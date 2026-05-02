import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  CreditCard, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ArrowLeft,
  Loader2,
  Hash,
  XCircle,
  User,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PaymentHistory({ isEmbedded }: { isEmbedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'offline' | 'online' | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [feeStructure, setFeeStructure] = useState<any>({});

  useEffect(() => {
    if (!profile) return;

    // Fetch global fee structure in real-time
    const unsubStructure = onSnapshot(
      doc(db, 'config', 'feeStructure'),
      (snapshot) => {
        if (snapshot.exists()) setFeeStructure(snapshot.data());
      },
      (error) => console.error("Error fetching fee structure:", error)
    );

    fetchPayments();

    return () => unsubStructure();
  }, [profile]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Fetch all payments made by this student
      const studentIds = [profile?.uid, profile?.studentId, profile?.id].filter(Boolean);
      let loadedPayments: any[] = [];
      if (studentIds && studentIds.length > 0) {
        const q = query(collection(db, 'payments'), where('studentId', 'in', studentIds));
        const querySnapshot = await getDocs(q);
        loadedPayments = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setPayments(loadedPayments);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId || !selectedSemester || !profile || !paymentAmount) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'payments'), {
        studentId: profile.uid,
        studentName: profile.name,
        semester: selectedSemester,
        courseId: profile.courseId || profile.department || profile.courseName || '',
        amount: Number(paymentAmount),
        transactionId,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      await addDoc(collection(db, 'notifications'), {
        title: 'New Fee Payment Submitted',
        message: `${profile.name} has submitted a fee payment of ₹${paymentAmount} (Tx: ${transactionId}) for Sem ${selectedSemester}.`,
        targetRole: 'teacher',
        timestamp: new Date().toISOString(),
        read: false
      });

      setSelectedSemester(null);
      setTransactionId('');
      setPaymentAmount('');
      setPaymentMethod(null);
      alert('Payment reference submitted successfully! Teacher will verify it soon.');
      fetchPayments();
    } catch (error) {
      console.error("Error submitting payment:", error);
      alert('Failed to submit payment reference.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract clean dept name
  const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
  const dept = cleanStr(profile?.courseId) || cleanStr(profile?.courseName) || cleanStr(profile?.department) || 'BCA';
  const currentSem = Number(profile?.semester) || 1;

  // Generate an array of semesters from 1 to the student's current semester
  const semestersDue = Array.from({ length: currentSem }, (_, i) => i + 1);

  return (
    <div className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-6 ${isEmbedded ? '' : 'pb-24 pt-12'}`}>
      {!isEmbedded && (
        <button 
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-tight">
            <div className="w-12 h-12 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl flex items-center justify-center">
              <CreditCard className="text-wa-teal w-7 h-7" />
            </div>
            Accounts Hub
          </h1>
          <p className="text-[#8696a0] font-semibold mt-1">Manage your course fees and payment archives</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-wa-teal animate-spin" />
            </div>
            <p className="text-[#8696a0] font-black uppercase tracking-[0.2em] text-[10px]">Loading Ledger...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Side: Payment History */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em] flex items-center gap-2">
                   <Clock className="w-4 h-4" /> Recent Transactions
                </h2>
                <span className="text-[10px] font-black text-wa-teal bg-wa-teal/10 px-3 py-1 rounded-full uppercase tracking-widest">{payments.length} Records</span>
              </div>
              
              {payments.length === 0 ? (
                <div className="bg-white dark:bg-[#202c33] p-12 rounded-[2.5rem] border border-slate-50 dark:border-white/5 text-center shadow-sm">
                  <div className="w-16 h-16 bg-[#f0f2f5] dark:bg-[#111b21] rounded-full flex items-center justify-center mx-auto mb-4">
                     <Clock className="w-8 h-8 text-[#8696a0]/20" />
                  </div>
                  <p className="text-[#8696a0] font-black uppercase tracking-widest text-xs">No transaction history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(payment => (
                    <div key={payment.id} className="bg-white dark:bg-[#202c33] p-6 rounded-[2rem] border border-slate-50 dark:border-white/5 flex justify-between items-center transition-all hover:shadow-md hover:border-wa-teal/30 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                          payment.status === 'confirmed' ? 'bg-wa-green/10 text-wa-green' :
                          payment.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                          'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
                        }`}>
                           {payment.status === 'confirmed' ? <CheckCircle className="w-6 h-6" /> : 
                            payment.status === 'rejected' ? <XCircle className="w-6 h-6" /> : 
                            <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 dark:text-[#e9edef] text-xl tracking-tight">₹{Number(payment.amount).toLocaleString()}</p>
                            <span className="text-[10px] font-black text-[#8696a0]/50 uppercase tracking-widest italic">• Sem {payment.semester}</span>
                          </div>
                          <p className="text-[10px] text-[#8696a0] font-mono mt-1 uppercase flex items-center gap-1.5 font-bold">
                            <Hash className="w-3 h-3" /> {payment.transactionId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${
                            payment.status === 'confirmed' ? 'bg-wa-green/10 text-wa-green' :
                            payment.status === 'rejected' ? 'bg-red-50 text-red-500' :
                            'bg-orange-50 text-orange-500'
                          }`}>
                            {payment.status}
                          </div>
                          <p className="text-[9px] text-[#8696a0] font-bold">
                            {new Date(payment.timestamp || payment.date).toLocaleDateString()}
                          </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side: Pay Now Dashboard */}
            <div className="space-y-6">
              <div className="px-2">
                <h2 className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em] flex items-center gap-2">
                   <Info className="w-4 h-4" /> Billing Status
                </h2>
              </div>

              {(() => {
                const getExpectedFee = () => {
                  if (!feeStructure || Object.keys(feeStructure).length === 0) return { amount: 0, deptName: 'BCA' };
                  
                  const studentDept = (profile?.courseId || profile?.courseName || profile?.department || '').trim();
                  const sem = Number(profile?.semester) || 1;

                  if (feeStructure[studentDept] && feeStructure[studentDept][sem] !== undefined) {
                    return { amount: feeStructure[studentDept][sem], deptName: studentDept };
                  }

                  const upperDept = studentDept.toUpperCase();
                  if (feeStructure[upperDept] && feeStructure[upperDept][sem] !== undefined) {
                    return { amount: feeStructure[upperDept][sem], deptName: upperDept };
                  }

                  const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
                  const cleanedStudentDept = cleanStr(studentDept) || 'BCA';
                  
                  const matchingKey = Object.keys(feeStructure).find(key => cleanStr(key) === cleanedStudentDept);
                  if (matchingKey && feeStructure[matchingKey][sem] !== undefined) {
                    return { amount: feeStructure[matchingKey][sem], deptName: matchingKey };
                  }

                  return { amount: 0, deptName: studentDept || 'BCA' };
                };

                const expectedFeeResult = getExpectedFee();
                const expectedAmount = expectedFeeResult.amount;
                const currentDept = expectedFeeResult.deptName;

                const sem = Number(profile?.semester) || 1;
                const semPayments = payments.filter(p => Number(p.semester) === sem);
                const paidAmount = semPayments
                  .filter(p => p.status === 'confirmed')
                  .reduce((sum, p) => sum + Number(p.amount), 0);
                const pendingAmount = semPayments
                  .filter(p => p.status === 'pending')
                  .reduce((sum, p) => sum + Number(p.amount), 0);
                const dueAmount = Math.max(0, expectedAmount - paidAmount);

                if (expectedAmount === 0 || dueAmount === 0) {
                    return (
                       <div className="bg-gradient-to-br from-wa-teal to-wa-teal-dark p-12 rounded-[3rem] shadow-xl text-center text-white relative overflow-hidden group">
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                          <div className="relative z-10">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                               <CheckCircle className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-black mb-3 tracking-tight">Sem {sem} Fully Paid!</h3>
                            <p className="text-[#e9edef] font-medium max-w-[240px] mx-auto text-sm leading-relaxed opacity-80 italic">"Grateful for your support in building this center of excellence."</p>
                          </div>
                          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                       </div>
                    );
                }

                return (
                    <div className="space-y-6">
                        <div key={sem} className="bg-white dark:bg-[#202c33] p-8 rounded-[3rem] shadow-sm border border-slate-50 dark:border-white/5 space-y-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${paidAmount > 0 ? 'bg-wa-teal/10 text-wa-teal' : 'bg-red-50 text-red-600'}`}>
                                    {paidAmount > 0 ? 'Partly Paid' : 'Due Notification'}
                                </span>
                            </div>

                            <div>
                                <h3 className="font-black text-slate-900 dark:text-[#e9edef] text-2xl tracking-tight mb-1">Semester {sem} Fees</h3>
                                <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest flex items-center gap-2">
                                  Academic Program: <span className="text-wa-teal">{currentDept}</span>
                                </p>
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center p-4 bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl">
                                    <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest">Expected Total</p>
                                    <p className="font-black text-slate-900 dark:text-[#e9edef] text-xl tracking-tight">₹{expectedAmount.toLocaleString()}</p>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-wa-green/5 rounded-2xl border border-wa-green/10">
                                    <p className="text-[10px] font-black text-wa-green uppercase tracking-widest">Archive Total Paid</p>
                                    <p className="font-black text-wa-green text-xl tracking-tight">₹{paidAmount.toLocaleString()}</p>
                                </div>
                                {pendingAmount > 0 && (
                                    <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">Processing Reference</p>
                                        <p className="font-black text-orange-500 text-xl tracking-tight">₹{pendingAmount.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-8 border-t border-slate-50 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="text-center md:text-left">
                                    <p className="text-[9px] text-red-500 uppercase font-black tracking-[0.3em] mb-1">Current Outstanding Due</p>
                                    <div className="flex items-baseline gap-2">
                                       <p className="text-4xl font-black text-red-600 tracking-tighter">₹{dueAmount.toLocaleString()}</p>
                                       <span className="text-sm font-bold text-red-500/50 uppercase italic">/ Sem {sem}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedSemester(sem)}
                                    className="w-full md:w-auto bg-wa-teal hover:bg-wa-teal/90 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl shadow-wa-teal/20 active:scale-95 group flex items-center justify-center gap-3"
                                >
                                    <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" /> Sync Payment
                                </button>
                            </div>
                        </div>
                    </div>
                );
              })()
            }

            <div className="bg-white dark:bg-[#202c33] p-8 rounded-[3rem] shadow-sm border border-slate-50 dark:border-white/5">
               <h3 className="text-lg font-black text-slate-900 dark:text-[#e9edef] mb-6 flex items-center gap-3 tracking-tight">
                  <Info className="w-5 h-5 text-wa-teal" />
                  Account Support
               </h3>
               <div className="space-y-4">
                  <div className="p-4 bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl">
                     <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest mb-1">Tuition Accountant</p>
                     <p className="font-bold text-slate-900 dark:text-[#e9edef]">B.M Sir Admission Cell</p>
                  </div>
                  <div className="p-4 bg-wa-teal/5 rounded-2xl border border-wa-teal/10">
                     <p className="text-[10px] font-black text-wa-teal uppercase tracking-widest leading-relaxed">
                        * All online payments are verified within 24-48 business hours. Please keep your transaction ID safe for future reference.
                     </p>
                  </div>
               </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedSemester && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[130] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-[3rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-white/10 relative">
            <button 
              onClick={() => {
                setSelectedSemester(null);
                setPaymentMethod(null);
                setTransactionId('');
                setPaymentAmount('');
              }}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-[#f0f2f5] dark:bg-slate-800 rounded-full text-[#8696a0] hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-[#e9edef] tracking-tight">Sync Payment</h3>
              <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest mt-1">Select your preferred verification method</p>
            </div>

            {!paymentMethod ? (
              <div className="space-y-4">
                <button 
                  onClick={() => setPaymentMethod('offline')}
                  className="w-full p-6 bg-[#f0f2f5] dark:bg-[#111b21] border-2 border-transparent hover:border-wa-teal rounded-[2rem] flex items-center gap-5 transition-all group shadow-sm active:scale-95"
                >
                  <div className="w-14 h-14 bg-white dark:bg-[#202c33] rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <User className="text-[#8696a0] w-7 h-7 group-hover:text-wa-teal" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900 dark:text-[#e9edef] text-lg tracking-tight uppercase">Cash Register</p>
                    <p className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Pay directly at front desk</p>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('online')}
                  className="w-full p-6 bg-[#f0f2f5] dark:bg-[#111b21] border-2 border-transparent hover:border-wa-teal rounded-[2rem] flex items-center gap-5 transition-all group shadow-sm active:scale-95"
                >
                  <div className="w-14 h-14 bg-wa-teal rounded-2xl flex items-center justify-center shadow-lg shadow-wa-teal/20 group-hover:scale-110 transition-transform">
                    <CreditCard className="text-white w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900 dark:text-[#e9edef] text-lg tracking-tight uppercase">Digital Sync</p>
                    <p className="text-[10px] font-bold text-[#8696a0] uppercase tracking-widest">Submit UPI reference</p>
                  </div>
                </button>
              </div>
            ) : paymentMethod === 'offline' ? (
              <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-24 h-24 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto transition-transform hover:scale-110">
                  <User className="w-12 h-12 text-wa-teal" />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em]">Contact Accounts Manager</p>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-[#e9edef] tracking-tight">Barun Maity (B.M) Sir</h4>
                  <a 
                    href="tel:+919775220895" 
                    className="inline-flex items-center gap-3 text-wa-teal px-6 py-3 bg-wa-teal/10 rounded-2xl font-black text-xl hover:bg-wa-teal/20 transition-all shadow-sm"
                  >
                    +91 9775220895
                  </a>
                </div>
                <div className="p-6 bg-wa-teal/5 rounded-3xl border border-wa-teal/10 italic">
                  <p className="text-[11px] text-wa-teal leading-relaxed font-semibold">
                    "Please visit the tuition center hub during working hours (10AM - 6PM) to complete your manual cash sync."
                  </p>
                </div>
                <button 
                  onClick={() => setPaymentMethod(null)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-[#8696a0] hover:bg-[#f0f2f5] rounded-2xl transition-all"
                >
                  Back to Hub
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-6">
                  <div className="bg-[#f0f2f5] dark:bg-white p-6 rounded-[2.5rem] inline-block shadow-inner relative group border-4 border-slate-50">
                    <img 
                      src="https://picsum.photos/seed/qr/400/400" 
                      alt="Tuition QR Sink" 
                      className="w-48 h-48 mx-auto rounded-xl group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-wa-teal/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                       <CreditCard className="w-12 h-12 text-wa-teal animate-bounce" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-wa-teal uppercase tracking-[0.2em]">Sem {selectedSemester} Tuition Sink</p>
                    <p className="text-[10px] text-[#8696a0] italic px-6 font-semibold opacity-60 leading-relaxed">
                      "Education is the legacy you build. Your contribution ensures we provide the best tools for your future."
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-5 text-left">
                  <div className="group">
                    <label className="block text-[10px] font-black text-[#8696a0] uppercase tracking-widest mb-2 ml-1 group-focus-within:text-wa-teal transition-colors">
                      Amount Disburst (₹)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      className="w-full px-5 py-4 bg-[#f0f2f5] dark:bg-[#111b21] border-2 border-transparent focus:border-wa-teal rounded-2xl outline-none text-slate-900 dark:text-[#e9edef] font-black transition-all"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                
                  <div className="group">
                    <label className="block text-[10px] font-black text-[#8696a0] uppercase tracking-widest mb-2 ml-1 group-focus-within:text-wa-teal transition-colors">
                      Transaction ID / UTR Sync
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696a0] w-5 h-5 group-focus-within:text-wa-teal transition-colors" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. UPI-1234..."
                        className="w-full pl-12 pr-5 py-4 bg-[#f0f2f5] dark:bg-[#111b21] border-2 border-transparent focus:border-wa-teal rounded-2xl outline-none text-slate-900 dark:text-[#e9edef] font-mono font-bold transition-all"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setPaymentMethod(null)}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-[#8696a0] bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-100 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={!transactionId || !paymentAmount || submitting}
                      className="flex-[2] py-4 bg-wa-teal text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-wa-teal/20 hover:bg-wa-teal/90 transition-all disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-3 overflow-hidden active:scale-95"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sync Proof Archive'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
