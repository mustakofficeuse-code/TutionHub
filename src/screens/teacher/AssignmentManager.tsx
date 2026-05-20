import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  QrCode,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sendNotification } from '../../services/notificationService';

export default function AssignmentManager() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [viewSubmissions, setViewSubmissions] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubscribeAssignments = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubscribeDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    fetchSubmissions();
    return () => {
      unsubscribeAssignments();
      unsubscribeDepts();
    };
  }, []);

  const fetchSubmissions = async () => {
    const querySnapshot = await getDocs(collection(db, 'submissions'));
    setSubmissions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        title,
        description,
        dueDate,
        courseId,
        subject,
        createdAt: new Date().toISOString()
      });

      await sendNotification({
        title: 'New Assignment',
        message: `A new assignment "${title}" has been added for ${courseId} - ${subject}.`,
        targetRole: 'student',
        type: 'new_assignment',
        targetDept: courseId,
      } as any);

      setShowAdd(false);
      resetForm();
    } catch (error) {
      console.error("Error adding assignment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setCourseId('');
    setSubject('');
  };

  const deleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await deleteDoc(doc(db, 'assignments', id));
    } catch (error) {
      console.error("Error deleting assignment:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] p-4 sm:p-6 sm:p-6 sm:p-10 pb-32 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-4 sm:mb-8 flex items-center gap-3 text-slate-500 dark:text-slate-400 font-bold hover:text-wa-teal transition-all  tracking-normal text-xs group"
      >
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#202c33] flex items-center justify-center shadow-sm group-hover:bg-wa-teal group-hover:text-white transition-all border border-slate-100 dark:border-white/5 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse" />
              <span className="text-xs font-bold text-wa-teal  tracking-normal">Assignments Center</span>
            </div>
            <h1 className="text-3xl sm:text-4xl sm:text-3xl sm:text-4xl sm:text-5xl font-bold text-slate-800 dark:text-white tracking-normal leading-none italic">
              ASSIGNMENT TRACKER
            </h1>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-3 ml-1">Manage and track student submissions for active courses</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="w-full sm:w-auto bg-wa-teal hover:bg-wa-teal/90 text-white px-5 sm:px-8 py-3 sm:py-5 rounded-[1.5rem] font-bold  tracking-normal text-xs flex items-center justify-center gap-3 shadow-xl shadow-wa-teal/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> New Assignment
          </button>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No assignments created yet.</p>
            </div>
          ) : (
            assignments.map((a) => {
              const dept = departments.find(d => d.id === a.courseId || d.name === a.courseId);
              const subCount = submissions.filter(s => s.assignmentId === a.id).length;
              return (
                <div key={a.id} className="bg-white dark:bg-[#202c33] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 overflow-hidden group hover:border-wa-teal transition-all duration-500 hover:-translate-y-2">
                  <div className="p-4 sm:p-5 sm:p-5 sm:p-6 space-y-5">
                    <div className="flex justify-between items-start">
                      <div className="p-4 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl text-wa-teal shadow-inner group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedAssignment(a)}
                          className="p-3 text-slate-400 hover:text-wa-teal hover:bg-wa-teal/10 dark:hover:bg-wa-teal/20 rounded-xl transition-all"
                          title="Generate Submission QR"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteAssignment(a.id)}
                          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-xl line-clamp-1 italic  tracking-normal">{a.title}</h3>
                      <p className="text-xs font-bold text-wa-teal  tracking-normal mt-2 block">
                        {a.subject} <span className="text-slate-300 dark:text-slate-700 mx-2">|</span> {dept?.name || 'ALL DEPARTMENTS'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal pb-6">
                      <Calendar className="w-4 h-4 text-wa-teal" />
                      <span>DUE: {new Date(a.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-white/5">
                      <span className="text-sm font-bold text-wa-teal bg-wa-teal/10 dark:bg-wa-teal/20 px-3 py-1.5 rounded-lg tracking-normal border border-wa-teal/10">
                        {subCount} SUBMISSIONS
                      </span>
                      <button 
                        onClick={() => setViewSubmissions(a)}
                        className="text-slate-800 dark:text-[#e9edef] text-sm font-bold flex items-center gap-2 hover:text-wa-teal transition-colors tracking-normal"
                      >
                        VIEW ALL <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 sm:p-5 sm:p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 sm:mb-8  italic tracking-normal">Create New Assignment</h3>
            <form onSubmit={handleAdd} className="space-y-3 sm:space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal mb-2.5 ml-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 sm:px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-bold text-slate-800 dark:text-white transition-all outline-none"
                  placeholder="Java Lab Assignment 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal mb-2.5 ml-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 sm:px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-bold text-slate-800 dark:text-white transition-all outline-none resize-none"
                  placeholder="Enter assignment details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal mb-2.5 ml-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 sm:px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-bold text-slate-800 dark:text-white transition-all outline-none"
                    placeholder="Java"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal mb-2.5 ml-1">Due Date</label>
                  <div className="relative group">
                    <input
                      type="date"
                      required
                      className="w-full px-4 sm:px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-bold text-slate-800 dark:text-white transition-all outline-none pr-14"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setDueDate(getTomorrowString())}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-wa-teal/10 dark:bg-wa-teal/20 text-wa-teal rounded-xl hover:bg-wa-teal hover:text-white transition-all"
                      title="Set to Tomorrow"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400  tracking-normal mb-2.5 ml-1">Target Department</label>
                <select
                  required
                  className="w-full px-4 sm:px-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl text-base font-bold text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 sm:py-5 text-slate-500 dark:text-slate-400 font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-[#111b21] rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 sm:py-5 bg-wa-teal text-white font-bold  tracking-normal text-xs rounded-[1.5rem] hover:bg-wa-teal/90 transition-all shadow-xl shadow-wa-teal/20 disabled:bg-slate-300 dark:disabled:bg-[#111b21]"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 sm:p-5 sm:p-6 w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submission QR Code</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 sm:mb-6">{selectedAssignment.title}</p>
            
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 inline-block mb-4 sm:mb-6">
              <QRCodeSVG value={`assignment:${selectedAssignment.id}`} size={200} />
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-4 sm:mb-6">Students can scan this to submit their work directly.</p>

            <button 
              onClick={() => setSelectedAssignment(null)}
              className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Submissions View Modal */}
      {viewSubmissions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 sm:p-5 sm:p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Submissions: {viewSubmissions.title}</h3>
              <button onClick={() => setViewSubmissions(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                <Plus className="w-6 h-6 rotate-45 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="space-y-2 sm:space-y-4">
              {submissions.filter(s => s.assignmentId === viewSubmissions.id).length === 0 ? (
                <p className="text-center py-10 text-slate-500 dark:text-slate-400">No submissions yet.</p>
              ) : (
                submissions.filter(s => s.assignmentId === viewSubmissions.id).map((s) => (
                  <div key={s.id} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 dark:border-slate-700 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Student ID: {s.studentId.substring(0, 8)}...</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(s.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: true })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a 
                        href={s.submissionUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold  tracking-normal ${
                        s.status === 'reviewed' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
