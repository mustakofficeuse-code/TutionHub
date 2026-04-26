import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
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
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATIC_QR_ID = "TUITIONHUB_ATTENDANCE_001";

export default function AttendanceGenerator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tuitionLocation, setTuitionLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [indexError, setIndexError] = useState(false);
  const [viewMode, setViewMode] = useState<'live' | 'history'>(() => 
    (localStorage.getItem('attendance_view_mode') as 'live' | 'history') || 'live'
  );

  useEffect(() => {
    localStorage.setItem('attendance_view_mode', viewMode);
  }, [viewMode]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => 
    localStorage.getItem('active_attendance_session')
  );

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('active_attendance_session', activeSessionId);
    } else {
      localStorage.removeItem('active_attendance_session');
    }
  }, [activeSessionId]);

  // Session Config
  const [sessionData, setSessionData] = useState(() => {
    const saved = localStorage.getItem('attendance_session_config');
    return saved ? JSON.parse(saved) : {
      department: 'BCA',
      semester: '1st',
      startTime: '09:00',
      endTime: '11:00',
      validDuration: '60', // minutes
      requireLocation: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('attendance_session_config', JSON.stringify(sessionData));
  }, [sessionData]);

  useEffect(() => {
    fetchTuitionLocation();
    const unsubscribe = listenToRecentAttendance();
    return () => unsubscribe();
  }, [activeSessionId, viewMode]);

  useEffect(() => {
    if (activeSessionId) {
      const fetchSession = async () => {
        const snap = await getDoc(doc(db, 'attendance_sessions', activeSessionId));
        if (snap.exists()) setSessionInfo(snap.data());
      };
      fetchSession();
    }
  }, [activeSessionId]);

  const isSessionValid = () => {
    if (!sessionInfo) return true; // Default to showing if no session info yet
    
    const now = new Date();
    const startTimeParts = sessionInfo.startTime.split(':');
    const sessionStart = new Date();
    sessionStart.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0, 0);

    const validityPeriod = parseInt(sessionInfo.validDuration) * 60 * 1000;
    const sessionExpiry = new Date(sessionStart.getTime() + validityPeriod);
    
    return now <= sessionExpiry;
  };

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

  const listenToRecentAttendance = () => {
    // If we have an active session and in live mode, only show attendance for that session
    let q;
    if (viewMode === 'live') {
      if (!activeSessionId) {
        setRecentAttendance([]);
        return () => {};
      }
      q = query(collection(db, 'attendance'), where('sessionId', '==', activeSessionId), orderBy('timestamp', 'desc'), limit(50));
    } else {
      // History mode: show more records regardless of session, but filtered by current teacher
      q = query(collection(db, 'attendance'), where('teacherId', '==', user?.uid), orderBy('timestamp', 'desc'), limit(100));
    }

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

  const generateSession = async () => {
    setSaving(true);
    
    const createSession = async (loc: {lat: number, lng: number}) => {
      try {
        const sessionId = `SESS_${Date.now()}`;
        const sessionRef = doc(db, 'attendance_sessions', sessionId);
        
        // Auto-set start time to now if the teacher didn't change it or just for better UX
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const payload = {
          id: sessionId,
          teacherId: user?.uid,
          ...sessionData,
          startTime: nowStr, // Override with actual creation time
          location: loc,
          createdAt: new Date().toISOString(),
          status: 'active'
        };

        await setDoc(sessionRef, payload);
        setActiveSessionId(sessionId);
        setSessionInfo(payload); // Update local session info
      } catch (error) {
        console.error("Error creating session:", error);
        alert("Failed to create attendance session.");
      } finally {
        setSaving(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          createSession(currentLoc);
        },
        (error) => {
          console.error("Error getting location:", error);
          if (tuitionLocation) {
            console.log("Falling back to fixed tuition location");
            createSession(tuitionLocation);
          } else {
            alert("Could not get your current location and no fallback location is set. Please enable GPS.");
            setSaving(false);
          }
        },
        { enableHighAccuracy: true }
      );
    } else {
      if (tuitionLocation) {
        createSession(tuitionLocation);
      } else {
        alert("Geolocation not supported and no fallback location set.");
        setSaving(false);
      }
    }
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

  const qrValue = activeSessionId ? `TUITIONHUB_SESS_${activeSessionId}` : STATIC_QR_ID;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Session Configuration Panel */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="text-blue-600 w-6 h-6" />
              Session Info
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Department</label>
                <select 
                  value={sessionData.department}
                  onChange={(e) => setSessionData({...sessionData, department: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                >
                  <option value="BCA">BCA</option>
                  <option value="BSC">BSC</option>
                  <option value="BTECH">BTECH</option>
                  <option value="MCA">MCA</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Semester</label>
                <select 
                  value={sessionData.semester}
                  onChange={(e) => setSessionData({...sessionData, semester: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                >
                  <option value="1st">1st Sem</option>
                  <option value="2nd">2nd Sem</option>
                  <option value="3rd">3rd Sem</option>
                  <option value="4th">4th Sem</option>
                  <option value="5th">5th Sem</option>
                  <option value="6th">6th Sem</option>
                  <option value="7th">7th Sem</option>
                  <option value="8th">8th Sem</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Class Start</label>
                  <input 
                    type="time"
                    value={sessionData.startTime}
                    onChange={(e) => setSessionData({...sessionData, startTime: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Class End</label>
                  <input 
                    type="time"
                    value={sessionData.endTime}
                    onChange={(e) => setSessionData({...sessionData, endTime: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1 flex justify-between">
                  Valid For
                  <span className="text-blue-600">{sessionData.validDuration} Minutes</span>
                </label>
                <input 
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={sessionData.validDuration}
                  onChange={(e) => setSessionData({...sessionData, validDuration: e.target.value})}
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Require GPS Location</span>
                </div>
                <button 
                  onClick={() => setSessionData({...sessionData, requireLocation: !sessionData.requireLocation})}
                  className={`w-10 h-5 rounded-full relative transition-colors ${sessionData.requireLocation ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${sessionData.requireLocation ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <button 
                onClick={generateSession}
                disabled={saving || !tuitionLocation}
                className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                {activeSessionId ? "Update QR Session" : "Generate Attendance QR"}
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setActiveSessionId(null);
              setSessionInfo(null);
            }}
            className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
          >
            Clear Active Session
          </button>

          {/* Static QR Panel Replacement */}
          {activeSessionId && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100 dark:shadow-none">
                <QrCode className="text-white w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Active Session QR
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg uppercase">{sessionData.department}</span>
                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg uppercase">{sessionData.semester} Sem</span>
              </div>
              
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 mb-6 group relative cursor-pointer" onClick={() => window.print()}>
                <QRCodeSVG value={qrValue} size={200} level="H" includeMargin={true} />
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                  <p className="font-bold text-blue-600 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Click to Print</p>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">SESSION ID</p>
                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{activeSessionId}</p>
              </div>
            </div>
          )}

          {/* Location Config */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="text-blue-600 w-5 h-5" />
              Tuition Location
            </h3>
            {loading ? (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            ) : tuitionLocation ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Current Coordinates</p>
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    Lat: {tuitionLocation.lat.toFixed(6)}<br />
                    Lng: {tuitionLocation.lng.toFixed(6)}
                  </p>
                </div>
                <button 
                  onClick={updateLocation}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Update to Current Location
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Stand at the entry gate and click update to set the attendance center point.
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">No location set yet.</p>
                <button 
                  onClick={updateLocation}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Set Tuition Location
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Attendance List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 min-h-[600px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex gap-4">
                <button 
                  onClick={() => setViewMode('live')}
                  className={`text-xl font-bold flex items-center gap-2 transition-colors ${viewMode === 'live' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
                >
                  <Users className={`w-6 h-6 ${viewMode === 'live' ? 'text-blue-600' : 'text-slate-400'}`} />
                  Live Feed
                </button>
                <button 
                  onClick={() => setViewMode('history')}
                  className={`text-xl font-bold flex items-center gap-2 transition-colors ${viewMode === 'history' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
                >
                  <Calendar className={`w-6 h-6 ${viewMode === 'history' ? 'text-blue-600' : 'text-slate-400'}`} />
                  History
                </button>
              </div>
              
              {viewMode === 'live' && (
                <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                  LIVE
                </div>
              )}
            </div>

            <div className="space-y-4">
              {viewMode === 'live' && !isSessionValid() ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Clock className="w-12 h-12 text-slate-400 mb-4 opacity-50" />
                  <p className="font-bold text-slate-900 dark:text-white mb-2">Session Expired</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                    The valid duration for this attendance session has ended. Live feed is hidden. Check history for results.
                  </p>
                  <button 
                    onClick={() => setViewMode('history')}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold"
                  >
                    View History
                  </button>
                </div>
              ) : indexError ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-blue-50/30 dark:bg-blue-900/5 rounded-[3rem] border border-blue-100/50 dark:border-blue-900/20 px-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-200 dark:shadow-none">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white mb-2 text-xl tracking-tight">Index Required for History</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
                    To view cross-session history, Firestore requires a composite index. Your proposed setup <b>(teacherId: Asc, timestamp: Desc)</b> is 100% correct.
                  </p>
                  
                  <div className="text-left bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 w-full max-w-md shadow-sm">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Manual Setup Strategy</p>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">1</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Open <b>Firebase Console</b> &gt; <b>Cloud Firestore</b> &gt; <b>Indexes</b></p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">2</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Click <b>Add Index</b> for the <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600">attendance</code> collection</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">3</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Add Fields: <b>teacherId</b> (Asc) and <b>timestamp</b> (Desc)</p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Waiting for Firestore to finish building...
                  </p>
                </div>
              ) : recentAttendance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Clock className="w-12 h-12 mb-4 opacity-20" />
                  <p>Waiting for students to scan...</p>
                </div>
              ) : (
                recentAttendance.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                        <User className="text-blue-600 w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{record.studentName}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {record.department} • Sem {record.semester} • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        <MapPin className="w-3 h-3" />
                        Verified
                      </div>
                      <p className="text-[10px] font-mono text-slate-400">
                        {record.location ? `${record.location.lat.toFixed(4)}, ${record.location.lng.toFixed(4)}` : 'No Location'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {recentAttendance.length > 0 && (
              <button 
                onClick={() => setViewMode('history')}
                className="w-full mt-8 py-3 text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline"
              >
                View All History
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
