import React, { useState, useEffect, useRef } from 'react';
import { collection, query, addDoc, deleteDoc, doc, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../firebase';
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
  QrCode,
  Eye,
  Camera,
  Video,
  X,
  Upload,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const ROMAN_UNITS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

export default function MaterialManager() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [viewMaterial, setViewMaterial] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'pdf' | 'link' | 'image' | 'camera'>('pdf');
  const [links, setLinks] = useState<string[]>(['']);
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [captures, setCaptures] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    // Real-time materials listener
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsubscribeMaterials = onSnapshot(q, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to materials:", error);
      setLoading(false);
    });

    // Real-time departments listener
    const unsubscribeDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeMaterials();
      unsubscribeDepts();
      if (cameraStream) stopCamera();
    };
  }, []);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    console.error(`Firestore ${operation} error at ${path}:`, error);
    if (error.code === 'permission-denied') {
      alert(`Permission Denied: You do not have permission to ${operation} this material. Please ensure you are logged in as a teacher.`);
    } else {
      alert(`Error ${operation}ing material: ${error.message || 'Unknown error'}`);
    }
  };

  const addLinkField = () => setLinks([...links, '']);
  const updateLink = (index: number, val: string) => {
    const newLinks = [...links];
    newLinks[index] = val;
    setLinks(newLinks);
  };
  const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCaptures(prev => [...prev, dataUrl]);
      }
    }
  };

  const removeCapture = (index: number) => {
    setCaptures(prev => prev.filter((_, i) => i !== index));
  };

  function snapshotDocs(docs: any[]) {
    return docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    
    if (!title || !courseId || !semester || !subject) {
      alert("Please fill in all required fields (Title, Target Course, Semester, Subject).");
      return;
    }

    setUploading(true);
    setUploadStatus('Starting upload...');
    try {
      if (!auth.currentUser) {
        throw new Error("You must be logged in to upload materials.");
      }

      const uploadTasks: Promise<any>[] = [];

      if (type === 'link') {
        const validLinks = links.filter(l => l.trim());
        if (validLinks.length === 0) throw new Error("Please enter at least one valid link.");
        
        setUploadStatus(`Saving ${validLinks.length} link(s)...`);
        validLinks.forEach((link, idx) => {
          uploadTasks.push(
            addDoc(collection(db, 'materials'), {
              title: validLinks.length > 1 ? `${title} (Resource ${idx + 1})` : title,
              type: 'link', 
              url: link.trim(), 
              courseId, 
              semester, 
              subject, 
              unit, 
              topic,
              createdAt: new Date().toISOString()
            }).catch(err => {
              handleFirestoreError(err, 'create', 'materials');
              throw err;
            })
          );
        });
      } else if (type === 'pdf' || type === 'image') {
        if (files.length === 0) throw new Error(`Please select at least one ${type.toUpperCase()} file.`);
        
        // Check for 10MB limit (Cloudinary free tier limit)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
        if (oversizedFiles.length > 0) {
          throw new Error(`File "${oversizedFiles[0].name}" is too large (>${Math.round(oversizedFiles[0].size/1024/1024)}MB). The maximum file size is 10MB.`);
        }

        setUploadStatus(`Processing ${files.length} file(s)...`);
        files.forEach((file) => {
          const task = (async () => {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
            
            const base64 = await base64Promise;
            const uniqueId = Math.random().toString(36).substring(7);
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const fileName = `materials/${Date.now()}_${uniqueId}_${sanitizedName}`;

            setUploadStatus(`Uploading ${file.name} via secure bridge...`);
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
              const errData = await response.json();
              throw new Error(errData.error || `Server failed to upload ${file.name}`);
            }

            const { url } = await response.json();
            
            setUploadStatus(`Saving material info for ${file.name}...`);
            return await addDoc(collection(db, 'materials'), {
              title: files.length > 1 ? `${title} (${file.name})` : title,
              type: file.type.includes('pdf') ? 'pdf' : 'image',
              url,
              courseId, semester, subject, unit, topic,
              createdAt: new Date().toISOString()
            });
          })();
          uploadTasks.push(task);
        });
      } else if (type === 'camera') {
        if (captures.length === 0) throw new Error("Please capture at least one photo.");
        
        // Rough base64 to byte size check (base64 string length * 0.75 gives approx bytes)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const oversizedCaptures = captures.filter(c => (c.length * 0.75) > MAX_FILE_SIZE);
        if (oversizedCaptures.length > 0) {
           throw new Error("One of your camera captures is too large (over 10MB limit). Please try capturing at a lower resolution.");
        }

        setUploadStatus(`Processing ${captures.length} captures...`);
        captures.forEach((cap, idx) => {
          const task = (async () => {
            try {
              const uniqueId = Math.random().toString(36).substring(7);
              const fileName = `materials/capture_${Date.now()}_${uniqueId}_${idx}.jpg`;
              
              setUploadStatus(`Uploading capture ${idx + 1} via secure bridge...`);
              const response = await fetch('/api/upload-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  base64: cap,
                  fileName,
                  contentType: 'image/jpeg'
                })
              });

              if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Server failed to upload capture ${idx + 1}`);
              }

              const { url } = await response.json();
              
              setUploadStatus(`Saving capture ${idx + 1}...`);
              const docRef = await addDoc(collection(db, 'materials'), {
                title: captures.length > 1 ? `${title} (Capture ${idx + 1})` : title,
                type: 'image',
                url,
                courseId, semester, subject, unit, topic,
                createdAt: new Date().toISOString()
              });
              return docRef;
            } catch (err: any) {
              console.error(`Error uploading capture ${idx + 1}:`, err);
              throw new Error(`Failed to upload capture ${idx + 1}: ${err.message}`);
            }
          })();
          uploadTasks.push(task);
        });
      }

      if (uploadTasks.length === 0) throw new Error("No items selected for upload.");
      
      await Promise.all(uploadTasks);
      setUploadStatus('Complete!');

      setShowAdd(false);
      stopCamera();
      resetForm();
    } catch (error: any) {
      console.error("Error adding material:", error);
      let displayError = "Failed to add material.";
      
      if (error.message) {
        try {
          const parsed = JSON.parse(error.message);
          displayError = parsed.message || parsed.error || error.message;
        } catch (e) {
          displayError = error.message;
        }
      }
      
      alert(displayError);
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const resetForm = () => {
    setTitle('');
    setType('pdf');
    setLinks(['']);
    setCourseId('');
    setSemester('');
    setSubject('');
    setUnit('');
    setTopic('');
    setFiles([]);
    setCaptures([]);
  };

  const deleteMaterial = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materials', id));
      setDeleteConfirm(null);
    } catch (error: any) {
      handleFirestoreError(error, 'delete', `materials/${id}`);
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
                      m.type === 'image' || m.type === 'camera' ? 'bg-blue-50 text-blue-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {m.type === 'pdf' ? <FileText className="w-6 h-6" /> :
                       (m.type === 'image' || m.type === 'camera') ? <ImageIcon className="w-6 h-6" /> :
                       <LinkIcon className="w-6 h-6" />}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setViewMaterial(m)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View Material"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedMaterial(m)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="View QR"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(m.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-1">{m.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                      {m.subject} • {departments.find(d => d.id === m.courseId || d.name === m.courseId)?.name || (m.courseId === 'all' ? 'All Courses' : m.courseId?.toUpperCase())}
                    </p>
                    {m.topic && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Topic: {m.topic}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                    <span className="text-xs text-slate-400">Unit {m.unit || 'N/A'}</span>
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

      {/* View Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{viewMaterial.title}</h3>
                <p className="text-xs text-slate-500">{viewMaterial.subject} • Unit {viewMaterial.unit}</p>
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
                <div className="text-center p-8">
                  <LinkIcon className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-20" />
                  <p className="text-slate-500 mb-6 font-medium">External Web Resource</p>
                  <a 
                    href={viewMaterial.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold inline-flex items-center gap-2 shadow-lg shadow-blue-100"
                  >
                    Open Link in New Tab <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Material?</h3>
            <p className="text-slate-500 text-sm mb-8">This action cannot be undone. Are you sure?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteMaterial(deleteConfirm)}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Study Material</h3>
              <button onClick={() => { setShowAdd(false); stopCamera(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="Material Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Department</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    <option value="all">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Java, OS, etc."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="">Select Unit</option>
                    {ROMAN_UNITS.map(u => <option key={u} value={u}>Unit {u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Topic Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  placeholder="Variables, Loops, etc."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              {/* Type Selection Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl">
                {(['pdf', 'image', 'camera', 'link'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setType(t); if(t !== 'camera') stopCamera(); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-1 ${
                      type === t ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    {t === 'pdf' && <FileText className="w-3 h-3" />}
                    {t === 'image' && <ImageIcon className="w-3 h-3" />}
                    {t === 'camera' && <Camera className="w-3 h-3" />}
                    {t === 'link' && <LinkIcon className="w-3 h-3" />}
                    {t}
                  </button>
                ))}
              </div>

              {/* Dynamic Inputs Based on Type */}
              {type === 'camera' && (
                <div className="space-y-4">
                  {!showCamera ? (
                    <button 
                      type="button"
                      onClick={startCamera}
                      className="w-full py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-all"
                    >
                      <Video className="w-8 h-8" />
                      <span className="font-bold text-sm">Activate Camera</span>
                    </button>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-blue-500">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-6">
                        <button 
                          type="button"
                          onClick={capturePhoto}
                          className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                        >
                          <div className="w-12 h-12 border-2 border-slate-900 rounded-full" />
                        </button>
                        <button 
                          type="button"
                          onClick={stopCamera}
                          className="absolute right-4 bottom-2 p-2 bg-black/50 text-white rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {captures.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {captures.map((cap, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                          <img src={cap} alt="Capture" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => removeCapture(i)}
                            className="absolute top-0.5 right-0.5 p-1 bg-red-500 text-white rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(type === 'pdf' || type === 'image') && (
                <div>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-all border-blue-200/50">
                    <div className="flex flex-col items-center justify-center py-5">
                      <Upload className="w-8 h-8 text-slate-300 group-hover:text-blue-500 mb-2" />
                      <p className="text-sm text-slate-500 text-center px-4">
                        <span className="font-bold">{files.length > 0 ? `${files.length} selected` : 'Select Multiple Files'}</span>
                      </p>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      accept={type === 'pdf' ? '.pdf' : 'image/*'}
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {files.map((f, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 truncate max-w-[100px]">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {type === 'link' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Resource links</label>
                  {links.map((lnk, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="url"
                        className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                        placeholder="https://..."
                        value={lnk}
                        onChange={(e) => updateLink(idx, e.target.value)}
                      />
                      {links.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeLink(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={addLinkField}
                    className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Another Link
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setShowAdd(false); stopCamera(); }}
                  className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300 disabled:shadow-none flex flex-col items-center justify-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mb-1" />
                      <span className="text-[10px] font-medium">{uploadStatus}</span>
                    </>
                  ) : 'Confirm Add'}
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

            <p className="text-xs text-slate-400 mb-6 font-medium uppercase tracking-widest">Scan to Open</p>

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
