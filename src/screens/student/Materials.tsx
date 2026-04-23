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

export default function StudentMaterials() {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-blue-600 w-7 h-7" />
            Study Materials
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Access your notes, diagrams, and video links</p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by title, subject or topic..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Materials List */}
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No materials found matching your search.</p>
            </div>
          ) : (
            filteredMaterials.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    m.type === 'pdf' ? 'bg-red-50 text-red-600 shadow-sm' :
                    (m.type === 'image' || m.type === 'camera') ? 'bg-blue-50 text-blue-600 shadow-sm' :
                    'bg-green-50 text-green-600 shadow-sm'
                  }`}>
                    {m.type === 'pdf' ? <FileText className="w-7 h-7" /> :
                     (m.type === 'image' || m.type === 'camera') ? <ImageIcon className="w-7 h-7" /> :
                     <LinkIcon className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{m.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {m.subject} • Unit {m.unit || 'N/A'} {m.topic ? `• ${m.topic}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setViewMaterial(m)}
                    className="p-2.5 text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-950 rounded-xl transition-all"
                    title="Quick View"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <a 
                    href={m.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    title="Open Link"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{viewMaterial.title}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  {viewMaterial.subject} • Unit {viewMaterial.unit} {viewMaterial.topic ? `• ${viewMaterial.topic}` : ''}
                </p>
              </div>
              <button 
                onClick={() => setViewMaterial(null)}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-auto flex items-center justify-center">
              {viewMaterial.type === 'pdf' ? (
                <iframe src={viewMaterial.url} className="w-full h-full border-none" title="Material View" />
              ) : (viewMaterial.type === 'image' || viewMaterial.type === 'camera') ? (
                <img src={viewMaterial.url} alt="Material" className="max-w-full max-h-full object-contain p-4" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-center p-12">
                  <LinkIcon className="w-20 h-20 text-blue-500 mx-auto mb-6 opacity-20" />
                  <p className="text-slate-500 mb-8 font-bold text-lg">External Link Content</p>
                  <a 
                    href={viewMaterial.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200/50"
                  >
                    Open Link <ExternalLink className="w-5 h-5 inline ml-2" />
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
