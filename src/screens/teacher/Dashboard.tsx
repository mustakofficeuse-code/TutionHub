import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';
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
  Edit2,
  Trash2,
  X,
  UserX,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Save
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function TeacherDashboard({ isEmbedded, onTabChange }: { isEmbedded?: boolean, onTabChange?: (id: string) => void }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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
  
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistDocs, setBlacklistDocs] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [locationConfigured, setLocationConfigured] = useState<boolean>(true);
  
  // Department Management
  const [departments, setDepartments] = useState<any[]>([]);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptSemesters, setNewDeptSemesters] = useState('8');
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [isAddingDept, setIsAddingDept] = useState(false);

  // Schedule Management
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    subject: '',
    department: 'BCA',
    semester: '1',
    startTime: '10:00',
    endTime: '11:00',
    date: new Date().toISOString().split('T')[0],
    requireGPS: true,
    gracePeriod: '15'
  });

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editRealEmail, setEditRealEmail] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const startEditSchedule = (item: any) => {
    setEditingScheduleId(item.id);
    setScheduleForm({
      subject: item.subject || '',
      department: item.department || 'BCA',
      semester: item.semester || '1',
      startTime: item.startTime || '10:00',
      endTime: item.endTime || '11:00',
      date: item.date || new Date().toISOString().split('T')[0],
      requireGPS: item.requireGPS ?? true,
      gracePeriod: item.gracePeriod || '15'
    });
    setShowScheduleModal(true);
  };

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
    const unsubDepts = listenToDepartments();
    const unsubSchedules = listenToSchedules();

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubFees();
      unsubRecent();
      unsubNotifs();
      unsubDepts();
      unsubSchedules();
    };
  }, []);

  const listenToSchedules = () => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    try {
      const scheduleData = {
        ...scheduleForm,
        courseId: scheduleForm.department.toUpperCase(),
        teacherName: profile?.name || 'Teacher',
        teacherId: auth.currentUser?.uid,
        updatedAt: serverTimestamp()
      };

      let currentScheduleId = editingScheduleId;

      if (editingScheduleId) {
        await updateDoc(doc(db, 'schedules', editingScheduleId), scheduleData);
      } else {
        const docRef = await addDoc(collection(db, 'schedules'), {
          ...scheduleData,
          createdAt: serverTimestamp()
        });
        currentScheduleId = docRef.id;
      }

      // Automatically activate attendance window in current session logic
      // This maps the Class Schedule to the Attendance Schedule system
      const attendanceScheduleId = `ATT_SCHED_${currentScheduleId}`;
      await setDoc(doc(db, 'attendance_schedules', attendanceScheduleId), {
        id: attendanceScheduleId,
        department: scheduleForm.department.toUpperCase(),
        semester: scheduleForm.semester,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        date: scheduleForm.date,
        requireGPS: scheduleForm.requireGPS,
        gracePeriod: scheduleForm.gracePeriod,
        teacherId: auth.currentUser?.uid,
        teacherName: profile?.name || 'Teacher',
        subject: scheduleForm.subject,
        updatedAt: serverTimestamp()
      });

      // Notify Students
      await addDoc(collection(db, 'notifications'), {
        title: editingScheduleId ? 'Class Schedule Updated' : 'New Class Scheduled',
        message: `${scheduleForm.subject} for ${scheduleForm.department} Sem ${scheduleForm.semester} on ${scheduleForm.date} at ${scheduleForm.startTime}.`,
        targetRole: 'student',
        targetDept: scheduleForm.department.toUpperCase(),
        targetSem: scheduleForm.semester,
        type: 'schedule',
        timestamp: new Date().toISOString(),
        read: false
      });

      setShowScheduleModal(false);
      setEditingScheduleId(null);
      setScheduleForm({
        ...scheduleForm,
        subject: ''
      });
    } catch (err) {
      console.error("Error adding/updating schedule:", err);
      alert("Failed to save schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
      // Also delete the associated attendance window
      await deleteDoc(doc(db, 'attendance_schedules', `ATT_SCHED_${id}`));
      setScheduleToDelete(null);
    } catch (err) {
      console.error("Error deleting schedule:", err);
      alert("Failed to delete schedule");
    }
  };

  const listenToDepartments = () => {
    return onSnapshot(collection(db, 'departments'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDepartments(list);
      
      // Auto-seed defaults if collection is empty
      if (snapshot.empty && list.length === 0) {
        console.log("[Admin] Seeding default departments...");
        const defaults = ['BCA', 'BSC', 'BTECH', 'MCA'];
        defaults.forEach(async (name) => {
          await setDoc(doc(db, 'departments', name), {
            name,
            createdAt: new Date().toISOString(),
            isDefault: true
          });
        });
      }
    });
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setIsAddingDept(true);
    try {
      const deptId = editingDept ? editingDept.id : newDeptName.trim().toUpperCase();
      const deptData = {
        name: newDeptName.trim().toUpperCase(),
        totalSemesters: Number(newDeptSemesters) || 8,
        updatedAt: new Date().toISOString(),
      };

      if (editingDept) {
        await updateDoc(doc(db, 'departments', editingDept.id), deptData);
      } else {
        await setDoc(doc(db, 'departments', deptId), {
          ...deptData,
          createdAt: new Date().toISOString(),
          teacherId: auth.currentUser?.uid,
          isCustom: true
        });
      }
      
      setNewDeptName('');
      setNewDeptSemesters('8');
      setEditingDept(null);
      setShowAddDeptModal(false);
    } catch (err) {
      console.error("Error saving department:", err);
      alert("Failed to save department");
    } finally {
      setIsAddingDept(false);
    }
  };

  const handleDeleteDepartment = async (id: string, isDefault?: boolean) => {
    console.log(`[Admin] Attempting to delete department: ${id}, isDefault: ${isDefault}`);
    
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    setDeleteConfirmId(null);
    try {
      await deleteDoc(doc(db, 'departments', id));
      console.log(`[Admin] Department ${id} deleted successfully`);
    } catch (err) {
      console.error("Error deleting department:", err);
      alert("Failed to delete department. Check console for details.");
    }
  };

  const listenToNotifications = () => {
    // Only show notifications for teachers/admins
    const q = query(
      collection(db, 'notifications'), 
      where('targetRole', 'in', ['teacher', 'admin', 'ALL']), 
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(list.slice(0, 20));
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

  const [isClearingFeed, setIsClearingFeed] = useState(false);
  const [isClearingNotifs, setIsClearingNotifs] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClearNotifications = async () => {
    if (!notifications.length) return;
    setIsClearingNotifs(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        batch.delete(doc(db, 'notifications', notif.id));
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearingNotifs(false);
    }
  };

  const clearAttendanceFeed = async () => {
    if (!recentAttendance.length) return;
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }

    setIsClearingFeed(true);
    try {
      const batch = writeBatch(db);
      recentAttendance.forEach(record => {
        batch.delete(doc(db, 'attendance', record.id));
      });
      await batch.commit();
      setClearConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearingFeed(false);
    }
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setEditSemester(student.semester || '1');
    setEditDepartment(student.courseId || student.courseName || 'BCA');
    setEditPhoneNumber(student.phoneNumber || '');
    setEditRealEmail(student.realEmail || '');
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);

    try {
      await updateDoc(doc(db, 'users', editingStudent.id), {
        semester: editSemester,
        courseName: editDepartment,
        courseId: editDepartment.toUpperCase()
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
    const deptStudents = allStudents.filter(s => {
      const d = String(s.courseId || s.courseName || '').toUpperCase();
      // If it's GENERAL and we are viewing BCA, include it (or vice versa depending on intent, but let's assume BCA is the default now)
      if (deptUpper === 'BCA' && (d === 'GENERAL' || d === '')) return true;
      return d === deptUpper;
    });
    
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
      <div className="grid grid-cols-1 gap-8">
        {semesters.map(sem => (
          <div key={sem} className="group animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none -rotate-2 group-hover:rotate-0 transition-transform">
                <span className="text-[10px] font-black leading-none uppercase opacity-80">Sem</span>
                <span className="text-xl font-black leading-none">{sem}</span>
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Semester {sem} Batch</h4>
                <div className="flex gap-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {bySemester[sem].length} Total Students
                  </p>
                  <span className="text-slate-300">•</span>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {bySemester[sem].filter((s: any) => !blacklist.includes(s.email)).length} Active
                  </p>
                </div>
              </div>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 ml-4 hidden sm:block"></div>
            </div>

            <div className="bg-white dark:bg-slate-900 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Student Profile</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 hidden md:table-cell">Reg Details</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Account Status</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {bySemester[sem].map((student: any) => {
                    const isBlocked = blacklist.includes(student.email);
                    return (
                      <tr key={student.id} className={`group/row ${isBlocked ? 'bg-red-50/10' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/10'} transition-colors`}>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div 
                              onClick={() => student.avatarUrl && setZoomedPhoto(student.avatarUrl)}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all overflow-hidden ${isBlocked ? 'bg-red-100 dark:bg-red-900/20' : 'bg-slate-100 dark:bg-slate-800 group-hover/row:bg-white dark:group-hover/row:bg-slate-900 group-hover/row:shadow-md'} ${student.avatarUrl ? 'cursor-zoom-in' : ''}`}
                            >
                              {student.avatarUrl ? (
                                <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className={`w-6 h-6 ${isBlocked ? 'text-red-500' : 'text-slate-400 group-hover/row:text-blue-600 transition-colors'}`} />
                              )}
                            </div>
                            <div>
                              <p className={`font-black text-base tracking-tight ${isBlocked ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`}>{student.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden sm:block">
                                  {student.realEmail || student.email}
                                </p>
                                {student.phoneNumber && (
                                  <a 
                                    href={`tel:${student.phoneNumber}`}
                                    className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Phone className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap hidden md:table-cell">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono tracking-tighter">ID: {student.studentId || 'N/A'}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Registered {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Long ago'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          {isBlocked ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl w-fit">
                              <UserX className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Suspended</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit">
                              <CheckCircle className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Active</span>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(student)}
                              className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                              title="Edit Details"
                            >
                              <Edit className="w-4.5 h-4.5" />
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
          </div>
        ))}
      </div>
    );
  };

  const overviewStats = [
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Today Attendance', value: todayAttendanceCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending Fees', value: `₹${pendingFeesSum}`, icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

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
      {/* Mobile Top Header (Student-like Profile Section) */}
      <div className="sm:hidden">
        <header className="bg-blue-600 text-white px-6 pt-6 pb-12 rounded-b-[32px] shadow-lg shadow-blue-100 dark:shadow-none relative overflow-hidden transition-all">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <motion.div 
                layoutId="profile-avatar"
                onClick={() => profile?.avatarUrl && setZoomedPhoto(profile.avatarUrl)}
                className="w-12 h-12 bg-white/20 rounded-2xl p-1 backdrop-blur-md cursor-pointer hover:scale-105 transition-transform overflow-hidden group relative shrink-0"
              >
                <div className="w-full h-full bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img 
                      src={profile.avatarUrl} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    profile?.name?.charAt(0) || 'T'
                  )}
                </div>
              </motion.div>
              <div className="flex flex-col gap-1.5">
                <div 
                  onClick={() => handleNav('/profile', 'profile')}
                  className="cursor-pointer"
                >
                  <p className="text-blue-100 text-[10px] font-black uppercase tracking-wider">Teacher Account</p>
                  <h1 className="text-xl font-black tracking-tight leading-tight">{profile?.name}</h1>
                </div>
                
                {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                  <button 
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 bg-yellow-400 text-blue-900 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all w-fit"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin Section
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md hover:bg-white/30 transition-all"
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={() => setShowNotifications(true)}
                className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md relative hover:bg-white/30 transition-all"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-blue-600 flex items-center justify-center text-[8px] font-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Desktop Sidebar/Nav (Hidden on Mobile) */}
      <nav className="hidden sm:flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 justify-between items-center sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white hidden xs:block">TuitionHub <span className="text-blue-600">Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleNav('/materials/manage', 'materials')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-2 sm:mr-4"
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden lg:inline">Materials</span>
          </button>
          <button 
            onClick={() => handleNav('/doubts', 'doubts')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-2 sm:mr-4"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="hidden lg:inline">Doubts</span>
          </button>
          <button 
            onClick={() => handleNav('/teacher/analytics', 'stats')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-2 sm:mr-4"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="hidden lg:inline">Analytics</span>
          </button>
          <button 
            onClick={() => handleNav('/attendance/generate', 'attendance')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-2 sm:mr-4"
          >
            <QrCode className="w-5 h-5" />
            <span className="hidden lg:inline">Attendance</span>
          </button>
          <button 
            onClick={() => handleNav('/fees/manage', 'fees')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors mr-2 sm:mr-4"
          >
            <CreditCard className="w-5 h-5" />
            <span className="hidden lg:inline">Fees</span>
          </button>

          {(profile?.role === 'admin' || profile?.role === 'teacher') && (
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none mr-2 sm:mr-4"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Section</span>
            </button>
          )}
          
          <button 
            onClick={() => setShowNotifications(true)}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => handleNav('/profile', 'profile')}
            className="flex items-center gap-3 hover:opacity-70 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm shrink-0">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile?.name?.charAt(0) || 'T'
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{profile?.name}</p>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-right">Teacher</p>
            </div>
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
              onClick={() => handleNav('/attendance/generate', 'attendance')}
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
                  onClick={stat.label === 'Pending Fees' ? () => handleNav('/fees/manage', 'fees') : undefined}
                  className={`bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 ${stat.label === 'Pending Fees' ? 'cursor-pointer hover:border-blue-500 transition-all' : ''}`}
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

            {/* Middle Section — Department Management (Students) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                      <ClipboardList className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Department Management</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Total {totalStudents} enrolled students</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddDeptModal(true)}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                    title="Add New Department"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {departments.length === 0 ? (
                    <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-400">No departments found. Click + to create one.</p>
                    </div>
                  ) : (
                    departments.sort((a, b) => a.name.localeCompare(b.name)).map((deptObj) => {
                      const dept = deptObj.name.toUpperCase();
                      const isActive = expandedDept === dept;
                      const deptCount = allStudents.filter(s => {
                        const d = String(s.courseId || s.courseName || s.department || '').toUpperCase();
                        const normalized = (d === 'GENERAL' || d === '' || d === 'OTHER') ? 'BCA' : d;
                        return normalized === dept;
                      }).length;

                      return (
                        <div
                          key={dept}
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedDept(isActive ? null : dept)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedDept(isActive ? null : dept);
                            }
                          }}
                          className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-32 relative group cursor-pointer ${
                            isActive 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 dark:shadow-none' 
                              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-500'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                              <BookOpen className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                            </div>
                            <div className="flex items-center gap-1">
                              {!isActive && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDept(deptObj);
                                      setNewDeptName(deptObj.name);
                                      setNewDeptSemesters(String(deptObj.totalSemesters || 8));
                                      setShowAddDeptModal(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                    title="Edit Department"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      handleDeleteDepartment(deptObj.id, deptObj?.isDefault); 
                                    }}
                                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                      deleteConfirmId === deptObj.id 
                                        ? 'bg-red-500 text-white px-3 ring-4 ring-red-100 dark:ring-red-900/30 shadow-lg' 
                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                    } cursor-pointer`}
                                    title={deleteConfirmId === deptObj.id ? "Click again to confirm" : "Delete Department"}
                                  >
                                    {deleteConfirmId === deptObj.id && (
                                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Confirm?</span>
                                    )}
                                    <Trash2 className={`${deleteConfirmId === deptObj.id ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                                  </button>
                                </div>
                              )}
                              {isActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>Department</p>
                            <p className="text-lg font-bold truncate">{dept}</p>
                            <p className={`text-[10px] ${isActive ? 'text-white/80' : 'text-slate-500'}`}>{deptCount} Students</p>
                          </div>
                        </div>
                      );
                    })
                  )}
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
              </div>

              {/* Attendance Feed */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    Attendance Feed
                  </h2>
                  <div className="flex items-center gap-2">
                    {recentAttendance.length > 0 && (
                      <button 
                        onClick={clearAttendanceFeed}
                        disabled={isClearingFeed}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest transition-all ${
                          clearConfirm 
                            ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-100 animate-pulse' 
                            : 'text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20'
                        } disabled:opacity-50`}
                      >
                        {isClearingFeed ? 'Clearing...' : clearConfirm ? 'Confirm Clear?' : 'Clear'}
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                      LIVE
                    </div>
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
                            <div 
                              onClick={() => record.studentAvatarUrl && setZoomedPhoto(record.studentAvatarUrl)}
                              className={`w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm overflow-hidden ${record.studentAvatarUrl ? 'cursor-zoom-in' : ''}`}
                            >
                              {record.studentAvatarUrl ? (
                                <img src={record.studentAvatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="text-blue-600 w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{record.studentName}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {record.department || record.courseName} • Sem {record.semester} • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
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

            {/* Quick Actions */}
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
                  onClick={() => navigate('/fees/reminders')}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">Fee Reminders</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Generate alerts</p>
                </button>
                <button 
                  onClick={() => setShowScheduleModal(true)}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">Class Schedule</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Plan upcoming classes</p>
                </button>
              </div>
            </div>

            {/* Schedule Overview */}
            {schedules.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    Upcoming Schedule
                  </h3>
                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    Manage All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schedules.filter(s => s.date >= new Date().toISOString().split('T')[0]).slice(0, 6).map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative group hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditSchedule(item);
                          }}
                          className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-blue-500 rounded-xl shadow-sm hover:scale-110 active:scale-95"
                          title="Edit Schedule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleToDelete(item.id);
                          }}
                          className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-500 rounded-xl shadow-sm hover:scale-110 active:scale-95"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
                          {item.department.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{item.subject}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{item.department} • Sem {item.semester}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {item.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
                          <Clock className="w-3 h-3" />
                          {item.startTime}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Manage Schedules</h3>
                <p className="text-sm text-slate-500">Plan and track your upcoming classes</p>
              </div>
              <button onClick={() => {
                setShowScheduleModal(false);
                setEditingScheduleId(null);
                setScheduleForm({
                  subject: '',
                  department: 'BCA',
                  semester: '1',
                  startTime: '10:00',
                  endTime: '11:00',
                  date: new Date().toISOString().split('T')[0],
                  requireGPS: true,
                  gracePeriod: '15'
                });
              }} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Side */}
              <div className="lg:col-span-1 border-r border-slate-100 dark:border-slate-800 pr-0 lg:pr-8">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
                  {editingScheduleId ? 'Edit Schedule' : 'Create New'}
                </h4>
                <form onSubmit={handleAddSchedule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2">Subject / Topic</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Advanced Java"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={scheduleForm.subject}
                      onChange={(e) => setScheduleForm({...scheduleForm, subject: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">Dept</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={scheduleForm.department}
                        onChange={(e) => setScheduleForm({...scheduleForm, department: e.target.value})}
                      >
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        {departments.length === 0 && <option value="BCA">BCA</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">Sem</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={scheduleForm.semester}
                        onChange={(e) => setScheduleForm({...scheduleForm, semester: e.target.value})}
                      >
                        {(() => {
                          const deptObj = departments.find(d => d.name === scheduleForm.department);
                          const total = deptObj?.totalSemesters || 8;
                          return Array.from({ length: total }, (_, i) => i + 1).map(s => (
                            <option key={s} value={s.toString()}>Sem {s}</option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2">Date</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={scheduleForm.date}
                      onChange={(e) => setScheduleForm({...scheduleForm, date: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">Start</label>
                      <input 
                        type="time" 
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={scheduleForm.startTime}
                        onChange={(e) => setScheduleForm({...scheduleForm, startTime: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">End</label>
                      <input 
                        type="time" 
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={scheduleForm.endTime}
                        onChange={(e) => setScheduleForm({...scheduleForm, endTime: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">Grace Period</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={scheduleForm.gracePeriod}
                        onChange={(e) => setScheduleForm({...scheduleForm, gracePeriod: e.target.value})}
                      >
                        <option value="5">5 Mins</option>
                        <option value="10">10 Mins</option>
                        <option value="15">15 Mins</option>
                        <option value="30">30 Mins</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase mb-2">Security</label>
                      <button 
                        type="button"
                        onClick={() => setScheduleForm({...scheduleForm, requireGPS: !scheduleForm.requireGPS})}
                        className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${scheduleForm.requireGPS ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                      >
                        <MapPin className="w-3 h-3" />
                        GPS {scheduleForm.requireGPS ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSavingSchedule}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2 mt-4"
                  >
                    {isSavingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : editingScheduleId ? <><Save className="w-5 h-5" /> Update Schedule</> : <><Plus className="w-5 h-5" /> Add to Schedule</>}
                  </button>
                  {editingScheduleId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingScheduleId(null);
                        setScheduleForm({
                          subject: '',
                          department: 'BCA',
                          semester: '1',
                          startTime: '10:00',
                          endTime: '11:00',
                          date: new Date().toISOString().split('T')[0],
                          requireGPS: true,
                          gracePeriod: '15'
                        });
                      }}
                      className="w-full py-2 text-slate-500 text-xs font-bold hover:underline"
                    >
                      Cancel Editing
                    </button>
                  )}
                </form>
              </div>

              {/* List Side */}
              <div className="lg:col-span-2">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Existing Schedules</h4>
                {schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Calendar className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm font-bold">No schedules found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:bg-white dark:hover:bg-slate-800 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-600 font-bold text-[10px]">
                            {item.department.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{item.subject}</p>
                            <p className="text-[10px] text-slate-500 font-black uppercase">{item.department} • Sem {item.semester} • {item.date}</p>
                          </div>
                        </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                              {formatTime12h(item.startTime)} - {formatTime12h(item.endTime)}
                            </span>
                            <button 
                              onClick={() => startEditSchedule(item)}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setScheduleToDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mb-4">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{editingStudent.name}</p>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 uppercase tracking-widest">{editingStudent.studentId}</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Semester</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                  >
                    {(() => {
                      const deptObj = departments.find(d => d.name === editDepartment);
                      const total = deptObj?.totalSemesters || 8;
                      return Array.from({ length: total }, (_, i) => i + 1).map(s => (
                        <option key={s} value={s}>Sem {s}</option>
                      ));
                    })()}
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
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    {departments.length === 0 && <option value="BCA">BCA (Default)</option>}
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

      {/* Notifications Panel */}
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
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No alerts yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      onClick={async () => {
                        if (!notif.read) {
                          await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                        }
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group ${notif.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-1 ${notif.type === 'schedule' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                          {notif.type === 'schedule' ? <Clock className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{notif.title}</h4>
                            {!notif.read && <span className="w-2 h-2 bg-blue-600 rounded-full mt-1.5" />}
                          </div>
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
      {showAddDeptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingDept ? 'Edit' : 'Add'} Department
              </h3>
              <button 
                onClick={() => {
                  setShowAddDeptModal(false);
                  setEditingDept(null);
                  setNewDeptName('');
                  setNewDeptSemesters('8');
                }} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddDepartment} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTECH, BCA, MSC"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Total Semesters</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  placeholder="e.g. 8"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newDeptSemesters}
                  onChange={(e) => setNewDeptSemesters(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddDeptModal(false);
                    setEditingDept(null);
                    setNewDeptName('');
                    setNewDeptSemesters('8');
                  }}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isAddingDept}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {isAddingDept ? <Loader2 className="w-5 h-5 animate-spin" /> : editingDept ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      {!isEmbedded && (
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-40 transition-colors">
        <button 
          onClick={() => handleNav('/', 'dashboard')}
          className="flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => handleNav('/materials/manage', 'materials')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-[10px] font-bold">Materials</span>
        </button>
        <button 
          onClick={() => handleNav('/doubts', 'doubts')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold">Doubts</span>
        </button>
        <button 
          onClick={() => handleNav('/teacher/analytics', 'stats')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
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
          onClick={() => handleNav('/profile', 'profile')}
          className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
      )}

      {/* Photo Zoom Modal */}
      {zoomedPhoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <button 
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={zoomedPhoto} 
            alt="Profile View" 
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Schedule Delete Confirmation */}
      {scheduleToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 mb-6 mx-auto">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center mb-2">Delete Schedule?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8 font-medium">This action cannot be undone. Are you sure you want to remove this schedule from the calendar?</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setScheduleToDelete(null)}
                className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Keep it
              </button>
              <button 
                onClick={() => handleDeleteSchedule(scheduleToDelete)}
                className="py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
