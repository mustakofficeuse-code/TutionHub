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
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-6 pb-24 pt-12 transition-colors font-sans">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-normal">
            <div className="w-12 h-12 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl flex items-center justify-center">
              <Megaphone className="text-wa-teal w-7 h-7" />
            </div>
            Bulletin Archive
          </h1>
          <p className="text-[#8696a0] font-semibold mt-1">Real-time transmissions from the tuition hub</p>
        </div>

        {/* Notices List */}
        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-10 h-10 text-wa-teal animate-spin" />
              </div>
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal">Intercepting Frequencies...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-[#202c33] rounded-3xl border border-slate-50 dark:border-white/5 shadow-sm">
              <Info className="w-12 h-12 text-[#8696a0]/20 mx-auto mb-4" />
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal leading-relaxed">No notices detected for your designated department</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {announcements.map((a) => (
                <div 
                  key={a.id} 
                  className={`bg-white dark:bg-[#202c33] p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border-l-8 transition-all hover:shadow-md hover:-translate-y-1 group ${
                    a.type === 'urgent' ? 'border-l-red-500' :
                    a.type === 'holiday' ? 'border-l-orange-500' :
                    'border-l-wa-teal'
                  } border-slate-50 dark:border-white/5 relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-5 sm:p-5 sm:p-6 opacity-5 group-hover:scale-110 transition-transform">
                     {a.type === 'urgent' ? <AlertTriangle className="w-24 h-24" /> :
                      a.type === 'holiday' ? <Palmtree className="w-24 h-24" /> :
                      <Megaphone className="w-24 h-24" />}
                  </div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                        a.type === 'urgent' ? 'bg-red-50 text-red-500' :
                        a.type === 'holiday' ? 'bg-orange-50 text-orange-500' :
                        'bg-wa-teal/5 text-wa-teal'
                      }`}>
                        {a.type === 'urgent' ? <AlertTriangle className="w-6 h-6" /> :
                         a.type === 'holiday' ? <Palmtree className="w-6 h-6" /> :
                         <Info className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-[#e9edef] text-xl tracking-normal mb-0.5">{a.title}</h3>
                        <div className="flex items-center gap-2">
                           <Clock className="w-3 h-3 text-[#8696a0]" />
                           <p className="text-xs text-[#8696a0] font-bold  tracking-normal">
                            {new Date(a.createdAt).toLocaleDateString('en-US', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {a.type === 'urgent' && (
                      <span className="bg-red-500 text-white text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full animate-pulse shadow-lg shadow-red-500/20">
                        Critical
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-[#8696a0] leading-relaxed text-sm font-medium relative z-10 opacity-90">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
