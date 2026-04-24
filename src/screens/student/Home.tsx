import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  QrCode, 
  BookOpen, 
  CreditCard, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Calendar,
  ChevronRight,
  LogOut,
  User,
  Shield,
  MessageSquare,
  TrendingUp,
  Moon,
  Sun
} from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

export default function StudentHome() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [attendanceCount, setAttendanceCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [feeStructure, setFeeStructure] = useState<any>({});
  const [studentFees, setStudentFees] = useState<any[]>([]);
  const [stats, setStats] = useState({
    attendance: '0%',
    feesStatus: 'No Data',
    payableFee: '₹0'
  });
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !profile?.courseId) {
      setLoading(false);
      return;
    }

    // 1. Attendance Count
    const unsubAtt = onSnapshot(
      query(collection(db, 'attendance'), where('studentId', '==', user.uid)),
      (snapshot) => setAttendanceCount(snapshot.size),
      (error) => console.error("Error fetching attendance:", error)
    );

    // 2. Sessions Count
    const unsubSess = onSnapshot(
      query(collection(db, 'sessions'), where('courseId', '==', profile.courseId)),
      (snapshot) => setSessionCount(snapshot.size),
      (error) => console.error("Error fetching sessions:", error)
    );

    // 3. Fee Structure Listener
    const unsubStructure = onSnapshot(
      doc(db, 'config', 'feeStructure'),
      (snapshot) => {
        if (snapshot.exists()) setFeeStructure(snapshot.data());
      },
      (error) => console.error("Error fetching fee structure:", error)
    );

    // 4. Student Fees Listener
    const unsubFees = onSnapshot(
      query(collection(db, 'fees'), where('studentId', '==', user.uid)),
      (snapshot) => {
        setStudentFees(snapshot.docs.map(d => d.data()));
      },
      (error) => console.error("Error fetching fees:", error)
    );

    // 5. Upcoming Classes
    const unsubSchedule = onSnapshot(
      query(collection(db, 'schedules'), where('courseId', '==', profile.courseId)),
      (snapshot) => {
        const classes = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((c: any) => c.date && c.date >= today)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
        setUpcomingClasses(classes);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching schedules:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubAtt();
      unsubSess();
      unsubStructure();
      unsubFees();
      unsubSchedule();
    };
  }, [user?.uid, profile?.courseId, profile?.courseName, profile?.semester]);

  useEffect(() => {
    const attPercentage = sessionCount > 0 ? Math.round((attendanceCount / sessionCount) * 100) : 0;
    
    // Calculate Fee Stats
    // Ensure department name matches the structure keys (BCA, BSC, BTECH, MCA)
    const rawDept = profile?.courseName || 'BCA';
    const dept = rawDept.toUpperCase().includes('TECH') ? 'BTECH' : rawDept.toUpperCase();
    const sem = profile?.semester || '1';
    const structFee = feeStructure[dept]?.[sem] || 0;
    
    const pendingFees = studentFees.filter(f => f.status !== 'paid');
    const totalPending = pendingFees.reduce((acc, f) => acc + (f.amount || 0), 0);
    
    // The user wants the structured 'Amount' to be displayed in 'Payable Fee'
    // If there are specific unpaid bills, we show those. 
    // Otherwise, we show the default structure fee for their semester.
    const displayAmount = totalPending > 0 ? totalPending : structFee;
    
    let status = 'Not Set';
    if (totalPending > 0) {
      status = 'Pending';
    } else if (studentFees.length > 0) {
      status = 'Paid';
    } else if (structFee > 0) {
      status = 'Due';
    }

    setStats(prev => ({
      ...prev,
      attendance: `${attPercentage}%`,
      payableFee: `₹${displayAmount.toLocaleString()}`,
      feesStatus: status
    }));
  }, [attendanceCount, sessionCount, feeStructure, studentFees, profile?.courseName, profile?.semester]);

  const quickStats = [
    { label: 'Attendance', value: stats.attendance, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Payable Fee', value: stats.payableFee, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Status', value: stats.feesStatus, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 transition-colors">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 pt-12 pb-20 rounded-b-[40px] shadow-lg shadow-blue-100 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-blue-100 text-sm font-medium">Welcome back,</p>
            <h1 className="text-2xl font-bold">{profile?.name}</h1>
            <p className="text-blue-100 text-xs mt-1">Roll: {profile?.rollNumber} • Sem {profile?.semester}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 bg-white/20 rounded-xl backdrop-blur-md hover:bg-white/30 transition-all"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Bell className="w-5 h-5" />
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 bg-white/20 rounded-xl backdrop-blur-md"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 -mt-12 relative z-10 space-y-8">
        {profile?.courseId === 'legacy' && (
          <div className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-12">
            <div>
              <p className="font-bold text-sm">Account Migration</p>
              <p className="text-xs mt-1">Please update your Department (e.g. BCA) and Semester in your profile so you can access your study materials.</p>
            </div>
            <button 
              onClick={() => navigate('/profile')} 
              className="px-4 py-2 bg-yellow-500 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-yellow-600 transition-colors whitespace-nowrap"
            >
              Update Profile
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Loading your dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {quickStats.map((stat, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                  <div className={`${stat.bg} dark:bg-slate-800 p-2 rounded-lg mb-2`}>
                    <stat.icon className={`${stat.color} w-5 h-5`} />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Scan Attendance Card */}
            <div 
              onClick={() => navigate('/attendance/scan')}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
                  <QrCode className="text-white w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Scan Attendance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Mark your presence for today's class</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            </div>

            {/* Upcoming Classes */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upcoming Classes</h2>
                <button className="text-blue-600 dark:text-blue-400 text-sm font-bold">View All</button>
              </div>
              <div className="space-y-4">
                {upcomingClasses.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No upcoming classes scheduled</p>
                  </div>
                ) : (
                  upcomingClasses.map((cls, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                          <Clock className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{cls.subject}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cls.teacherName || 'Teacher'} • {cls.date === today ? 'Today' : cls.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{cls.startTime}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bottom Tab Bar (Mobile Style) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-8 py-4 flex justify-between items-center z-50 transition-colors">
        <button className="flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => navigate('/materials/list')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-[10px] font-bold">Materials</span>
        </button>
        <button 
          onClick={() => navigate('/doubts')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold">Doubts</span>
        </button>
        <button 
          onClick={() => navigate('/student/analytics')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <TrendingUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Stats</span>
        </button>
        <button 
          onClick={() => navigate('/fees/history')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <CreditCard className="w-6 h-6" />
          <span className="text-[10px] font-bold">Fees</span>
        </button>
        {profile?.role === 'admin' && (
          <button 
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-1 text-indigo-600 dark:text-indigo-400"
          >
            <Shield className="w-6 h-6" />
            <span className="text-[10px] font-bold">Admin</span>
          </button>
        )}
        <button 
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}
