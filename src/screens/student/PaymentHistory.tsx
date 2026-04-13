import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
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
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PaymentHistory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'offline' | 'online' | null>(null);
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    if (profile) fetchFees();
  }, [profile]);

  const fetchFees = async () => {
    try {
      const q = query(collection(db, 'fees'), where('studentId', '==', profile?.uid));
      const querySnapshot = await getDocs(q);
      setFees(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId || !selectedFee || !profile) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'payments'), {
        studentId: profile.uid,
        feeId: selectedFee.id,
        courseId: profile.courseId || '',
        amount: selectedFee.amount,
        transactionId,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      setSelectedFee(null);
      setTransactionId('');
      alert('Payment reference submitted successfully! Teacher will verify it soon.');
    } catch (error) {
      console.error("Error submitting payment:", error);
      alert('Failed to submit payment reference.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="text-blue-600 w-7 h-7" />
            Fees & Payments
          </h1>
          <p className="text-slate-500 dark:text-slate-400">View your fee status and upload payment proofs</p>
        </div>

        {/* Fee Cards */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : fees.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No fee records found.</p>
            </div>
          ) : (
            fees.map((fee) => (
              <div key={fee.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Semester {fee.semester} Tuition Fee</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Due: {new Date(fee.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    fee.status === 'paid' ? 'bg-green-100 text-green-700' :
                    fee.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {fee.status}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Amount</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{fee.amount.toLocaleString()}</p>
                  </div>
                  {fee.status !== 'paid' && (
                    <button 
                      onClick={() => setSelectedFee(fee)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100"
                    >
                      <Upload className="w-4 h-4" /> Pay Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {selectedFee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Choose Payment Method</h3>
              <button 
                onClick={() => {
                  setSelectedFee(null);
                  setPaymentMethod(null);
                  setTransactionId('');
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
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Scan to Pay ₹{selectedFee.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic px-4">
                      "Education is the most powerful weapon which you can use to change the world. Your timely fee payment helps us maintain the quality of education and support your learning journey."
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Transaction ID / Reference Number
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

                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setPaymentMethod(null)}
                      className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={!transactionId || submitting}
                      className="flex-2 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
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
