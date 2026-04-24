import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, getDoc, setDoc, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  CreditCard, 
  BookOpen,
  Search, 
  Filter, 
  CheckCircle, 
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
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStudent, setPaymentStudent] = useState<any>(null);
  const [paymentSemester, setPaymentSemester] = useState<number>(0);
  const [isManualPayment, setIsManualPayment] = useState(false);

  const [feeStructure, setFeeStructure] = useState<any>({
    BCA: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    BSC: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    BTECH: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    MCA: { 1: 0, 2: 0, 3: 0, 4: 0 }
  });

  const departments = ['BCA', 'BSC', 'BTECH', 'MCA'];
  const [savingStructure, setSavingStructure] = useState(false);
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
    
    // Convert old single 'courseId' document dropdown selections
    if (selectedCourse !== 'all' && selectedCourse) {
       // A very rough match against courses created by admin
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
                 setPaymentAmount('');
                 setIsManualPayment(true);
                 setShowPaymentModal(true);
               }}
               className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all text-sm flex items-center gap-2"
             >
               + Record Payment
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
          <>
            {/* Filters & Search */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search student name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 outline-none"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="all">All Departments/Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <optgroup label="Raw Departments">
                     {departments.map(d => <option key={`RAW_${d}`} value={d}>{d}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Fee Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status & Ledger</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-12 text-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-12 text-center text-slate-500 dark:text-slate-400">
                        No students found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const studentId = student.uid || student.id;
                      const dept = cleanStr(student.courseId) || cleanStr(student.courseName) || cleanStr(student.department);
                      const currentSem = Number(student.semester) || 1;
                      
                      // For dashboard cleanliness, only show their current active semester calculation
                      const expectedAmount = feeStructure[dept]?.[currentSem] || 0;
                      
                      const semPayments = payments.filter(p => p.studentId === studentId && Number(p.semester) === currentSem);
                      const paidAmount = semPayments
                         .filter(p => p.status === 'confirmed')
                         .reduce((sum, p) => sum + Number(p.amount), 0);
                      
                      const pendingPayments = semPayments.filter(p => p.status === 'pending');
                         
                      const amountDue = Math.max(0, expectedAmount - paidAmount);
                      
                      let statusText = 'Due';
                      let statusColor = 'bg-orange-100 text-orange-700';
                      
                      if (amountDue <= 0 && expectedAmount > 0) {
                        statusText = 'Full Paid';
                        statusColor = 'bg-green-100 text-green-700';
                      } else if (paidAmount > 0) {
                        statusText = 'Partly Paid';
                        statusColor = 'bg-blue-100 text-blue-700';
                      } else if (expectedAmount === 0) {
                        statusText = 'No Fee Set';
                        statusColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
                      }

                      return (
                        <tr key={studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 align-top w-1/3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center shrink-0">
                                <User className="text-blue-600 w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{student.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {dept || 'No Dept'} • Sem {currentSem} • ID: {student.studentId || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-top w-1/3">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                  {statusText}
                                </span>
                                {pendingPayments.length > 0 && (
                                   <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 shrink-0">
                                     Verification Pending!
                                   </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-[10px] uppercase text-slate-400 font-bold">Total Due</p>
                                  <p className="font-bold text-slate-900 dark:text-white">₹{expectedAmount.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-slate-400 font-bold">Total Paid</p>
                                  <p className="font-bold text-green-600">₹{paidAmount.toLocaleString()}</p>
                                </div>
                              </div>
                              
                              {/* Pending Approvals Queue */}
                              {pendingPayments.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {pendingPayments.map(p => (
                                    <div key={p.id} className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                                      <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">₹{Number(p.amount).toLocaleString()}</p>
                                        <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                          <Hash className="w-3 h-3" /> {p.transactionId}
                                        </p>
                                      </div>
                                      <button 
                                        onClick={() => confirmPayment(p.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm"
                                      >
                                        Verify
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-top text-right w-1/3">
                            <div className="flex flex-col sm:flex-row justify-end gap-2">
                               {amountDue > 0 ? (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setPaymentStudent(student);
                                        setPaymentSemester(currentSem);
                                        setPaymentAmount(amountDue.toString());
                                        setIsManualPayment(false);
                                        setShowPaymentModal(true);
                                      }}
                                      className="px-4 py-2 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                                    >
                                      Mark Full Paid
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setPaymentStudent(student);
                                        setPaymentSemester(currentSem);
                                        setPaymentAmount('');
                                        setIsManualPayment(false);
                                        setShowPaymentModal(true);
                                      }}
                                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                                    >
                                      Mark Partly Paid
                                    </button>
                                  </>
                               ) : expectedAmount > 0 ? (
                                  <span className="text-green-600 font-bold text-sm flex items-center gap-1 justify-end mt-2">
                                    <CheckCircle className="w-4 h-4" /> Cleared
                                  </span>
                               ) : (
                                  <span className="text-slate-400 text-xs italic mt-2 inline-block">Set fee first</span>
                               )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Semester-wise Fee Structure</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Set the default payable fee for each semester and department.</p>
              </div>
              <button 
                onClick={handleSaveStructure}
                disabled={savingStructure}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {savingStructure ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save Structure
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
                            className="w-full pl-7 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
               <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
             </div>
             <form onSubmit={handleTeacherPaymentReceipt} className="space-y-4 text-left">
               {isManualPayment ? (
                 <>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                       Select Student
                     </label>
                     <select
                       required
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-sm"
                       value={paymentStudent?.id || paymentStudent?.uid || ''}
                       onChange={(e) => {
                         const student = students.find(s => s.id === e.target.value || s.uid === e.target.value);
                         setPaymentStudent(student || null);
                       }}
                     >
                       <option value="" disabled>Select a student</option>
                       {students.map(s => (
                         <option key={s.id || s.uid} value={s.id || s.uid}>
                           {s.name} ({s.courseName || s.department || 'N/A'})
                         </option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                       Semester
                     </label>
                     <select
                       required
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-sm"
                       value={paymentSemester}
                       onChange={(e) => setPaymentSemester(Number(e.target.value))}
                     >
                       {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                         <option key={sem} value={sem}>Semester {sem}</option>
                       ))}
                     </select>
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
               <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                   Amount Received (₹)
                 </label>
                 <input
                   type="number"
                   required
                   autoFocus
                   placeholder="e.g. 5000"
                   className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all text-lg"
                   value={paymentAmount}
                   onChange={(e) => setPaymentAmount(e.target.value)}
                 />
               </div>
               <button 
                 type="submit"
                 disabled={!paymentAmount}
                 className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 disabled:shadow-none mt-4"
               >
                 Confirm Receipt
               </button>
             </form>
           </div>
         </div>
      )}
    </div>
  );
}
