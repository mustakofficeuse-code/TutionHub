import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth, logError } from '../../firebase';
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
  UserX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

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
  
  // Permanent Delete State
  const [studentToPermanentDelete, setStudentToPermanentDelete] = useState<any | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

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
      logError("Error fetching students:", error);
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
      logError("Error fetching attendance:", error);
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
      logError("Error fetching fees:", error);
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
      logError("Error fetching recent attendance:", error);
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

  const handlePermanentDelete = async (student: any) => {
    const emailToUse = student.email || student.id;
    if (!emailToUse) return;
    setIsPermanentDeleting(true);

    try {
      const q = query(collection(db, 'users'), where('email', '==', emailToUse));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'users', d.id)));
      await Promise.all(deletePromises);

      await setDoc(doc(db, 'blacklist', emailToUse), {
        email: emailToUse,
        name: student.name || 'Unknown Student',
        permanentlyDeleted: true,
        blockedAt: new Date().toISOString()
      }, { merge: true });

      setStudentToPermanentDelete(null);
    } catch (error) {
      console.error("Error permanently deleting student:", error);
      alert("Failed to permanently delete student");
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const handleRemoveFromBlacklist = async (id: string) => {
    if (!window.confirm("Remove this record from the blocklist history?")) return;
    try {
      await deleteDoc(doc(db, 'blacklist', id));
    } catch (error) {
      console.error("Error removing from blacklist:", error);
    }
  };

  const clearDeletedRecords = async () => {
    if (!window.confirm("Clear all permanently deleted student records from the blocklist history?")) return;
    const deletedOnes = blacklistDocs.filter(s => s.permanentlyDeleted);
    try {
      const promises = deletedOnes.map(s => deleteDoc(doc(db, 'blacklist', s.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing deleted records:", error);
    }
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

  const renderStudentTable = (department: string) => {
    const deptUpper = department.toUpperCase();
    const deptStudents = allStudents.filter(s => String(s.courseName || s.courseId || '').toUpperCase() === deptUpper);
    
    // Group by semester
    const bySemester = deptStudents.reduce((acc: any, student) => {
      const sem = student.semester || '1';
      if (!acc[sem]) acc[sem] = [];
      acc[sem].push(student);
      return acc;
    }, {});

    const semesters = Object.keys(bySemester).sort();

    if (deptStudents.length === 0) {
      return (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No students enrolled in {department} yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {semesters.map(sem => (
          <div key={sem} className="bg-white dark:bg-slate-900 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                Semester {sem} — {bySemester[sem].length} Students
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">ID / Email</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {bySemester[sem].map((student: any) => {
                    const isBlocked = blacklist.includes(student.email);
                    return (
                      <tr key={student.id} className={`${isBlocked ? 'bg-red-50/30 dark:bg-red-900/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'} transition-colors`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                              <User className={`w-4 h-4 ${isBlocked ? 'text-red-500' : 'text-blue-500'}`} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{student.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 sm:hidden">{student.studentId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">{student.studentId}</p>
                          <p className="text-[10px] text-slate-400">{student.email}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isBlocked ? (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 uppercase tracking-widest">Suspended</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 uppercase tracking-widest">Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => openEditModal(student)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setStudentToBlock(student)}
                              className={`p-1.5 rounded-lg transition-all ${isBlocked ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                              title={isBlocked ? "Unblock" : "Suspend"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
          <button 
            onClick={() => navigate('/attendance/generate')}
            className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-4"
          >
            <QrCode className="w-5 h-5" /> Attendance
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
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                      <ClipboardList className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Course Management</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Total {totalStudents} enrolled students</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/admin/students/add')}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                    title="Add New Student"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {(Array.from(new Set(allStudents.map(s => String(s.courseName || s.courseId || '').toUpperCase()))) as string[])
                    .filter(dept => dept && dept !== 'GENERAL' && dept !== 'OTHER')
                    .map((dept, index) => {
                      const isActive = expandedDept === dept;
                      const deptCount = allStudents.filter(s => String(s.courseName || s.courseId || '').toUpperCase() === dept).length;
                      return (
                      <button
                        key={dept}
                        onClick={() => setExpandedDept(isActive ? null : dept)}
                        className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-32 relative group ${
                          isActive 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 dark:shadow-none' 
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-500'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <BookOpen className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                          </div>
                          {isActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>Department</p>
                          <p className="text-lg font-bold truncate">{dept}</p>
                          <p className={`text-[10px] ${isActive ? 'text-white/80' : 'text-slate-500'}`}>{deptCount} Students</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {expandedDept && (
                    <motion.div
                      key={expandedDept}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="animate-in fade-in duration-300"
                    >
                      <div className="flex items-center justify-between mb-4 mt-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {expandedDept} Student Records
                          </h3>
                        </div>
                        <button 
                          onClick={() => setExpandedDept(null)}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Minimize
                        </button>
                      </div>
                      {renderStudentTable(expandedDept)}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Blocks List */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                        <UserX className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Blocks List</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Suspended students by teacher</p>
                      </div>
                    </div>
                    {blacklistDocs.some(s => s.permanentlyDeleted) && (
                      <button 
                        onClick={clearDeletedRecords}
                        className="text-xs text-red-600 hover:underline font-bold px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        Clear Deleted History
                      </button>
                    )}
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
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 uppercase tracking-widest">
                                  ID: {student.studentId || student.id?.substring(0, 8)}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${student.permanentlyDeleted ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                  {student.permanentlyDeleted ? 'Deleted' : 'Suspended'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {student.permanentlyDeleted ? (
                               <div className="flex items-center gap-2">
                                 <span className="px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold text-xs rounded-lg uppercase tracking-wider">
                                   Permanently Deleted
                                 </span>
                                 <button 
                                   onClick={() => handleRemoveFromBlacklist(student.id)}
                                   className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                   title="Remove from history"
                                 >
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => setStudentToBlock(student)}
                                  className="px-4 py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                  title="Unblock Student"
                                >
                                  Unblock
                                </button>
                                <button 
                                  onClick={() => setStudentToPermanentDelete(student)}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                                  title="Permanently Delete Student"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
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
                  onClick={() => navigate('/attendance/generate')}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <QrCode className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">QR Attendance</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Generate session QR</p>
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
                    <option value="BTECH">BTECH</option>
                    <option value="MCA">MCA</option>
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

      {/* Permanent Delete Confirmation Modal */}
      {studentToPermanentDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto bg-red-50 dark:bg-red-900/20">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
              Permanently Delete Student?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900 dark:text-white">{studentToPermanentDelete.name || 'this student'}</span>? 
              This will completely remove them and prevent them from ever enrolling in TuitionHub again. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setStudentToPermanentDelete(null)}
                className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handlePermanentDelete(studentToPermanentDelete)}
                disabled={isPermanentDeleting}
                className="flex-1 py-3 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none"
              >
                {isPermanentDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete Permanently'}
              </button>
            </div>
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
