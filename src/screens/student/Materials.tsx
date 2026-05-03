import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  FileText, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Eye,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudentMaterials({ isEmbedded }: { isEmbedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMaterial, setViewMaterial] = useState<any>(null);

  useEffect(() => {
    // Real-time listener
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to materials:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                         m.subject.toLowerCase().includes(search.toLowerCase()) ||
                         (m.topic && m.topic.toLowerCase().includes(search.toLowerCase()));
    
    // If courseId is 'all', all students see it. Otherwise, must match profile.courseId
    // If the student is a "legacy" student who auto-migrated, they might not have a correct courseId yet.
    const isTargetedCourse = m.courseId === 'all' || m.courseId === profile?.courseId || profile?.courseId === 'legacy';
    
    // Semester match (strictly match student's own semester unless they are legacy)
    const matchesSem = profile?.semester && profile?.courseId !== 'legacy' ? m.semester.toString() === profile.semester.toString() : true;

    return matchesSearch && matchesSem && isTargetedCourse;
  });

  return (
    <div className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-6 ${isEmbedded ? '' : 'pb-24 pt-12'}`}>
      {!isEmbedded && (
        <button 
          onClick={() => navigate('/')}
          className="mb-4 sm:mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      )}

      <div className="max-w-4xl mx-auto space-y-2 sm:space-y-4 sm:space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-normal">
              <div className="w-12 h-12 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl flex items-center justify-center">
                <BookOpen className="text-wa-teal w-7 h-7" />
              </div>
              Study Hub
            </h1>
            <p className="text-[#8696a0] font-semibold mt-1">Curated academic resources for your success</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696a0] w-5 h-5 group-focus-within:text-wa-teal transition-colors" />
            <input 
              type="text" 
              placeholder="Search by title, subject or topic..."
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#202c33] border-2 border-transparent focus:border-wa-teal rounded-2xl shadow-sm outline-none transition-all text-slate-900 dark:text-[#e9edef] font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Materials List */}
        <div className="space-y-2 sm:space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-[#8696a0]  tracking-normal">Latest Updates</h2>
            <span className="text-xs font-bold text-wa-teal bg-wa-teal/10 px-3 py-1 rounded-full  tracking-normal">{filteredMaterials.length} Items</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-wa-teal animate-spin" />
                </div>
                <p className="text-[#8696a0] font-bold  tracking-normal text-xs">Loading Hub...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-[#202c33] rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="w-20 h-20 bg-[#f0f2f5] dark:bg-[#111b21] rounded-full flex items-center justify-center mx-auto mb-4">
                   <BookOpen className="w-10 h-10 text-[#8696a0]/20" />
                </div>
                <p className="text-[#8696a0] font-bold  tracking-normal text-xs">No resources found matching your search</p>
              </div>
            ) : (
              filteredMaterials.map((m) => (
                <div key={m.id} className="bg-white dark:bg-[#202c33] p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 flex items-center justify-between group hover:border-wa-teal/30 transition-all">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                      m.type === 'pdf' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                      (m.type === 'image' || m.type === 'camera') ? 'bg-wa-teal/10 dark:bg-wa-teal/20 text-wa-teal' :
                      'bg-wa-green/10 dark:bg-wa-green/20 text-wa-green'
                    }`}>
                      {m.type === 'pdf' ? <FileText className="w-7 h-7" /> :
                       (m.type === 'image' || m.type === 'camera') ? <ImageIcon className="w-7 h-7" /> :
                       <LinkIcon className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-[#e9edef] group-hover:text-wa-teal transition-colors tracking-normal text-lg">{m.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-wa-teal  tracking-normal bg-wa-teal/10 px-2 py-0.5 rounded-md">{m.subject}</span>
                        <div className="w-1 h-1 rounded-full bg-[#8696a0]/30" />
                        <span className="text-xs font-bold text-[#8696a0]  tracking-normal">Unit {m.unit || 'N/A'}</span>
                        {m.topic && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-[#8696a0]/30" />
                            <span className="text-xs italic font-bold text-[#8696a0] tracking-wide truncate max-w-[150px]">{m.topic}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewMaterial(m)}
                      className="w-12 h-12 flex items-center justify-center text-[#8696a0] hover:text-wa-teal hover:bg-wa-teal/10 rounded-2xl transition-all"
                      title="Quick View"
                    >
                      <Eye className="w-6 h-6" />
                    </button>
                    <a 
                      href={m.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-12 h-12 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl text-[#8696a0] hover:bg-wa-teal hover:text-white transition-all shadow-sm border border-slate-100 dark:border-white/5"
                      title="Download / Open"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-[#202c33]">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-xl flex items-center justify-center">
                    <BookOpen className="text-wa-teal w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900 dark:text-[#e9edef] tracking-normal text-xl">{viewMaterial.title}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-wa-teal font-bold  tracking-normal bg-wa-teal/10 px-2 py-0.5 rounded-md">{viewMaterial.subject}</span>
                       <span className="text-xs text-[#8696a0] font-bold  tracking-normal">• Unit {viewMaterial.unit}</span>
                    </div>
                 </div>
              </div>
              <button 
                onClick={() => setViewMaterial(null)}
                className="w-10 h-10 flex items-center justify-center bg-[#f0f2f5] dark:bg-slate-800 rounded-full text-[#8696a0] hover:bg-red-500 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-[#f0f2f5] dark:bg-[#0b141a] overflow-auto flex items-center justify-center relative">
              {viewMaterial.type === 'pdf' ? (
                <iframe src={viewMaterial.url} className="w-full h-full border-none" title="Material View" />
              ) : (viewMaterial.type === 'image' || viewMaterial.type === 'camera') ? (
                <img src={viewMaterial.url} alt="Material" className="max-w-full max-h-full object-contain p-4 sm:p-5 sm:p-5 sm:p-6 shadow-2xl rounded-2xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-center p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 bg-white dark:bg-[#202c33] rounded-3xl shadow-2xl max-w-md mx-4 border border-slate-100 dark:border-white/5">
                  <div className="w-24 h-24 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-8">
                     <LinkIcon className="w-12 h-12 text-wa-teal" />
                  </div>
                  <h4 className="text-[#8696a0] mb-4 sm:mb-8 font-bold  tracking-normal text-xs">External Resource Archive</h4>
                  <a 
                    href={viewMaterial.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 sm:py-5 bg-wa-teal text-white rounded-2xl font-bold  tracking-normal text-xs shadow-xl shadow-wa-teal/30 hover:bg-wa-teal/90 transition-all flex items-center justify-center gap-3"
                  >
                    Open Resource Hub <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
