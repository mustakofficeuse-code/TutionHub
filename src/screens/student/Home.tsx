import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth, logError } from '../../firebase';
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
  Sun,
  Mail,
  Phone
} from 'lucide-react';
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
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<{name: string, phone?: string, email?: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !profile?.courseId) {
      setLoading(false);
      return;
    }

    const dept = (profile.courseId || profile.courseName || profile.department || '').toUpperCase();
    const sem = String(profile.semester || '1');

    // Fetch Teacher Info
    const fetchTeacherInfo = async () => {
      try {
        const docRef = doc(db, 'config', 'appSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTeacherInfo({
            name: data.teacherName || 'Barun Maity',
            phone: data.teacherPhone,
            email: data.teacherEmail,
            avatarUrl: data.teacherAvatarUrl || data.avatarUrl
          });
        }
      } catch (err) {
        console.error("Error fetching teacher info:", err);
      }
    };
    fetchTeacherInfo();

    // 1. Attendance Count
    const unsubAtt = onSnapshot(
      query(collection(db, 'attendance'), where('studentId', '==', user.uid)),
      (snapshot) => setAttendanceCount(snapshot.size),
      (error) => logError("Error fetching attendance:", error)
    );

    // 2. Recent Attendance Feed
    const unsubRecentAtt = onSnapshot(
      query(collection(db, 'attendance'), where('studentId', '==', user.uid), orderBy('timestamp', 'desc'), limit(5)),
      (snapshot) => {
        setRecentAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => logError("Error fetching recent attendance:", error)
    );

    // 3. Sessions Count
    const unsubSess = onSnapshot(
      query(collection(db, 'sessions'), where('courseId', '==', profile.courseId)),
      (snapshot) => setSessionCount(snapshot.size),
      (error) => logError("Error fetching sessions:", error)
    );

    // 4. Fee Structure Listener
    const unsubStructure = onSnapshot(
      doc(db, 'config', 'feeStructure'),
      (snapshot) => {
        if (snapshot.exists()) setFeeStructure(snapshot.data());
      },
      (error) => logError("Error fetching fee structure:", error)
    );

    // 5. Student Payments Listener
    const studentIds = [user.uid, profile.studentId, profile.id].filter(Boolean);
    const unsubFees = onSnapshot(
      query(collection(db, 'payments'), where('studentId', 'in', studentIds)),
      (snapshot) => {
        setStudentFees(snapshot.docs.map(d => d.data()));
      },
      (error) => logError("Error fetching payments:", error)
    );

    // 6. Upcoming Classes (from schedules and attendance_schedules)
    const unsubSchedule = onSnapshot(
      query(collection(db, 'schedules'), where('courseId', '==', profile.courseId)),
      (snapshot) => {
        const permanentClasses = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data(), type: 'permanent' }))
          .filter((c: any) => c.date && c.date >= today);
          
        setUpcomingClasses(prev => {
          const others = prev.filter(c => c.type !== 'permanent');
          const combined = [...others, ...permanentClasses]
            .sort((a: any, b: any) => {
              const dateA = a.date || today;
              const dateB = b.date || today;
              return new Date(dateA).getTime() - new Date(dateB).getTime();
            });
          return combined;
        });
        setLoading(false);
      },
      (error) => {
        logError("Error fetching schedules:", error);
        setLoading(false);
      }
    );

    const unsubActiveSchedules = onSnapshot(
      query(
        collection(db, 'attendance_schedules'), 
        where('date', '==', today),
        where('department', 'in', [dept, 'ALL'])
      ),
      (snapshot) => {
        const activeClasses = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data(), type: 'active' }))
          .filter((c: any) => {
            const schedSem = String(c.semester);
            return schedSem === sem || schedSem === 'ALL';
          });

        setUpcomingClasses(prev => {
          const others = prev.filter(c => c.type !== 'active');
          const combined = [...others, ...activeClasses]
            .sort((a: any, b: any) => {
              const dateA = a.date || today;
              const dateB = b.date || today;
              return new Date(dateA).getTime() - new Date(dateB).getTime();
            });
          return combined;
        });
      }
    );

    return () => {
      unsubAtt();
      unsubRecentAtt();
      unsubSess();
      unsubStructure();
      unsubFees();
      unsubSchedule();
      unsubActiveSchedules();
    };
  }, [user?.uid, profile?.courseId, profile?.courseName, profile?.semester, profile?.department]);

  useEffect(() => {
    const attPercentage = sessionCount > 0 ? Math.round((attendanceCount / sessionCount) * 100) : 0;
    
    // Calculate Fee Stats
    const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
    const dept = cleanStr(profile?.courseId) || cleanStr(profile?.courseName) || cleanStr(profile?.department) || 'BCA';
    const currentSem = Number(profile?.semester) || 1;
    
    // Calculate dues ONLY for the current semester
    const expected = feeStructure[dept]?.[currentSem] || 0;
    const paid = studentFees
      .filter(f => f.status === 'confirmed' && Number(f.semester) === currentSem)
      .reduce((acc, f) => acc + Number(f.amount || 0), 0);
    
    const amountDue = Math.max(0, expected - paid);
    let status = 'Due';
    
    if (expected > 0) {
      if (amountDue === 0) status = 'Paid';
      else if (paid > 0) status = 'Partly Paid';
    } else {
      status = 'No Fee Set';
    }

    setStats(prev => ({
      ...prev,
      attendance: `${attPercentage}%`,
      payableFee: `₹${amountDue.toLocaleString()}`,
      feesStatus: status
    }));
  }, [attendanceCount, sessionCount, feeStructure, studentFees, profile?.courseName, profile?.semester, profile?.courseId, profile?.department]);

  const quickStats = [
    { label: 'Attendance', value: stats.attendance, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', link: '/student/analytics' },
    { label: 'Payable Fee', value: stats.payableFee, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/fees/history' },
    { label: 'Status', value: stats.feesStatus, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', link: '/fees/history' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 transition-colors">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 pt-12 pb-20 rounded-b-[40px] shadow-lg shadow-blue-100 dark:shadow-none relative overflow-hidden transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => navigate('/profile')}
              className="w-14 h-14 bg-white/20 rounded-2xl p-1 backdrop-blur-md cursor-pointer hover:scale-105 transition-transform overflow-hidden"
            >
              <div className="w-full h-full bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.name?.charAt(0) || 'S'
                )}
              </div>
            </div>
            <div>
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-wider">Welcome back,</p>
              <h1 className="text-2xl font-black tracking-tight">{profile?.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold backdrop-blur-sm border border-white/10">Sem {profile?.semester}</span>
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold backdrop-blur-sm border border-white/10">{profile?.courseName}</span>
              </div>
            </div>
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
                <div 
                  key={i} 
                  onClick={() => stat.link ? navigate(stat.link) : null}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center ${stat.link ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors' : ''}`}
                >
                  <div className={`${stat.bg} dark:bg-slate-800 p-2 rounded-lg mb-2`}>
                    <stat.icon className={`${stat.color} w-5 h-5`} />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Teacher Contact Section */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                   <User className="text-blue-600 w-5 h-5" />
                   Your Teacher
                 </h3>
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Available</span>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 overflow-hidden">
                     {teacherInfo?.avatarUrl ? (
                       <img src={teacherInfo.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                       <User className="w-6 h-6" />
                     )}
                   </div>
                   <div>
                     <p className="font-bold text-slate-900 dark:text-white text-sm">{teacherInfo?.name || 'Barun Maity'}</p>
                     <p className="text-[10px] text-slate-500 dark:text-slate-400">Lead Instructor</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   {teacherInfo?.phone && (
                     <a 
                       href={`tel:${teacherInfo.phone}`}
                       className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 dark:border-emerald-800"
                       title="Call Teacher"
                     >
                       <Phone className="w-5 h-5" />
                     </a>
                   )}
                   {teacherInfo?.email && (
                     <a 
                       href={`mailto:${teacherInfo.email}`}
                       className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 dark:border-blue-800"
                       title="Email Teacher"
                     >
                       <Mail className="w-5 h-5" />
                     </a>
                   )}
                 </div>
               </div>
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
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                          <Clock className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{cls.type === 'active' ? 'Live Session' : 'Scheduled'}</p>
                          <h4 className="font-bold text-slate-900 dark:text-white">{cls.subject || `${cls.department} Sem ${cls.semester}`}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cls.teacherName || 'Teacher'} • {cls.date === today ? 'Today' : cls.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{cls.startTime}</p>
                        {cls.type === 'active' && (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase mt-1">
                            <span className="w-1 h-1 bg-emerald-600 rounded-full animate-ping"></span>
                            Live
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Attendance */}
            <div className="space-y-4 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Attendance</h2>
              <div className="space-y-3">
                {recentAttendance.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No recent records found</p>
                  </div>
                ) : (
                  recentAttendance.map((record, i) => (
                    <div key={record.id || i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                          <CheckCircle2 className="text-emerald-600 w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Present</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(record.timestamp).toLocaleDateString()} at {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{record.department}</p>
                        <p className="text-[10px] text-slate-400 uppercase">Sem {record.semester}</p>
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
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400 group"
        >
          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-all overflow-hidden border-2 border-transparent group-hover:border-blue-500">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}
