import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
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
  BookmarkCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudentMaterials() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSem, setFilterSem] = useState(profile?.semester || '');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'materials'));
      setMaterials(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                         m.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSem = filterSem ? m.semester.toString() === filterSem.toString() : true;
    const matchesCourse = m.courseId === 'all' || m.courseId === profile?.courseId;
    return matchesSearch && matchesSem && matchesCourse;
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

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by title or subject..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-600"
            value={filterSem}
            onChange={(e) => setFilterSem(e.target.value)}
          >
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>

        {/* Materials List */}
        <div className="space-y-4">
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
              <div key={m.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    m.type === 'pdf' ? 'bg-red-50 text-red-600' :
                    m.type === 'image' ? 'bg-blue-50 text-blue-600' :
                    'bg-green-50 text-green-600'
                  }`}>
                    {m.type === 'pdf' ? <FileText className="w-7 h-7" /> :
                     m.type === 'image' ? <ImageIcon className="w-7 h-7" /> :
                     <LinkIcon className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{m.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      {m.subject} • Ch. {m.chapter || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <a 
                    href={m.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
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
  );
}
