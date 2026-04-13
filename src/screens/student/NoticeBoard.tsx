import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Megaphone, 
  AlertTriangle, 
  Info, 
  Palmtree,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NoticeBoard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Filter for student's course or 'all'
      const filtered = allNotices.filter(a => 
        a.targetCourseId === 'all' || a.targetCourseId === profile?.courseId
      );
      setAnnouncements(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.courseId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="text-blue-600 w-7 h-7" />
            Notice Board
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Stay updated with the latest class news</p>
        </div>

        {/* Notices List */}
        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No announcements for your course yet.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div 
                key={a.id} 
                className={`bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border-l-4 transition-all hover:shadow-md ${
                  a.type === 'urgent' ? 'border-l-red-500' :
                  a.type === 'holiday' ? 'border-l-orange-500' :
                  'border-l-blue-500'
                }`}
              >
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
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">{a.title}</h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {new Date(a.createdAt).toLocaleDateString('en-US', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  {a.type === 'urgent' && (
                    <span className="bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{a.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
