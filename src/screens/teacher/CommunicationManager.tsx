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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="text-blue-600 w-7 h-7" />
              Notice Board
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Post updates and announcements for students</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
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
              <div key={a.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-blue-200 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      a.type === 'urgent' ? 'bg-red-50 text-red-600' :
                      a.type === 'holiday' ? 'bg-orange-50 text-orange-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {a.type === 'urgent' ? <AlertTriangle className="w-5 h-5" /> :
                       a.type === 'holiday' ? <Palmtree className="w-5 h-5" /> :
                       <Info className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{a.title}</h3>
                      <p className="text-xs text-slate-400">
                        {new Date(a.createdAt).toLocaleDateString()} • {a.targetCourseId === 'all' ? 'All Courses' : `Course: ${courses.find(c => c.id === a.targetCourseId)?.name || 'Unknown'}`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteAnnouncement(a.id)}
                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-slate-600 leading-relaxed">{a.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Post New Announcement</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Exam Schedule Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Enter notice details here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                  >
                    <option value="normal">Normal Update</option>
                    <option value="urgent">Urgent Notice</option>
                    <option value="holiday">Holiday/Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Course</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                  >
                    <option value="all">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300"
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
