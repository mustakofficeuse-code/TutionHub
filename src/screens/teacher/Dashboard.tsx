import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Plus, 
  ArrowRight,
  Loader2,
  TrendingUp,
  AlertCircle,
  LogOut,
  QrCode,
  MapPin,
  BookOpen,
  User,
  Shield,
  MessageSquare,
  Moon,
  Sun,
  CreditCard,
  Bell,
  ClipboardList,
  Trophy,
  Edit,
  Trash2,
  X,
  UserX
} from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistDocs, setBlacklistDocs] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [locationConfigured, setLocationConfigured] = useState<boolean>(true);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Block Confirmation State
  const [studentToBlock, setStudentToBlock] = useState<any | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);
  
  // Real-time stats
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0);
  const [pendingFeesSum, setPendingFeesSum] = useState(0);
  const [statsLoading, setStatsLoading] = useState({
    students: true,
    attendance: true,
    fees: true
  });

  const isStatsLoading = statsLoading.students || statsLoading.attendance || statsLoading.fees;

  useEffect(() => {
    checkLocationConfig();
    
    const unsubStudents = listenToTotalStudents();
    const unsubAttendance = listenToTodayAttendance();
    const unsubFees = listenToPendingFees();
    const unsubRecent = listenToRecentAttendance();
    const unsubNotifs = listenToNotifications();
    const unsubBlacklist = listenToBlacklist();

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubFees();
      unsubRecent();
      unsubNotifs();
      unsubBlacklist();
    };
  }, []);

  const listenToBlacklist = () => {
    return onSnapshot(collection(db, 'blacklist'), (snapshot) => {
      setBlacklistDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setBlacklist(snapshot.docs.map(doc => doc.id));
    });
  };

  const listenToNotifications = () => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(list);
    });
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const listenToTotalStudents = () => {
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    return onSnapshot(q, (snapshot) => {
      setTotalStudents(snapshot.size);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllStudents(students);
      setStatsLoading(prev => ({ ...prev, students: false }));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching students:", error);
      setStatsLoading(prev => ({ ...prev, students: false }));
      setLoading(false);
    });
  };

  const listenToTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    return onSnapshot(q, (snapshot) => {
      setTodayAttendanceCount(snapshot.size);
      setStatsLoading(prev => ({ ...prev, attendance: false }));
    }, (error) => {
      console.error("Error fetching attendance:", error);
      setStatsLoading(prev => ({ ...prev, attendance: false }));
    });
  };

  const listenToPendingFees = () => {
    const q = query(collection(db, 'payments'), where('status', '==', 'pending'));
    return onSnapshot(q, (snapshot) => {
      const sum = snapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setPendingFeesSum(sum);
      setStatsLoading(prev => ({ ...prev, fees: false }));
    }, (error) => {
      console.error("Error fetching fees:", error);
      setStatsLoading(prev => ({ ...prev, fees: false }));
    });
  };

  const checkLocationConfig = async () => {
    try {
      const docRef = doc(db, 'config', 'attendance');
      const docSnap = await getDoc(docRef);
      setLocationConfigured(docSnap.exists());
    } catch (error) {
      console.error("Error checking location config:", error);
    }
  };

  const listenToRecentAttendance = () => {
    const q = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentAttendance(list);
    }, (error) => {
      console.error("Error fetching recent attendance:", error);
    });
  };

  const overviewStats = [
    { 
      label: 'Total Students', 
      value: isStatsLoading ? '...' : totalStudents.toString(), 
      icon: Users, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50' 
    },
    { 
      label: 'Overall Attendance', 
      value: isStatsLoading ? '...' : (totalStudents > 0 ? `${Math.round((todayAttendanceCount / totalStudents) * 100)}%` : '0%'), 
      icon: CheckCircle, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: 'Pending Fees', 
      value: isStatsLoading ? '...' : `₹${pendingFeesSum.toLocaleString()}`, 
      icon: AlertCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    },
  ];

  const handleToggleBlock = async (student: any) => {
    const emailToUse = student.email || student.id;
    if (!emailToUse) return;
    setIsBlocking(true);

    const isCurrentlyBlocked = blacklist.includes(emailToUse);

    try {
      if (isCurrentlyBlocked) {
        // Unblock
        await deleteDoc(doc(db, 'blacklist', emailToUse));
      } else {
        // Block
        await setDoc(doc(db, 'blacklist', emailToUse), {
          email: emailToUse,
          name: student.name || 'Unknown Student',
          blockedAt: new Date().toISOString()
        });
      }
      setStudentToBlock(null);
    } catch (error) {
      console.error("Error toggling block status:", error);
      alert("Failed to update student access");
    } finally {
      setIsBlocking(false);
    }
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setEditName(student.name || '');
    setEditSemester(student.semester || '1');
    setEditDepartment(student.courseName || 'BCA');
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);

    try {
      await updateDoc(doc(db, 'users', editingStudent.id), {
        name: editName,
        semester: editSemester,
        courseName: editDepartment,
        courseId: editDepartment.toLowerCase()
      });
      setEditingStudent(null);
    } catch (error) {
      console.error("Error updating student:", error);
      alert("Failed to update student");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderStudentGroup = (department: string) => {
    const deptUpper = department.toUpperCase();
    const deptStudents = allStudents.filter(s => String(s.courseId || s.courseName || 'General').toUpperCase() === deptUpper);
    
    // Group by semester
    const bySemester = deptStudents.reduce((acc: any, student) => {
      const sem = student.semester || 'Unknown';
      if (!acc[sem]) acc[sem] = [];
      acc[sem].push(student);
      return acc;
    }, {});

    const semesters = Object.keys(bySemester).sort();

    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{department} Students</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{deptStudents.length} total students</p>
          </div>
        </div>

        {semesters.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No students enrolled in {department} yet.
          </div>
        ) : (
          <div className="space-y-6">
            {semesters.map(sem => (
              <div key={sem} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      Semester {sem}
                    </span>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 border-l-2 border-slate-50 dark:border-slate-900">
                  {bySemester[sem].map((student: any) => {
                    const isBlocked = blacklist.includes(student.email);
                    return (
                    <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isBlocked ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-100 dark:bg-red-900/20' : 'bg-white dark:bg-slate-900'}`}>
                          <User className={`w-5 h-5 ${isBlocked ? 'text-red-500' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{student.name}</p>
                            {isBlocked && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 uppercase tracking-widest">
                                Suspended
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{student.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 transition-opacity">
                        <button 
                          onClick={() => openEditModal(student)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="Edit Student"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setStudentToBlock(student)}
                          className={`p-2 rounded-lg transition-all ${isBlocked ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                          title={isBlocked ? "Unblock Student" : "Block Student"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const courseColors = [
    'border-blue-200 dark:border-blue-900 bg-blue-50/30',
    'border-purple-200 dark:border-purple-900 bg-purple-50/30',
    'border-emerald-200 dark:border-emerald-900 bg-emerald-50/30',
    'border-orange-200 dark:border-orange-900 bg-orange-50/30',
    'border-pink-200 dark:border-pink-900 bg-pink-50/30',
    'border-indigo-200 dark:border-indigo-900 bg-indigo-50/30',
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Sidebar/Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">TuitionHub <span className="text-blue-600">Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/materials/manage')}
            className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-4"
          >
            <BookOpen className="w-5 h-5" /> Materials
          </button>
          <button 
            onClick={() => navigate('/doubts')}
            className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-4"
          >
            <MessageSquare className="w-5 h-5" /> Doubts
          </button>
          <button 
            onClick={() => navigate('/teacher/analytics')}
            className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-4"
          >
            <TrendingUp className="w-5 h-5" /> Analytics
          </button>

          {(profile?.role === 'admin' || profile?.role === 'teacher') && (
            <button 
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none mr-4"
            >
              <Shield className="w-4 h-4" /> Admin Section
            </button>
          )}
          
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => !notif.read && markNotificationRead(notif.id)}
                        className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm font-bold ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {notif.title}
                          </h4>
                          {!notif.read && <span className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(notif.timestamp).toLocaleDateString()} at {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => navigate('/profile')}
            className="text-right hidden sm:block hover:opacity-70 transition-opacity"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Teacher</p>
          </button>
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
        )}

        {!loading && !locationConfigured && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-xl flex items-center justify-center">
                <MapPin className="text-orange-600 dark:text-orange-400 w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-orange-900 dark:text-orange-100">Tuition Location Not Set</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">Students cannot mark attendance until you set the tuition center location.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/attendance/generate')}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-700 transition-all whitespace-nowrap"
            >
              Set Location Now
            </button>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">
            {/* Top Section — Daily Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {overviewStats.map((stat, i) => (
                <div 
                  key={i} 
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4"
                >
                  <div className={`${stat.bg} dark:bg-slate-800 p-3 rounded-xl`}>
                    <stat.icon className={`${stat.color} w-6 h-6`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Middle Section — Course Management (Students) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-7 h-7 text-blue-600" />
                    Course Management
                  </h2>
                  <div className="flex gap-2">
                    {(Array.from(new Set(allStudents.map(s => String(s.courseId || s.courseName || 'General').toUpperCase()))) as string[]).map(dept => (
                      <span key={dept} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold uppercase">{dept}</span>
                    ))}
                  </div>
                </div>
                {(Array.from(new Set(allStudents.map(s => String(s.courseId || s.courseName || 'General').toUpperCase()))) as string[]).length > 0 ? (
                  (Array.from(new Set(allStudents.map(s => String(s.courseId || s.courseName || 'General').toUpperCase()))) as string[]).map(dept => (
                    <div key={dept}>
                      {renderStudentGroup(dept || 'BCA')}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No students enrolled yet.
                  </div>
                )}
                
                {/* Blocks List */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 mt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                      <UserX className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Blocks List</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Suspended students by teacher</p>
                    </div>
                  </div>
                  
                  {blacklistDocs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No blocked students.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blacklistDocs.map((student: any) => (
                        <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border transition-all bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/20">
                              <UserX className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{student.name || 'Unknown Student'}</p>
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 uppercase tracking-widest">
                                  Suspended
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{student.email || student.id}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setStudentToBlock(student)}
                            className="px-4 py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                            title="Unblock Student"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance Feed */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    Attendance Feed
                  </h2>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                    LIVE
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 min-h-[400px]">
                  <div className="space-y-4">
                    {recentAttendance.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Clock className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm">No scans yet today</p>
                      </div>
                    ) : (
                      recentAttendance.map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                              <User className="text-blue-600 w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{record.studentName}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {record.courseName} • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(record.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {recentAttendance.length > 0 && (
                    <button 
                      onClick={() => navigate('/attendance/generate')}
                      className="w-full mt-6 py-2 text-blue-600 dark:text-blue-400 font-bold text-xs hover:underline"
                    >
                      View Full History
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Section — Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => navigate('/fees/manage')}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">Fee Structure</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set semester fees</p>
                </button>
                <button 
                  onClick={() => navigate('/admin/students/add')}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">New Student</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enroll a student</p>
                </button>
                <button 
                  onClick={() => navigate('/fees/reminders')}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">Fee Reminders</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Generate alerts</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Student</h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Semester</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Sem {s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                  >
                    <option value="BCA">BCA</option>
                    <option value="BSC">BSC</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {studentToBlock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <Trash2 className={`w-8 h-8 ${blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'text-orange-600' : 'text-red-600'}`} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
              {blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'Unblock Student?' : 'Suspend Student?'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to {blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'unblock' : 'suspend'} <span className="font-bold text-slate-900 dark:text-white">{studentToBlock.name || 'this student'}</span>? 
              {blacklist.includes(studentToBlock.email || studentToBlock.id) ? ' They will regain access to their account.' : ' They will be logged out and blocked from accessing their account.'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setStudentToBlock(null)}
                className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleToggleBlock(studentToBlock)}
                disabled={isBlocking}
                className={`flex-1 py-3 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-100 dark:shadow-none' : 'bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none'}`}
              >
                {isBlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : (blacklist.includes(studentToBlock.email || studentToBlock.id) ? 'Unblock' : 'Suspend')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-40 transition-colors">
        <button 
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => navigate('/materials/manage')}
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
          onClick={() => navigate('/teacher/analytics')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"
        >
          <TrendingUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Stats</span>
        </button>
        {(profile?.role === 'admin' || profile?.role === 'teacher') && (
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
