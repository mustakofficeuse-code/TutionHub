import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth, logError } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Camera, MapPin, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATIC_QR_ID = "TUITIONHUB_ATTENDANCE_001";

export default function AttendanceScanner() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
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
    if (decodedText !== STATIC_QR_ID) {
      setScanning(false);
      setStatus('error');
      setMessage('Invalid QR Code. Please scan the official TuitionHub Attendance QR at the entry gate.');
      return;
    }

    setScanning(false);
    setStatus('verifying');
    setMessage('Checking your location...');

    try {
      // 1. Get Tuition Location from Config
      const configRef = doc(db, 'config', 'attendance');
      const configSnap = await getDoc(configRef);
      
      if (!configSnap.exists()) {
        throw new Error('Tuition location is not configured. Please ask the teacher to set it.');
      }

      const tuitionLoc = configSnap.data() as {lat: number, lng: number};

      // 2. Check Location (GPS Radius 200m)
      const position = await getCurrentPosition();
      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        tuitionLoc.lat,
        tuitionLoc.lng
      );

      if (distance > 0.2) { // 0.2 km = 200m
        throw new Error(`You must be at the tuition location to mark attendance. You are currently ${Math.round(distance * 1000)}m away.`);
      }

      // 3. Check Duplicate Attendance (One per day per student)
      const today = new Date().toISOString().split('T')[0];
      const attendanceId = `${user?.uid}_${today}`;
      const attRef = doc(db, 'attendance', attendanceId);
      const attSnap = await getDoc(attRef);

      if (attSnap.exists()) {
        throw new Error('You have already marked your attendance for today.');
      }

      // 4. Mark Attendance
      await setDoc(attRef, {
        studentId: user?.uid,
        studentName: profile?.name,
        courseId: profile?.courseId || 'unknown',
        courseName: profile?.courseName || 'unknown',
        date: today,
        timestamp: new Date().toISOString(),
        status: 'present',
        location: { lat: position.coords.latitude, lng: position.coords.longitude }
      });

      setStatus('success');
      setMessage('Attendance marked successfully!');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="bg-blue-600 p-8 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Camera className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Attendance Scanner</h1>
          <p className="text-blue-100 text-sm mt-2">Scan the QR code displayed by your teacher</p>
        </div>

        <div className="p-8">
          {status === 'idle' && (
            <div className="space-y-6">
              <div id="reader" className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700"></div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-400 text-sm">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <p>Ensure your GPS is turned on and you are at the tuition center.</p>
              </div>
            </div>
          )}

          {status === 'verifying' && (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Success!</h2>
              <p className="text-slate-600 dark:text-slate-400">{message}</p>
              <button 
                onClick={() => navigate('/')}
                className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 dark:shadow-none"
              >
                Done
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Verification Failed</h2>
              <p className="text-slate-600 dark:text-slate-400">{message}</p>
              <button 
                onClick={() => { setStatus('idle'); setScanning(true); }}
                className="mt-6 w-full bg-slate-900 dark:bg-slate-800 text-white py-3 rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
