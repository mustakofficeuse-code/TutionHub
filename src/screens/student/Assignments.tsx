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
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
        where('courseId', '==', profile.courseId),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });

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

  const startScanner = () => {
    setScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        if (decodedText.startsWith('assignment:')) {
          const assignmentId = decodedText.split(':')[1];
          const assignment = assignments.find(a => a.id === assignmentId);
          if (assignment) {
            setSelectedAssignment(assignment);
            scanner.clear();
            setScanning(false);
          } else {
            alert('Assignment not found for your course.');
          }
        }
      }, (error) => {
        // console.warn(error);
      });
    }, 100);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="text-blue-600 w-7 h-7" />
              My Assignments
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Track and submit your class work</p>
          </div>
          <button 
            onClick={startScanner}
            className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all hover:bg-slate-800 dark:hover:bg-slate-700"
          >
            <QrCode className="w-5 h-5" /> Scan to Submit
          </button>
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No assignments for your course yet.</p>
            </div>
          ) : (
            assignments.map((a) => {
              const submission = submissions.find(s => s.assignmentId === a.id);
              return (
                <div key={a.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      submission ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    }`}>
                      <ClipboardList className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{a.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        {a.subject} • Due: {new Date(a.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {submission ? (
                      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Submitted
                      </div>
                    ) : (
                      <button 
                        onClick={() => setSelectedAssignment(a)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                      >
                        Submit Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {scanning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl relative border border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setScanning(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:text-white dark:hover:text-white transition-all"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">Scan Assignment QR</h3>
            <div id="reader" className="overflow-hidden rounded-2xl border-4 border-slate-100 dark:border-slate-800"></div>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-6 text-sm">Point your camera at the assignment QR code provided by your teacher.</p>
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submit Assignment</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{selectedAssignment.title}</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Submission Link (Google Drive / Dropbox)
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2 italic">
                  Upload your work to Drive and paste the shared link here.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!submissionUrl || submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 dark:disabled:bg-slate-700"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
