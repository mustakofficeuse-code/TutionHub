import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, getDoc, doc } from 'firebase/firestore';
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

export default function PaymentHistory() {
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
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      // Fetch global fee structure
      const structSnap = await getDoc(doc(db, 'config', 'feeStructure'));
      if (structSnap.exists()) {
        setFeeStructure(structSnap.data());
      }
      
      // Fetch all payments made by this student
      const studentIds = [profile?.uid, profile?.studentId, profile?.id].filter(Boolean);
      let loadedPayments: any[] = [];
      if (studentIds.length > 0) {
        const q = query(collection(db, 'payments'), where('studentId', 'in', studentIds));
        const querySnapshot = await getDocs(q);
        loadedPayments = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setPayments(loadedPayments);
    } catch (error) {
      console.error("Error fetching fee details:", error);
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
        semester: selectedSemester,
        courseId: profile.courseId || profile.department || profile.courseName || '',
        amount: Number(paymentAmount),
        transactionId,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      setSelectedSemester(null);
      setTransactionId('');
      setPaymentAmount('');
      setPaymentMethod(null);
      alert('Payment reference submitted successfully! Teacher will verify it soon.');
      fetchData();
    } catch (error) {
      console.error("Error submitting payment:", error);
      alert('Failed to submit payment reference.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract clean dept name
  const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
  const dept = cleanStr(profile?.courseId) || cleanStr(profile?.courseName) || cleanStr(profile?.department) || '';
  const currentSem = Number(profile?.semester) || 1;

  // Generate an array of semesters from 1 to the student's current semester
  const semestersDue = Array.from({ length: currentSem }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="text-blue-600 w-7 h-7" />
            Fees & Payments
          </h1>
          <p className="text-slate-500 dark:text-slate-400">View your fee status and payment history</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side: Payment History */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-slate-400" /> Payment History
              </h2>
              {payments.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-slate-500 dark:text-slate-400">No payment history found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(payment => (
                    <div key={payment.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center transition-all hover:shadow-md">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900 dark:text-white text-lg">₹{Number(payment.amount).toLocaleString()}</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            payment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            payment.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {payment.transactionId}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(payment.timestamp || payment.date).toLocaleString()} • Sem {payment.semester}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        {payment.status === 'confirmed' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Clock className="w-5 h-5" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side: Pay Now Dashboard */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-slate-400" /> Pay Now Dashboard
              </h2>
              {(() => {
                let hasAnyDues = false;
                
                // Find the first semester with due fees
                const firstDueSem = semestersDue.find(sem => {
                    const expectedAmount = feeStructure[dept]?.[sem] || 0;
                    const semPayments = payments.filter(p => Number(p.semester) === sem);
                    const paidAmount = semPayments
                      .filter(p => p.status === 'confirmed')
                      .reduce((sum, p) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, expectedAmount - paidAmount);
                    return expectedAmount > 0 && dueAmount > 0;
                });

                if (!firstDueSem) {
                    return (
                       <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 rounded-3xl shadow-lg text-center text-white">
                          <CheckCircle className="w-16 h-16 text-white/80 mx-auto mb-4" />
                          <h3 className="text-2xl font-bold mb-2">Fully Paid!</h3>
                          <p className="text-green-50">You have no pending dues or uninitialized fees.</p>
                       </div>
                    );
                }

                const sem = firstDueSem;
                const expectedAmount = feeStructure[dept]?.[sem] || 0;
                const semPayments = payments.filter(p => Number(p.semester) === sem);
                const paidAmount = semPayments
                  .filter(p => p.status === 'confirmed')
                  .reduce((sum, p) => sum + Number(p.amount), 0);
                const pendingAmount = semPayments
                  .filter(p => p.status === 'pending')
                  .reduce((sum, p) => sum + Number(p.amount), 0);
                const dueAmount = Math.max(0, expectedAmount - paidAmount);

                return (
                    <div key={sem} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6 mb-4">
                      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg">Semester {sem} Tuition Fee</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Department: {dept}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                           {paidAmount > 0 ? 'Partly Paid' : 'Due'}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Expected Fee</p>
                          <p className="font-bold text-slate-900 dark:text-white">₹{expectedAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Paid Amount</p>
                          <p className="font-bold text-green-600">₹{paidAmount.toLocaleString()}</p>
                        </div>
                        {pendingAmount > 0 && (
                          <div className="flex justify-between items-center text-orange-500 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30">
                            <p className="text-sm font-bold uppercase tracking-wider">Processing</p>
                            <p className="font-bold">₹{pendingAmount.toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div>
                           <p className="text-xs text-red-500 uppercase font-bold tracking-wider mb-1">Remaining Due</p>
                           <p className="text-3xl font-bold text-red-600">₹{dueAmount.toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedSemester(sem)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                        >
                          <Upload className="w-5 h-5" /> Pay Now
                        </button>
                      </div>
                    </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedSemester && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Choose Payment Method</h3>
              <button 
                onClick={() => {
                  setSelectedSemester(null);
                  setPaymentMethod(null);
                  setTransactionId('');
                  setPaymentAmount('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {!paymentMethod ? (
              <div className="space-y-4">
                <button 
                  onClick={() => setPaymentMethod('offline')}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:border-blue-500 transition-all group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Hash className="text-slate-600 dark:text-slate-400 w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 dark:text-white">Off-Line (Cash)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pay directly at the center</p>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('online')}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:border-blue-500 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none group-hover:scale-110 transition-transform">
                    <CreditCard className="text-white w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 dark:text-white">On-Line (UPI)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Scan QR code to pay</p>
                  </div>
                </button>
              </div>
            ) : paymentMethod === 'offline' ? (
              <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-600 dark:text-slate-400">For cash payments, please contact:</p>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">Barun Maity (B.M) Sir</h4>
                  <a 
                    href="tel:+919775220895" 
                    className="inline-flex items-center gap-2 text-blue-600 font-bold text-lg hover:underline"
                  >
                    +91 9775220895
                  </a>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Please visit the tuition center during working hours to complete your cash payment.
                  </p>
                </div>
                <button 
                  onClick={() => setPaymentMethod(null)}
                  className="w-full py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Back to Methods
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-4">
                  <div className="bg-slate-50 dark:bg-white p-4 rounded-3xl inline-block shadow-inner">
                    <img 
                      src="https://picsum.photos/seed/qr/300/300" 
                      alt="Payment QR Code" 
                      className="w-48 h-48 mx-auto rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Upload Reference for Sem {selectedSemester}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic px-4">
                      "Education is the most powerful weapon which you can use to change the world. Your timely fee payment helps us maintain the quality of education and support your learning journey."
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Amount Paid (₹)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Transaction UID / UTR
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. 123456789012"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setPaymentMethod(null)}
                      className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={!transactionId || !paymentAmount || submitting}
                      className="flex-2 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Proof'}
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
