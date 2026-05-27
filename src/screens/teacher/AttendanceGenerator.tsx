import React, { useState, useEffect, Fragment } from 'react';
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, orderBy, onSnapshot, limit, where, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  MapPin, 
  ArrowLeft, 
  RefreshCw,
  Loader2,
  Save,
  Clock,
  User,
  X,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Trash2,
  Activity,
  FileText,
  Search,
  TrendingUp,
  Plus,
  Edit2
} from 'lucide-react';
import { sendNotification } from '../../services/notificationService';
import { useNavigate } from 'react-router-dom';

const STATIC_QR_VALUE = "TUITIONHUB_WALL_QR_2026_SECURE";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AttendanceGenerator({ isEmbedded }: { isEmbedded?: boolean }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [tuitionLocation, setTuitionLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClearingFeed, setIsClearingFeed] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [indexError, setIndexError] = useState(false);
  
  // Schedule state replacements
  const [globalRequireGPS, setGlobalRequireGPS] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    subject: "",
    message: "",
    department: "BCA",
    semester: "1",
    startTime: "10:00",
    endTime: "11:00",
    date: getTodayString(),
    requireGPS: true,
    gracePeriod: "until_end",
  });

  const [searchQuery, setSearchQuery] = useState({
    name: '',
    department: 'ALL',
    semester: 'ALL'
  });

  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'history'>('monitor');
  const [departments, setDepartments] = useState<string[]>([]);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    fetchTuitionLocation();
    const unsubSchedules = listenToSchedules();
    const unsubAttendance = listenToRecentAttendance();
    
    // Departments listener
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => doc.data().name));
    }, (e: any) => {});

    // All schedules listener for the popup/dialog box
    const qAllSchedules = query(
      collection(db, 'schedules'),
      where('teacherId', '==', user.uid)
    );
    const unsubAllSchedules = onSnapshot(qAllSchedules, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllSchedules(list);
    }, (err) => {
      console.error("Error listening to all schedules:", err);
    });

    // History listener - all time records for this teacher
    const qHistory = query(
      collection(db, 'attendance'), 
      where('teacherId', '==', user.uid),
      limit(200)
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const records = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistoryRecords(records);
    }, (error) => {
      console.error("History listener error:", error);
    });

    return () => {
      unsubSchedules();
      unsubAttendance();
      unsubHistory();
      unsubDepts();
      unsubAllSchedules();
    };
  }, [user]);

  const fetchTuitionLocation = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'config', 'attendance');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTuitionLocation(docSnap.data() as {lat: number, lng: number});
      }
    } catch (error) {
      console.error("Error fetching tuition location:", error);
    } finally {
      setLoading(false);
    }
  };

  const listenToSchedules = () => {
    if (!user?.uid) return () => {};
    
    const today = getTodayString();
    console.log(`[Teacher] Listening for schedules: Date=${today}, Teacher=${user.uid}`);
    
    const q = query(
      collection(db, 'schedules'), 
      where('teacherId', '==', user.uid),
      where('date', '==', today)
    );
    return onSnapshot(q, (snapshot) => {
      console.log(`[Teacher] Found ${snapshot.docs.length} schedules in listener`);
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setActiveSchedules(list);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("[Teacher] Schedules listener error:", error);
      }
    });
  };

  useEffect(() => {
    if (!activeSchedules || activeSchedules.length === 0) return;
    
    const checkActiveClasses = async () => {
      const now = new Date();
      const todayVal = getTodayString();
      
      for (const sched of activeSchedules) {
        if (sched.date === todayVal && !sched.attendanceNotified) {
          try {
            let formattedDate = sched.date;
            if (formattedDate && formattedDate.includes("-")) {
              const parts = formattedDate.split("-");
              if (parts[0].length === 2) {
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            }
            const startDateTime = new Date(`${formattedDate}T${sched.startTime}:00`);
            const endDateTime = new Date(`${formattedDate}T${sched.endTime}:00`);
            
            const activeStart = new Date(startDateTime.getTime() - 15 * 60 * 1000);
            const activeEnd = new Date(endDateTime.getTime() - 60 * 60 * 1000); // 1 hour before end of class
            
            const nowMs = now.getTime();
            if (nowMs >= activeStart.getTime() && nowMs <= activeEnd.getTime()) {
              sched.attendanceNotified = true;
              
              const schedId = sched.id;
              
              try {
                const schedRef = doc(db, 'schedules', schedId);
                const attRef = doc(db, 'attendance_schedules', `ATT_SCHED_${schedId}`);
                
                await updateDoc(schedRef, { attendanceNotified: true }).catch(() => {});
                await updateDoc(attRef, { attendanceNotified: true }).catch(() => {});
                
                const ampmStart = formatTime12h(sched.startTime);
                const ampmEnd = formatTime12h(sched.endTime);
                
                await addDoc(collection(db, 'notifications'), {
                  title: `⚡ Attendance System Active: ${sched.subject || 'Class'}`,
                  message: `The attendance system for ${sched.subject || 'Class'} (${sched.department} Sem ${sched.semester}) is now active (${ampmStart} - ${ampmEnd}). Mark attendance immediately!`,
                  type: 'schedule_change',
                  senderId: sched.teacherId || 'system',
                  senderName: sched.teacherName || 'System',
                  targetRole: 'ALL',
                  targetDept: sched.department.toUpperCase(),
                  targetSem: sched.semester,
                  read: false,
                  createdAt: new Date().toISOString()
                });
                
                await fetch('/api/send-push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: `⚡ Attendance Active: ${sched.subject || 'Class'}`,
                    body: `The attendance/class schedule is active. Check-in now!`,
                    targetRole: 'ALL',
                    type: 'schedule_change',
                    targetDept: sched.department.toUpperCase(),
                    targetSem: sched.semester,
                    senderId: sched.teacherId || 'system',
                  })
                }).catch(() => {});
              } catch (err) {
                console.error("Error setting notification:", err);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    };
    
    checkActiveClasses();
    const interval = setInterval(checkActiveClasses, 15000);
    return () => clearInterval(interval);
  }, [activeSchedules]);

  const listenToRecentAttendance = () => {
    if (!user?.uid) return () => {};

    const q = query(
      collection(db, 'attendance'), 
      where('teacherId', '==', user.uid), 
      orderBy('timestamp', 'desc'), 
      limit(50)
    );

    return onSnapshot(q as any, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setRecentAttendance(list);
      setIndexError(false);
    }, (error: any) => {
      if (error.code !== 'permission-denied') {
        console.error("[Teacher] Attendance feed error:", error);
      }
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        setIndexError(true);
      }
    });
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Update every 10s
    return () => clearInterval(timer);
  }, []);

  const isScheduleActive = (sched: any) => {
    try {
      const now = currentTime;
      let formattedDate = sched.date;
      if (formattedDate && formattedDate.includes("-")) {
        const parts = formattedDate.split("-");
        if (parts[0].length === 2) {
          formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      const startObj = new Date(`${formattedDate}T${sched.startTime}:00`);
      const endObj = new Date(`${formattedDate}T${sched.endTime}:00`);
      
      const activeStart = new Date(startObj.getTime() - 15 * 60 * 1000); // 15 minutes before start
      
      let activeEnd: Date;
      const gp = sched.gracePeriod || "until_end";
      if (gp === "until_end") {
        activeEnd = endObj;
      } else {
        const minutes = parseInt(gp, 10);
        if (!isNaN(minutes)) {
          activeEnd = new Date(startObj.getTime() + minutes * 60 * 1000);
        } else {
          activeEnd = endObj;
        }
      }
      
      const nowMs = now.getTime();
      return nowMs >= activeStart.getTime() && nowMs <= activeEnd.getTime();
    } catch (e) {
      return false;
    }
  };

  const getLiveAttendance = () => {
    // Only show attendance records that belong to a CURRENTLY active schedule
    return recentAttendance.filter(record => {
      const schedule = activeSchedules.find(s => s.id === record.scheduleId);
      if (!schedule) return false;
      return isScheduleActive(schedule);
    });
  };

  const calculateEndTime = (startTime: string, minutes: number) => {
    if (!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date(2000, 0, 1, h, m);
    const end = new Date(start.getTime() + minutes * 60000);
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    return `${eh}:${em}`;
  };

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
  };

  const getNextDays = () => {
    const today = new Date();
    const suggestions = [
      {
        label: "Today",
        date: today.toISOString().split("T")[0],
      }
    ];

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

    return suggestions;
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    setSaveStatus({ type: null, message: '' });
    try {
      const data = {
        ...scheduleForm,
        courseId: scheduleForm.department.toUpperCase(),
        department: scheduleForm.department.toUpperCase(),
        teacherId: user?.uid,
        updatedAt: serverTimestamp(),
      };
      const durationStr = `${formatTime12h(scheduleForm.startTime)} - ${formatTime12h(scheduleForm.endTime)}`;
      
      if (editingScheduleId) {
        await updateDoc(doc(db, "schedules", editingScheduleId), data);
        await updateDoc(doc(db, "attendance_schedules", `ATT_SCHED_${editingScheduleId}`), data);
        await sendNotification({
          title: "Schedule Updated",
          message: `Your class schedule for ${scheduleForm.subject} (${durationStr}) has been updated for ${scheduleForm.date}.${scheduleForm.message ? ' Note: ' + scheduleForm.message : ''}`,
          type: 'schedule_change',
          senderId: user?.uid || 'auto',
          senderName: 'Teacher',
          targetRole: "student",
          targetDept: scheduleForm.department.toUpperCase(),
          targetSem: scheduleForm.semester,
        });
        setSaveStatus({ type: 'success', message: "Schedule updated successfully!" });
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
          message: `A new class for ${scheduleForm.subject} (${durationStr}) has been scheduled on ${scheduleForm.date}.${scheduleForm.message ? ' Note: ' + scheduleForm.message : ''}`,
          type: 'schedule_change',
          senderId: user?.uid || 'auto',
          senderName: 'Teacher',
          targetRole: "student",
          targetDept: scheduleForm.department.toUpperCase(),
          targetSem: scheduleForm.semester,
        });
        setSaveStatus({ type: 'success', message: "Schedule created successfully!" });
      }
      setEditingScheduleId(null);
      setScheduleForm((p) => ({ ...p, subject: "", message: "" }));
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus({ type: 'error', message: "Failed to save schedule" });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const cleanId = id.startsWith('ATT_SCHED_') ? id.replace('ATT_SCHED_', '') : id;
    const attId = id.startsWith('ATT_SCHED_') ? id : `ATT_SCHED_${id}`;

    const scheduleItem = allSchedules.find((s) => s.id === cleanId || s.id === attId)
      || activeSchedules.find((s) => s.id === cleanId || s.id === attId);

    const label = scheduleItem
      ? `${scheduleItem.subject || "Class"} (${scheduleItem.department} Sem ${scheduleItem.semester})`
      : "this class schedule";

    if (!window.confirm(`Are you sure you want to delete the schedule for "${label}"? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      // 1. Primary deletion by document IDs
      await deleteDoc(doc(db, "schedules", cleanId));
      await deleteDoc(doc(db, "attendance_schedules", attId));
      
      // Fallback deletions in case IDs are swapped or loaded differently
      await deleteDoc(doc(db, "attendance_schedules", cleanId)).catch(() => {});
      await deleteDoc(doc(db, "schedules", attId)).catch(() => {});

      // 2. Secondary Deletion: Query and purge any matching records in both collections
      // to eliminate any duplicates or remnants
      if (scheduleItem) {
        const { subject, department, semester, startTime, date } = scheduleItem;
        const targetTeacherId = scheduleItem.teacherId || user?.uid;
        
        if (subject && department && semester && startTime && date) {
          const qSched = query(
            collection(db, "schedules"),
            where("subject", "==", subject),
            where("department", "==", department),
            where("semester", "==", semester),
            where("startTime", "==", startTime),
            where("date", "==", date),
            where("teacherId", "==", targetTeacherId)
          );
          const snapSched = await getDocs(qSched);
          await Promise.all(snapSched.docs.map(d => deleteDoc(doc(db, "schedules", d.id)))).catch(() => {});

          const qAttSched = query(
            collection(db, "attendance_schedules"),
            where("subject", "==", subject),
            where("department", "==", department),
            where("semester", "==", semester),
            where("startTime", "==", startTime),
            where("date", "==", date),
            where("teacherId", "==", targetTeacherId)
          );
          const snapAttSched = await getDocs(qAttSched);
          await Promise.all(snapAttSched.docs.map(d => deleteDoc(doc(db, "attendance_schedules", d.id)))).catch(() => {});
        }

        await sendNotification({
          title: "Schedule Cancelled",
          message: `The scheduled class for "${scheduleItem.subject || 'Class'}" (${scheduleItem.department} Sem ${scheduleItem.semester}) has been cancelled.`,
          type: "schedule_change",
          senderId: user?.uid || "auto",
          senderName: "Teacher",
          targetRole: "student",
          targetDept: scheduleItem.department.toUpperCase(),
          targetSem: scheduleItem.semester,
        });
      }
      setSaveStatus({ type: 'success', message: "Schedule deleted successfully!" });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (err) {
      console.error("Error deleting schedule:", err);
      alert("Failed to delete schedule");
    } finally {
      setSaving(false);
    }
  };

  const [showClearFeedConfirm, setShowClearFeedConfirm] = useState(false);

  const deleteAllAttendance = async () => {
    if (recentAttendance.length === 0) return;
    
    setSaving(true);
    setIsClearingFeed(true);
    try {
      const batch = writeBatch(db);
      recentAttendance.forEach((record) => {
        batch.delete(doc(db, 'attendance', record.id));
      });
      await batch.commit();
      setSaveStatus({ type: 'success', message: "Attendance Feed cleared successfully." });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
      setShowClearFeedConfirm(false);
    } catch (error) {
      console.error("Error clearing attendance:", error);
      setSaveStatus({ type: 'error', message: "Failed to clear records." });
    } finally {
      setSaving(false);
      setIsClearingFeed(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Aggregation for History
  const getAggregatedHistory = () => {
    const filtered = historyRecords.filter(rec => {
      const nameMatch = !searchQuery.name || rec.studentName?.toLowerCase().includes(searchQuery.name.toLowerCase());
      const deptMatch = searchQuery.department === 'ALL' || rec.department === searchQuery.department;
      const semMatch = searchQuery.semester === 'ALL' || String(rec.semester) === searchQuery.semester;
      return nameMatch && deptMatch && semMatch;
    });

    const studentCounts: Record<string, { name: string, dept: string, sem: string, avatarUrl: string, count: number, lastTime: string, records: any[] }> = {};
    
    filtered.forEach(rec => {
      if (!studentCounts[rec.studentId]) {
        studentCounts[rec.studentId] = { 
          name: rec.studentName || 'Unknown Student',
          dept: rec.department || 'N/A',
          sem: rec.semester || 'N/A',
          avatarUrl: rec.studentAvatarUrl || '',
          count: 0,
          lastTime: rec.timestamp,
          records: [] 
        };
      }
      studentCounts[rec.studentId].count += 1;
      // Since it's ordered by desc timestamp, the first one encountered for each student is the most recent
      if (new Date(rec.timestamp) > new Date(studentCounts[rec.studentId].lastTime)) {
        studentCounts[rec.studentId].lastTime = rec.timestamp;
      }
      studentCounts[rec.studentId].records.push(rec);
    });

    return Object.values(studentCounts).sort((a, b) => b.count - a.count);
  };

  const getGroupedHistory = () => {
    const aggregated = getAggregatedHistory();
    const groups: Record<string, any[]> = {};
    
    aggregated.forEach(student => {
      const dept = student.dept || 'Other';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(student);
    });
    
    return groups;
  };

  const updateLocation = async () => {
    if (navigator.geolocation) {
      setSaving(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          try {
            await setDoc(doc(db, 'config', 'attendance'), newLoc);
            setTuitionLocation(newLoc);
          } catch (error) {
            console.error("Error saving location:", error);
          } finally {
            setSaving(false);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setSaving(false);
          alert("Failed to get current location. Please ensure GPS is enabled.");
        }
      );
    }
  };

  return (
    <div className={`min-h-screen ${isEmbedded ? '' : 'bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-5 sm:p-5 sm:p-6'} transition-colors font-sans print:p-0 print:bg-white`}>
      <div className="w-full max-w-none mx-auto px-1 md:px-4 print:max-w-none">
        {!isEmbedded && (
          <button 
            onClick={() => navigate('/')}
            className="mb-4 sm:mb-8 flex items-center gap-3 text-slate-600 dark:text-slate-300 font-bold hover:text-wa-teal transition-all  tracking-normal text-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#202c33] flex items-center justify-center shadow-sm group-hover:bg-wa-teal group-hover:text-white transition-all border border-slate-100 dark:border-white/5 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Dashboard
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-4 sm:gap-8 items-start">
          
          {/* LEFT: Scheduling & Static QR */}
          <div className="lg:col-span-3 space-y-2 sm:space-y-4 sm:space-y-8 print:col-span-12 print:space-y-0">
            
            {/* The Wall QR Code (Static) */}
            <div 
              className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 text-center group cursor-pointer relative overflow-hidden print:shadow-none print:border-0 print:p-0" 
              onClick={handlePrint}
              role="button"
              tabIndex={0}
            >
              <div className="absolute inset-0 bg-wa-teal opacity-0 group-hover:opacity-5 transition-opacity print:hidden"></div>
              
              <div className="flex flex-col items-center mb-4 sm:mb-8">
                <div className="w-16 h-16 bg-wa-teal rounded-[1.25rem] flex items-center justify-center mb-5 shadow-lg shadow-wa-teal/20 dark:shadow-none animate-pulse print:hidden shrink-0">
                  <QrCode className="text-white w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-[#e9edef] tracking-normal italic leading-none">ATTENDANCE QR</h2>
                <p className="text-sm font-bold text-wa-teal tracking-normal mt-3 print:text-black">Scan to Attend</p>
              </div>
              
              <div className="bg-[#f8f9fa] dark:bg-[#111b21] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl inline-block border-2 border-slate-50 dark:border-white/5 mb-4 sm:mb-8 group-hover:border-wa-teal/30 transition-all print:border-slate-200 print:bg-white relative">
                <QRCodeSVG value={STATIC_QR_VALUE} size={240} level="H" includeMargin={true} className="mx-auto max-w-full h-auto" />
                
                {activeSchedules.filter(isScheduleActive).length > 0 && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-wa-green text-white px-5 sm:px-8 py-2.5 rounded-full text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 shadow-xl shadow-wa-green/20 dark:shadow-none whitespace-nowrap animate-bounce">
                     LIVE
                  </div>
                )}
              </div>
              
              <div className="space-y-2 sm:space-y-4 mb-4 sm:mb-6 sm:mb-10">
                {activeSchedules.filter(isScheduleActive).length > 0 ? (
                  activeSchedules.filter(isScheduleActive).map(sched => (
                    <div key={sched.id} className="p-4 sm:p-5 bg-wa-teal/5 dark:bg-wa-teal/10 rounded-[1.5rem] border border-wa-teal/10 animate-in fade-in duration-500">
                      <p className="text-xs font-bold text-wa-teal  tracking-normal mb-1.5">Live Class</p>
                      <p className="text-base font-bold text-slate-800 dark:text-[#e9edef] leading-tight">{sched.subject || 'Standard Class'}</p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300  tracking-normal mt-2">{sched.department} • SEMESTER {sched.semester}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#111b21] rounded-[1.5rem] border border-dashed border-slate-200 dark:border-white/5 opacity-60">
                    <p className="text-xs font-bold text-slate-400  tracking-normal leading-none">Standby</p>
                    <p className="text-xs font-bold text-slate-400 mt-2">QR Code Inactive</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handlePrint}
                className="w-full text-xs font-bold text-wa-teal hover:text-white transition-all  tracking-normal flex items-center justify-center gap-3 print:hidden bg-wa-teal/10 py-3 sm:py-5 rounded-[1.5rem] hover:bg-wa-teal shadow-inner"
              >
                <RefreshCw className="w-4 h-4" /> Print Options
              </button>
            </div>

            {/* Class Schedule Section */}
            <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 print:hidden">
              <div className="flex items-center gap-4 mb-4 sm:mb-8">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                  <Calendar className="text-indigo-500 w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-[#e9edef] tracking-normal">Class Schedule</h3>
                   <p className="text-xs font-bold text-slate-400 tracking-normal">Manage attendance window</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setShowScheduleModal(true)}
                  className="w-full py-3 sm:py-5 bg-wa-teal hover:bg-wa-teal/90 text-white rounded-[1.5rem] font-bold shadow-xl shadow-wa-teal/20 dark:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-95 group"
                >
                  <Clock className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Set Schedule Dialog
                </button>

                {/* Keep GPS Required button inside this class schedule section */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-bold text-slate-400 mb-2">GPS SETTING</p>
                  <button 
                    onClick={() => setGlobalRequireGPS(!globalRequireGPS)}
                    className={`w-full h-14 rounded-2xl text-xs font-bold tracking-normal transition-all flex items-center justify-center gap-2 border-2 ${globalRequireGPS ? 'bg-wa-teal border-wa-teal text-white shadow-lg shadow-wa-teal/20' : 'bg-[#f8f9fa] border-slate-100 text-slate-400 dark:bg-[#111b21] dark:border-white/5'}`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    GPS {globalRequireGPS ? 'REQUIRED' : 'NOT REQUIRED'}
                  </button>
                </div>
              </div>
            </div>

            {/* GPS Anchor */}
            <div className="bg-[#111b21] text-white p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-xl overflow-hidden relative group print:hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-wa-teal/10 blur-3xl -mr-24 -mt-24 group-hover:bg-wa-teal/20 transition-all"></div>
              <div className="relative z-10">
                <h3 className="font-bold mb-4 sm:mb-6 flex items-center gap-3 text-sm  tracking-normal text-wa-teal">
                  <MapPin className="w-5 h-5" /> Require Location
                </h3>
                {tuitionLocation ? (
                  <div className="space-y-3 sm:space-y-6">
                    <div className="p-4 sm:p-5 bg-white/5 rounded-2xl backdrop-blur-md border border-white/5 space-y-2">
                       <div>
                        <p className="text-[8px] font-bold text-slate-600 dark:text-slate-400  tracking-normal mb-1">LATITUDE ACCURACY</p>
                        <p className="text-xs font-mono text-wa-teal">{tuitionLocation.lat.toFixed(8)}</p>
                       </div>
                       <div>
                        <p className="text-[8px] font-bold text-slate-600 dark:text-slate-400  tracking-normal mb-1">LONGITUDE ACCURACY</p>
                        <p className="text-xs font-mono text-wa-teal">{tuitionLocation.lng.toFixed(8)}</p>
                       </div>
                    </div>
                    <button onClick={updateLocation} className="w-full py-4 text-xs font-bold text-wa-teal hover:text-white transition-all  tracking-normal flex items-center justify-center gap-2 border border-wa-teal/20 rounded-xl hover:bg-wa-teal/10">
                      <RefreshCw className="w-3.5 h-3.5" /> Re-Calibrate Anchor
                    </button>
                  </div>
                ) : (
                  <button onClick={updateLocation} className="w-full py-4 bg-wa-teal text-white rounded-xl font-bold text-xs  tracking-normal">Initialize Node</button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Monitor / History Tabs */}
          <div className="lg:col-span-9 space-y-2 sm:space-y-4 sm:space-y-8 print:hidden">
            
            {/* Tab Selection */}
              <div className="flex bg-[#f8f9fa] dark:bg-[#111b21] p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner relative z-20">
                <button 
                  onClick={() => setActiveTab('monitor')}
                  className={`flex-1 py-3 sm:py-5 rounded-[1.25rem] text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-3 ${activeTab === 'monitor' ? 'bg-wa-teal text-white shadow-xl shadow-wa-teal/20 dark:shadow-none' : 'text-slate-600 dark:text-slate-300 hover:text-wa-teal'}`}
                >
                  <Activity className="w-4 h-4" /> LIVE MONITOR
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3 sm:py-5 rounded-[1.25rem] text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-3 ${activeTab === 'history' ? 'bg-wa-teal text-white shadow-xl shadow-wa-teal/20 dark:shadow-none' : 'text-slate-600 dark:text-slate-300 hover:text-wa-teal'}`}
                >
                  <FileText className="w-4 h-4" /> History
                </button>
              </div>

            {activeTab === 'monitor' ? (
              <div className="space-y-2 sm:space-y-4 sm:space-y-8">
                {/* Active Schedules Ribbon */}
                <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-wa-teal/5 blur-3xl -mr-16 -mt-16"></div>
                  <div className="flex items-center justify-between gap-4 mb-4 sm:mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-[#e9edef] flex items-center gap-3 tracking-normal">
                        <Users className="text-wa-teal w-6 h-6" />
                        Active Sessions
                      </h3>
                      <p className="text-xs font-bold text-slate-400  tracking-normal mt-1">Live Operational Windows</p>
                    </div>
                    {saveStatus.type && (
                      <div className={`px-4 py-2 rounded-full text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-right-2 duration-300 ${saveStatus.type === 'success' ? 'bg-wa-green/10 text-wa-green' : 'bg-red-500/10 text-red-500'}`}>
                        {saveStatus.message.includes('successfully') || saveStatus.message.includes('removed') ? 'Success' : 'Error'}
                      </div>
                    )}
                  </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSchedules.length === 0 ? (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl">
                     <p className="text-slate-400 font-bold text-xs  tracking-normal">Void Frequency • Awaiting Session Start</p>
                  </div>
                ) : (
                  activeSchedules.map(sched => (
                    <div key={sched.id} className="bg-[#f8f9fa] dark:bg-[#111b21] p-4 sm:p-5 rounded-2xl border border-transparent hover:border-wa-teal/20 transition-all flex items-center gap-5 group">
                      <div className="w-12 h-12 bg-white dark:bg-[#202c33] rounded-2xl flex flex-col items-center justify-center shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                        <span className="text-[6px] font-bold text-slate-400  leading-none">SEMESTER</span>
                        <span className="text-lg font-bold text-wa-teal leading-none">{sched.semester}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 dark:text-[#e9edef] text-sm truncate  tracking-normal">{sched.department}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-xs font-bold text-slate-400  tracking-normal whitespace-nowrap bg-white dark:bg-[#202c33] px-2 py-1 rounded-lg">
                            {sched.startTime}—{sched.endTime}
                          </p>
                          <span className={`text-[8px] font-bold px-2 py-1 rounded-lg  tracking-normal shrink-0 ${sched.requireGPS ? 'bg-wa-teal/10 text-wa-teal' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                            {sched.requireGPS ? 'GPS TRACE ON' : 'GPS BYPASS'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button 
                          onClick={() => handleDeleteSchedule(sched.id)}
                          disabled={saving}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Purge Window"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attendance reality feed */}
            <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 min-h-[500px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 mb-4 sm:mb-6 sm:mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-wa-green/10 rounded-2xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-wa-green animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-normal">ATTENDANCE FEED</h3>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-1">Live Telemetry Incoming</p>
                  </div>
                </div>
                  <button 
                    onClick={() => setShowClearFeedConfirm(true)}
                    disabled={recentAttendance.length === 0 || saving || isClearingFeed}
                    className="flex items-center gap-2 text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 transition-all px-5 py-3 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 
                    {isClearingFeed ? 'CLEARING...' : 'CLEAR FEED'}
                  </button>
              </div>

              <div className="space-y-2 sm:space-y-4">
                {getLiveAttendance().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700 opacity-50">
                    <Activity className="w-20 h-20 mb-4 sm:mb-6 stroke-[1px] animate-pulse" />
                    <p className="font-bold  tracking-normal text-xs">Frequency Silent</p>
                  </div>
                ) : (
                  getLiveAttendance().map((record) => (
                    <motion.div 
                      key={record.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center justify-between p-4 sm:p-5 bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-white dark:hover:bg-[#202c33] hover:shadow-xl rounded-2xl border border-transparent hover:border-wa-teal/20 transition-all duration-500"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div 
                          onClick={() => record.studentAvatarUrl && setZoomedPhoto(record.studentAvatarUrl)}
                          className={`w-14 h-14 bg-white dark:bg-[#202c33] rounded-[1.25rem] flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform overflow-hidden border-2 border-transparent group-hover:border-wa-teal/30 ${record.studentAvatarUrl ? 'cursor-zoom-in' : ''}`}
                        >
                          {record.studentAvatarUrl ? (
                            <img src={record.studentAvatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="text-wa-teal w-7 h-7" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-lg text-slate-800 dark:text-[#e9edef] tracking-normal truncate">{record.studentName}</h4>
                          <div className="flex items-center gap-3 text-xs font-bold text-slate-400  tracking-normal mt-1">
                            <span className="text-wa-teal">{record.department}</span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span>LEVEL {record.semester}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold text-slate-800 dark:text-[#e9edef] mb-1">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                        <div className="flex items-center justify-end gap-2 text-xs font-bold text-wa-green  tracking-normal">
                          <div className="w-1.5 h-1.5 bg-wa-green rounded-full animate-pulse" />
                          VERIFIED
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
            ) : (
              /* HISTORY VIEW */
              <div className="space-y-2 sm:space-y-4 sm:space-y-8 animate-in fade-in duration-700">
                <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 space-y-3 sm:space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-wa-teal/10 rounded-2xl flex items-center justify-center">
                      <Search className="w-6 h-6 text-wa-teal" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-[#e9edef]  tracking-normal">Attendance</h3>
                      <p className="text-xs font-bold text-slate-400  tracking-normal">View past records</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="SEARCH OPERATIVE..."
                        value={searchQuery.name}
                        onChange={(e) => setSearchQuery({...searchQuery, name: e.target.value})}
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-4 sm:px-6 pl-14 text-[13px] font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                      />
                    </div>
                    <select 
                      value={searchQuery.department}
                      onChange={(e) => setSearchQuery({...searchQuery, department: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-4 sm:px-6 text-[13px] font-bold transition-all outline-none cursor-pointer text-slate-800 dark:text-[#e9edef]"
                    >
                      <option value="ALL">ALL SECTORS</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <select 
                      value={searchQuery.semester}
                      onChange={(e) => setSearchQuery({...searchQuery, semester: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-4 sm:px-6 text-[13px] font-bold transition-all outline-none cursor-pointer text-slate-800 dark:text-[#e9edef]"
                    >
                      <option value="ALL">ALL LEVELS</option>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>SEMESTER {s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#202c33] rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
                  <div className="p-4 sm:p-5 sm:p-5 sm:p-6 border-b border-slate-50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#f8f9fa] dark:bg-[#111b21]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-[#e9edef]  tracking-normal">Attendance Stats</h3>
                    </div>
                    <span className="px-4 py-2 bg-white dark:bg-[#202c33] border border-slate-100 dark:border-white/5 rounded-full text-xs font-bold text-slate-400  tracking-normal">{getAggregatedHistory().length} Students Present</span>
                  </div>
                  
                  <div className="w-full overflow-x-auto scrollbar-hide"><table className="w-full min-w-max text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-[#f8f9fa] dark:bg-[#111b21]">
                          <th className="px-5 sm:px-8 py-4 sm:py-6 text-xs font-bold text-slate-400  tracking-normal">Student</th>
                          <th className="px-5 sm:px-8 py-4 sm:py-6 text-xs font-bold text-slate-400  tracking-normal">Department</th>
                          <th className="px-5 sm:px-8 py-4 sm:py-6 text-xs font-bold text-slate-400  tracking-normal">Last Entry</th>
                          <th className="px-5 sm:px-8 py-4 sm:py-6 text-xs font-bold text-slate-400  tracking-normal text-center">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5 text-slate-900 dark:text-[#e9edef]">
                        {Object.entries(getGroupedHistory()).sort(([a], [b]) => a.localeCompare(b)).map(([dept, students]) => (
                          <Fragment key={dept}>
                            <tr className="bg-slate-50/50 dark:bg-[#111b21]/50">
                              <td colSpan={4} className="px-5 sm:px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse"></div>
                                  <span className="text-xs font-bold text-slate-800 dark:text-[#e9edef]  tracking-normal">{dept} DEPARTMENT</span>
                                  <span className="text-xs font-bold text-wa-teal bg-wa-teal/10 px-3 py-1 rounded-full border border-wa-teal/10 ml-3">
                                    {students.length} STUDENTS
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {students.map((student, idx) => (
                              <tr key={student.id || `${student.name}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-[#202c33] transition-colors border-l-4 border-l-transparent hover:border-l-wa-teal">
                                <td className="px-5 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                                  <div className="flex items-center gap-4">
                                    <div 
                                      onClick={() => student.avatarUrl && setZoomedPhoto(student.avatarUrl)}
                                      className={`shrink-0 w-12 h-12 bg-white dark:bg-[#111b21] rounded-2xl flex items-center justify-center text-wa-teal font-bold text-sm overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm ${student.avatarUrl ? 'cursor-zoom-in group-hover:scale-110 transition-transform' : ''}`}
                                    >
                                      {student.avatarUrl ? (
                                        <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        student.name.charAt(0)
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-800 dark:text-[#e9edef] text-sm truncate  tracking-normal">{student.name}</p>
                                      <p className="text-xs font-bold text-slate-400  tracking-normal mt-0.5">ID: {student.id?.slice(-8) || "N/A"}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                                  <span className="px-3 py-1.5 bg-[#f8f9fa] dark:bg-[#111b21] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-white/5">SEMESTER {student.sem}</span>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                                  <p className="text-xs font-bold text-slate-800 dark:text-[#e9edef]">
                                    {new Date(student.lastTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                  <p className="text-xs font-bold text-slate-400  tracking-normal mt-1 opacity-60">
                                    {new Date(student.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-4">
                                    <span className="text-lg font-bold text-slate-800 dark:text-[#e9edef]">{student.count}</span>
                                    <div className="hidden sm:block h-2 w-24 bg-[#f8f9fa] dark:bg-[#111b21] rounded-full overflow-hidden border border-slate-100 dark:border-white/5 shadow-inner">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (student.count / 10) * 100)}%` }}
                                        className="h-full bg-wa-teal rounded-full" 
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table></div>

                  {getAggregatedHistory().length === 0 && (
                    <div className="p-24 text-center">
                      <div className="w-24 h-24 bg-slate-50 dark:bg-[#111b21] rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                        <Search className="w-10 h-10 text-slate-200" />
                      </div>
                      <p className="text-xs font-bold text-slate-400  tracking-normal">Query Matrix Empty</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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

      {/* Clear Feed Confirmation */}
      {showClearFeedConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-5 sm:p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/10">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] text-center mb-2">Clear Live Feed?</h3>
            <p className="text-[#8696a0] text-center mb-4 sm:mb-8">
              This will clear the current session's live monitor feed. The master history records will remain safe.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearFeedConfirm(false)}
                className="flex-1 py-3 text-[#8696a0] font-bold hover:bg-[#f0f2f5] dark:hover:bg-[#111b21] rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={deleteAllAttendance}
                disabled={saving || isClearingFeed}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      <AnimatePresence>
        {zoomedPhoto && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4"
            onClick={() => setZoomedPhoto(null)}
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-2xl w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={zoomedPhoto} alt="Zoomed DP" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setZoomedPhoto(null)}
                className="absolute top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all shadow-lg border border-white/20 group"
              >
                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Class Schedule Dialog Box */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1f2c34] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl border border-white/5 custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-wa-teal" /> Class Schedule Dialog
                </h3>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    setEditingScheduleId(null);
                    setScheduleForm((p) => ({ ...p, subject: "", message: "", gracePeriod: "until_end" }));
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                <form onSubmit={handleAddSchedule} className="space-y-4">
                  <p className="text-xs font-bold text-wa-teal tracking-normal uppercase">
                    {editingScheduleId ? "Edit Session Details" : "Plan New Class Session"}
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
                  <input
                    value={scheduleForm.message}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        message: e.target.value,
                      })
                    }
                    className="w-full p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal"
                    placeholder="Optional Message (e.g. Bring your laptop - optional)"
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
                        <option key={d} value={d}>
                          {d}
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
                        key={s.label}
                        type="button"
                        onClick={() =>
                          setScheduleForm({ ...scheduleForm, date: s.date })
                        }
                        className={`px-3 py-1.5 text-xs font-bold tracking-normal rounded-full transition-all ${
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
                  
                  {/* Attendance Active Duration Selector */}
                  <div className="space-y-2 bg-slate-50/50 dark:bg-[#111b21]/30 p-4 rounded-2xl border border-slate-100/60 dark:border-white/5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Attendance Scanner Active Till:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={["until_end", "15", "30", "45", "60"].includes(scheduleForm.gracePeriod) ? scheduleForm.gracePeriod : "custom"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setScheduleForm({
                              ...scheduleForm,
                              gracePeriod: "20", // Default custom value
                            });
                          } else {
                            setScheduleForm({
                              ...scheduleForm,
                              gracePeriod: val,
                            });
                          }
                        }}
                        className="w-full p-3.5 bg-white dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-white/10 text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal text-xs font-semibold"
                      >
                        <option value="until_end">Until class ends</option>
                        <option value="15">First 15 minutes of class</option>
                        <option value="30">First 30 minutes of class</option>
                        <option value="45">First 45 minutes of class</option>
                        <option value="60">First 60 minutes of class</option>
                        <option value="custom">Custom duration in mins</option>
                      </select>
                      
                      {!["until_end", "15", "30", "45", "60"].includes(scheduleForm.gracePeriod) ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            placeholder="Minutes"
                            value={scheduleForm.gracePeriod}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScheduleForm({
                                ...scheduleForm,
                                gracePeriod: val || "1",
                              });
                            }}
                            required
                            min="1"
                            max="360"
                            className="w-24 p-3.5 bg-white dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-white/10 text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-wa-teal text-xs font-semibold text-center"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">minutes after start</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-[11px] text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-[#111b21]/50 px-3 py-2 rounded-xl border border-slate-150 dark:border-white/5 font-semibold">
                          {scheduleForm.gracePeriod === "until_end" 
                            ? "✓ Active for full class duration" 
                            : `✓ Active first ${scheduleForm.gracePeriod} mins of class`}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 leading-normal">
                      Note: System allows student scan 15 mins before starting until selected duration limit.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSavingSchedule}
                      className="w-full py-4 bg-wa-teal text-white font-bold rounded-2xl shadow-xl shadow-wa-teal/20 active:scale-95 transition-all flex items-center justify-center gap-2 tracking-normal text-xs uppercase"
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
                  </div>
                  {editingScheduleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScheduleId(null);
                        setScheduleForm((p) => ({ ...p, subject: "", message: "", gracePeriod: "until_end" }));
                      }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all text-xs"
                    >
                      Cancel Editing
                    </button>
                  )}
                </form>

                <div>
                  <p className="text-xs font-bold text-slate-400 tracking-normal mb-4 uppercase">
                    Upcoming & Planned Classes ({allSchedules.length})
                  </p>
                  <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                    {allSchedules.map((s) => (
                      <div
                        key={s.id}
                        className="p-4 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center group relative shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                            {s.subject}
                          </p>
                          {s.message && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5 max-w-[200px] truncate" title={s.message}>
                              Note: {s.message}
                            </p>
                          )}
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-1">
                            {s.department} Sem {s.semester} • {s.date}
                          </p>
                          <p className="text-[11px] text-wa-teal font-bold mt-0.5 mb-2">
                            {formatTime12h(s.startTime)} -{" "}
                            {formatTime12h(s.endTime)}
                          </p>
                          <ClassCountdown date={s.date} startTime={s.startTime} endTime={s.endTime} />
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingScheduleId(s.id);
                              setScheduleForm({
                                ...s,
                                message: s.message || "",
                                date: s.date || getTodayString(),
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
                    {allSchedules.length === 0 && (
                      <p className="text-center py-20 text-slate-400 text-xs italic">
                        No scheduled classes planned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ClassCountdown({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }) {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const update = () => {
      try {
        const now = new Date();
        let formattedDate = date;
        if (formattedDate && formattedDate.includes("-")) {
          const parts = formattedDate.split("-");
          if (parts[0].length === 2) {
            formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        const startObj = new Date(`${formattedDate}T${startTime}:00`);
        const endObj = new Date(`${formattedDate}T${endTime}:00`);
        const diffStart = startObj.getTime() - now.getTime();
        const diffEnd = endObj.getTime() - now.getTime();

        if (diffEnd < 0) {
          setMsg("Finished");
        } else if (diffStart < 0) {
          setMsg("In Progress");
        } else {
          const totalSecs = Math.floor(diffStart / 1000);
          if (totalSecs < 0) {
            setMsg("In Progress");
            return;
          }
          const days = Math.floor(totalSecs / 86400);
          const hours = Math.floor((totalSecs % 86400) / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          
          let parts = [];
          if (days > 0) {
            parts.push(`${days}d`);
          }
          if (hours > 0 || days > 0) {
            parts.push(`${hours}h`);
          }
          if (mins > 0 || hours > 0 || days > 0) {
            parts.push(`${mins}m`);
          }
          parts.push(`${secs}s`);
          
          setMsg(`Starts in ${parts.join(" ")}`);
        }
      } catch (e) {
        setMsg("");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [date, startTime, endTime]);

  if (!msg) return null;
  return (
    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
      msg === "In Progress" ? "bg-wa-green/10 text-wa-green animate-pulse" :
      msg === "Finished" ? "bg-slate-100 text-slate-400 dark:bg-white/5" :
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/25 dark:text-indigo-400"
    }`}>
      {msg}
    </span>
  );
}
