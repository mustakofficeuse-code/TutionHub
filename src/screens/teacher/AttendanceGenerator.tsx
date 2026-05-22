import { useState, useEffect, Fragment } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, query, orderBy, onSnapshot, limit, where, writeBatch } from 'firebase/firestore';
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
  TrendingUp
} from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [isClearingFeed, setIsClearingFeed] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [indexError, setIndexError] = useState(false);
  
  const [newSchedule, setNewSchedule] = useState({
    department: 'BCA',
    semester: '1',
    subject: '',
    topic: '',
    startTime: '',
    endTime: '',
    requireGPS: true,
    gracePeriod: '15', // Default 15 minutes grace period
    date: getTodayString()
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
      collection(db, 'attendance_schedules'), 
      where('teacherId', '==', user.uid),
      where('date', '==', today)
    );
    return onSnapshot(q, (snapshot) => {
      console.log(`[Teacher] Found ${snapshot.docs.length} schedules in listener`);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSchedules(list);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("[Teacher] Schedules listener error:", error);
      }
    });
  };

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
    const now = currentTime;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    // Schedule is active if current time is between start and end
    return timeStr >= sched.startTime && timeStr <= sched.endTime;
  };

  const getLiveAttendance = () => {
    // Only show attendance records that belong to a CURRENTLY active schedule
    return recentAttendance.filter(record => {
      const schedule = activeSchedules.find(s => s.id === record.scheduleId);
      if (!schedule) return false;
      return isScheduleActive(schedule);
    });
  };

  const [customDuration, setCustomDuration] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const calculateEndTime = (startTime: string, minutes: number) => {
    if (!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date(2000, 0, 1, h, m);
    const end = new Date(start.getTime() + minutes * 60000);
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    return `${eh}:${em}`;
  };

  const createSchedule = async () => {
    console.log("[Teacher] createSchedule triggered");
    setSaveStatus({ type: null, message: '' });

    if (!user) {
      setSaveStatus({ type: 'error', message: "Please log in to set schedules." });
      return;
    }
    if (!newSchedule.startTime || !newSchedule.endTime) {
      setSaveStatus({ type: 'error', message: "Please set both start and end times." });
      return;
    }

    // Validate 5-hour maximum (increased from 1 hour)
    const start = new Date(`2000-01-01T${newSchedule.startTime}:00`);
    const end = new Date(`2000-01-01T${newSchedule.endTime}:00`);
    let diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    // Handle midnight crossing
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    if (diffMinutes > 300) {
      setSaveStatus({ type: 'error', message: "Maximum schedule window is 5 hours." });
      return;
    }

    if (diffMinutes <= 0) {
      setSaveStatus({ type: 'error', message: "End time must be after start time." });
      return;
    }
    
    setSaving(true);
    try {
      const scheduleId = `SCHED_${Date.now()}`;
      const scheduleDate = newSchedule.date;
      const scheduleData = {
        ...newSchedule,
        department: newSchedule.department.toUpperCase(),
        date: scheduleDate,
        id: scheduleId,
        teacherId: user.uid,
        teacherName: profile?.name || 'Teacher',
        createdAt: new Date().toISOString()
      };
      
      console.log("[Teacher] Writing schedule to Firestore:", scheduleData);
      
      await setDoc(doc(db, 'attendance_schedules', scheduleId), scheduleData);
      console.log("[Teacher] Schedule written successfully");
      setSaveStatus({ 
        type: 'success', 
        message: `Active window for ${scheduleData.department} (Sem ${scheduleData.semester}) set successfully!` 
      });
      
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      console.error("[Teacher] Error creating schedule:", error);
      setSaveStatus({ 
        type: 'error', 
        message: "Failed to create schedule. Error: " + (error instanceof Error ? error.message : String(error)) 
      });
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, dept: string} | null>(null);
  const [showClearFeedConfirm, setShowClearFeedConfirm] = useState(false);

  const deleteSchedule = async (id: string, dept: string) => {
    setSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      await deleteDoc(doc(db, 'attendance_schedules', id));
      setSaveStatus({ type: 'success', message: `Attendance window for ${dept} removed.` });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("[Teacher] Error deleting schedule:", error);
      setSaveStatus({ 
        type: 'error', 
        message: "Failed to remove window."
      });
    } finally {
      setSaving(false);
    }
  };

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
      <div className="max-w-7xl mx-auto print:max-w-none">
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
          <div className="lg:col-span-4 space-y-2 sm:space-y-4 sm:space-y-8 print:col-span-12 print:space-y-0">
            
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

            {/* Set New Schedule */}
            <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 print:hidden">
              <div className="flex items-center gap-4 mb-4 sm:mb-8">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                  <Calendar className="text-indigo-500 w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-[#e9edef] tracking-normal">Set Schedule</h3>
                   <p className="text-xs font-bold text-slate-400  tracking-normal">Create an attendance window</p>
                </div>
              </div>
              
              <div className="space-y-3 sm:space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300  tracking-normal block mb-2.5 ml-1">Subject / Objective</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Data Structures"
                      value={newSchedule.subject}
                      onChange={(e) => setNewSchedule({...newSchedule, subject: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl py-3 sm:py-5 px-4 sm:px-6 text-base font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]  tracking-wide placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300  tracking-normal block mb-2.5 ml-1">Current Topic</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Hash Tables"
                      value={newSchedule.topic}
                      onChange={(e) => setNewSchedule({...newSchedule, topic: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/30 focus:ring-4 focus:ring-wa-teal/5 rounded-2xl py-3 sm:py-5 px-4 sm:px-6 text-base font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]  tracking-wide placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-2 ml-1">Department</label>
                    <select 
                      value={newSchedule.department}
                      onChange={(e) => setNewSchedule({...newSchedule, department: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-5 text-sm font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                    >
                      {departments.length > 0 ? (
                        departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))
                      ) : (
                        ['BCA', 'BSC', 'BTECH', 'MCA'].map(d => <option key={d} value={d}>{d}</option>)
                      )}
                      <option value="ALL">UNIFIED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-2 ml-1">Semester</label>
                    <select 
                      value={newSchedule.semester}
                      onChange={(e) => setNewSchedule({...newSchedule, semester: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-5 text-sm font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>SEMESTER {s}</option>)}
                      <option value="ALL">GLOBAL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-2 ml-1">Window Size</label>
                    <select 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') { setIsCustomMode(true); return; }
                        setIsCustomMode(false);
                        if (!val) return;
                        let currentStart = newSchedule.startTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
                        const end = calculateEndTime(currentStart, parseInt(val));
                        setNewSchedule({...newSchedule, startTime: currentStart, endTime: end});
                      }}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-5 text-sm font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                    >
                      <option value="">MANUAL</option>
                      <option value="30">30 MINS</option>
                      <option value="60">1 HOUR</option>
                      <option value="120">2 HOURS</option>
                      <option value="custom">CUSTOM...</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    {isCustomMode && (
                      <input 
                        type="number"
                        placeholder="MINS"
                        className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-wa-teal/30 rounded-2xl py-4 px-5 text-sm font-bold outline-none"
                        onChange={(e) => {
                          const mins = e.target.value;
                          if (mins) {
                            let currentStart = newSchedule.startTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
                            const end = calculateEndTime(currentStart, parseInt(mins));
                            setNewSchedule({...newSchedule, startTime: currentStart, endTime: end});
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-2 ml-1">Start T-Minus</label>
                    <input 
                      type="time"
                      value={newSchedule.startTime}
                      onChange={(e) => setNewSchedule({...newSchedule, startTime: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-5 text-sm font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400  tracking-normal block mb-2 ml-1">End T-Plus</label>
                    <input 
                      type="time"
                      value={newSchedule.endTime}
                      onChange={(e) => setNewSchedule({...newSchedule, endTime: e.target.value})}
                      className="w-full bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/50 rounded-2xl py-4 px-5 text-sm font-bold transition-all outline-none text-slate-800 dark:text-[#e9edef]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                    onClick={() => setNewSchedule({...newSchedule, requireGPS: !newSchedule.requireGPS})}
                    className={`h-14 rounded-2xl text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-2 border-2 ${newSchedule.requireGPS ? 'bg-wa-teal border-wa-teal text-white shadow-lg shadow-wa-teal/20' : 'bg-[#f8f9fa] border-slate-100 text-slate-400 dark:bg-[#111b21] dark:border-white/5'}`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    GPS {newSchedule.requireGPS ? 'REQUIRED' : 'NOT REQUIRED'}
                  </button>
                  <div className="relative group">
                    <input 
                      type="date"
                      value={newSchedule.date}
                      onChange={(e) => setNewSchedule({...newSchedule, date: e.target.value})}
                      className="w-full h-14 bg-[#f8f9fa] dark:bg-[#111b21] border border-transparent rounded-2xl px-5 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                {saveStatus.type && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${saveStatus.type === 'success' ? 'bg-wa-green/10 text-wa-green border border-wa-green/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {saveStatus.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="text-xs font-bold  leading-tight tracking-normal">{saveStatus.message}</p>
                  </div>
                )}

                <button 
                  onClick={createSchedule}
                  disabled={saving}
                  className="w-full py-3 sm:py-5 bg-wa-teal hover:bg-wa-teal/90 text-white rounded-[1.5rem] font-bold shadow-xl shadow-wa-teal/20 dark:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-95 group mt-2"
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="flex items-center gap-2"><Clock className="w-6 h-6 group-hover:rotate-12 transition-transform" /> Start Session</div>}
                </button>
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
          <div className="lg:col-span-8 space-y-2 sm:space-y-4 sm:space-y-8 print:hidden">
            
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
                          onClick={() => setShowDeleteConfirm({id: sched.id, dept: sched.department})}
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
      {/* Delete Schedule Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-5 sm:p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/10">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] text-center mb-2">Delete Window?</h3>
            <p className="text-[#8696a0] text-center mb-4 sm:mb-8">
              Are you sure you want to stop attendance for <span className="font-bold text-slate-900 dark:text-[#e9edef]">{showDeleteConfirm.dept}</span>? 
              Students will no longer be able to mark attendance.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 text-[#8696a0] font-bold hover:bg-[#f0f2f5] dark:hover:bg-[#111b21] rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteSchedule(showDeleteConfirm.id, showDeleteConfirm.dept)}
                disabled={saving}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
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

    </div>
  );
}
