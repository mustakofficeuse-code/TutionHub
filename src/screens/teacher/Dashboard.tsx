import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db, auth, logError } from "../../firebase";
import { sendNotification } from "../../services/notificationService";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
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
  Edit2,
  Trash2,
  X,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  Save,
  Search,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";

export default function TeacherDashboard({
  isEmbedded,
  onTabChange,
}: {
  isEmbedded?: boolean;
  onTabChange?: (id: string) => void;
}) {
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
    if (!timeStr) return "";
    try {
      const [hours, minutes] = timeStr.split(":");
      let h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const getNextDays = () => {
    const today = new Date();
    const suggestions = [];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    suggestions.push({
      label: "Tomorrow",
      date: tomorrow.toISOString().split("T")[0],
    });

    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    suggestions.push({
      label: "Day After",
      date: dayAfter.toISOString().split("T")[0],
    });

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    suggestions.push({
      label: "Next Monday",
      date: nextMonday.toISOString().split("T")[0],
    });

    return suggestions;
  };

  // States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [locationConfigured, setLocationConfigured] = useState<boolean>(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptSemesters, setNewDeptSemesters] = useState("8");
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    subject: "",
    department: "BCA",
    semester: "1",
    startTime: "10:00",
    endTime: "11:00",
    date: new Date().toISOString().split("T")[0],
    requireGPS: true,
    gracePeriod: "15",
  });

  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editSemester, setEditSemester] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [deptSearch, setDeptSearch] = useState<{
    [key: string]: { sem: string; name: string };
  }>({});
  const [deletionRestriction, setDeletionRestriction] = useState<{
    show: boolean;
    deptName: string;
    studentCount: number;
  }>({ show: false, deptName: "", studentCount: 0 });

  // Stats
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0);
  const [pendingFeesSum, setPendingFeesSum] = useState(0);
  const [statsLoading, setStatsLoading] = useState({
    students: true,
    attendance: true,
    fees: true,
  });

  const isStatsLoading =
    statsLoading.students || statsLoading.attendance || statsLoading.fees;

  useEffect(() => {
    checkLocationConfig();
    const unsubStudents = onSnapshot(
      query(collection(db, "users"), where("role", "==", "student")),
      (snap) => {
        setTotalStudents(snap.size);
        setAllStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatsLoading((p) => ({ ...p, students: false }));
        setLoading(false);
      },
    );
    const unsubAttendance = onSnapshot(
      query(
        collection(db, "attendance"),
        where("date", "==", new Date().toISOString().split("T")[0]),
      ),
      (snap) => {
        setTodayAttendanceCount(snap.size);
        setStatsLoading((p) => ({ ...p, attendance: false }));
      },
    );
    const unsubFees = onSnapshot(
      query(collection(db, "payments"), where("status", "==", "pending")),
      (snap) => {
        setPendingFeesSum(
          snap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0),
        );
        setStatsLoading((p) => ({ ...p, fees: false }));
      },
    );
    const unsubRecent = onSnapshot(
      query(
        collection(db, "attendance"),
        orderBy("timestamp", "desc"),
        limit(15),
      ),
      (snap) => {
        setRecentAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );
    const unsubDepts = onSnapshot(collection(db, "departments"), (snap) => {
      setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubSchedules = onSnapshot(
      query(collection(db, "schedules"), orderBy("date", "desc"), limit(20)),
      (snap) => {
        setSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );
    const unsubNotifs = onSnapshot(
      query(
        collection(db, "notifications"),
        where("targetRole", "in", ["teacher", "admin", "ALL"]),
        limit(20),
      ),
      (snap) => {
        setNotifications(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort(
              (a: any, b: any) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            ),
        );
      },
    );

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubFees();
      unsubRecent();
      unsubDepts();
      unsubSchedules();
      unsubNotifs();
    };
  }, []);

  const checkLocationConfig = async () => {
    const docSnap = await getDoc(doc(db, "config", "attendance"));
    setLocationConfigured(docSnap.exists());
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    try {
      const data = {
        ...scheduleForm,
        courseId: scheduleForm.department.toUpperCase(),
        teacherId: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
      };
      if (editingScheduleId) {
        await updateDoc(doc(db, "schedules", editingScheduleId), data);
        await sendNotification({
          title: "Schedule Updated",
          message: `Your class schedule for ${scheduleForm.subject} has been updated.`,
          type: 'schedule_change',
          senderId: auth.currentUser?.uid || 'auto',
          senderName: 'Teacher',
          targetRole: "student",
          targetDept: scheduleForm.department.toUpperCase(),
          targetSem: scheduleForm.semester,
        });
      } else {
        const dr = await addDoc(collection(db, "schedules"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        const attId = `ATT_SCHED_${dr.id}`;
        await setDoc(doc(db, "attendance_schedules", attId), {
          ...data,
          id: attId,
          createdAt: serverTimestamp(),
        });
        await sendNotification({
          title: "New Class Scheduled",
          message: `A new class for ${scheduleForm.subject} has been scheduled on ${scheduleForm.date}.`,
          type: 'schedule_change',
          senderId: auth.currentUser?.uid || 'auto',
          senderName: 'Teacher',
          targetRole: "student",
          targetDept: scheduleForm.department.toUpperCase(),
          targetSem: scheduleForm.semester,
        });
      }
      setShowScheduleModal(false);
      setEditingScheduleId(null);
      setScheduleForm((p) => ({ ...p, subject: "" }));
    } catch (err) {
      alert("Failed to save schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteDoc(doc(db, "schedules", id));
      await deleteDoc(doc(db, "attendance_schedules", `ATT_SCHED_${id}`));
      setScheduleToDelete(null);
    } catch (err) {
      alert("Failed to delete schedule");
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setIsAddingDept(true);
    try {
      const dData = {
        name: newDeptName.trim().toUpperCase(),
        totalSemesters: Number(newDeptSemesters) || 8,
        updatedAt: new Date().toISOString(),
      };
      if (editingDept) {
        await updateDoc(doc(db, "departments", editingDept.id), dData);
      } else {
        await setDoc(doc(db, "departments", dData.name), {
          ...dData,
          createdAt: new Date().toISOString(),
          teacherId: auth.currentUser?.uid,
        });
      }
      setShowAddDeptModal(false);
      setEditingDept(null);
      setNewDeptName("");
    } catch (err) {
      alert("Failed to save department");
    } finally {
      setIsAddingDept(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    const deptObj = departments.find((d) => d.id === id);
    const students = allStudents.filter(
      (s) =>
        (s.courseId || s.courseName || "").toUpperCase() ===
        deptObj?.name?.toUpperCase(),
    );
    if (students.length > 0) {
      setDeletionRestriction({
        show: true,
        deptName: deptObj.name,
        studentCount: students.length,
      });
      return;
    }
    if (window.confirm(`Delete ${deptObj.name}?`)) {
      await deleteDoc(doc(db, "departments", id));
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", editingStudent.id), {
        semester: editSemester,
        courseName: editDepartment,
        courseId: editDepartment.toUpperCase(),
      });
      await sendNotification({
        title: "Profile Updated",
        message: `Your profile has been updated by the teacher. You are now in Semester ${editSemester}, Dept ${editDepartment}.`,
        type: 'profile_update',
        senderId: auth.currentUser?.uid || 'auto',
        senderName: 'Teacher',
        recipientId: editingStudent.id,
      });
      setEditingStudent(null);
    } catch (err) {
      alert("Failed to update student");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderStudentTable = (dept: string) => {
    const searchConfig = deptSearch[dept] || { sem: "ALL", name: "" };

    let students = allStudents.filter((s) => {
      const d = (s.courseId || s.courseName || "").toUpperCase();
      return (
        d === dept.toUpperCase() ||
        (dept.toUpperCase() === "BCA" && (d === "GENERAL" || d === ""))
      );
    });

    if (searchConfig.sem !== "ALL") {
      students = students.filter(
        (s) => (s.semester || "1") === searchConfig.sem,
      );
    }

    if (searchConfig.name.trim()) {
      const q = searchConfig.name.toLowerCase();
      students = students.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.studentId || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q),
      );
    }

    // Prepare UI elements first even if length is 0, so search is always available once expanded
    const grouped = students.reduce((acc: any, s) => {
      const sem = s.semester || "1";
      if (!acc[sem]) acc[sem] = [];
      acc[sem].push(s);
      return acc;
    }, {});

    return (
      <div className="space-y-4 px-1 pb-2">
        <div className="flex flex-col sm:flex-row gap-3 pt-3">
          <select
            value={searchConfig.sem}
            onChange={(e) =>
              setDeptSearch((prev) => ({
                ...prev,
                [dept]: { ...searchConfig, sem: e.target.value },
              }))
            }
            className="p-3 bg-white dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-wa-teal dark:text-white"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID or email..."
              value={searchConfig.name}
              onChange={(e) =>
                setDeptSearch((prev) => ({
                  ...prev,
                  [dept]: { ...searchConfig, name: e.target.value },
                }))
              }
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-sm outline-none focus:ring-2 focus:ring-wa-teal dark:text-white"
            />
          </div>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic bg-white dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5">
            No students match your search in {dept}.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.keys(grouped)
              .sort()
              .map((sem) => (
                <div
                  key={sem}
                  className="bg-white dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden"
                >
                  <div className="px-4 py-2 bg-slate-50 dark:bg-[#202c33] border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-[10px] font-black uppercase text-wa-teal">
                    <span>Semester {sem}</span>
                    <span>{grouped[sem].length} Students</span>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-white/5">
                    {grouped[sem].map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all group"
                      >
                        <div
                          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0"
                          onClick={() =>
                            s.avatarUrl && setZoomedPhoto(s.avatarUrl)
                          }
                        >
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => {
                            setEditingStudent(s);
                            setEditSemester(s.semester || "1");
                            setEditDepartment(
                              s.courseId || s.courseName || "BCA",
                            );
                          }}
                        >
                          <p className="text-sm font-bold text-slate-800 dark:text-[#e9edef] truncate">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {s.studentId || s.email}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {s.phoneNumber && (
                            <a
                              href={`tel:${s.phoneNumber}`}
                              className="p-2 text-wa-teal hover:bg-wa-teal/10 rounded-full"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setEditingStudent(s);
                              setEditSemester(s.semester || "1");
                              setEditDepartment(
                                s.courseId || s.courseName || "BCA",
                              );
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  const overviewStats = [
    {
      label: "Total Students",
      value: totalStudents,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Today Attendance",
      value: todayAttendanceCount,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending Fees",
      value: `₹${pendingFeesSum}`,
      icon: CreditCard,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-wa-bg dark:bg-[#0b141a] p-4 space-y-6 custom-scrollbar pb-10">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-wa-teal animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Main Feed View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Directory */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-[#202c33] p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 dark:border-white/5 sticky top-0 z-20">
                <h2 className="text-lg font-black text-slate-800 dark:text-[#e9edef] flex items-center gap-2">
                  <Users className="w-5 h-5 text-wa-teal" /> Student Directory
                </h2>
                <button
                  onClick={() => setShowAddDeptModal(true)}
                  className="p-2 bg-slate-50 dark:bg-[#111b21] rounded-full text-wa-teal hover:bg-wa-teal hover:text-white transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Cards Row */}
              <div className="grid grid-cols-3 gap-3">
                {overviewStats.map((s, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-[#202c33] p-3 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col items-center text-center"
                  >
                    <div
                      className={`w-8 h-8 ${s.bg} ${s.color} rounded-full flex items-center justify-center mb-1`}
                    >
                      <s.icon className="w-4 h-4" />
                    </div>
                    <p className="text-[8px] font-black uppercase text-[#8696a0] tracking-wider mb-0.5">
                      {s.label}
                    </p>
                    <p className="text-sm font-black text-slate-800 dark:text-[#e9edef]">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Departments Expansion */}
              <div className="space-y-3">
                {departments.map((d) => {
                  const name = d.name.toUpperCase();
                  const isActive = expandedDept === name;
                  const count = allStudents.filter(
                    (s) =>
                      (s.courseId || s.courseName || "").toUpperCase() === name,
                  ).length;
                  return (
                    <div key={d.id} className="space-y-2">
                      <div
                        onClick={() => setExpandedDept(isActive ? null : name)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center shadow-sm ${isActive ? "bg-wa-teal border-wa-teal text-white" : "bg-white dark:bg-[#202c33] border-slate-100 dark:border-white/5 text-slate-800 dark:text-[#e9edef]"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? "bg-white/20" : "bg-[#f0f2f5] dark:bg-slate-800"}`}
                          >
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-sm">{name}</h3>
                            <p className="text-[10px] font-bold opacity-60 uppercase">
                              {count} Students
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDept(d);
                                  setNewDeptName(d.name);
                                  setNewDeptSemesters(
                                    String(d.totalSemesters || 8),
                                  );
                                  setShowAddDeptModal(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-500"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDepartment(d.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {isActive ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {renderStudentTable(name)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Feed & Quick Actions */}
            <div className="space-y-6">
              {/* Quick Tools */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() =>
                    handleNav("/attendance/generate", "attendance")
                  }
                  className="p-5 bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 text-wa-green rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-[#8696a0] text-center">
                    QR Attendance
                  </span>
                </button>
                <button
                  onClick={() => handleNav("/fees/manage", "fees")}
                  className="p-5 bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-[#8696a0] text-center">
                    Fees Management
                  </span>
                </button>
                <button
                  onClick={() => handleNav("/admin", "admin")}
                  className="p-5 bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-all group col-span-2 sm:col-span-1"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-[#8696a0] text-center">
                    Admin Settings
                  </span>
                </button>
              </div>

              {/* Activity Feed */}
              <div className="bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 bg-[#f0f2f5] dark:bg-[#111b21] flex justify-between items-center border-b border-white/5">
                  <h3 className="text-sm font-black text-slate-800 dark:text-[#e9edef] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-wa-teal" /> Activity Feed
                  </h3>
                  <span className="text-[9px] bg-wa-teal/10 text-wa-teal px-2 py-0.5 rounded-full font-black uppercase">
                    Live
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {recentAttendance.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] rounded-2xl transition-all"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/10 text-wa-green flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-[#e9edef] truncate">
                          {rec.studentName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {rec.courseId} • Sem {rec.semester}
                        </p>
                      </div>
                      <span className="text-[9px] text-[#8696a0] font-bold">
                        {new Date(rec.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                  {recentAttendance.length === 0 && (
                    <div className="p-10 text-center text-slate-400 text-xs italic">
                      No check-ins yet.
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowScheduleModal(true)}
                className="w-full p-4 bg-slate-900 dark:bg-wa-teal text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Calendar className="w-4 h-4" /> Manage Class Schedule
              </button>
            </div>
          </div>
        </>
      )}

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
          >
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={zoomedPhoto}
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deletion Restriction Modal */}
      <AnimatePresence>
        {deletionRestriction.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#1f2c34] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl text-center border border-slate-100 dark:border-white/5"
            >
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shrink-0 rotate-3">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                Deletion Restricted
              </h3>
              <p className="text-slate-500 dark:text-[#8696a0] mb-8 font-medium leading-relaxed">
                Cannot delete the{" "}
                <span className="font-black text-slate-900 dark:text-white underline decoration-red-500 decoration-2 underline-offset-4 px-1">
                  {deletionRestriction.deptName}
                </span>{" "}
                department.
                <br />
                It currently has{" "}
                <span className="font-black text-red-600">
                  {deletionRestriction.studentCount} students
                </span>{" "}
                enrolled.
              </p>
              <button
                onClick={() =>
                  setDeletionRestriction((prev) => ({ ...prev, show: false }))
                }
                className="w-full py-4 bg-wa-teal text-white font-black rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-wa-teal/20"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals for Add/Edit Dept, Edit Student, etc. (kept minimal for visual clarity) */}
      {showAddDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/5">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-wa-teal" />{" "}
              {editingDept ? "Edit" : "New"} Department
            </h3>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                  Name
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  placeholder="e.g. BCA"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                  Total Semesters
                </label>
                <input
                  type="number"
                  value={newDeptSemesters}
                  onChange={(e) => setNewDeptSemesters(e.target.value)}
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  min="1"
                  max="10"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDept}
                  className="flex-1 py-4 bg-wa-teal text-white font-black rounded-2xl shadow-lg shadow-wa-teal/20 transition-all active:scale-95"
                >
                  {isAddingDept ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                {editingStudent.avatarUrl ? (
                  <img
                    src={editingStudent.avatarUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">
                  {editingStudent.name}
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  {editingStudent.studentId || editingStudent.email}
                </p>
              </div>
            </div>
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                    Semester
                  </label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                    Dept
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-4 bg-wa-teal text-white font-black rounded-2xl shadow-lg shadow-wa-teal/20 transition-all active:scale-95"
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Update"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 shadow-2xl border border-white/5 custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Calendar className="w-6 h-6 text-wa-teal" /> Class Schedule
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <form onSubmit={handleAddSchedule} className="space-y-4">
                <p className="text-[10px] font-black uppercase text-wa-teal tracking-widest mb-4">
                  {editingScheduleId ? "Edit Session" : "Plan New Session"}
                </p>
                <input
                  value={scheduleForm.subject}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      subject: e.target.value,
                    })
                  }
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  placeholder="Subject Name (e.g. Data Science)"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={scheduleForm.department}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        department: e.target.value,
                      })
                    }
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={scheduleForm.semester}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        semester: e.target.value,
                      })
                    }
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {getNextDays().map((s) => (
                    <button
                      key={s.date}
                      type="button"
                      onClick={() =>
                        setScheduleForm({ ...scheduleForm, date: s.date })
                      }
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full transition-all ${
                        scheduleForm.date === s.date
                          ? "bg-wa-teal text-white shadow-md"
                          : "bg-slate-50 dark:bg-[#111b21] text-slate-400 hover:text-wa-teal border border-slate-100 dark:border-white/5"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, date: e.target.value })
                  }
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        startTime: e.target.value,
                      })
                    }
                    required
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  />
                  <input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        endTime: e.target.value,
                      })
                    }
                    required
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingSchedule}
                  className="w-full py-5 bg-wa-teal text-white font-black rounded-2xl shadow-xl shadow-wa-teal/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter text-xs"
                >
                  {isSavingSchedule ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />{" "}
                      {editingScheduleId
                        ? "Update Schedule"
                        : "Confirm Schedule"}
                    </>
                  )}
                </button>
              </form>

              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">
                  Upcoming List
                </p>
                <div className="space-y-3 h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {schedules.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center group relative"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {s.subject}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                          {s.department} Sem {s.semester} • {s.date}
                        </p>
                        <p className="text-[9px] text-wa-teal font-black">
                          {formatTime12h(s.startTime)} -{" "}
                          {formatTime12h(s.endTime)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingScheduleId(s.id);
                            setScheduleForm({
                              ...s,
                              date:
                                s.date ||
                                new Date().toISOString().split("T")[0],
                            });
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <p className="text-center py-20 text-slate-400 text-xs italic">
                      No upcoming classes planned.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
