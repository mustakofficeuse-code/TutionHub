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

      // 2. Try  match
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
    { label: 'Attendance', value: stats.attendance, icon: Calendar, color: 'text-wa-teal', bg: 'bg-wa-teal/10', link: '/student/analytics', tabId: 'stats' },
    { label: 'Payable Fee', value: stats.payableFee, icon: CreditCard, color: 'text-wa-teal', bg: 'bg-wa-teal/10', link: '/fees/history', tabId: 'fees' },
    { label: 'Status', value: stats.feesStatus, icon: CheckCircle2, color: 'text-wa-green', bg: 'bg-wa-green/10', link: '/fees/history', tabId: 'fees' },
  ];

  return (
    <div className={`min-h-screen ${isEmbedded ? '' : 'bg-[#f0f2f5] dark:bg-[#111b21] pt-12'} pb-24 transition-colors font-sans`}>
      {/* Shared Profile Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[200] p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              layoutId="profile-avatar-zoom"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-xl w-full aspect-square rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomedImage} 
                alt="Zoomed DP" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-6 right-6 w-12 h-12 bg-black/50 hover:bg-wa-teal backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all shadow-lg border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className={`${isEmbedded ? 'p-4' : 'px-6 mt-8'} relative z-10 space-y-6 max-w-2xl mx-auto`}>
        {/* Profile Card */}
        <div className="bg-white dark:bg-[#202c33] p-5 sm:p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
             <Shield className="w-16 h-16 text-wa-teal" />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div 
              onClick={() => profile?.avatarUrl && setZoomedImage(profile.avatarUrl)}
              className="w-20 h-20 bg-[#f0f2f5] dark:bg-wa-teal/10 rounded-2xl p-1 overflow-hidden cursor-pointer hover:rotate-3 transition-all shadow-inner border-2 border-slate-50 dark:border-white/10"
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-wa-teal font-bold text-3xl">
                  {profile?.name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                 <span className="w-2 h-2 bg-wa-green rounded-full animate-pulse shadow-[0_0_10px_rgba(37,211,102,0.5)]"></span>
                 <p className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-wa-teal">Authenticated</p>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] truncate tracking-normal">{profile?.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 bg-wa-teal/10 text-wa-teal rounded-full text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 border border-wa-teal/10">Sem {profile?.semester}</span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-[#8696a0] rounded-full text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 border border-transparent truncate max-w-[150px]">{profile?.courseName || profile?.department}</span>
              </div>
            </div>
          </div>
        </div>

        {profile?.courseId === 'legacy' && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-4">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 shrink-0 mt-1" />
              <div>
                <p className="font-bold  tracking-normal text-xs">Profile Audit Required</p>
                <p className="text-sm font-semibold opacity-80 mt-1 leading-relaxed">Update your department and semester to sync your learning materials repository.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/profile')} 
              className="px-6 py-3 bg-orange-500 text-white font-bold  tracking-normal text-xs rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all whitespace-nowrap active:scale-95"
            >
              Update Profile
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-[#202c33] p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-50 dark:border-white/5 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-wa-teal border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-xs font-bold text-[#8696a0]  tracking-normal">Synchronizing Ledger...</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {quickStats.map((stat, i) => (
                <button 
                  key={i} 
                  onClick={() => handleNav(stat.link, stat.tabId)}
                  className="bg-white dark:bg-[#202c33] p-5 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 flex flex-col items-center text-center group transition-all hover:bg-wa-teal/5 active:scale-95"
                >
                  <div className="w-10 h-10 bg-[#f0f2f5] dark:bg-[#111b21] rounded-xl flex items-center justify-center mb-3 group-hover:bg-wa-teal group-hover:text-white transition-colors">
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-[#8696a0] font-bold  tracking-normal mb-1">{stat.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">{stat.value}</p>
                </button>
              ))}
            </div>

            {/* Attendance & Scanner Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scan Attendance Card */}
                <div 
                  onClick={() => handleNav('/attendance/scan', 'scan')}
                  className="bg-wa-teal p-5 sm:p-5 sm:p-6 rounded-3xl shadow-xl shadow-wa-teal/20 flex flex-col justify-between group cursor-pointer hover:bg-wa-teal/90 transition-all relative overflow-hidden active:scale-[0.98]"
                >
                  <div className="absolute top-0 right-0 p-5 sm:p-5 sm:p-6 opacity-10 group-hover:rotate-12 transition-transform">
                     <QrCode className="w-24 h-24 text-white" />
                  </div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                      <QrCode className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-normal">Sync Presence</h3>
                      <p className="text-white/70 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 mt-1">Biometric Scanner</p>
                    </div>
                  </div>
                </div>

                {/* Teacher Contact Section */}
                <div className="bg-white dark:bg-[#202c33] p-5 sm:p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-50 dark:border-white/5 flex flex-col justify-between">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="text-sm font-bold text-[#8696a0]  tracking-normal flex items-center gap-2">
                       <Shield className="w-4 h-4" /> Mentor Unit
                     </h3>
                     <span className="text-[8px] font-bold  tracking-normal text-wa-green bg-wa-green/10 px-2 py-1 rounded-full">Encrypted</span>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                       <div 
                         onClick={() => teacherInfo?.avatarUrl && setZoomedImage(teacherInfo.avatarUrl)}
                         className="w-14 h-14 bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer hover:border-wa-teal border-2 border-transparent transition-all shadow-inner"
                       >
                         {teacherInfo?.avatarUrl ? (
                           <img src={teacherInfo.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                           <User className="w-8 h-8 text-wa-teal" />
                         )}
                       </div>
                       <div className="min-w-0">
                         <p className="font-bold text-slate-900 dark:text-[#e9edef] text-base tracking-normal leading-none mb-1">{teacherInfo?.name || 'Barun Maity'}</p>
                         <p className="text-xs font-bold text-wa-teal  tracking-normal">Master Instructor</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-3">
                       {teacherInfo?.phone && (
                         <a 
                           href={`tel:${teacherInfo.phone}`}
                           className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl hover:bg-wa-green hover:text-white transition-all flex items-center justify-center shadow-lg shadow-wa-green/10"
                         >
                           <Phone className="w-4 h-4" />
                         </a>
                       )}
                       {teacherInfo?.email && (
                         <a 
                           href={`mailto:${teacherInfo.email}`}
                           className="w-10 h-10 bg-wa-teal/10 text-wa-teal rounded-xl hover:bg-wa-teal hover:text-white transition-all flex items-center justify-center shadow-lg shadow-wa-teal/10"
                         >
                           <MessageSquare className="w-4 h-4" />
                         </a>
                       )}
                     </div>
                   </div>
                </div>
            </div>

            {/* Upcoming Classes */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-xs font-bold text-[#8696a0]  tracking-normal flex items-center gap-2">
                   <Clock className="w-4 h-4" /> Schedule Broadcast
                </h2>
                <button className="text-wa-teal text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 bg-wa-teal/5 px-4 py-1.5 rounded-full">Archive View</button>
              </div>
              <div className="space-y-4 px-2">
                {upcomingClasses.length === 0 ? (
                  <div className="bg-white dark:bg-[#202c33] p-6 sm:p-6 sm:p-5 sm:p-6 rounded-2xl border border-dashed border-slate-100 dark:border-white/5 text-center">
                    <Calendar className="w-10 h-10 text-slate-100 dark:text-slate-800 mx-auto mb-4" />
                    <p className="text-xs font-bold text-[#8696a0]  tracking-normal">No spectral schedules detected</p>
                  </div>
                ) : (
                  upcomingClasses.map((cls, i) => (
                    <div key={i} className="bg-white dark:bg-[#202c33] p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 flex items-center justify-between group transition-all hover:border-wa-teal/30">
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden ${cls.type === 'active' ? 'bg-wa-green/10' : 'bg-[#f0f2f5] dark:bg-[#111b21]'}`}>
                           <Clock className={`w-6 h-6 ${cls.type === 'active' ? 'text-wa-green animate-pulse' : 'text-wa-teal'}`} />
                           {cls.type === 'active' && <div className="absolute inset-0 border-2 border-wa-green/30 rounded-2xl animate-ping" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 mb-1 ${cls.type === 'active' ? 'text-wa-green' : 'text-wa-teal'}`}>
                            {cls.type === 'active' ? 'Direct Communication' : 'Future Transmission'}
                          </p>
                          <h4 className="font-bold text-slate-900 dark:text-[#e9edef] text-lg tracking-normal leading-none mb-1">
                            {cls.subject || `${cls.department} Sem ${cls.semester}`}
                          </h4>
                          <div className="flex items-center gap-3">
                             <p className="text-xs text-[#8696a0] font-bold">{cls.teacherName || 'Teacher'} • {cls.date === today ? 'Today' : cls.date}</p>
                             {cls.topic && <span className="text-xs text-wa-teal font-bold  tracking-normal px-2 py-0.5 bg-wa-teal/5 rounded-md truncate max-w-[150px]">{cls.topic}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-wa-teal tracking-normal">{formatTime12h(cls.startTime)}</p>
                        {cls.type === 'active' ? (
                          <div className="flex items-center justify-end gap-1.5 mt-1.5">
                             <span className="w-1.5 h-1.5 bg-wa-green rounded-full animate-pulse"></span>
                             <span className="text-xs font-bold text-wa-green  tracking-normal">Active</span>
                          </div>
                        ) : (
                           <p className="text-xs font-bold text-[#8696a0]/40  tracking-normal mt-1.5">Standby</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Attendance */}
            <div className="space-y-4 pb-8">
              <div className="flex items-center justify-between px-4">
                <h2 className="text-xs font-bold text-[#8696a0]  tracking-normal flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Presence Ledger
                </h2>
                {recentAttendance.length > 0 && (
                  <button 
                    onClick={async () => {
                      if (!window.confirm("Are you sure you want to clear your recent attendance history?")) return;
                      try {
                        const { writeBatch, doc } = await import('firebase/firestore');
                        const batch = writeBatch(db);
                        recentAttendance.forEach(rec => {
                          batch.delete(doc(db, 'attendance', rec.id));
                        });
                        await batch.commit();
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="text-xs font-bold  text-red-500 hover:text-red-700 tracking-normal px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all border border-transparent hover:border-red-100"
                  >
                    Purge Records
                  </button>
                )}
              </div>
              <div className="space-y-3 px-2">
                {recentAttendance.length === 0 ? (
                  <div className="bg-white dark:bg-[#202c33] p-6 sm:p-6 sm:p-5 sm:p-6 rounded-2xl border border-dashed border-slate-100 dark:border-white/5 text-center">
                    <CheckCircle2 className="w-10 h-10 text-slate-100 dark:text-slate-800 mx-auto mb-4" />
                    <p className="text-xs font-bold text-[#8696a0]  tracking-normal">No verification data located</p>
                  </div>
                ) : (
                  recentAttendance.map((record, i) => (
                    <div key={record.id || i} className="bg-white dark:bg-[#202c33] p-5 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 flex items-center justify-between group hover:border-wa-green/30 transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-wa-green/5 dark:bg-wa-green/10 rounded-2xl flex items-center justify-center shrink-0 border border-wa-green/10">
                          <CheckCircle2 className="text-wa-green w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-slate-900 dark:text-[#e9edef] truncate tracking-normal">{record.subject || 'Standard Session'}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <p className="text-xs text-[#8696a0] font-bold">
                               {new Date(record.timestamp).toLocaleDateString()}
                             </p>
                             <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                             <p className="text-xs text-wa-teal font-bold  tracking-normal italic">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-wa-teal  tracking-normal mb-1">{record.department}</p>
                        <div className="inline-flex px-2 py-0.5 bg-wa-teal/5 text-wa-teal rounded-md text-[8px] font-bold  tracking-normal">Sem {record.semester}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Ported from Global Hub Design */}
      {!isEmbedded && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#111b21]/80 backdrop-blur-2xl border-t border-slate-100 dark:border-white/5 px-6 pb-6 pt-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <button className="flex flex-col items-center gap-1.5 text-wa-teal relative group">
             <div className="absolute -top-3 w-8 h-1 bg-wa-teal rounded-full" />
             <div className="w-12 h-12 bg-wa-teal/10 rounded-2xl flex items-center justify-center transition-all group-active:scale-90">
                <Calendar className="w-6 h-6" />
             </div>
             <span className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Portal</span>
          </button>
          
          <button onClick={() => navigate('/materials/list')} className="flex flex-col items-center gap-1.5 text-[#8696a0] group">
             <div className="w-12 h-12 hover:bg-[#f0f2f5] dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-all group-active:scale-90">
                <BookOpen className="w-6 h-6 group-hover:text-wa-teal transition-colors" />
             </div>
             <span className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Library</span>
          </button>
          
          <button onClick={() => navigate('/doubts')} className="flex flex-col items-center gap-1.5 text-[#8696a0] group">
             <div className="w-12 h-12 hover:bg-[#f0f2f5] dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-all group-active:scale-90">
                <MessageSquare className="w-6 h-6 group-hover:text-wa-teal transition-colors" />
             </div>
             <span className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Inquiry</span>
          </button>

          <button onClick={() => navigate('/student/analytics')} className="flex flex-col items-center gap-1.5 text-[#8696a0] group">
             <div className="w-12 h-12 hover:bg-[#f0f2f5] dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-all group-active:scale-90">
                <TrendingUp className="w-6 h-6 group-hover:text-wa-teal transition-colors" />
             </div>
             <span className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Ledger</span>
          </button>

          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1.5 text-[#8696a0] group">
             <div className="w-12 h-12 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-all group-active:scale-90 overflow-hidden relative">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-7 h-7 object-cover rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-6 h-6 group-hover:text-wa-teal transition-colors" />
                )}
             </div>
             <span className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Entity</span>
          </button>
        </nav>
      )}
    </div>
  );
}
