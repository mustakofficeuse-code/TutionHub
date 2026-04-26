import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, getDoc, setDoc, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  CreditCard, 
  BookOpen,
  Search, 
  Filter, 
  CheckCircle, 
  Save,
  Edit,
  X,
  ArrowLeft,
  Loader2,
  User,
  MoreVertical,
  Hash
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FeeManagement() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStudent, setPaymentStudent] = useState<any>(null);
  const [paymentSemester, setPaymentSemester] = useState<number>(1);
  const [modalDepartment, setModalDepartment] = useState<string>('');
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [viewDetailsStudent, setViewDetailsStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [feeStructure, setFeeStructure] = useState<any>({
    BCA: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    BSC: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    BTECH: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    MCA: { 1: 0, 2: 0, 3: 0, 4: 0 }
  });

  const departments = ['BCA', 'BSC', 'BTECH', 'MCA'];
  const [savingStructure, setSavingStructure] = useState(false);
  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'structure'>('history');

  useEffect(() => {
    fetchData();
    fetchFeeStructure();
  }, []);

  const fetchFeeStructure = async () => {
    try {
      const docRef = doc(db, 'config', 'feeStructure');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFeeStructure(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching fee structure:", error);
    }
  };

  const handleSaveStructure = async () => {
    setSavingStructure(true);
    try {
      await setDoc(doc(db, 'config', 'feeStructure'), feeStructure);
      alert('Fee structure updated successfully!');
      setIsEditingStructure(false);
      fetchData();
    } catch (error) {
      console.error("Error saving fee structure:", error);
      alert('Failed to save fee structure.');
    } finally {
      setSavingStructure(false);
    }
  };

  const updateStructureValue = (dept: string, sem: number, value: string) => {
    setFeeStructure((prev: any) => ({
      ...prev,
      [dept]: {
        ...prev[dept],
        [sem]: Number(value) || 0
      }
    }));
  };

  const fetchData = async () => {
    try {
      const userSnap = await getDocs(collection(db, 'users'));
      const allUsers = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const studentUsers = allUsers.filter(u => String(u.role).toLowerCase() === 'student' || u.studentId);
      setStudents(studentUsers);

      const courseSnap = await getDocs(collection(db, 'courses'));
      setCourses(courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const paymentSnap = await getDocs(collection(db, 'payments'));
      setPayments(paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching fee data:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), { status: 'confirmed' });
      fetchData();
    } catch (error) {
      console.error("Error confirming payment:", error);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL payment history?")) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      paymentsSnap.forEach(docSnap => batch.delete(docSnap.ref));
      
      await batch.commit();
      alert("All payment data successfully wiped!");
      fetchData();
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("Failed to clear data");
      setLoading(false);
    }
  };
  
  const handleTeacherPaymentReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentStudent || !paymentSemester || !paymentAmount) return;
    
    try {
      await addDoc(collection(db, 'payments'), {
         studentId: paymentStudent.uid || paymentStudent.id,
         semester: paymentSemester,
         courseId: paymentStudent.courseId || paymentStudent.department || paymentStudent.courseName || '',
         amount: Number(paymentAmount),
         transactionId: 'CASH_RECEIPT_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
         status: 'confirmed',
         teacherReceived: true,
         timestamp: new Date().toISOString()
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      fetchData();
    } catch (err) {
      console.error("Failed recording payment:", err);
      alert("Failed recording payment.");
    }
  };

  // Helper to extract clean dept name
  const cleanStr = (str: any) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');

  const filteredStudents = students.filter(s => {
    const sName = (s.name || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    if (q && !sName.includes(q) && !(s.studentId || '').toLowerCase().includes(q)) return false;
    
    if (selectedCourse !== 'all' && selectedCourse) {
       const cName = cleanStr(selectedCourse);
       const sDept = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department);
       if (sDept !== cName && s.courseId !== selectedCourse) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="text-blue-600 w-7 h-7" />
              Fee Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Track and manage student tuition fees seamlessly</p>
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={() => {
                 setPaymentStudent(null);
                 setPaymentSemester(1);
                 setModalDepartment('');
                 setPaymentAmount('');
                 setIsManualPayment(true);
                 setShowPaymentModal(true);
               }}
               className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all text-sm flex items-center gap-2"
             >
               + Receive Payment
             </button>
            <button 
              onClick={handleClearData}
              className="px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-2xl font-bold transition-all text-sm"
            >
              Wipe Test Data
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'history' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Student Dues Tracker
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('structure')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'structure' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Fee Structure
            {activeTab === 'structure' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>}
          </button>
        </div>

        {activeTab === 'history' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters & Search */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Quick search student name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white transition-all shadow-inner font-medium"
                />
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setExpandedDepts(expandedDepts.length === departments.length ? [] : departments)}
                  className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-600 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all text-sm flex items-center gap-2 shadow-sm"
                >
                  {expandedDepts.length === departments.length ? <Edit className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                  {expandedDepts.length === departments.length ? 'Minimize All' : 'Expand All'}
                </button>
              </div>
            </div>

            {/* Department Action Buttons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {departments.map((dept) => {
                const deptCount = students.filter(s => {
                  const sDept = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department);
                  return sDept === dept;
                }).length;
                
                const isExpanded = expandedDepts.includes(dept);

                return (
                  <button
                    key={dept}
                    disabled={deptCount === 0}
                    onClick={() => setExpandedDepts(prev => 
                      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
                    )}
                    className={`group relative p-8 rounded-[2.5rem] border-2 transition-all text-left flex flex-col gap-4 overflow-hidden h-44 ${
                      isExpanded 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200 dark:shadow-none translate-y-[-4px]' 
                        : deptCount === 0 
                          ? 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50 opacity-40 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:translate-y-[-4px] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none'
                    }`}
                  >
                    <div className="flex justify-between items-center relative z-10 w-full">
                      <span className={`text-2xl font-black tracking-tight ${isExpanded ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{dept}</span>
                      <div className={`p-2.5 rounded-2xl transition-all duration-300 ${
                        isExpanded ? 'bg-blue-500 text-white rotate-12' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 group-hover:rotate-12'
                      }`}>
                        <BookOpen className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black ${isExpanded ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{deptCount}</p>
                        <span className={`text-xs font-bold uppercase tracking-widest ${isExpanded ? 'text-blue-100/70' : 'text-slate-400'}`}>Students</span>
                      </div>
                    </div>
                    
                    {/* Background Pattern */}
                    <Hash className={`absolute -right-8 -bottom-8 w-40 h-40 transition-all duration-700 pointer-events-none ${
                      isExpanded ? 'text-white/10 rotate-12 scale-125' : 'text-slate-50 dark:text-slate-800/30 group-hover:rotate-45'
                    }`} />
                  </button>
                );
              })}
            </div>

            {/* Department-wise Tables */}
            <div className="space-y-12">
              {departments.map((dept) => {
                const isExpanded = expandedDepts.includes(dept);
                const deptFilteredStudents = filteredStudents.filter(s => {
                  const sDept = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department);
                  return sDept === dept;
                });

                // Auto-expand if search produces results in this dept
                const shouldShow = isExpanded || (searchQuery && deptFilteredStudents.length > 0);
                if (!shouldShow || deptFilteredStudents.length === 0) return null;

                return (
                  <div 
                    key={`registry-${dept}`} 
                    className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-8 duration-700"
                  >
                    <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/40 dark:bg-slate-800/20 backdrop-blur-sm">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm flex items-center justify-center text-blue-600 border border-slate-100 dark:border-slate-800 rotate-[-4deg]">
                           <User className="w-8 h-8" />
                         </div>
                         <div>
                           <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{dept} Department Table</h3>
                           <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{deptFilteredStudents.length} Students found</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setExpandedDepts(prev => prev.filter(d => d !== dept))}
                        className="p-4 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-red-500 shadow-sm border border-transparent hover:border-slate-200"
                      >
                        <X className="w-7 h-7" />
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto p-2">
                      <table className="w-full text-left border-separate border-spacing-y-3 px-8">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Full Profile</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Status</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Fee (Sem)</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Amount Paid</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Latest Txn</th>
                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] opacity-60 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptFilteredStudents.map((student) => {
                            const studentId = student.uid || student.id;
                            const currentSem = Number(student.semester) || 1;
                            const totalExpected = feeStructure[dept]?.[currentSem] || 0;
                            const allStudentPayments = payments.filter(p => p.studentId === studentId && Number(p.semester) === currentSem);
                            const totalPaid = allStudentPayments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0);
                            const amountDue = Math.max(0, totalExpected - totalPaid);
                            const pendingPayments = allStudentPayments.filter(p => p.status === 'pending');

                            let statusText = 'Pending Dues';
                            let statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
                            
                            if (totalExpected > 0 && amountDue <= 0) {
                              statusText = 'Fully Cleared';
                              statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                            } else if (totalPaid > 0) {
                              statusText = 'Partially Paid';
                              statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
                            } else if (totalExpected === 0) {
                              statusText = 'No Fee Plan';
                              statusColor = 'bg-slate-100 text-slate-500 border-slate-200';
                            }

                            const lastPayment = allStudentPayments.filter(p => p.status === 'confirmed').sort((a,b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime())[0];
                            const lastPaymentDate = lastPayment ? new Date(lastPayment.date || lastPayment.timestamp).toLocaleDateString() : 'Never';

                            return (
                              <tr key={studentId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all rounded-2xl overflow-hidden shadow-sm hover:shadow-md">
                                <td className="px-6 py-6 align-middle rounded-l-2xl border-y border-l border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10">
                                  <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:bg-white transition-all shadow-inner">
                                      <User className="w-7 h-7" />
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-900 dark:text-white text-lg group-hover:text-blue-600 transition-colors">{student.name}</p>
                                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        ID: {student.studentId || 'NOT_SET'} • SEM {currentSem}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-6 align-middle border-y border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10">
                                  <div className="flex flex-col gap-2 items-start">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColor}`}>
                                      {statusText}
                                    </span>
                                    {pendingPayments.length > 0 && (
                                       <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] bg-rose-600 text-white animate-pulse">
                                         Action Required
                                       </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-6 align-middle border-y border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 font-black text-slate-900 dark:text-white text-lg tracking-tight">₹{totalExpected.toLocaleString()}</td>
                                <td className="px-6 py-6 align-middle border-y border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 font-black text-emerald-600 text-lg tracking-tight">₹{totalPaid.toLocaleString()}</td>
                                <td className="px-6 py-6 align-middle border-y border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 text-xs font-black text-slate-500 uppercase tracking-widest">{lastPaymentDate}</td>
                                <td className="px-6 py-6 align-middle text-right rounded-r-2xl border-y border-r border-slate-100/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10">
                                   <button 
                                     onClick={() => setViewDetailsStudent({ ...student, expectedAmount: totalExpected, paidAmount: totalPaid, amountDue, semPayments: allStudentPayments })}
                                     className="px-6 py-3 bg-slate-950 hover:bg-blue-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
                                   >
                                     Manage Dues
                                   </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {!loading && filteredStudents.length === 0 && (
                <div className="py-40 text-center bg-white dark:bg-slate-900 rounded-[4rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-inner">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <Search className="w-12 h-12 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">No Student Records Found</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">We couldn't locate any matching records for your query. Try broadening your terms.</p>
                </div>
              )}

              {loading && (
                <div className="py-24 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute inset-0" />
                    <div className="absolute inset-4 bg-blue-600 rounded-full opacity-20 animate-ping" />
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Processing Database...</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Semester-wise Fee Structure</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Set the default payable fee for each semester and department.</p>
              </div>
              <button 
                onClick={isEditingStructure ? handleSaveStructure : () => setIsEditingStructure(true)}
                disabled={savingStructure}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 ${
                  isEditingStructure 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {savingStructure ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isEditingStructure ? (
                  <>
                    <Save className="w-4 h-4" />
                    Save Structure
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Change Structure
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {departments.map(dept => (
                <div key={dept} className="space-y-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    {dept} Department
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].filter(s => dept !== 'MCA' || s <= 4).map(sem => (
                      <div key={sem} className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Semester {sem}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                          <input 
                            type="number"
                            disabled={!isEditingStructure}
                            className={`w-full pl-7 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                              !isEditingStructure ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'hover:border-blue-300'
                            }`}
                            value={feeStructure[dept]?.[sem] || ''}
                            onChange={(e) => updateStructureValue(dept, sem, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record Cash Receipt</h3>
               <button onClick={() => {
                 setShowPaymentModal(false);
                 setStudentSearch('');
                 setPaymentStudent(null);
               }} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
             </div>
             <form onSubmit={handleTeacherPaymentReceipt} className="space-y-4 text-left">
               {isManualPayment ? (
                 <>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                       Department
                     </label>
                     <select
                       required
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-sm mb-4"
                       value={modalDepartment}
                       onChange={(e) => {
                         setModalDepartment(e.target.value);
                         setPaymentStudent(null);
                         setStudentSearch('');
                       }}
                     >
                       <option value="" disabled>Select Department</option>
                       {departments.map(d => (
                         <option key={d} value={d}>{d}</option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                       Semester
                     </label>
                     <select
                       required
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-sm mb-4"
                       value={paymentSemester}
                       onChange={(e) => {
                         setPaymentSemester(Number(e.target.value));
                         setPaymentStudent(null);
                         setStudentSearch('');
                       }}
                     >
                       {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                         <option key={sem} value={sem}>Semester {sem}</option>
                       ))}
                     </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Search Student
                      </label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input
                            type="text"
                            placeholder={!modalDepartment || !paymentSemester ? "Select Dept & Sem first" : "Search name or ID..."}
                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-sm ${(!modalDepartment || !paymentSemester) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={studentSearch}
                            onChange={(e) => {
                              setStudentSearch(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            disabled={!modalDepartment || !paymentSemester}
                          />
                        </div>

                        {showSuggestions && modalDepartment && paymentSemester && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                            {(() => {
                              const filtered = students.filter(s => {
                                const cIdName = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department) || '';
                                const sSem = Number(String(s.semester || '').replace(/\D/g, '')) || 0;
                                const matchesDept = cIdName === modalDepartment;
                                const matchesSem = sSem === paymentSemester || !s.semester;
                                if (!matchesDept || !matchesSem) return false;

                                const q = studentSearch.toLowerCase();
                                return (s.name || '').toLowerCase().includes(q) || (s.studentId || '').toLowerCase().includes(q);
                              });

                              if (filtered.length === 0) {
                                return <div className="p-4 text-xs text-slate-500 text-center">No matching students found</div>;
                              }

                              return filtered.map(s => (
                                <button
                                  key={s.id || s.uid}
                                  type="button"
                                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                                  onClick={() => {
                                    setPaymentStudent(s);
                                    setStudentSearch(s.name);
                                    setShowSuggestions(false);
                                  }}
                                >
                                  <p className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</p>
                                  <p className="text-[10px] text-slate-500">{s.studentId || 'No ID'}</p>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                      {paymentStudent && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Selected: {paymentStudent.name}</p>
                            <p className="text-[10px] text-blue-600/70">{paymentStudent.studentId || 'No ID'}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              setPaymentStudent(null);
                              setStudentSearch('');
                            }}
                            className="ml-auto p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3 text-blue-600" />
                          </button>
                        </div>
                      )}
                    </div>
                 </>
               ) : (
                 paymentStudent && (
                   <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Student: <span className="text-blue-600">{paymentStudent.name}</span></p>
                      <p className="text-xs text-slate-500">Sem {paymentSemester}</p>
                   </div>
                 )
               )}

               {paymentStudent && (() => {
                 const studentDept = cleanStr(paymentStudent?.courseId || paymentStudent?.courseName || paymentStudent?.department);
                 const targetDept = isManualPayment ? modalDepartment : studentDept;
                 const targetSemFee = feeStructure[targetDept]?.[paymentSemester] || 0;
                 const totalPaidForSem = payments
                   .filter(p => (p.studentId === paymentStudent?.id || p.studentId === paymentStudent?.uid) && Number(p.semester) === paymentSemester && p.status === 'confirmed')
                   .reduce((sum, p) => sum + Number(p.amount), 0);
                 const maxAllowed = Math.max(0, targetSemFee - totalPaidForSem);

                 return (
                   <div>
                     <div className="flex justify-between items-end mb-2">
                       <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                         Amount Received (₹)
                       </label>
                       {targetSemFee > 0 && (
                         <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full animate-in zoom-in-50 duration-300">
                           Max ₹{maxAllowed} Allowed
                         </span>
                       )}
                     </div>
                     <input
                       type="number"
                       required
                       autoFocus
                       placeholder="e.g. 5000"
                       max={targetSemFee > 0 ? maxAllowed : undefined}
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-lg"
                       value={paymentAmount}
                       onChange={(e) => {
                         const val = Number(e.target.value);
                         if (targetSemFee > 0 && val > maxAllowed) {
                           setPaymentAmount(maxAllowed.toString());
                         } else {
                           setPaymentAmount(e.target.value);
                         }
                       }}
                     />
                   </div>
                 );
               })()}

               <button 
                 type="submit"
                 disabled={!paymentAmount || !paymentStudent || (feeStructure[isManualPayment ? modalDepartment : cleanStr(paymentStudent?.courseId || paymentStudent?.courseName || paymentStudent?.department)]?.[paymentSemester] > 0 && Number(paymentAmount) > Math.max(0, (feeStructure[isManualPayment ? modalDepartment : cleanStr(paymentStudent?.courseId || paymentStudent?.courseName || paymentStudent?.department)]?.[paymentSemester] || 0) - payments.filter(p => (p.studentId === paymentStudent?.id || p.studentId === paymentStudent?.uid) && Number(p.semester) === paymentSemester && p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0)))}
                 className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 disabled:shadow-none mt-4 flex items-center justify-center gap-2"
               >
                 Confirm Receipt
                 <CheckCircle className="w-4 h-4" />
               </button>
             </form>
           </div>
         </div>
      )}

      {/* Student Details Modal */}
      {viewDetailsStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="text-blue-600 w-6 h-6" />
                Student Details
              </h3>
              <button 
                onClick={() => setViewDetailsStudent(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* Profile Info */}
              <div className="flex gap-4 items-center mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-blue-600">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{viewDetailsStudent.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ID: {viewDetailsStudent.studentId || viewDetailsStudent.uid || 'N/A'} • 
                    Dept: {cleanStr(viewDetailsStudent.courseId) || cleanStr(viewDetailsStudent.courseName) || cleanStr(viewDetailsStudent.department) || 'N/A'} • 
                    Sem: {viewDetailsStudent.semester || 1}
                  </p>
                </div>
              </div>

              {/* Financial Status */}
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Financial Status (Semester {viewDetailsStudent.semester || 1})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Sem Fee</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">₹{viewDetailsStudent.expectedAmount.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30">
                  <p className="text-xs text-green-600 dark:text-green-500 font-bold uppercase tracking-wider mb-1">Sem Paid</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">₹{viewDetailsStudent.paidAmount.toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                  <p className="text-xs text-orange-600 dark:text-orange-500 font-bold uppercase tracking-wider mb-1">Sem Left</p>
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-400">₹{viewDetailsStudent.amountDue.toLocaleString()}</p>
                </div>
              </div>

              {/* Payment History */}
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Payment Transactions</h4>
              {viewDetailsStudent.semPayments.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">No records found for this semester.</p>
              ) : (
                <div className="space-y-3">
                  {viewDetailsStudent.semPayments.sort((a: any, b: any) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()).map((p: any) => (
                    <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900 dark:text-white text-lg">₹{Number(p.amount).toLocaleString()}</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">Txn ID: {p.transactionId}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(p.date || p.timestamp).toLocaleString()}</p>
                      </div>
                      {p.status === 'pending' && (
                        <button 
                          onClick={() => {
                            confirmPayment(p.id);
                            setViewDetailsStudent((prev: any) => ({
                              ...prev,
                              semPayments: prev.semPayments.map((sp: any) => sp.id === p.id ? { ...sp, status: 'confirmed' } : sp),
                              paidAmount: prev.paidAmount + Number(p.amount),
                              amountDue: Math.max(0, prev.expectedAmount - (prev.paidAmount + Number(p.amount)))
                            }));
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                        >
                          Verify Payment
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
