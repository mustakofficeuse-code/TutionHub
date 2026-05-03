import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth, logError } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Camera, MapPin, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATIC_QR_VALUE = "TUITIONHUB_WALL_QR_2026_SECURE";

export default function AttendanceScanner({ isEmbedded, onTabChange }: { isEmbedded?: boolean, onTabChange?: (id: string) => void }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
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

  const [scanning, setScanning] = useState(true);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (scanning && status === 'idle') {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(error => logError("Failed to clear scanner", error));
      };
    }
  }, [scanning, status]);

  async function onScanSuccess(decodedText: string) {
    const cleanText = decodedText.trim();
    if (cleanText !== STATIC_QR_VALUE) {
      setScanning(false);
      setStatus('error');
      setMessage('Invalid QR Code. Please scan the official tuition center QR code attached to the wall.');
      return;
    }

    setScanning(false);
    setStatus('verifying');
    setMessage('Authenticating your location and schedule...');

    try {
      // 1. Fetch Tuition Center Config (Location)
      const configRef = doc(db, 'config', 'attendance');
      const configSnap = await getDoc(configRef);
      
      if (!configSnap.exists()) {
        throw new Error('Tuition center location is not set. Please contact your teacher.');
      }
      
      const centerConfig = configSnap.data();

      // 2. Fetch Today's Schedules
      setMessage('Matching your profile with active schedules...');
      
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayString = `${y}-${m}-${d}`;
      
      console.log("Checking schedules for date:", todayString);
      
      const schedulesRef = collection(db, 'attendance_schedules');
      const q = query(schedulesRef, where('date', '==', todayString));
      const schedulesSnap = await getDocs(q);

      if (schedulesSnap.empty) {
        throw new Error('No attendance schedules found for today. Please wait for your teacher to start a session.');
      }

      // 3. Find matching schedule
      // Ensure HH:mm format for comparison
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;
      
      const rawDept = String(profile?.courseId || profile?.courseName || '').toUpperCase();
      const studentDept = (rawDept === 'GENERAL' || rawDept === '' || rawDept === 'OTHER') ? 'BCA' : rawDept;
      const studentSem = String(profile?.semester || '');

      console.log(`Checking match for: Dept:${studentDept}, Sem:${studentSem}, Time:${currentTimeStr}`);

      let matchingSchedule = null;

      for (const docSnap of schedulesSnap.docs) {
        const sched = docSnap.data();
        
        // Match Dept & Sem
        const deptMatch = sched.department === 'ALL' || sched.department.toUpperCase() === studentDept;
        const semMatch = sched.semester === 'ALL' || String(sched.semester) === studentSem;

        if (deptMatch && semMatch) {
          // Check Time Window
          const start = new Date(`2000-01-01T${sched.startTime}:00`);
          const graceMin = parseInt(sched.gracePeriod || '15');
          const graceEnd = new Date(start.getTime() + graceMin * 60000);
          
          const hoursGrace = String(graceEnd.getHours()).padStart(2, '0');
          const minutesGrace = String(graceEnd.getMinutes()).padStart(2, '0');
          const graceEndTimeStr = `${hoursGrace}:${minutesGrace}`;

          // Student must scan BETWEEN startTime and graceEndTime
          if (currentTimeStr >= sched.startTime && currentTimeStr <= graceEndTimeStr) {
            matchingSchedule = sched;
            break;
          } else if (currentTimeStr > graceEndTimeStr && currentTimeStr <= sched.endTime) {
            throw new Error(`Validation failed. You are past the ${graceMin}-minute grace period for this session.`);
          }
        }
      }

      if (!matchingSchedule) {
        throw new Error(`Schedule mismatch. Please ensure you are scanning at your scheduled time (${studentDept} Sem ${studentSem}). Current time: ${formatTime12h(currentTimeStr)}`);
      }

      // 4. Validate Location (ONLY if required by schedule)
      let studentPos = null;
      if (matchingSchedule.requireGPS) {
        setMessage('Verifying you are at the tuition center...');
        const position = await getCurrentPosition().catch(err => {
          console.error("GPS error:", err);
          throw new Error("Could not access your location. Please ensure GPS is enabled and permissions are granted.");
        });
        
        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          centerConfig.lat,
          centerConfig.lng
        );

        if (distance > 0.3) { // 300m for better tolerance
          throw new Error(`Location mismatch. You are ${Math.round(distance * 1000)}m away. You must be at the tuition center.`);
        }
        studentPos = { lat: position.coords.latitude, lng: position.coords.longitude };
      }

      // 5. Check Duplicate
      const attendanceId = `${user?.uid}_${todayString}_${matchingSchedule.id}`;
      const attRef = doc(db, 'attendance', attendanceId);
      const attSnap = await getDoc(attRef);

      if (attSnap.exists()) {
        throw new Error('You have already marked your attendance for this scheduled session.');
      }

      // 6. Record Attendance
      await setDoc(attRef, {
        scheduleId: matchingSchedule.id,
        teacherId: matchingSchedule.teacherId,
        teacherName: matchingSchedule.teacherName || 'Teacher',
        studentId: user?.uid,
        studentAvatarUrl: profile?.avatarUrl || '',
        studentName: profile?.name,
        studentIdNum: profile?.studentId || 'N/A',
        department: studentDept,
        semester: studentSem,
        subject: matchingSchedule.subject || 'General Class',
        topic: matchingSchedule.topic || '',
        timestamp: new Date().toISOString(),
        date: todayString,
        status: 'present',
        location: studentPos,
        requireGPS: matchingSchedule.requireGPS || false
      });

      setStatus('success');
      const sessionInfo = matchingSchedule.subject ? `for ${matchingSchedule.subject}${matchingSchedule.topic ? ` (${matchingSchedule.topic})` : ''}` : `for ${studentDept} Sem ${studentSem}`;
      setMessage(`Knowledge is power! Your attendance ${sessionInfo} has been recorded.`);
      
    } catch (error: any) {
      logError("Attendance scanner error:", error);
      setStatus('error');
      setMessage(error.message || 'Verification failed. Please try again.');
    }
  }

  function onScanFailure(error: any) {
    // Quietly handle scan failures (usually just "no QR found in frame")
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  return (
    <div className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-6 transition-colors ${isEmbedded ? 'pb-24 pt-12' : 'pt-12'}`}>
      {!isEmbedded ? (
        <button 
          onClick={() => navigate('/')}
          className="mb-4 sm:mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      ) : (
        <button 
          onClick={() => { if(onTabChange) onTabChange('home'); }}
          className="mb-4 sm:mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Home
        </button>
      )}

      <div className="max-w-md mx-auto bg-white dark:bg-[#202c33] rounded-3xl shadow-2xl overflow-hidden border border-slate-50 dark:border-white/5 animate-in zoom-in-95 duration-500">
        <div className="bg-wa-teal p-4 sm:p-6 sm:p-10 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 backdrop-blur-xl shadow-inner group">
              <Camera className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </div>
            <h1 className="text-3xl font-bold tracking-normal mb-2">Biometric Scan</h1>
            <p className="text-white/80 text-xs  font-bold tracking-normal">Locate the official Tuition Hub QR to verify</p>
          </div>
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-black/10 rounded-full blur-3xl" />
        </div>

        <div className="p-4 sm:p-6 sm:p-10">
          {status === 'idle' && (
            <div className="space-y-2 sm:space-y-4 sm:space-y-8">
              <div id="reader" className="overflow-hidden rounded-2xl border-4 border-slate-50 dark:border-white/5 shadow-inner bg-[#f0f2f5] dark:bg-[#111b21] aspect-square flex items-center justify-center relative">
                 <div className="absolute inset-0 pointer-events-none border-2 border-wa-teal/20 rounded-2xl animate-pulse" />
              </div>
              <div className="flex items-center gap-4 p-4 sm:p-5 bg-wa-teal/5 dark:bg-wa-teal/10 rounded-2xl border border-wa-teal/10">
                <div className="w-10 h-10 bg-wa-teal rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-wa-teal/20">
                   <MapPin className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-bold text-wa-teal  tracking-normal leading-relaxed">
                  Encryption active: Ensure high-accuracy GPS permissions are granted for location verification.
                </p>
              </div>
            </div>
          )}

          {status === 'verifying' && (
            <div className="py-20 flex flex-col items-center text-center space-y-3 sm:space-y-6">
              <div className="w-24 h-24 bg-wa-teal/10 rounded-full flex items-center justify-center relative">
                 <Loader2 className="w-12 h-12 text-wa-teal animate-spin" />
                 <div className="absolute inset-0 border-4 border-wa-teal/20 rounded-full animate-ping opacity-20" />
              </div>
              <p className="text-[#8696a0] font-bold  tracking-normal text-xs">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-12 flex flex-col items-center text-center space-y-2 sm:space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative">
                <div className="w-28 h-28 bg-[#f0f2f5] dark:bg-wa-green/10 rounded-2xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-wa-green/20 shadow-xl p-1">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                  ) : (
                    <CheckCircle className="w-16 h-16 text-wa-green" />
                  )}
                </div>
                <div className="absolute -bottom-3 -right-3 bg-wa-green text-white p-3 rounded-2xl shadow-xl shadow-wa-green/20 border-4 border-white dark:border-[#202c33]">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">Verified!</h3>
                <p className="text-[#8696a0] text-sm font-semibold px-4 sm:px-6 leading-relaxed italic">"{message}"</p>
              </div>
              <button 
                onClick={() => {
                  if (isEmbedded && onTabChange) onTabChange('home');
                  else navigate('/');
                }}
                className="w-full bg-wa-teal hover:bg-wa-teal/90 text-white py-4 rounded-2xl font-bold  tracking-normal text-xs transition-all shadow-xl shadow-wa-teal/20 active:scale-95"
              >
                Return to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-12 flex flex-col items-center text-center space-y-2 sm:space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center relative group">
                <AlertCircle className="w-12 h-12 text-red-500 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 border-2 border-red-500/20 rounded-2xl animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">Scan Reset</h2>
                <p className="text-[#8696a0] text-sm font-semibold px-4 sm:px-6 leading-relaxed italic">{message}</p>
              </div>
              <button 
                onClick={() => { setStatus('idle'); setScanning(true); }}
                className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-4 rounded-2xl font-bold  tracking-normal text-xs shadow-lg transition-all active:scale-95"
              >
                Retry Authorization
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
