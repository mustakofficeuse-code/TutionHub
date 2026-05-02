import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  Palmtree
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CommunicationManager() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'normal' | 'urgent' | 'holiday'>('normal');
  const [targetCourseId, setTargetCourseId] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    fetchCourses();
    return () => unsubscribe();
  }, []);

  const fetchCourses = async () => {
    const querySnapshot = await getDocs(collection(db, 'courses'));
    setCourses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        content,
        type,
        targetCourseId,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setTitle('');
      setContent('');
      setType('normal');
      setTargetCourseId('all');
    } catch (error) {
      console.error("Error adding announcement:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      console.error("Error deleting announcement:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] p-6 sm:p-10 pb-32 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-3 text-slate-500 dark:text-slate-400 font-black hover:text-wa-teal transition-all uppercase tracking-[0.2em] text-[11px] group"
      >
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#202c33] flex items-center justify-center shadow-sm group-hover:bg-wa-teal group-hover:text-white transition-all border border-slate-100 dark:border-white/5 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Back to Dashboard
      </button>

      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse" />
              <span className="text-[11px] font-black text-wa-teal uppercase tracking-[0.4em]">Broadcasting Hub</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tracking-tighter uppercase leading-none italic">
              NOTICE BOARD
            </h1>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-1">Deploy mission updates and announcements to all units</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="w-full sm:w-auto bg-wa-teal hover:bg-wa-teal/90 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-wa-teal/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Post Notice
          </button>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No announcements yet.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="bg-white dark:bg-[#202c33] p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 hover:border-wa-teal transition-all duration-500 hover:-translate-y-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl shadow-inner ${
                      a.type === 'urgent' ? 'bg-red-500/10 text-red-500' :
                      a.type === 'holiday' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-wa-teal/10 text-wa-teal'
                    }`}>
                      {a.type === 'urgent' ? <AlertTriangle className="w-6 h-6" /> :
                       a.type === 'holiday' ? <Palmtree className="w-6 h-6" /> :
                       <Info className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-slate-800 dark:text-white uppercase italic tracking-tight">{a.title}</h3>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                        {new Date(a.createdAt).toLocaleDateString()} <span className="text-slate-200 dark:text-slate-700 mx-2">|</span> {a.targetCourseId === 'all' ? 'ALL UNITS' : `SECTOR: ${courses.find(c => c.id === a.targetCourseId)?.name || 'UNKNOWN'}`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteAnnouncement(a.id)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-bold text-sm sm:text-base border-t border-slate-50 dark:border-white/5 pt-6">{a.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-8 uppercase italic tracking-tight">Post New Announcement</h3>
            <form onSubmit={handleAdd} className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-6 py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-black text-slate-800 dark:text-white transition-all outline-none"
                  placeholder="Exam Schedule Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Content</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-6 py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-black text-slate-800 dark:text-white transition-all outline-none resize-none"
                  placeholder="Enter notice details here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Type</label>
                  <select
                    className="w-full px-6 py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-black text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                  >
                    <option value="normal">NORMAL UPDATE</option>
                    <option value="urgent">URGENT NOTICE</option>
                    <option value="holiday">HOLIDAY/LEAVE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Target Course</label>
                  <select
                    className="w-full px-6 py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-black text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                  >
                    <option value="all">ALL COURSES</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-5 text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 dark:hover:bg-[#111b21] rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-5 bg-wa-teal text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[1.5rem] hover:bg-wa-teal/90 transition-all shadow-xl shadow-wa-teal/20 disabled:bg-slate-300 dark:disabled:bg-[#111b21]"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
