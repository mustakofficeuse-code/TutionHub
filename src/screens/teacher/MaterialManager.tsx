import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { 
  BookOpen, 
  Plus, 
  FileText, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Trash2, 
  ArrowLeft,
  Loader2,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function MaterialManager() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'pdf' | 'link' | 'image'>('pdf');
  const [url, setUrl] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchMaterials();
    fetchCourses();
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

  const fetchCourses = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'courses'));
      setCourses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      await addDoc(collection(db, 'materials'), {
        title,
        type: 'link', // Force link type for lightweight mode
        url,
        courseId,
        semester,
        subject,
        chapter,
        createdAt: new Date().toISOString()
      });

      setShowAdd(false);
      resetForm();
      fetchMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setType('pdf');
    setUrl('');
    setCourseId('');
    setSemester('');
    setSubject('');
    setChapter('');
    setFile(null);
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    try {
      await deleteDoc(doc(db, 'materials', id));
      fetchMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
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

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="text-blue-600 w-7 h-7" />
              Study Materials
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Upload and organize notes for students</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Material
          </button>
        </div>

        {/* Materials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : materials.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No materials uploaded yet.</p>
            </div>
          ) : (
            materials.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden group hover:border-blue-200 transition-all">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl ${
                      m.type === 'pdf' ? 'bg-red-50 text-red-600' :
                      m.type === 'image' ? 'bg-blue-50 text-blue-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {m.type === 'pdf' ? <FileText className="w-6 h-6" /> :
                       m.type === 'image' ? <ImageIcon className="w-6 h-6" /> :
                       <LinkIcon className="w-6 h-6" />}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedMaterial(m)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View QR"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => deleteMaterial(m.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-1">{m.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                      {m.subject} • {courses.find(c => c.id === m.courseId)?.name || 'All Courses'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-xs text-slate-400">Ch. {m.chapter || 'N/A'}</span>
                    <a 
                      href={m.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Add Study Material</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Introduction to Java"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Course</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                  >
                    <option value="">Select Course</option>
                    <option value="all">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="">Select</option>
                    {[1,2,3,4,5,6].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Java"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="01"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                  />
                </div>
              </div>

              {type === 'link' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                  <input
                    type="url"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://youtube.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload File</label>
                  <input
                    type="file"
                    required
                    accept={type === 'pdf' ? '.pdf' : 'image/*'}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}

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
                  disabled={uploading}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Material QR Code</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{selectedMaterial.title}</p>
            
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 inline-block mb-6">
              <QRCodeSVG value={selectedMaterial.url} size={200} />
            </div>

            <p className="text-xs text-slate-400 mb-6">Students can scan this to open the material directly.</p>

            <button 
              onClick={() => setSelectedMaterial(null)}
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
