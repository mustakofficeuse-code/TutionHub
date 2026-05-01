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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="text-blue-600 w-7 h-7" />
              Assignment Tracker
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Manage and track student submissions</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 dark:shadow-none transition-all"
          >
            <Plus className="w-5 h-5" /> New Assignment
          </button>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div key={a.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedAssignment(a)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          title="Generate Submission QR"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deleteAssignment(a.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-1">{a.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                        {a.subject} • {dept?.name || 'All Departments'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                        {subCount} Submissions
                      </span>
                      <button 
                        onClick={() => setViewSubmissions(a)}
                        className="text-slate-900 dark:text-white text-sm font-bold flex items-center gap-1 hover:underline"
                      >
                        View All <ExternalLink className="w-3 h-3" />
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Create New Assignment</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Java Lab Assignment 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                  placeholder="Enter assignment details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Java"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Department</label>
                <select
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 dark:disabled:bg-slate-700"
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submission QR Code</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{selectedAssignment.title}</p>
            
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 inline-block mb-6">
              <QRCodeSVG value={`assignment:${selectedAssignment.id}`} size={200} />
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-6">Students can scan this to submit their work directly.</p>

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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Submissions: {viewSubmissions.title}</h3>
              <button onClick={() => setViewSubmissions(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                <Plus className="w-6 h-6 rotate-45 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
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
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
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
