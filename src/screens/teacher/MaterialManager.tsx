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
  Check,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const ROMAN_UNITS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

export default function MaterialManager({ isEmbedded }: { isEmbedded?: boolean }) {
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
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');

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
      
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'New Study Material',
          message: `A new study material "${title}" has been uploaded for ${courseId} Sem ${semester}.`,
          targetRole: 'student',
          targetDept: courseId.toUpperCase(),
          targetSem: semester,
          timestamp: new Date().toISOString(),
          read: false
        });
      } catch (err) {
        console.warn("Failed to notify students:", err);
      }

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

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (m.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.topic || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || m.type === filterType;
    const matchesDept = filterDept === 'all' || m.courseId === filterDept;
    return matchesSearch && matchesType && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] p-6 lg:p-6 sm:p-6 sm:p-5 sm:p-6 selection:bg-wa-teal selection:text-white">
      {!isEmbedded && (
        <button 
          onClick={() => navigate('/')}
          className="mb-6 sm:mb-10 flex items-center gap-3 text-slate-400 font-bold  tracking-normal text-xs hover:text-wa-teal transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Terminal
        </button>
      )}

      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-6 mb-4">
              <div className="w-16 h-16 bg-white dark:bg-[#202c33] rounded-[1.5rem] shadow-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 rotate-[-8deg] shrink-0">
                <BookOpen className="text-wa-teal w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tracking-normal  italic leading-none">Materials</h1>
                <p className="text-xs font-bold text-wa-teal  tracking-normal mt-3 ml-1">Asset Repository [VER 0.92]</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-wa-teal dark:hover:bg-wa-teal/90 text-white px-6 sm:px-10 py-3 sm:py-5 rounded-[1.5rem] font-bold flex items-center justify-center gap-4 shadow-2xl transition-all  tracking-normal text-xs active:scale-95"
          >
            <Plus className="w-5 h-5" /> INITIALIZE DEPLOYMENT
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-[#202c33] p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-2xl flex flex-col lg:flex-row gap-6 items-center">
           <div className="relative flex-1 w-full">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="PROBE ARCHIVE BY TITLE, SUBJECT, OR TOPIC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 rounded-[1.5rem] text-[11px] font-bold  tracking-normal outline-none text-slate-800 dark:text-white transition-all shadow-inner placeholder:text-slate-400"
              />
           </div>
           
           <div className="flex gap-4 w-full lg:w-auto">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex-1 lg:w-48 px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] rounded-[1.5rem] border border-transparent focus:border-wa-teal/30 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 outline-none cursor-pointer appearance-none text-center"
              >
                <option value="all">TYPE: ALL</option>
                <option value="pdf">TYPE: PDF</option>
                <option value="link">TYPE: LINK</option>
                <option value="image">TYPE: VISUAL</option>
              </select>

              <select 
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="flex-1 lg:w-60 px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] rounded-[1.5rem] border border-transparent focus:border-wa-teal/30 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 outline-none cursor-pointer appearance-none text-center"
              >
                <option value="all">DEPARTMENT: ALL</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name.toUpperCase()}</option>
                ))}
              </select>
           </div>
        </div>

        {/* Materials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
          {loading ? (
            <div className="col-span-full py-40 text-center">
              <div className="relative inline-block">
                <Loader2 className="w-16 h-16 text-wa-teal animate-spin opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse" />
                </div>
              </div>
              <p className="mt-6 text-xs font-bold text-slate-400  tracking-normal">Establishing Neural Link...</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 shadow-2xl">
              <div className="w-24 h-24 bg-[#f8f9fa] dark:bg-[#111b21] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 stroke-[1.5px]" />
              </div>
              <p className="text-slate-400 font-bold  tracking-normal text-xs">Matrix Status: Void • No Matching Assets Found</p>
            </div>
          ) : (
            filteredMaterials.map((m) => (
              <div key={m.id} className="bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 overflow-hidden group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] dark:hover:shadow-none hover:-translate-y-2 transition-all duration-700 relative">
                <div className="absolute top-0 left-0 w-full h-[6px] bg-slate-100 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="h-full bg-wa-teal w-1/3 animate-progress" />
                </div>
                
                <div className="p-6 sm:p-10 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[6deg] ${
                      m.type === 'pdf' ? 'bg-rose-500/10 text-rose-500' :
                      m.type === 'image' || m.type === 'camera' ? 'bg-wa-teal/10 text-wa-teal' :
                      'bg-wa-green/10 text-wa-green'
                    }`}>
                      {m.type === 'pdf' ? <FileText className="w-8 h-8" /> :
                       (m.type === 'image' || m.type === 'camera') ? <ImageIcon className="w-8 h-8" /> :
                       <LinkIcon className="w-8 h-8" />}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setViewMaterial(m)}
                        className="w-11 h-11 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] text-slate-400 hover:text-wa-teal hover:shadow-lg transition-all rounded-xl"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedMaterial(m)}
                        className="w-11 h-11 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] text-slate-400 hover:text-wa-teal hover:shadow-lg transition-all rounded-xl"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(m.id)}
                        className="w-11 h-11 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#111b21] text-slate-400 hover:text-rose-500 hover:shadow-lg transition-all rounded-xl"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-4">
                       <span className="text-xs font-bold text-wa-teal  tracking-normal bg-wa-teal/10 px-3 py-1.5 rounded-lg border border-wa-teal/10">
                        {m.type === 'camera' ? 'SCANNED' : m.type.toUpperCase()}
                       </span>
                       <span className="text-xs font-bold text-slate-400 dark:text-slate-500  tracking-normal italic font-mono truncate max-w-[120px]">
                        ID_{m.id.substring(0, 8).toUpperCase()}
                       </span>
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-2xl tracking-normal line-clamp-2  leading-tight italic">{m.title}</h3>
                    
                    <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-wa-teal rounded-full" />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400  tracking-normal">{m.subject}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400  tracking-normal">
                            {departments.find(d => d.id === m.courseId || d.name === m.courseId)?.name || (m.courseId === 'all' ? 'GLOBAL' : m.courseId?.toUpperCase())}
                          </span>
                       </div>
                    </div>
                  </div>

                  {m.topic && (
                    <div className="bg-[#fcfcfd] dark:bg-[#111b21] p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                      <p className="text-xs font-bold text-slate-400  tracking-normal mb-1.5">PROBE CONTEXT:</p>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 line-clamp-2 italic">{m.topic}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400  tracking-normal">Semester</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">UNIT {m.unit || 'X'}</span>
                    </div>
                    <a 
                      href={m.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-5 sm:px-8 py-4 bg-slate-900 dark:bg-wa-teal dark:hover:bg-wa-teal/90 text-white text-xs font-bold  tracking-normal rounded-2xl hover:bg-wa-teal transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3"
                    >
                      ACCESS <ExternalLink className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 lg:p-6 sm:p-6 sm:p-5 sm:p-6 z-[140] animate-in fade-in duration-700">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl w-full max-w-6xl h-full max-h-[90vh] overflow-hidden flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10 relative">
            <div className="absolute top-0 left-0 w-full h-[8px] bg-gradient-to-r from-wa-teal via-indigo-500 to-wa-green" />
            
            <div className="p-6 sm:p-10 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-[#fcfcfd] dark:bg-[#202c33] shrink-0">
              <div className="flex items-center gap-5 sm:gap-8">
                <div className="w-16 h-16 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-[1.5rem] flex items-center justify-center shadow-xl">
                  <Eye className="text-wa-teal w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-normal  italic leading-none">{viewMaterial.title}</h3>
                  <div className="flex gap-4 mt-3">
                     <span className="text-xs font-bold text-wa-teal  tracking-normal">PROBE: {viewMaterial.subject}</span>
                     <span className="text-xs font-bold text-slate-300  tracking-normal">•</span>
                     <span className="text-xs font-bold text-slate-400  tracking-normal">STATUS: VERIFIED_ASSET</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setViewMaterial(null)}
                className="w-14 h-14 bg-white dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all border border-slate-200/20 shadow-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 bg-[#111b21] overflow-hidden flex items-center justify-center relative p-5 sm:p-5 sm:p-6">
              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-wa-teal via-transparent to-transparent scale-150" />
              </div>

              {viewMaterial.type === 'pdf' ? (
                <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-white border-8 border-slate-800/50">
                  <iframe src={viewMaterial.url} className="w-full h-full border-none" title="Material View" />
                </div>
              ) : (viewMaterial.type === 'image' || viewMaterial.type === 'camera') ? (
                <div className="relative group max-w-full max-h-full">
                  <img 
                    src={viewMaterial.url} 
                    alt="Material" 
                    className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border-4 border-white/5" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute bottom-6 right-6 p-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                     <p className="text-xs font-bold text-white  tracking-normal">ASSET_SCAN_RENDER_V1</p>
                  </div>
                </div>
              ) : (
                <div className="text-center p-20 bg-white dark:bg-[#202c33] rounded-3xl shadow-2xl max-w-xl border border-white/10 mx-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-wa-teal" />
                  <div className="w-28 h-28 bg-[#f8f9fa] dark:bg-[#111b21] rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-10 shadow-inner group transition-transform hover:scale-110">
                    <LinkIcon className="w-12 h-12 text-wa-teal group-hover:rotate-12 transition-transform" />
                  </div>
                  <h4 className="text-2xl font-bold text-slate-800 dark:text-white  tracking-normal italic mb-4">External Protocol Link</h4>
                  <p className="text-[11px] font-bold text-slate-400 mb-8 sm:mb-12  tracking-normal leading-relaxed">
                    This asset resides in an external domain. <br/>Establish a secure handshake to view content.
                  </p>
                  <a 
                    href={viewMaterial.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-4 sm:py-6 bg-slate-900 text-white rounded-2xl font-bold  tracking-normal text-xs shadow-2xl shadow-slate-900/30 hover:bg-wa-teal transition-all flex items-center justify-center gap-4 group"
                  >
                    ESTABLISH CONNECTION <ExternalLink className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-5 sm:p-5 sm:p-6 bg-[#fcfcfd] dark:bg-[#111b21] border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-6 items-center shrink-0">
               <div className="flex-1">
                  <p className="text-xs font-bold text-slate-300  tracking-normal mb-1">METADATA_HEADER</p>
                  <p className="text-[11px] font-bold text-slate-500  tracking-normal truncate">{viewMaterial.topic || 'NO TOPIC DEFINED'}</p>
               </div>
               <div className="flex gap-4">
                  <span className="px-4 py-2 bg-white dark:bg-[#202c33] rounded-xl text-xs font-bold text-slate-400 border border-slate-100 dark:border-white/5  tracking-normal italic font-mono">DEPT_{viewMaterial.courseId.toUpperCase()}</span>
                  <span className="px-4 py-2 bg-white dark:bg-[#202c33] rounded-xl text-xs font-bold text-slate-400 border border-slate-100 dark:border-white/5  tracking-normal italic font-mono">SEMESTER_{viewMaterial.semester}</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-6 sm:p-10 w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-8 mx-auto">
              <Trash2 className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-normal mb-3 ">PURGE ARCHIVE?</h3>
            <p className="text-sm font-bold text-slate-400  tracking-normal mb-6 sm:mb-10">This protocol is irreversible. Material will be deleted from the database.</p>
            <div className="space-y-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="w-full py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] text-slate-400 font-bold  tracking-normal text-xs rounded-[1.5rem] border border-slate-100 dark:border-white/5 hover:text-wa-teal/70 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteMaterial(deleteConfirm)}
                className="w-full py-3 sm:py-5 bg-red-600 text-white font-bold  tracking-normal text-xs rounded-[1.5rem] shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all"
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 lg:p-6 sm:p-6 sm:p-5 sm:p-6 z-[150] animate-in fade-in duration-700">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-4xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] max-h-full overflow-y-auto border border-white/10 relative scrollbar-hide">
            <div className="absolute top-0 left-0 w-full h-[10px] bg-slate-900 dark:bg-white/5" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-5 sm:gap-8">
              <div className="flex items-center gap-5 sm:gap-8">
                <div className="w-20 h-20 bg-slate-900 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-wa-teal opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Plus className="text-white w-10 h-10 relative z-10" />
                </div>
                <div>
                  <h3 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tracking-normal  italic leading-none">Add Material</h3>
                  <p className="text-xs font-bold text-wa-teal  tracking-normal mt-3 ml-1">Upload Material • READY</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAdd(false); stopCamera(); }} 
                className="w-16 h-16 bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all border border-slate-100 dark:border-white/5 shadow-xl active:scale-90"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                <div className="space-y-10">
                  <div className="group">
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3 group-focus-within:text-wa-teal transition-colors">Material Designation</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-base font-bold transition-all outline-none text-slate-800 dark:text-white  tracking-normal placeholder:text-slate-300"
                      placeholder="ENTER RESOURCE CODE_NAME..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-5 sm:gap-8">
                    <div>
                      <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3">Department</label>
                      <select
                        required
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-[11px] font-bold transition-all outline-none cursor-pointer text-slate-800 dark:text-white  tracking-normal appearance-none"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                      >
                        <option value="">SELECT DEPT</option>
                        <option value="all">GLOBAL_ACCESS</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3">Semester</label>
                      <select
                        required
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-[11px] font-bold transition-all outline-none cursor-pointer text-slate-800 dark:text-white  tracking-normal appearance-none text-center"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                      >
                        <option value="">SEMESTER</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>SEMESTER {s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 sm:gap-8">
                    <div>
                      <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3">Subject ID</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-base font-bold transition-all outline-none text-slate-800 dark:text-white  tracking-normal placeholder:text-slate-300"
                        placeholder="E.G. CS-402"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3">Unit Tag</label>
                      <select
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-[11px] font-bold transition-all outline-none cursor-pointer text-slate-800 dark:text-white  tracking-normal appearance-none text-center"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                      >
                        <option value="">Select Unit</option>
                        {ROMAN_UNITS.map(u => <option key={u} value={u}>Unit {u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-4 ml-3">Context Matrix (Topic)</label>
                    <input
                      type="text"
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-2xl py-4 sm:py-6 px-5 sm:px-8 text-base font-bold transition-all outline-none text-slate-800 dark:text-white  tracking-normal placeholder:text-slate-300"
                      placeholder="ASSET_TOPIC_IDENTIFIER..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-10">
                  {/* Type Selection Tabs */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-[#f8f9fa] dark:bg-[#111b21] rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                    {(['pdf', 'image', 'camera', 'link'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setType(t); if(t !== 'camera') stopCamera(); }}
                        className={`py-4 sm:py-6 rounded-[1.5rem] text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 transition-all flex flex-col items-center justify-center gap-3 border shadow-sm ${
                          type === t 
                          ? 'bg-wa-teal text-white border-wa-teal shadow-2xl shadow-wa-teal/20 scale-105 active:scale-100' 
                          : 'bg-white dark:bg-[#202c33] text-slate-400 border-slate-100 dark:border-white/5 hover:border-wa-teal/30 hover:text-wa-teal'
                        }`}
                      >
                        {t === 'pdf' && <FileText className="w-6 h-6" />}
                        {t === 'image' && <ImageIcon className="w-6 h-6" />}
                        {t === 'camera' && <Camera className="w-6 h-6" />}
                        {t === 'link' && <LinkIcon className="w-6 h-6" />}
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Inputs Based on Type */}
                  <div className="animate-in fade-in slide-in-from-right-4 duration-700 min-h-[300px]">
                    {type === 'camera' && (
                      <div className="space-y-8">
                        {!showCamera ? (
                          <button 
                            type="button"
                            onClick={startCamera}
                            className="w-full py-24 border-4 border-dashed border-slate-100 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-6 text-slate-300 hover:text-wa-teal hover:border-wa-teal/30 hover:bg-wa-teal/5 transition-all group relative overflow-hidden shadow-inner"
                          >
                            <div className="w-24 h-24 bg-white dark:bg-[#111b21] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-[10deg] transition-all shadow-2xl border border-slate-100 dark:border-white/10">
                              <Camera className="w-10 h-10" />
                            </div>
                            <span className="font-bold text-[11px]  tracking-normal">ACTIVATE OPTICAL_SCAN</span>
                          </button>
                        ) : (
                          <div className="relative rounded-3xl overflow-hidden bg-slate-900 aspect-square sm:aspect-video border-[8px] border-slate-800 dark:border-[#111b21] shadow-2xl ring-8 ring-wa-teal/10">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.4)_100%)] pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-10 flex justify-center gap-6 sm:gap-10">
                              <button 
                                type="button"
                                onClick={capturePhoto}
                                className="w-24 h-24 bg-white/10 backdrop-blur-3xl rounded-full flex items-center justify-center p-3 border-4 border-white transition-all hover:scale-110 active:scale-90"
                              >
                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-2xl">
                                   <div className="w-12 h-12 border-4 border-slate-900 rounded-full" />
                                </div>
                              </button>
                            </div>
                            <button 
                              type="button" 
                              onClick={stopCamera}
                              className="absolute top-8 right-8 w-12 h-12 bg-black/60 backdrop-blur-xl text-white rounded-2xl hover:bg-rose-500 transition-all border border-white/20 flex items-center justify-center"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                        )}

                        {captures.length > 0 && (
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-2">
                            {captures.map((cap, i) => (
                              <div key={i} className="relative w-32 h-32 rounded-2xl overflow-hidden group border-4 border-wa-teal/30 shrink-0 shadow-2xl transform hover:rotate-3 transition-transform">
                                <img src={cap} alt="Capture" className="w-full h-full object-cover" />
                                <button 
                                  type="button" 
                                  onClick={() => removeCapture(i)}
                                  className="absolute inset-0 bg-rose-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <Trash2 className="w-8 h-8 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {(type === 'pdf' || type === 'image') && (
                      <div className="h-full">
                        <label className="flex flex-col items-center justify-center w-full h-72 border-4 border-dashed border-slate-100 dark:border-white/5 rounded-3xl cursor-pointer hover:bg-wa-teal/5 transition-all border-wa-teal/10 group relative overflow-hidden bg-[#fcfcfd] dark:bg-[#111b21] shadow-inner mb-6">
                          <div className="flex flex-col items-center justify-center py-10 relative z-10 text-center">
                            <div className="w-20 h-20 bg-white dark:bg-[#202c33] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all shadow-2xl border border-slate-100 dark:border-white/10 text-slate-300 group-hover:text-wa-teal">
                              <Upload className="w-10 h-10" />
                            </div>
                            <p className="text-[11px] font-bold text-slate-400  tracking-normal px-5 sm:px-8 group-hover:text-wa-teal transition-colors">
                              {files.length > 0 ? `${files.length} ASSETS_CACHED` : 'UPLOAD SOURCE_STREAM'}
                            </p>
                            <p className="text-xs font-medium text-slate-300 mt-2">DRAG & DROP SYSTEM_READY</p>
                          </div>
                          <input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            accept={type === 'pdf' ? '.pdf' : 'image/*'}
                            onChange={(e) => setFiles(Array.from(e.target.files || []))}
                          />
                        </label>
                        {files.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {files.map((f, i) => (
                              <div key={i} className="px-5 py-3 bg-white dark:bg-[#111b21] rounded-[1.2rem] border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-500  tracking-normal flex items-center gap-3 shadow-sm animate-in zoom-in-50 duration-300">
                                 <FileText className="w-4 h-4 text-wa-teal" />
                                 <span className="truncate max-w-[150px]">{f.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {type === 'link' && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2 ml-2">
                           <div className="w-1.5 h-1.5 bg-wa-teal rounded-full animate-pulse" />
                           <label className="text-xs font-bold text-slate-400  tracking-normal">LINK_STREAMS</label>
                        </div>
                        {links.map((lnk, idx) => (
                          <div key={idx} className="flex gap-4 group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="relative flex-1">
                               <LinkIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-wa-teal transition-colors w-4 h-4" />
                               <input
                                type="url"
                                className="w-full bg-[#fcfcfd] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-8 focus:ring-wa-teal/5 rounded-[1.5rem] py-3 sm:py-5 pl-14 pr-6 text-[11px] font-bold transition-all outline-none text-slate-800 dark:text-white  tracking-normal shadow-inner placeholder:text-slate-200"
                                placeholder="https://..."
                                value={lnk}
                                onChange={(e) => updateLink(idx, e.target.value)}
                              />
                            </div>
                            {links.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => removeLink(idx)}
                                className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1.5rem] flex items-center justify-center transition-all shadow-xl ring-4 ring-transparent hover:ring-rose-500/20"
                              >
                                <X className="w-6 h-6" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button 
                          type="button"
                          onClick={addLinkField}
                          className="w-full py-3 sm:py-5 bg-white dark:bg-[#111b21] text-wa-teal text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 rounded-[1.5rem] border-2 border-dashed border-wa-teal/30 hover:bg-wa-teal/5 transition-all flex items-center justify-center gap-4 group"
                        >
                          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> ADD_STUB_FIELD
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-12 border-t border-slate-100 dark:border-white/5">
                <button 
                  type="button"
                  onClick={() => { setShowAdd(false); stopCamera(); }}
                  className="flex-1 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#111b21] text-slate-400 font-bold  tracking-normal text-xs rounded-[2.2rem] border border-slate-100 dark:border-white/10 hover:text-wa-teal/70 hover:bg-white transition-all shadow-inner"
                >
                  ABORT OPERATION
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className="flex-[2] py-4 sm:py-6 bg-slate-900 text-white font-bold  tracking-normal text-xs rounded-[2.2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:bg-wa-teal transition-all disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center relative overflow-hidden group"
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-1000" />
                  {uploading ? (
                    <div className="flex items-center gap-4 animate-in fade-in duration-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs  tracking-normal italic">{uploadStatus || 'INJECTING...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                       <Upload className="w-5 h-5" />
                       EXECUTE_DEPLOYMENT
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 z-[130] animate-in fade-in duration-500">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-sm shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] text-center border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[6px] bg-wa-teal" />
            
            <div className="flex justify-between items-center mb-6 sm:mb-10">
              <div className="text-left">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-normal  italic">RESOURCE SYNC</h3>
                <p className="text-xs font-bold text-wa-teal  tracking-normal mt-1">Cross-Link Initiated</p>
              </div>
              <button 
                onClick={() => setSelectedMaterial(null)}
                className="w-12 h-12 bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all shadow-sm border border-slate-100 dark:border-white/5"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl mb-6 sm:mb-10 inline-block border-[10px] border-[#f8f9fa] dark:border-[#111b21]/50 relative group">
              <div className="absolute -inset-2 bg-gradient-to-tr from-wa-teal/20 via-transparent to-wa-teal/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <QRCodeSVG 
                value={`https://${window.location.hostname}/m/${selectedMaterial.id}`}
                size={220}
                level="H"
                includeMargin={false}
                className="relative z-10"
              />
            </div>

            <div className="bg-[#fcfcfd] dark:bg-[#111b21] p-6 rounded-2xl border border-slate-100 dark:border-white/5 mb-6 sm:mb-10">
               <p className="text-xs font-bold text-slate-400  tracking-normal leading-relaxed">
                  Scan to establish secure connection to <br/>
                  <span className="text-wa-teal">ASSET_VECTOR_{selectedMaterial.id.substring(0,8).toUpperCase()}</span>
               </p>
            </div>

            <button 
              onClick={() => setSelectedMaterial(null)}
              className="w-full py-4 sm:py-6 bg-slate-900 text-white rounded-2xl font-bold  tracking-normal text-xs shadow-2xl shadow-slate-900/30 hover:bg-slate-800 transition-all active:scale-95"
            >
              DISCONNECT TERMINAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
