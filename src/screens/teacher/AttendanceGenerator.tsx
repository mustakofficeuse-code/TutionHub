import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, query, orderBy, onSnapshot, limit, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, 
  MapPin, 
  ArrowLeft, 
  RefreshCw,
  Loader2,
  Save,
  Clock,
  User,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Trash2,
  Activity,
  FileText,
  Search
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

export default function AttendanceGenerator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tuitionLocation, setTuitionLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [indexError, setIndexError] = useState(false);
  
  const [newSchedule, setNewSchedule] = useState({
    department: 'BCA',
    semester: '1',
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

  useEffect(() => {
    if (!user) return;
    
    fetchTuitionLocation();
    const unsubSchedules = listenToSchedules();
    const unsubAttendance = listenToRecentAttendance();
    
    // History listener - all time records for this teacher
    const qHistory = query(
      collection(db, 'attendance'), 
      where('teacherId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryRecords(records);
    }, (error) => {
      console.error("History listener error:", error);
    });

    return () => {
      unsubSchedules();
      unsubAttendance();
      unsubHistory();
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
      console.error("[Teacher] Schedules listener error:", error);
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
      console.error("[Teacher] Attendance feed error:", error);
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        setIndexError(true);
      }
    });
  };

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

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
      const scheduleDate = getTodayString();
      const scheduleData = {
        ...newSchedule,
        department: newSchedule.department.toUpperCase(),
        date: scheduleDate,
        id: scheduleId,
        teacherId: user.uid,
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

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteSchedule = async (id: string, dept: string) => {
    console.log(`[Teacher] Attempting to delete schedule: id=${id}, dept=${dept}`);
    
    // Use multi-click confirmation instead of window.confirm for iframe reliability
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      // Reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }
    
    setDeleteConfirmId(null);
    setSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      await deleteDoc(doc(db, 'attendance_schedules', id));
      console.log(`[Teacher] Schedule ${id} deleted successfully`);
      setSaveStatus({ type: 'success', message: `Attendance window for ${dept} removed.` });
      // Clear status after 3s
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      console.error("[Teacher] Error deleting schedule:", error);
      setSaveStatus({ 
        type: 'error', 
        message: "Failed to remove window. " + (error instanceof Error ? error.message : String(error)) 
      });
    } finally {
      setSaving(false);
    }
  };

  const [isClearingFeed, setIsClearingFeed] = useState(false);
  const [clearConfirmFeed, setClearConfirmFeed] = useState(false);

  const deleteAllAttendance = async () => {
    if (recentAttendance.length === 0) return;
    
    if (!clearConfirmFeed) {
      setClearConfirmFeed(true);
      setTimeout(() => setClearConfirmFeed(false), 3000);
      return;
    }
    
    setClearConfirmFeed(false);
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

    const studentCounts: Record<string, { name: string, dept: string, sem: string, count: number, lastTime: string, records: any[] }> = {};
    
    filtered.forEach(rec => {
      if (!studentCounts[rec.studentId]) {
        studentCounts[rec.studentId] = { 
          name: rec.studentName || 'Unknown Student',
          dept: rec.department || 'N/A',
          sem: rec.semester || 'N/A',
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors font-sans print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto print:max-w-none">
        <button 
          onClick={() => navigate('/')}
          className="mb-6 sm:mb-8 flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-all border-b-2 border-transparent hover:border-blue-600 pb-1 print:hidden"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* LEFT: Scheduling & Static QR */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8 print:col-span-12 print:space-y-0">
            
            {/* The Wall QR Code (Static) */}
            <div 
              className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 text-center group cursor-pointer relative overflow-hidden print:shadow-none print:border-0 print:p-0" 
              onClick={handlePrint}
              role="button"
              tabIndex={0}
            >
              <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 transition-opacity print:hidden"></div>
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-none animate-pulse print:hidden">
                <QrCode className="text-white w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Static Center QR</h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 sm:mb-8 print:text-black">Stick this on the tuition wall</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] inline-block border-2 border-slate-100 dark:border-slate-800 mb-6 group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors print:border-slate-200 print:bg-white">
                <QRCodeSVG value={STATIC_QR_VALUE} size={window.innerWidth < 640 ? 200 : 250} level="H" includeMargin={true} className="mx-auto max-w-full h-auto" />
              </div>
              
              <p className="text-[9px] sm:text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center justify-center gap-2 print:hidden">
                <RefreshCw className="w-3 h-3" /> Click to Print Permanent QR
              </p>
              <p className="hidden print:block text-[10px] font-bold text-slate-500 mt-4 uppercase">TuitionHub Automated Attendance System</p>
            </div>

            {/* Set New Schedule */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 print:hidden">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                  <Calendar className="text-indigo-600 w-5 h-5" />
                </div>
                Schedule Session
              </h3>
              
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Dept</label>
                    <select 
                      value={newSchedule.department}
                      onChange={(e) => setNewSchedule({...newSchedule, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-sm font-bold transition-all outline-none"
                    >
                      <option value="BCA">BCA</option>
                      <option value="BSC">BSC</option>
                      <option value="BTECH">BTECH</option>
                      <option value="MCA">MCA</option>
                      <option value="ALL">ALL DEPTS</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Sem</label>
                    <select 
                      value={newSchedule.semester}
                      onChange={(e) => setNewSchedule({...newSchedule, semester: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-sm font-bold transition-all outline-none"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Sem {s}</option>)}
                      <option value="ALL">ALL SEM</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Start Time</label>
                    <input 
                      type="time"
                      value={newSchedule.startTime}
                      onChange={(e) => setNewSchedule({...newSchedule, startTime: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-sm font-bold transition-all outline-none appearance-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">End Time</label>
                    <input 
                      type="time"
                      value={newSchedule.endTime}
                      onChange={(e) => setNewSchedule({...newSchedule, endTime: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-sm font-bold transition-all outline-none appearance-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Grace Period</label>
                    <select 
                      value={newSchedule.gracePeriod}
                      onChange={(e) => setNewSchedule({...newSchedule, gracePeriod: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-sm font-bold transition-all outline-none"
                    >
                      <option value="5">5 Mins</option>
                      <option value="10">10 Mins</option>
                      <option value="15">15 Mins</option>
                      <option value="30">30 Mins</option>
                      <option value="60">Max (60)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Strict Location</label>
                    <button 
                      onClick={() => setNewSchedule({...newSchedule, requireGPS: !newSchedule.requireGPS})}
                      className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${newSchedule.requireGPS ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                    >
                      <MapPin className="w-3 h-3" />
                      GPS {newSchedule.requireGPS ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {saveStatus.type && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                    {saveStatus.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="text-xs font-bold leading-tight">{saveStatus.message}</p>
                  </div>
                )}

                <button 
                  onClick={createSchedule}
                  disabled={saving}
                  className="w-full py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-[1.25rem] sm:rounded-[1.5rem] font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-95 mt-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                  Set Active Window
                </button>
              </div>
            </div>

            {/* Location Config Mini */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl overflow-hidden relative print:hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl -mr-16 -mt-16"></div>
              <h3 className="font-black mb-4 flex items-center gap-2 relative z-10 text-sm sm:text-base">
                <MapPin className="text-blue-400 w-5 h-5" />
                GPS Anchor
              </h3>
              {tuitionLocation ? (
                <div className="space-y-4 relative z-10">
                  <div className="p-3 sm:p-4 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10">
                    <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase mb-1 tracking-widest">Active Coordinates</p>
                    <p className="text-[10px] sm:text-xs font-mono opacity-60">Lat: {tuitionLocation.lat.toFixed(5)}</p>
                    <p className="text-[10px] sm:text-xs font-mono opacity-60">Lng: {tuitionLocation.lng.toFixed(5)}</p>
                  </div>
                  <button onClick={updateLocation} className="text-[9px] sm:text-[10px] font-black text-blue-400 hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reset to Current Spot
                  </button>
                </div>
              ) : (
                <button onClick={updateLocation} className="w-full py-3 bg-blue-600 rounded-xl font-bold text-sm">Initialize Location</button>
              )}
            </div>

          </div>

          {/* RIGHT: Monitor / History Tabs */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8 print:hidden">
            
            {/* Tab Selection */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative z-20">
              <button 
                onClick={() => setActiveTab('monitor')}
                className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <Activity className="w-4 h-4" /> Live Monitor
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <FileText className="w-4 h-4" /> History
              </button>
            </div>

            {activeTab === 'monitor' ? (
              <div className="space-y-6 sm:space-y-8">
                {/* Active Schedules Ribbon */}
                <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
                    <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
                      <Users className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
                      Active Windows
                    </h3>
                    {saveStatus.type && (
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-2 duration-300 ${saveStatus.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {saveStatus.message.includes('successfully') || saveStatus.message.includes('removed') ? 'Updated' : 'Error'}
                      </div>
                    )}
                  </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {activeSchedules.length === 0 ? (
                  <p className="text-slate-400 font-bold text-xs sm:text-sm italic py-4 px-2 col-span-full">Awaiting session start...</p>
                ) : (
                  activeSchedules.map(sched => (
                    <div key={sched.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 sm:gap-4 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="w-10 h-10 bg-white dark:bg-slate-950 rounded-xl flex flex-col items-center justify-center shadow-sm shrink-0">
                        <span className="text-[6px] font-black text-slate-400 uppercase leading-none">Sem</span>
                        <span className="text-sm font-black text-blue-600 leading-none">{sched.semester}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-900 dark:text-white text-[11px] sm:text-sm truncate uppercase tracking-tight">{sched.department}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 sm:mt-1">
                          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {sched.startTime}—{sched.endTime}
                          </p>
                          <span className={`text-[6px] sm:text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter shrink-0 ${sched.requireGPS ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                            {sched.requireGPS ? 'GPS ON' : 'GPS OFF'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSchedule(sched.id, sched.department);
                          }}
                          disabled={saving}
                          className={`p-1.5 rounded-lg transition-all transform active:scale-95 flex items-center gap-1.5 ${
                            deleteConfirmId === sched.id 
                              ? 'bg-red-500 text-white px-3 ring-4 ring-red-100 dark:ring-red-900/30 shadow-lg' 
                              : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                          } disabled:opacity-30`}
                          title={deleteConfirmId === sched.id ? "Click again to confirm" : "Delete Window"}
                        >
                          {deleteConfirmId === sched.id && (
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Confirm?</span>
                          )}
                          <Trash2 className={`${deleteConfirmId === sched.id ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attendance reality feed */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 min-h-[500px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Presence Feed</h3>
                  <button 
                    onClick={deleteAllAttendance}
                    disabled={recentAttendance.length === 0 || saving || isClearingFeed}
                    className={`mt-2 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all px-3 py-1 rounded-lg ${
                      clearConfirmFeed 
                        ? 'bg-red-500 text-white shadow-lg ring-4 ring-red-100 animate-pulse' 
                        : 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                    } disabled:opacity-30`}
                  >
                    <Trash2 className="w-3 h-3" /> 
                    {isClearingFeed ? 'Clearing...' : clearConfirmFeed ? 'Confirm Clear?' : 'Clear Records'}
                  </button>
                </div>
                <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 self-start sm:self-center">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-emerald-600 rounded-full animate-ping"></div>
                  Reality Monitoring
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {recentAttendance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50">
                    <Clock className="w-12 h-12 sm:w-16 sm:h-16 mb-4 stroke-1" />
                    <p className="font-bold uppercase tracking-widest text-[9px] sm:text-[10px]">Awaiting First Scan...</p>
                  </div>
                ) : (
                  recentAttendance.map((record) => (
                    <div key={record.id} className="group flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-900 hover:shadow-lg rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-all duration-300">
                      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white dark:bg-slate-950 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                          <User className="text-blue-600 w-5 h-5 sm:w-7 sm:h-7" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm sm:text-lg text-slate-900 dark:text-white tracking-tight truncate">{record.studentName}</h4>
                          <div className="flex gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 sm:mt-1">
                            <span className="text-blue-600 truncate">{record.department}</span>
                            <span className="opacity-30 shrink-0">•</span>
                            <span className="shrink-0">Sem {record.semester}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mb-1">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="hidden xs:flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl uppercase tracking-widest">
                          <CheckCircle className="w-2.5 h-2.5 sm:w-3 h-3" />
                          Live
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
            ) : (
              /* HISTORY VIEW */
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
                  <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    Archive Search
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search student..."
                        value={searchQuery.name}
                        onChange={(e) => setSearchQuery({...searchQuery, name: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-xl py-3 px-4 pl-10 text-[13px] font-bold transition-all outline-none"
                      />
                    </div>
                    <select 
                      value={searchQuery.department}
                      onChange={(e) => setSearchQuery({...searchQuery, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-xl py-3 px-4 text-[13px] font-bold transition-all outline-none cursor-pointer"
                    >
                      <option value="ALL">All Departments</option>
                      <option value="BCA">BCA</option>
                      <option value="BSC">BSC</option>
                      <option value="BTECH">BTECH</option>
                      <option value="MCA">MCA</option>
                      <option value="BBA">BBA</option>
                    </select>
                    <select 
                      value={searchQuery.semester}
                      onChange={(e) => setSearchQuery({...searchQuery, semester: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-xl py-3 px-4 text-[13px] font-bold transition-all outline-none cursor-pointer"
                    >
                      <option value="ALL">All Semesters</option>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Sem {s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 sm:p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Stats Aggregation</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getAggregatedHistory().length} Unique Students Found</span>
                  </div>
                  
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                          <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                          <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Context</th>
                          <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Activity</th>
                          <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {getAggregatedHistory().map((student, idx) => (
                          <tr key={`${student.name}-${idx}`} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 sm:px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="shrink-0 w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 font-black text-xs">
                                  {student.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-black text-slate-900 dark:text-white text-sm truncate">{student.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{student.dept} Batch</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 sm:px-8 py-5">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase">Sem {student.sem}</span>
                            </td>
                            <td className="px-6 sm:px-8 py-5">
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {new Date(student.lastTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-[10px] opacity-50 uppercase tracking-wider">
                                {new Date(student.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </td>
                            <td className="px-6 sm:px-8 py-5">
                              <div className="flex items-center justify-center gap-3">
                                <span className="text-sm font-black text-slate-900 dark:text-white">{student.count}</span>
                                <div className="hidden sm:block h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (student.count / 10) * 100)}%` }}></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {getAggregatedHistory().length === 0 && (
                    <div className="p-16 text-center">
                      <Search className="w-12 h-12 text-slate-100 dark:text-slate-800 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching records found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
