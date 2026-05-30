import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  ClipboardList, 
  Search, 
  ArrowLeft, 
  Loader2, 
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Link as LinkIcon,
  Send,
  Plus,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function StudentAssignments() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.courseId) {
      const q = query(
        collection(db, 'assignments'), 
        where('courseId', '==', profile.courseId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const assignmentsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        setAssignments(assignmentsData);
        setLoading(false);
      }, (e: any) => {});

      fetchSubmissions();
      return () => unsubscribe();
    }
  }, [profile?.courseId]);

  const fetchSubmissions = async () => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'submissions'), where('studentId', '==', profile.uid));
    const querySnapshot = await getDocs(q);
    setSubmissions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (scanning) {
      const timer = setTimeout(() => {
        const readerEl = document.getElementById("reader");
        if (!readerEl) return;
        
        try {
          scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
          scanner.render((decodedText) => {
            if (decodedText.startsWith('assignment:')) {
              const assignmentId = decodedText.split(':')[1];
              const assignment = assignments.find(a => a.id === assignmentId);
              if (assignment) {
                setSelectedAssignment(assignment);
                if (scanner) {
                  scanner.clear().catch(err => console.debug("Scanner clear error on success:", err));
                }
                setScanning(false);
              } else {
                alert('Assignment not found for your course.');
              }
            }
          }, (error) => {
            // ignore scanner frame errors
          });
        } catch (e) {
          console.error("Scanner init error:", e);
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          const readerEl = document.getElementById("reader");
          if (readerEl) {
            scanner.clear().catch(err => console.debug("Scanner clear error on unmount:", err));
          }
        }
      };
    }
  }, [scanning, assignments]);

  const startScanner = () => {
    setScanning(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionUrl || !selectedAssignment || !profile) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        assignmentId: selectedAssignment.id,
        studentId: profile.uid,
        submissionUrl,
        status: 'submitted',
        timestamp: new Date().toISOString()
      });

      setSelectedAssignment(null);
      setSubmissionUrl('');
      fetchSubmissions();
      alert('Assignment submitted successfully!');
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert('Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-6 pb-24 pt-12 transition-colors font-sans">
      <button 
        onClick={() => navigate('/')}
        className="mb-4 sm:mb-8 flex items-center gap-3 text-[#8696a0] font-bold  tracking-normal text-xs hover:text-wa-teal transition-all group"
      >
        <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#202c33] rounded-xl shadow-sm border border-slate-100 dark:border-white/5 group-hover:scale-110 transition-transform">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Back to Dashboard
      </button>

      <div className="max-w-4xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] flex items-center gap-4 tracking-normal leading-none">
              <div className="p-3 bg-wa-teal/10 rounded-2xl">
                <ClipboardList className="text-wa-teal w-8 h-8" />
              </div>
              Project <span className="text-wa-teal">Center</span>
            </h1>
            <p className="text-xs font-bold text-[#8696a0]  tracking-normal mt-3">Monitor and transmit system directives</p>
          </div>
          <button 
            onClick={startScanner}
            className="w-full sm:w-auto bg-wa-teal hover:bg-wa-teal-dark text-white px-5 sm:px-8 py-4 rounded-[1.5rem] font-bold text-xs  tracking-normal flex items-center justify-center gap-3 shadow-xl transition-all shadow-wa-teal/30 active:scale-95 group"
          >
            <QrCode className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Scan Payload
          </button>
        </div>

        {/* Assignments List */}
        <div className="space-y-3 sm:space-y-6">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-12 h-12 text-wa-teal animate-spin mx-auto" />
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal mt-4 sm:mt-6">Scanning database...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="py-24 text-center bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
              <AlertCircle className="w-12 h-12 text-[#8696a0]/30 mx-auto mb-4 sm:mb-6" />
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal">Zero pending directives found</p>
            </div>
          ) : (
            assignments.map((a) => {
              const submission = submissions.find(s => s.assignmentId === a.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={a.id} 
                  className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-4 sm:gap-8 group hover:border-wa-teal transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-20 h-20 text-wa-teal" />
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 relative z-10">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all ${
                      submission ? 'bg-wa-green/10 text-wa-green' : 'bg-wa-teal/10 text-wa-teal'
                    }`}>
                      {submission ? <CheckCircle2 className="w-8 h-8" /> : <ClipboardList className="w-8 h-8" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal group-hover:text-wa-teal transition-colors">
                        {a.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-[#8696a0]  tracking-normal border border-slate-50 dark:border-white/10">
                          {a.subject}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500  tracking-normal">
                          <Calendar className="w-3 h-3" />
                          EXP: {new Date(a.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    {submission ? (
                      <div className="flex items-center gap-3 bg-wa-green/10 text-wa-green px-5 sm:px-8 py-3 rounded-2xl text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 border border-wa-green/10">
                        <div className="w-2 h-2 bg-wa-green rounded-full animate-pulse" />
                        Transmitted
                      </div>
                    ) : (
                      <button 
                        onClick={() => setSelectedAssignment(a)}
                        className="w-full md:w-auto bg-wa-teal hover:bg-wa-teal-dark text-white px-4 sm:px-6 sm:px-10 py-4 rounded-[1.5rem] text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 transition-all shadow-lg shadow-wa-teal/20 active:scale-95"
                      >
                        Transmit Now
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-10 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.4)] relative border border-white/5 text-center animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setScanning(false)}
              className="absolute top-8 right-8 w-10 h-10 bg-[#f0f2f5] dark:bg-white/5 rounded-xl flex items-center justify-center text-[#8696a0] hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-20 h-20 bg-wa-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-8">
              <QrCode className="w-10 h-10 text-wa-teal" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] mb-3 tracking-normal leading-none">Sensor <span className="text-wa-teal">Scan</span></h3>
            <p className="text-xs font-bold text-[#8696a0]  tracking-normal mb-4 sm:mb-8">Align directive QR in terminal view</p>
            
            <div id="reader" className="overflow-hidden rounded-2xl border-8 border-slate-50 dark:border-white/5 bg-slate-900 shadow-inner group aspect-square"></div>
            
            <p className="text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 text-wa-teal mt-4 sm:mt-8 leading-relaxed opacity-60 italic">Scan QR provided by your department</p>
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-white/10 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-20 h-20 bg-wa-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-inner">
               <ClipboardList className="text-wa-teal w-10 h-10" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] mb-3 tracking-normal leading-none">Final <span className="text-wa-teal">Transmit</span></h3>
            <p className="text-xs font-bold text-[#8696a0]  tracking-normal mb-4 sm:mb-6 sm:mb-10 leading-relaxed truncate px-4">{selectedAssignment.title}</p>
            
            <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4 sm:space-y-8">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#8696a0]  tracking-normal text-left ml-6">Directive Link</label>
                <div className="relative group">
                  <LinkIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-[#8696a0] w-5 h-5 group-focus-within:text-wa-teal transition-colors" />
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-16 pr-6 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                  />
                </div>
                <p className="text-xs font-bold text-[#8696a0]  tracking-normal italic">Ensure sharing permissions are enabled</p>
              </div>

              <div className="flex flex-col gap-4">
                 <button 
                  type="submit"
                  disabled={!submissionUrl || submitting}
                  className="w-full py-3 sm:py-5 bg-wa-teal hover:bg-wa-teal-dark text-white font-bold text-xs  tracking-normal rounded-2xl transition-all shadow-xl shadow-wa-teal/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Assignment
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="w-full py-3 sm:py-5 text-[#8696a0] font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  Cancel Uplink
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
