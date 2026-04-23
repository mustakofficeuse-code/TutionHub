import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, where, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  CreditCard, 
  BookOpen,
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  Plus,
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
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFee, setShowAddFee] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [modalDepartment, setModalDepartment] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [semester, setSemester] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
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

  useEffect(() => {
    // Auto-populate amount when department and semester are selected
    if (showAddFee && modalDepartment && semester && feeStructure[modalDepartment]) {
      const structFee = feeStructure[modalDepartment][semester] || 0;
      setAmount(structFee.toString());
    }
  }, [modalDepartment, semester, showAddFee, feeStructure]);

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
      
      // Sync pending fees with new structure
      const feesQuery = query(collection(db, 'fees'), where('status', '==', 'pending'));
      const feesSnap = await getDocs(feesQuery);
      
      const updatePromises = feesSnap.docs.map(async (feeDoc) => {
        const feeData = feeDoc.data();
        const dept = feeData.courseId?.toUpperCase();
        const sem = feeData.semester;
        
        if (dept && sem && feeStructure[dept] && feeStructure[dept][sem] !== undefined) {
          const newAmount = feeStructure[dept][sem];
          if (newAmount !== feeData.amount) {
            await updateDoc(doc(db, 'fees', feeDoc.id), { amount: newAmount });
          }
        }
      });
      
      await Promise.all(updatePromises);
      alert('Fee structure updated and all pending student fees have been synchronized!');
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
      // Instead of an exact where() query which might miss capitalization differences, fetch all users and filter
      const userSnap = await getDocs(collection(db, 'users'));
      const allUsers = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const studentUsers = allUsers.filter(u => String(u.role).toLowerCase() === 'student' || u.studentId);
      setStudents(studentUsers);

      const courseSnap = await getDocs(collection(db, 'courses'));
      setCourses(courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const feeSnap = await getDocs(collection(db, 'fees'));
      setFees(feeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const paymentSnap = await getDocs(collection(db, 'payments'));
      setPayments(paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching fee data:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (paymentId: string, feeId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), { status: 'confirmed' });
      await updateDoc(doc(db, 'fees', feeId), { status: 'paid' });
      fetchData();
    } catch (error) {
      console.error("Error confirming payment:", error);
    }
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.uid === selectedStudent);
    try {
      await addDoc(collection(db, 'fees'), {
        studentId: selectedStudent,
        courseId: student?.courseName || modalDepartment || '', // Save readable courseName or department if possible
        amount: Number(amount),
        dueDate,
        semester,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setShowAddFee(false);
      setModalDepartment('');
      setSemester('');
      setSelectedStudent('');
      setAmount('');
      setDueDate('');
      fetchData();
    } catch (error) {
      console.error("Error adding fee:", error);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL payment and fee history?")) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const feesSnap = await getDocs(collection(db, 'fees'));
      feesSnap.forEach(docSnap => batch.delete(docSnap.ref));
      
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      paymentsSnap.forEach(docSnap => batch.delete(docSnap.ref));
      
      await batch.commit();
      alert("All fee and payment data successfully wiped!");
      fetchData();
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("Failed to clear data");
      setLoading(false);
    }
  };

  const updateFeeStatus = async (feeId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'fees', feeId), { status });
      fetchData();
    } catch (error) {
      console.error("Error updating fee status:", error);
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="text-blue-600 w-7 h-7" />
              Fee Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Track and manage student tuition fees</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleClearData}
              className="px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-2xl font-bold transition-all text-sm"
            >
              Wipe Test Data
            </button>
            <button 
              onClick={() => setShowAddFee(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
            >
              <Plus className="w-5 h-5" /> Create Fee Entry
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
            Payment History
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
                  placeholder="Search student name..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-950 text-slate-600 rounded-xl text-sm font-semibold border border-slate-200 outline-none"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="all">All Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="px-4 py-2 bg-slate-50 dark:bg-slate-950 text-slate-600 rounded-xl text-sm font-semibold flex items-center gap-2 border border-slate-200 hover:bg-slate-100">
                  <Filter className="w-4 h-4" /> Filter
                </button>
              </div>
            </div>

            {/* Fee Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due Date</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : fees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                        No fee records found.
                      </td>
                    </tr>
                  ) : (
                    fees
                      .filter(f => selectedCourse === 'all' || f.courseId === selectedCourse)
                      .map((fee) => {
                        const student = students.find(s => s.uid === fee.studentId);
                        return (
                          <tr key={fee.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                                  <User className="text-blue-600 w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{student?.name || 'Unknown Student'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{student?.courseName || 'No Course'}</p>
                                </div>
                              </div>
                            </td>
                          <td className="p-4 font-bold text-slate-900 dark:text-white">₹{fee.amount.toLocaleString()}</td>
                          <td className="p-4 text-sm text-slate-600">{new Date(fee.dueDate).toLocaleDateString()}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              fee.status === 'paid' ? 'bg-green-100 text-green-700' :
                              fee.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {fee.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              {fee.status === 'pending' && (
                                <div className="flex flex-col items-end gap-2">
                                  {payments.filter(p => p.feeId === fee.id && p.status === 'pending').map(p => (
                                    <div key={p.id} className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-left min-w-[150px]">
                                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> Ref: {p.transactionId}
                                      </p>
                                      <button 
                                        onClick={() => confirmPayment(p.id, fee.id)}
                                        className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1 rounded transition-all"
                                      >
                                        Confirm
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fee.status !== 'paid' && fee.status !== 'pending' && (
                                <button 
                                  onClick={() => updateFeeStatus(fee.id, 'paid')}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                              )}
                              <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                <MoreVertical className="w-5 h-5" />
                              </button>
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

      {/* Add Fee Modal */}
      {showAddFee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Create Fee Entry</h3>
            <form onSubmit={handleAddFee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={modalDepartment}
                    onChange={(e) => {
                      setModalDepartment(e.target.value);
                      setSelectedStudent(''); // Reset student when dept changes
                    }}
                  >
                    <option value="">Select Dept</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={semester}
                    onChange={(e) => {
                      setSemester(e.target.value);
                      setSelectedStudent(''); // Reset student when sem changes
                    }}
                  >
                    <option value="">Select Sem</option>
                    {[1,2,3,4,5,6,7,8].filter(s => modalDepartment !== 'MCA' || s <= 4).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Student</label>
                <select
                  required
                  disabled={!modalDepartment || !semester}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 text-slate-900 dark:text-white"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">
                    {!modalDepartment || !semester ? 'Select Dept & Sem first' : 'Choose Student'}
                  </option>
                  
                  {/* Matching Students */}
                  <optgroup label={`Matches: ${modalDepartment} Sem ${semester}`}>
                    {students
                      .filter(s => {
                        const cleanStr = (str) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
                        const cleanNum = (str) => String(str || '').replace(/\D/g, '');
                        const rawDept = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department) || '';
                        return rawDept === cleanStr(modalDepartment) && cleanNum(s.semester) === cleanNum(semester);
                      })
                      .map(s => <option key={s.id} value={s.uid || s.id}>{s.name} ({s.studentId || 'No ID'})</option>)}
                  </optgroup>

                  {/* Other Students */}
                  <optgroup label="Other Students">
                    {students
                      .filter(s => {
                        const cleanStr = (str) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
                        const cleanNum = (str) => String(str || '').replace(/\D/g, '');
                        const rawDept = cleanStr(s.courseId) || cleanStr(s.courseName) || cleanStr(s.department) || '';
                        return !(rawDept === cleanStr(modalDepartment) && cleanNum(s.semester) === cleanNum(semester));
                      })
                      .map(s => <option key={s.id} value={s.uid || s.id}>{s.name} ({s.courseName || s.courseId || s.department || 'No Dept'} Sem {s.semester || '?'})</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Auto-filled"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddFee(false);
                    setModalDepartment('');
                    setSemester('');
                    setSelectedStudent('');
                    setAmount('');
                    setDueDate('');
                  }}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
