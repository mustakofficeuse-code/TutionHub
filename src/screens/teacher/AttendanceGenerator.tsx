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
    date: new Date().toISOString().split('T')[0]
  });

  const [searchQuery, setSearchQuery] = useState({
    name: '',
    department: 'ALL',
    semester: 'ALL'
  });

  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'history'>('monitor');

  useEffect(() => {
    fetchTuitionLocation();
    const unsubSchedules = listenToSchedules();
    const unsubAttendance = listenToRecentAttendance();
    return () => {
      unsubSchedules();
      unsubAttendance();
    };
  }, []);

  const fetchTuitionLocation = async () => {
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
    const q = query(
      collection(db, 'attendance_schedules'), 
      where('teacherId', '==', user?.uid),
      where('date', '==', new Date().toISOString().split('T')[0])
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSchedules(list);
    });
  };

  const listenToRecentAttendance = () => {
    const q = query(
      collection(db, 'attendance'), 
      where('teacherId', '==', user?.uid), 
      orderBy('timestamp', 'desc'), 
      limit(50)
    );

    return onSnapshot(q as any, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setRecentAttendance(list);
      setIndexError(false);
    }, (error: any) => {
      console.error("Attendance feed error:", error);
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        setIndexError(true);
      }
    });
  };

  const createSchedule = async () => {
    if (!newSchedule.startTime || !newSchedule.endTime) {
      alert("Please set start and end times");
      return;
    }

    // Validate 1-hour maximum
    const start = new Date(`2000-01-01T${newSchedule.startTime}:00`);
    const end = new Date(`2000-01-01T${newSchedule.endTime}:00`);
    let diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    // Handle midnight crossing if necessary (though usually not for tuition)
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    if (diffMinutes > 60) {
      alert("Maximum schedule window is 60 minutes. Please adjust your times.");
      return;
    }

    if (diffMinutes <= 0) {
      alert("End time must be after start time.");
      return;
    }
    
    setSaving(true);
    try {
      const scheduleId = `SCHED_${Date.now()}`;
      await setDoc(doc(db, 'attendance_schedules', scheduleId), {
        ...newSchedule,
        department: newSchedule.department.toUpperCase(),
        id: scheduleId,
        teacherId: user?.uid,
        createdAt: new Date().toISOString()
      });
      alert("Schedule created successfully!");
    } catch (error) {
      console.error("Error creating schedule:", error);
      alert("Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this attendance window?")) return;
    try {
      await deleteDoc(doc(db, 'attendance_schedules', id));
    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("Failed to delete schedule");
    }
  };

  const deleteAllAttendance = async () => {
    if (recentAttendance.length === 0) return;
    if (!window.confirm(`Are you sure you want to clear all ${recentAttendance.length} records in this feed? This cannot be undone.`)) return;
    
    setSaving(true);
    try {
      const batch = writeBatch(db);
      recentAttendance.forEach((record) => {
        batch.delete(doc(db, 'attendance', record.id));
      });
      await batch.commit();
      alert("All attendance records cleared.");
    } catch (error) {
      console.error("Error clearing attendance:", error);
      alert("Failed to clear records.");
    } finally {
      setSaving(false);
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

    const studentCounts: Record<string, { name: string, dept: string, sem: string, count: number, records: any[] }> = {};
    
    filtered.forEach(rec => {
      if (!studentCounts[rec.studentId]) {
        studentCounts[rec.studentId] = { 
          name: rec.studentName || 'Unknown Student',
          dept: rec.department || 'N/A',
          sem: rec.semester || 'N/A',
          count: 0,
          records: [] 
        };
      }
      studentCounts[rec.studentId].count += 1;
      studentCounts[rec.studentId].records.push(rec);
    });

    return Object.values(studentCounts).sort((a, b) => b.count - a.count);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryRecords(records);
    });
    return () => unsubscribe();
  }, [user]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors font-sans print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto print:max-w-none">
        <button 
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-all border-b-2 border-transparent hover:border-blue-600 pb-1 print:hidden"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Scheduling & Static QR */}
          <div className="lg:col-span-4 space-y-8 print:col-span-12 print:space-y-0">
            
            {/* The Wall QR Code (Static) */}
            <div 
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 text-center group cursor-pointer relative overflow-hidden print:shadow-none print:border-0 print:p-0" 
              onClick={handlePrint}
              role="button"
              tabIndex={0}
            >
              <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 transition-opacity print:hidden"></div>
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-none animate-pulse print:hidden">
                <QrCode className="text-white w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Static Center QR</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8 print:text-black">Stick this on the tuition wall</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] inline-block border-2 border-slate-100 dark:border-slate-800 mb-6 group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors print:border-slate-200 print:bg-white">
                <QRCodeSVG value={STATIC_QR_VALUE} size={280} level="H" includeMargin={true} className="mx-auto" />
              </div>
              
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center justify-center gap-2 print:hidden">
                <RefreshCw className="w-3 h-3" /> Click to Print Permanent QR
              </p>
              <p className="hidden print:block text-[10px] font-bold text-slate-500 mt-4 uppercase">TuitionHub Automated Attendance System</p>
            </div>

            {/* Set New Schedule */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 print:hidden">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                  <Calendar className="text-indigo-600 w-5 h-5" />
                </div>
                Schedule Session
              </h3>
              
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Dept</label>
                    <select 
                      value={newSchedule.department}
                      onChange={(e) => setNewSchedule({...newSchedule, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
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
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Sem {s}</option>)}
                      <option value="ALL">ALL SEM</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Start Time</label>
                    <input 
                      type="time"
                      value={newSchedule.startTime}
                      onChange={(e) => setNewSchedule({...newSchedule, startTime: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">End Time</label>
                      <input 
                        type="time"
                        value={newSchedule.endTime}
                        onChange={(e) => setNewSchedule({...newSchedule, endTime: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Grace Period (Min)</label>
                      <select 
                        value={newSchedule.gracePeriod}
                        onChange={(e) => setNewSchedule({...newSchedule, gracePeriod: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                      >
                        <option value="5">5 Minutes</option>
                        <option value="10">10 Minutes</option>
                        <option value="15">15 Minutes</option>
                        <option value="30">30 Minutes</option>
                        <option value="60">Ends at session end</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Location Check</label>
                      <button 
                        onClick={() => setNewSchedule({...newSchedule, requireGPS: !newSchedule.requireGPS})}
                        className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${newSchedule.requireGPS ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                      >
                        <MapPin className="w-3 h-3" />
                        GPS {newSchedule.requireGPS ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={createSchedule}
                  disabled={saving}
                  className="w-full py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-[1.5rem] font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                  Set Active Window
                </button>
              </div>
            </div>

            {/* Location Config Mini */}
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl overflow-hidden relative print:hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl -mr-16 -mt-16"></div>
              <h3 className="font-black mb-4 flex items-center gap-2 relative z-10">
                <MapPin className="text-blue-400 w-5 h-5" />
                GPS Anchor
              </h3>
              {tuitionLocation ? (
                <div className="space-y-4 relative z-10">
                  <div className="p-4 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10">
                    <p className="text-[10px] font-black text-blue-400 uppercase mb-1 tracking-widest">Active Coordinates</p>
                    <p className="text-xs font-mono opacity-60">Lat: {tuitionLocation.lat.toFixed(6)}</p>
                    <p className="text-xs font-mono opacity-60">Lng: {tuitionLocation.lng.toFixed(6)}</p>
                  </div>
                  <button onClick={updateLocation} className="text-[10px] font-black text-blue-400 hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reset to Current Spot
                  </button>
                </div>
              ) : (
                <button onClick={updateLocation} className="w-full py-3 bg-blue-600 rounded-xl font-bold">Initialize Location</button>
              )}
            </div>

          </div>

          {/* RIGHT: Monitor / History Tabs */}
          <div className="lg:col-span-8 space-y-8 print:hidden">
            
            {/* Tab Selection */}
            <div className="flex bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative z-20">
              <button 
                onClick={() => setActiveTab('monitor')}
                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <Activity className="w-4 h-4" /> Live Monitor
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <FileText className="w-4 h-4" /> History
              </button>
            </div>

            {activeTab === 'monitor' ? (
              <>
                {/* Active Schedules Ribbon */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                    <Users className="text-blue-600 w-6 h-6" />
                    Active Attendance Windows
                  </h3>
              
              <div className="flex flex-wrap gap-4">
                {activeSchedules.length === 0 ? (
                  <p className="text-slate-400 font-bold text-sm italic py-4 px-2">No active windows set for today.</p>
                ) : (
                  activeSchedules.map(sched => (
                    <div key={sched.id} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
                      <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Sem</span>
                        <span className="text-lg font-black text-blue-600 leading-none">{sched.semester}</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm">{sched.department} Batch</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {sched.startTime} — {sched.endTime}
                          </p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${sched.requireGPS ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                            {sched.requireGPS ? 'GPS REQD' : 'GPS SKIP'}
                          </span>
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 rounded uppercase tracking-tighter">{sched.gracePeriod}m Grace</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-auto">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-200"></div>
                        <button 
                          onClick={() => deleteSchedule(sched.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                          title="Remove Schedule"
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
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 min-h-[500px]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Today's Presence Feed</h3>
                  <button 
                    onClick={deleteAllAttendance}
                    disabled={recentAttendance.length === 0 || saving}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All Records
                  </button>
                </div>
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping"></div>
                  Reality Monitoring
                </div>
              </div>

              <div className="space-y-4">
                {recentAttendance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50">
                    <Clock className="w-16 h-16 mb-4 stroke-1" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Awaiting First Scan...</p>
                  </div>
                ) : (
                  recentAttendance.map((record) => (
                    <div key={record.id} className="group flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-900 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-all duration-300">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <User className="text-blue-600 w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">{record.studentName}</h4>
                          <div className="flex gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                            <span className="text-blue-600">{record.department}</span>
                            <span className="opacity-30">•</span>
                            <span>Semester {record.semester}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-white mb-1">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                          <CheckCircle className="w-3 h-3" />
                          Authenticated
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </>
            ) : (
              /* HISTORY VIEW */
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-600" />
                    History Filter
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search Name..."
                        value={searchQuery.name}
                        onChange={(e) => setSearchQuery({...searchQuery, name: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold transition-all outline-none"
                      />
                    </div>
                    <select 
                      value={searchQuery.department}
                      onChange={(e) => setSearchQuery({...searchQuery, department: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                    >
                      <option value="ALL">All Departments</option>
                      <option value="BCA">BCA</option>
                      <option value="BSC">BSC</option>
                      <option value="BTECH">BTECH</option>
                      <option value="MCA">MCA</option>
                      <option value="BBA">BBA</option>
                      <option value="GENERAL">General</option>
                    </select>
                    <select 
                      value={searchQuery.semester}
                      onChange={(e) => setSearchQuery({...searchQuery, semester: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all outline-none"
                    >
                      <option value="ALL">All Semesters</option>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={String(s)}>Semester {s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Aggregated Attendance</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getAggregatedHistory().length} Students Found</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Presence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {getAggregatedHistory().map((student) => (
                          <tr key={student.name + student.count} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                                    {student.name.substring(0, 1)}
                                  </div>
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                                </div>
                                <span className="font-black text-slate-900 dark:text-white text-sm">{student.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{student.dept} · SEM {student.sem}</span>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <span className="text-sm font-black text-slate-900 dark:text-white">{student.count}</span>
                                <div className="h-1.5 w-20 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, (student.count / 10) * 100)}%` }}></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {getAggregatedHistory().length === 0 && (
                    <div className="p-20 text-center">
                      <Search className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">No records found for your search</p>
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
