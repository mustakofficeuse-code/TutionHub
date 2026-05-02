import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendNotification } from '../../services/notificationService';
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
  X as XIcon,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function DoubtSection({ isEmbedded }: { isEmbedded?: boolean }) {
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

      await sendNotification({
        title: 'New Doubt Raised',
        message: `${profile.name} has raised a new doubt: "${title}".`,
        type: 'doubt_raised',
        senderId: profile.uid,
        senderName: profile.name,
        targetRole: 'teacher',
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
      
      if (profile.role === 'teacher') {
        await sendNotification({
          title: 'New Reply to Your Doubt',
          message: `Teacher ${profile.name} has replied to your doubt "${selectedDoubt.title}".`,
          type: 'doubt_reply',
          senderId: profile.uid,
          senderName: profile.name,
          recipientId: selectedDoubt.studentId,
        });
      }
      
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
    <div className={`fixed inset-0 bg-[#f0f2f5] dark:bg-[#0b141a] transition-colors flex ${isEmbedded ? 'top-0' : 'top-16 pb-0'}`}>
      <div className="flex-1 flex max-w-[1600px] mx-auto w-full overflow-hidden">
        
        {/* Left Sidebar: Contacts/Doubts List */}
        <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] flex flex-col ${selectedDoubt ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] flex justify-between items-center sm:hidden">
             <div className="w-10 h-10 bg-wa-teal rounded-full flex items-center justify-center text-white font-bold">
                {profile?.name?.charAt(0)}
             </div>
             <div className="flex gap-4">
                <button className="text-slate-500"><MessageCircle className="w-6 h-6" /></button>
                <button className="text-slate-500"><MoreVertical className="w-6 h-6" /></button>
             </div>
          </div>

          <div className="p-3">
             <div className="relative bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center px-3 py-1.5 focus-within:bg-white dark:focus-within:bg-white/10 transition-all">
                <Search className="text-slate-400 w-4 h-4 mr-3" />
                <input 
                  type="text" 
                  placeholder="Search or start new doubt"
                  className="bg-transparent border-none outline-none text-sm w-full text-slate-900 dark:text-white"
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-wa-teal animate-spin" />
                </div>
              ) : doubts.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm">No doubts posted yet.</p>
                </div>
              ) : (
                doubts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDoubt(d)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all border-b border-slate-50 dark:border-white/5 ${
                      selectedDoubt?.id === d.id ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                       <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 overflow-hidden">
                          {d.studentAvatar ? <img src={d.studentAvatar} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                       </div>
                       {d.status === 'resolved' && (
                         <div className="absolute -bottom-1 -right-1 bg-wa-green rounded-full p-0.5 ring-2 ring-white dark:ring-wa-header">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                         </div>
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className="font-bold text-slate-900 dark:text-[#e9edef] truncate text-base">{d.studentName}</h3>
                          <span className="text-[10px] text-slate-500 shrink-0">{new Date(d.createdAt).toLocaleDateString()}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <p className="text-sm text-slate-500 dark:text-[#8696a0] truncate flex-1">{d.title}</p>
                          {d.visibility === 'private' && <Shield className="w-3 h-3 text-purple-400 ml-1" />}
                       </div>
                    </div>
                  </button>
                ))
              )}
          </div>

          {profile?.role === 'student' && (
            <div className="p-4">
              <button 
                onClick={() => setShowAdd(true)}
                className="w-full bg-wa-teal hover:bg-wa-teal-dark text-white py-3 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" /> New Doubt
              </button>
            </div>
          )}
        </div>

        {/* Right Area: Conversation */}
        <div className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative ${!selectedDoubt ? 'hidden md:flex' : 'flex'}`}>
          {!selectedDoubt ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#f8f9fa] dark:bg-[#222e35] border-b-[6px] border-wa-teal">
              <div className="w-64 h-64 bg-slate-100 dark:bg-[#222e35] rounded-full flex items-center justify-center mb-8">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-32 h-32 opacity-20 grayscale" alt="" />
              </div>
              <h2 className="text-3xl font-light text-slate-800 dark:text-[#e9edef] mb-3">TutionHub Web</h2>
              <p className="text-[#8696a0] max-w-sm text-sm">
                Send and receive messages to resolve doubts. Use the list to select a conversation.
              </p>
              <div className="mt-auto text-[#8696a0] flex items-center gap-1 text-xs">
                <Shield className="w-3 h-3" /> End-to-end encrypted
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center gap-3 shrink-0 z-10 border-l border-slate-200 dark:border-slate-700">
                <button onClick={() => setSelectedDoubt(null)} className="md:hidden text-slate-500">
                   <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-[#e9edef] truncate">{selectedDoubt.studentName}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#8696a0] truncate">
                     {selectedDoubt.subject} • {selectedDoubt.status === 'resolved' ? 'Resolved' : 'Active'}
                  </p>
                </div>
                <div className="flex gap-4 text-slate-500">
                   <button onClick={() => toggleStatus(selectedDoubt.id, selectedDoubt.status)} className={`${selectedDoubt.status === 'resolved' ? 'text-wa-green' : ''}`}>
                      <CheckCircle2 className="w-6 h-6" />
                   </button>
                   {(profile?.role === 'teacher' || profile?.uid === selectedDoubt.studentId) && (
                      <button onClick={() => deleteDoubt(selectedDoubt.id)} className="hover:text-red-500">
                         <Trash2 className="w-6 h-6" />
                      </button>
                   )}
                   <button><MoreVertical className="w-6 h-6" /></button>
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 custom-scrollbar bg-chat-pattern">
                 {/* Original Doubt Message as a bubble */}
                 <div className="flex justify-start mb-8">
                    <div className="max-w-[85%] sm:max-w-[70%] bg-white dark:bg-[#202c33] p-4 rounded-xl rounded-tl-none shadow-sm relative">
                       <div className="absolute -left-2 top-0 w-0 h-0 border-[10px] border-transparent border-t-white dark:border-t-[#202c33]"></div>
                       <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-wa-teal dark:text-wa-green uppercase">{selectedDoubt.subject}</span>
                       </div>
                       <h4 className="font-bold text-slate-900 dark:text-white mb-2">{selectedDoubt.title}</h4>
                       <p className="text-sm text-slate-700 dark:text-[#d1d7db] whitespace-pre-wrap leading-relaxed">{selectedDoubt.content}</p>
                       
                       {selectedDoubt.attachmentUrl && (
                          <div className="mt-3 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#111b21] p-1 border border-slate-200 dark:border-white/10">
                             {selectedDoubt.attachmentType?.startsWith('image/') ? (
                               <img 
                                 src={selectedDoubt.attachmentUrl} 
                                 alt="" 
                                 className="w-full max-h-[300px] object-contain cursor-zoom-in"
                                 onClick={() => setViewMaterial({ url: selectedDoubt.attachmentUrl, title: selectedDoubt.attachmentName, type: 'image' })}
                               />
                             ) : (
                               <button 
                                 onClick={() => setViewMaterial({ url: selectedDoubt.attachmentUrl, title: selectedDoubt.attachmentName, type: 'pdf' })}
                                 className="p-3 w-full flex items-center gap-3 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
                               >
                                  <FileText className="w-8 h-8 text-wa-teal" />
                                  <span className="text-xs truncate font-medium">{selectedDoubt.attachmentName}</span>
                               </button>
                             )}
                          </div>
                       )}

                       <div className="flex justify-end mt-2">
                          <span className="text-[10px] text-slate-400">{new Date(selectedDoubt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                    </div>
                 </div>

                 {/* Replies */}
                 {replies.filter(r => r.doubtId === selectedDoubt.id).map((r) => {
                    const isOwn = r.userUid === profile?.uid;
                    return (
                      <div key={r.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] sm:max-w-[70%] p-3 px-4 rounded-xl shadow-sm relative ${
                           isOwn ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'
                         }`}>
                            {/* Tail */}
                            <div className={`absolute top-0 w-0 h-0 border-[10px] border-transparent ${
                               isOwn 
                                 ? '-right-2 border-t-[#dcf8c6] dark:border-t-[#005c4b]' 
                                 : '-left-2 border-t-white dark:border-t-[#202c33]'
                            }`}></div>

                            {!isOwn && (
                               <p className="text-[10px] font-black text-wa-teal dark:text-wa-green mb-1">{r.userName}</p>
                            )}

                            <p className={`text-sm leading-relaxed ${isOwn ? 'text-slate-900 dark:text-[#e9edef]' : 'text-slate-700 dark:text-[#d1d7db]'}`}>
                               {r.content}
                            </p>

                            {r.attachmentUrl && (
                               <div className="mt-2 rounded-lg bg-black/5 p-1">
                                  {r.attachmentType.startsWith('image/') ? (
                                    <img 
                                      src={r.attachmentUrl} 
                                      alt="" 
                                      className="w-full max-h-48 object-contain rounded cursor-pointer"
                                      onClick={() => setViewMaterial({ url: r.attachmentUrl, title: r.attachmentName, type: 'image' })}
                                    />
                                  ) : (
                                    <button 
                                      onClick={() => setViewMaterial({ url: r.attachmentUrl, title: r.attachmentName, type: 'pdf' })}
                                      className="flex items-center gap-2 p-2 w-full text-left"
                                    >
                                       <Paperclip className="w-5 h-5 opacity-50" />
                                       <span className="text-[10px] truncate">{r.attachmentName}</span>
                                    </button>
                                  )}
                               </div>
                            )}

                            <div className="flex justify-end items-center gap-1 mt-1 opacity-50">
                               <span className="text-[9px] uppercase">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               {isOwn && <CheckCircle2 className="w-2.5 h-2.5" />}
                            </div>
                         </div>
                      </div>
                    );
                 })}
              </div>

              {/* Chat Input */}
              <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex items-center gap-3 shrink-0">
                 <button className="text-slate-500 hover:text-wa-teal transition-colors">
                    <ImageIcon className="w-6 h-6" />
                 </button>
                 <label className="text-slate-500 hover:text-wa-teal transition-colors cursor-pointer">
                    <Paperclip className="w-6 h-6" />
                    <input type="file" className="hidden" onChange={(e) => setReplyFile(e.target.files?.[0] || null)} />
                 </label>
                 
                 <div className="flex-1 relative">
                    <form onSubmit={handleAddReply} className="flex gap-2">
                       <div className="flex-1 relative group">
                          {replyFile && (
                             <div className="absolute -top-12 left-0 right-0 bg-white dark:bg-[#202c33] p-2 rounded-t-xl border-t border-x border-slate-200 dark:border-white/10 flex justify-between items-center shadow-lg">
                                <div className="flex items-center gap-2 text-xs text-wa-teal truncate px-2">
                                   <Paperclip className="w-3 h-3" /> {replyFile.name}
                                </div>
                                <button onClick={() => setReplyFile(null)} className="text-slate-400 hover:text-red-500"><XIcon className="w-4 h-4" /></button>
                             </div>
                          )}
                          <input 
                            type="text" 
                            placeholder="Type a message"
                            className="w-full py-2.5 px-4 bg-white dark:bg-[#2a3942] border-none rounded-full outline-none text-sm text-slate-800 dark:text-[#e9edef] placeholder:text-[#8696a0]"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                       </div>
                       <button 
                         type="submit"
                         disabled={submitting || (!replyText && !replyFile)}
                         className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0 ${
                           (!replyText && !replyFile) ? 'text-slate-500' : 'bg-wa-teal text-white shadow-md active:scale-90'
                         }`}
                       >
                         <Send className="w-5 h-5 ml-0.5" />
                       </button>
                    </form>
                 </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Viewer Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="w-full h-full flex flex-col relative">
             <div className="h-16 flex items-center justify-between px-6 bg-black/20 text-white">
                <span className="font-bold truncate">{viewMaterial.title}</span>
                <button 
                  onClick={() => setViewMaterial(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-all"
                >
                  <XIcon className="w-8 h-8" />
                </button>
             </div>
             <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
                {viewMaterial.type === 'pdf' ? (
                  <iframe src={viewMaterial.url} className="w-full max-w-5xl h-full border-none rounded-lg" />
                ) : (
                  <img src={viewMaterial.url} className="max-w-full max-h-full object-contain shadow-2xl" />
                )}
             </div>
          </div>
        </div>
      )}

      {/* Add Doubt Modal (Student only) */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[300]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white dark:bg-[#202c33] rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-wa-teal dark:text-wa-green">New Doubt</h3>
                <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddDoubt} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Subject</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-wa-teal transition-all"
                        placeholder="e.g. Java"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                   </div>
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Visibility</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-wa-teal transition-all"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Title</label>
                   <input
                     type="text"
                     required
                     className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-wa-teal transition-all"
                     placeholder="Summary of the issue"
                     value={title}
                     onChange={(e) => setTitle(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Explanation</label>
                   <textarea
                     rows={4}
                     required
                     className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-wa-teal transition-all resize-none"
                     placeholder="Describe in detail..."
                     value={content}
                     onChange={(e) => setContent(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Attachment</label>
                   <label className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl cursor-pointer hover:bg-wa-teal/5 transition-all">
                      <Paperclip className="w-5 h-5 text-wa-teal" />
                      <span className="text-xs font-bold text-slate-500 truncate max-w-[200px]">
                         {selectedFile ? selectedFile.name : "Attach a file"}
                      </span>
                      <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                   </label>
                </div>
                
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-wa-teal text-white font-black rounded-2xl hover:bg-wa-teal-dark transition-all disabled:opacity-50 shadow-xl overflow-hidden relative"
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Post to Tutor'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
