import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  getDoc,
  writeBatch
} from 'firebase/firestore';
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
  Phone,
  Trash2,
  Loader2,
  X,
  Search
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function StudentHome({ isEmbedded, onTabChange }: { isEmbedded?: boolean, onTabChange?: (id: string) => void }) {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleNav = (path: string, tabId?: string) => {
    if (isEmbedded && tabId && onTabChange) {
      onTabChange(tabId);
    } else {
      navigate(path);
    }
  };

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      let h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isClearingNotifs, setIsClearingNotifs] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleClearNotifications = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all your notifications?")) return;

    setIsClearingNotifs(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        batch.delete(doc(db, 'notifications', notif.id));
      });
      await batch.commit();
      setShowNotifications(false);
    } catch (err) {
      console.error("Error clearing notifications:", err);
      alert("Failed to clear notifications");
    } finally {
      setIsClearingNotifs(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const dept = (profile?.courseId || profile?.courseName || profile?.department || 'ALL').toUpperCase();
    const sem = String(profile?.semester || 'ALL');

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
      query(collection(db, 'attendance'), where('studentId', '==', user.uid)),
      (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
            const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
            return timeB - timeA;
          });
        setRecentAttendance(sorted.slice(0, 5));
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

    // 7. Notifications Listener
    const unsubNotif = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('targetDept', 'in', [dept, 'ALL']),
        limit(50)
      ),
      (snapshot) => {
        const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter by semester and sort by timestamp DESC client-side to avoid index requirement
        const filtered = allNotifs
          .filter((n: any) => 
            !n.targetSem || n.targetSem === 'ALL' || String(n.targetSem) === sem || sem === 'ALL'
          )
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setNotifications(filtered.slice(0, 20));
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
      unsubNotif();
    };
  }, [user?.uid, profile?.courseId, profile?.courseName, profile?.semester, profile?.department]);

  useEffect(() => {
    // Calculate Fee Stats
    const getExpectedFee = () => {
      if (!feeStructure || Object.keys(feeStructure).length === 0) return 0;

      const studentDept = (profile?.courseId || profile?.courseName || profile?.department || '').trim();
      const currentSem = Number(profile?.semester) || 1;

      // 1. Try exact match
      if (feeStructure[studentDept] && feeStructure[studentDept][currentSem] !== undefined) {
        return feeStructure[studentDept][currentSem];
      }

      // 2. Try uppercase match
      const upperDept = studentDept.toUpperCase();
      if (feeStructure[upperDept] && feeStructure[upperDept][currentSem] !== undefined) {
        return feeStructure[upperDept][currentSem];
      }

      // 3. Try "cleaned" match (fallback for legacy)
      const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
      const cleanedStudentDept = cleanStr(studentDept) || 'BCA';
      
      // Look for a key in feeStructure that, when cleaned, matches the cleaned student dept
      const matchingKey = Object.keys(feeStructure).find(key => cleanStr(key) === cleanedStudentDept);
      if (matchingKey && feeStructure[matchingKey][currentSem] !== undefined) {
        return feeStructure[matchingKey][currentSem];
      }

      return 0;
    };

    const attPercentage = sessionCount > 0 ? Math.round((attendanceCount / sessionCount) * 100) : 0;
    const currentSem = Number(profile?.semester) || 1;
    const expected = getExpectedFee();
    
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
    { label: 'Attendance', value: stats.attendance, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', link: '/student/analytics', tabId: 'stats' },
    { label: 'Payable Fee', value: stats.payableFee, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/fees/history', tabId: 'fees' },
    { label: 'Status', value: stats.feesStatus, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', link: '/fees/history', tabId: 'fees' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 transition-colors">
      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[600px] bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-600 sm:rounded-t-[2.5rem] text-white">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <h3 className="font-black tracking-tight">Notifications</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleClearNotifications}
                    disabled={isClearingNotifs || notifications.length === 0}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 disabled:opacity-50"
                  >
                    {isClearingNotifs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Clear
                  </button>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-1 ${notif.type === 'schedule' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                          {notif.type === 'schedule' ? <Clock className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">{notif.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{notif.message}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(notif.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-slate-200 dark:shadow-none active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-blue-600 text-white px-6 pt-12 pb-20 rounded-b-[40px] shadow-lg shadow-blue-100 dark:shadow-none relative overflow-hidden transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <motion.div 
              layoutId="profile-avatar"
              onClick={() => profile?.avatarUrl && setZoomedImage(profile.avatarUrl)}
              className="w-14 h-14 bg-white/20 rounded-2xl p-1 backdrop-blur-md cursor-pointer hover:scale-105 transition-transform overflow-hidden group relative"
              title={profile?.avatarUrl ? "View Image" : ""}
            >
              <div className="w-full h-full bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                {profile?.avatarUrl ? (
                  <>
                    <motion.img 
                      layoutId="zoomed-image"
                      src={profile.avatarUrl} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Search className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  profile?.name?.charAt(0) || 'S'
                )}
              </div>
            </motion.div>
            <div 
              onClick={() => handleNav('/profile', 'profile')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-wider">Welcome back,</p>
              <h1 className="text-2xl font-black tracking-tight">{profile?.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold backdrop-blur-sm border border-white/10">Sem {profile?.semester}</span>
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold backdrop-blur-sm border border-white/10 uppercase">{profile?.courseName}</span>
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
            <button 
              onClick={() => setShowNotifications(true)}
              className="p-2 bg-white/20 rounded-xl backdrop-blur-md relative hover:bg-white/30 transition-all"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-blue-600 flex items-center justify-center text-[8px] font-black">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
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
                  onClick={() => handleNav(stat.link, stat.tabId)}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors`}
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
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${cls.type === 'active' ? 'text-emerald-600' : 'text-blue-600'}`}>
                            {cls.type === 'active' ? 'Live Session' : 'Scheduled'}
                          </p>
                          <h4 className="font-bold text-slate-900 dark:text-white">
                            {cls.subject || `${cls.department} Sem ${cls.semester}`}
                          </h4>
                          {cls.topic && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold italic mb-1">Topic: {cls.topic}</p>}
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cls.teacherName || 'Teacher'} • {cls.date === today ? 'Today' : cls.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatTime12h(cls.startTime)}</p>
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
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{record.subject || 'Present'}</p>
                          {record.topic && <p className="text-[10px] text-blue-500 font-medium italic">Topic: {record.topic}</p>}
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(record.timestamp).toLocaleDateString()} at {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
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

      {/* Profile Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              layoutId="profile-avatar"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-2xl w-full aspect-square rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img 
                layoutId="zoomed-image"
                src={zoomedImage} 
                alt="Zoomed DP" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all shadow-lg border border-white/20 group"
              >
                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isEmbedded && (
      /* Bottom Tab Bar (Mobile Style) */
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
      )}
    </div>
  );
}
