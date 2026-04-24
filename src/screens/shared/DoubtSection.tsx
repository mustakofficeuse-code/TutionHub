import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  Loader2,
  User,
  Send,
  MoreVertical,
  Trash2,
  MessageCircle,
  Paperclip,
  File,
  FileText,
  Image as ImageIcon,
  X as XIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function DoubtSection() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [doubts, setDoubts] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDoubt, setSelectedDoubt] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  const [viewMaterial, setViewMaterial] = useState<any>(null);

  const uploadFile = async (file: File) => {
    // 10MB Limit for Cloudinary Free Tier
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File size too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB. Please use a smaller file or compress it.`);
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const fileName = `doubts/${Date.now()}_${file.name}`;
          const response = await fetch('/api/upload-capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64,
              fileName,
              contentType: file.type
            })
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Upload failed');
          }

          const { url } = await response.json();
          resolve(url);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  useEffect(() => {
    if (!profile) return;

    // Fetch doubts: Teachers see all, students see their own + public doubts for their department
    const doubtsRef = collection(db, 'doubts');
    const q = query(doubtsRef, orderBy('createdAt', 'desc'));

    const unsubscribeDoubts = onSnapshot(q, (snapshot) => {
      let fetchedDoubts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Client-side filtering for students to respect visibility and department
      if (profile.role === 'student') {
        const studentDept = profile.courseId || profile.courseName || profile.department || '';
        fetchedDoubts = fetchedDoubts.filter((d: any) => 
          d.department === studentDept && (d.studentId === profile.uid || d.visibility === 'public')
        );
      }
      
      setDoubts(fetchedDoubts);
      setLoading(false);
    });

    const unsubscribeReplies = onSnapshot(query(collection(db, 'replies'), orderBy('createdAt', 'asc')), (snapshot) => {
      setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeDoubts();
      unsubscribeReplies();
    };
  }, [profile]);

  const handleAddDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setUploadProgress(selectedFile ? 'Uploading file...' : '');
    try {
      let fileUrl = '';
      if (selectedFile) {
        fileUrl = await uploadFile(selectedFile);
      }

      await addDoc(collection(db, 'doubts'), {
        studentId: profile.uid,
        studentName: profile.name,
        department: profile.courseId || 'unknown',
        semester: profile.semester || 'unknown',
        subject,
        title,
        content,
        visibility,
        attachmentUrl: fileUrl,
        attachmentName: selectedFile?.name || '',
        attachmentType: selectedFile?.type || '',
        status: 'open',
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setTitle('');
      setContent('');
      setSubject('');
      setVisibility('public');
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error adding doubt:", error);
      alert(error.message || "Failed to add doubt");
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText && !replyFile) || !selectedDoubt || !profile) return;

    setSubmitting(true);
    try {
      let fileUrl = '';
      if (replyFile) {
        fileUrl = await uploadFile(replyFile);
      }

      await addDoc(collection(db, 'replies'), {
        doubtId: selectedDoubt.id,
        userUid: profile.uid,
        userName: profile.name,
        userRole: profile.role,
        content: replyText,
        attachmentUrl: fileUrl,
        attachmentName: replyFile?.name || '',
        attachmentType: replyFile?.type || '',
        createdAt: new Date().toISOString()
      });
      setReplyText('');
      setReplyFile(null);
    } catch (error: any) {
      console.error("Error adding reply:", error);
      alert(error.message || "Failed to add reply");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (doubtId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'doubts', doubtId), {
        status: currentStatus === 'open' ? 'resolved' : 'open'
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteDoubt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doubt?')) return;
    try {
      await deleteDoc(doc(db, 'doubts', id));
      if (selectedDoubt?.id === id) setSelectedDoubt(null);
    } catch (error) {
      console.error("Error deleting doubt:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24 transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          {profile?.role === 'student' && (
            <button 
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 dark:shadow-none transition-all"
            >
              <Plus className="w-5 h-5" /> Ask a Doubt
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Doubts List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search doubts..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              ) : doubts.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No doubts posted yet.</p>
                </div>
              ) : (
                doubts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDoubt(d)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedDoubt?.id === d.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm' 
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        d.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                      }`}>
                        {d.status}
                      </span>
                      {d.visibility === 'private' && (
                        <span className="px-2 py-0.5 ml-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                          Private
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-auto">{d.subject} • Sem {d.semester || 'N/A'}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">{d.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{d.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {d.studentName} {profile?.role === 'teacher' ? `(${d.department?.toUpperCase()})` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Discussion Area */}
          <div className="lg:col-span-2">
            {selectedDoubt ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[calc(100vh-200px)]">
                {/* Doubt Header */}
                <div className="p-6 border-b border-slate-50 dark:border-slate-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          selectedDoubt.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                        }`}>
                          {selectedDoubt.status}
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                          {selectedDoubt.subject}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedDoubt.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {profile?.role === 'teacher' && (
                        <button 
                          onClick={() => toggleStatus(selectedDoubt.id, selectedDoubt.status)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-all"
                          title="Mark as Resolved"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                      {(profile?.role === 'teacher' || profile?.uid === selectedDoubt.studentId) && (
                        <button 
                          onClick={() => deleteDoubt(selectedDoubt.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap">{selectedDoubt.content}</p>
                  
                  {selectedDoubt.attachmentUrl && (
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 inline-block">
                      {selectedDoubt.attachmentType.startsWith('image/') ? (
                        <div className="space-y-2">
                          <img 
                            src={selectedDoubt.attachmentUrl} 
                            alt="Attachment" 
                            className="max-w-full h-auto rounded-xl max-h-64 object-contain shadow-sm cursor-pointer"
                            onClick={() => setViewMaterial({ url: selectedDoubt.attachmentUrl, title: selectedDoubt.attachmentName, type: 'image' })}
                          />
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
                            {selectedDoubt.attachmentName}
                          </p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setViewMaterial({ url: selectedDoubt.attachmentUrl, title: selectedDoubt.attachmentName, type: 'pdf' })}
                          className="flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="w-5 h-5" />
                          <span className="text-sm font-medium">{selectedDoubt.attachmentName || 'View Attachment'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="font-bold text-slate-600 dark:text-slate-400">{selectedDoubt.studentName}</span>
                    </div>
                    <span>•</span>
                    <span>{new Date(selectedDoubt.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Replies Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                  {replies.filter(r => r.doubtId === selectedDoubt.id).length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                      <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">No replies yet. Start the discussion!</p>
                    </div>
                  ) : (
                    replies.filter(r => r.doubtId === selectedDoubt.id).map((r) => (
                      <div key={r.id} className={`flex gap-3 ${r.userUid === profile?.uid ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          r.userRole === 'teacher' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className={`max-w-[80%] space-y-1 ${r.userUid === profile?.uid ? 'items-end' : ''}`}>
                          <div className={`flex items-center gap-2 mb-1 ${r.userUid === profile?.uid ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[10px] font-bold text-slate-900 dark:text-white">{r.userName}</span>
                            {r.userRole === 'teacher' && (
                              <span className="text-[8px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 rounded font-black uppercase">Teacher</span>
                            )}
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 dark:text-slate-400">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`p-3 rounded-2xl text-sm ${
                            r.userUid === profile?.uid 
                              ? 'bg-blue-600 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none shadow-sm'
                          }`}>
                            {r.content}
                            {r.attachmentUrl && (
                              <div className={`mt-2 ${r.userUid === profile?.uid ? 'border-white/20' : 'border-slate-100 dark:border-slate-700'} border-t pt-2`}>
                                {r.attachmentType.startsWith('image/') ? (
                                  <img 
                                    src={r.attachmentUrl} 
                                    alt="Reply Attachment" 
                                    className="max-w-full h-auto rounded-lg max-h-48 object-contain cursor-pointer"
                                    onClick={() => setViewMaterial({ url: r.attachmentUrl, title: r.attachmentName, type: 'image' })}
                                  />
                                ) : (
                                  <button 
                                    onClick={() => setViewMaterial({ url: r.attachmentUrl, title: r.attachmentName, type: 'pdf' })}
                                    className={`flex items-center gap-2 text-xs hover:underline ${r.userUid === profile?.uid ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}
                                  >
                                    <Paperclip className="w-4 h-4" />
                                    <span className="truncate max-w-[150px]">{r.attachmentName || 'Attachment'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Input */}
                <div className="p-4 border-t border-slate-50 dark:border-slate-800">
                  {replyFile && (
                    <div className="mb-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2 overflow-hidden text-blue-600 dark:text-blue-400">
                        <Paperclip className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs font-bold truncate">{replyFile.name}</span>
                      </div>
                      <button 
                        onClick={() => setReplyFile(null)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-400"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleAddReply} className="flex gap-2">
                    <label className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-all">
                      <Paperclip className="w-5 h-5" />
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <input 
                      type="text" 
                      placeholder="Type your reply..."
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={submitting || (!replyText && !replyFile)}
                      className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Select a Doubt</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Choose a doubt from the list to view the discussion or provide a solution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewer Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setViewMaterial(null)}
              className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-all z-10"
            >
              <XIcon className="w-6 h-6 text-slate-700 dark:text-slate-300" />
            </button>
            
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-1">{viewMaterial.title || 'Attachment View'}</h2>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
              {viewMaterial.type === 'pdf' ? (
                <iframe 
                  src={viewMaterial.url} 
                  className="w-full h-full border-none" 
                  title="PDF Viewer"
                />
              ) : (
                <img 
                  src={viewMaterial.url} 
                  alt="Full View" 
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-right">
              <a 
                href={viewMaterial.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add Doubt Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Ask a Doubt</h3>
              <form onSubmit={handleAddDoubt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Java, Python, Math"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Brief summary of your doubt"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={4}
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                    placeholder="Explain your doubt in detail..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Who can see this?</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                  >
                    <option value="public">Everyone (Students & Teacher can help)</option>
                    <option value="private">Only Teacher (Private discussion)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Attachment (Optional)</label>
                  <label className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group">
                    {selectedFile ? (
                      <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                        {selectedFile.type.startsWith('image/') ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        <span className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                        <button 
                          onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Paperclip className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-sm font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Attach Photo or Document</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-2">Max size: 10MB (PDF, PNG, JPG, JPEG)</p>
                </div>
                {uploadProgress && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> {uploadProgress}
                  </div>
                )}
                <div className="flex gap-3 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Post Doubt'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
