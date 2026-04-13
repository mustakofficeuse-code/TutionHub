import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { QRCodeSVG } from 'qrcode.react';
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
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATIC_QR_ID = "TUITIONHUB_ATTENDANCE_001";

export default function AttendanceGenerator() {
  const navigate = useNavigate();
  
  const [tuitionLocation, setTuitionLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchTuitionLocation();
    const unsubscribe = listenToRecentAttendance();
    return () => unsubscribe();
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

  const listenToRecentAttendance = () => {
    const q = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentAttendance(list);
    });
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

  const qrValue = STATIC_QR_ID;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Static QR Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100 dark:shadow-none">
              <QrCode className="text-white w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Permanent Attendance QR
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
              Print this QR and stick it at the entry gate. Students scan this to mark attendance.
            </p>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 mb-6">
              <QRCodeSVG value={qrValue} size={200} level="H" includeMargin={true} />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">QR VALUE</p>
              <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{qrValue}</p>
            </div>

            <button 
              onClick={() => window.print()}
              className="mt-6 w-full py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Print QR Code
            </button>
          </div>

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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-blue-600 w-6 h-6" />
                Live Attendance Feed
              </h2>
              <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                LIVE
              </div>
            </div>

            <div className="space-y-4">
              {recentAttendance.length === 0 ? (
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
                          {new Date(record.timestamp).toLocaleDateString()} • {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        <MapPin className="w-3 h-3" />
                        Verified
                      </div>
                      <p className="text-[10px] font-mono text-slate-400">
                        {record.location.lat.toFixed(4)}, {record.location.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {recentAttendance.length > 0 && (
              <button className="w-full mt-8 py-3 text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline">
                View All History
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
