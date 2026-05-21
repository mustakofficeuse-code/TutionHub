/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthGateway from './screens/auth/AuthGateway';
import StudentView from './screens/student/StudentView';
import AttendanceScanner from './screens/student/AttendanceScanner';
import AttendanceGenerator from './screens/teacher/AttendanceGenerator';
import FeeManagement from './screens/teacher/FeeManagement';
import MaterialManager from './screens/teacher/MaterialManager';
import TeacherDashboard from './screens/teacher/Dashboard';
import TeacherView from './screens/teacher/TeacherView';
import TeacherAnalytics from './screens/teacher/Analytics';
import AdminDashboard from './screens/admin/AdminDashboard';
import AddStudent from './screens/admin/AddStudent';

function AppRoutes() {
  const { user, profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-md mb-4 bg-white/5 p-1 animate-pulse">
            <img src="/logo.png" alt="TuitionHub" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
          </div>
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden absolute -bottom-4">
            <div className="w-1/2 h-full bg-blue-500 rounded-full animate-[shimmer_1.5s_infinite]" style={{
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
            }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthGateway />} />
        <Route path="*" element={<Navigate to="/auth" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          role === 'admin' ? <AdminDashboard /> :
          role === 'teacher' ? <TeacherView /> : 
          <StudentView />
        } 
      />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/students/add" element={<AddStudent />} />
      <Route path="/attendance/scan" element={<AttendanceScanner />} />
      <Route path="/attendance/generate" element={<AttendanceGenerator />} />
      <Route path="/fees/manage" element={<FeeManagement />} />
      <Route path="/materials/manage" element={<MaterialManager />} />
      <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function AppUpdatePrompt() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    let initialVersion: string | null = null;
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/app-version");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.version) return;

        if (!initialVersion) {
          initialVersion = data.version;
          console.log("[Updater] Initial app session version loaded:", initialVersion);
        } else if (data.version !== initialVersion) {
          console.log(`[Updater] New version detected! Server: ${data.version}, Initial: ${initialVersion}`);
          if (isMounted) {
            setHasUpdate(true);
          }
        }
      } catch (err) {
        console.error("[Updater] Failed to fetch server app-version:", err);
      }
    };

    // 1. Initial check
    checkVersion();

    // 2. Periodic checks every 10 seconds (optimized for fast local development feedback)
    const interval = setInterval(checkVersion, 10000);

    // 3. Focus/visibility check to detect changes immediately upon switching back to the browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Hook into Service Worker registration update listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        const handleUpdate = () => {
          const installing = reg.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[Updater] SW update found and installed in background");
                if (isMounted) setHasUpdate(true);
              }
            };
          }
        };

        reg.onupdatefound = handleUpdate;

        if (reg.waiting) {
          console.log("[Updater] Active waiting service worker detected");
          if (isMounted) setHasUpdate(true);
        }
      });
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-sm md:max-w-md px-4">
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="bg-sky-500 dark:bg-sky-600 text-white shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 border border-sky-400 dark:border-sky-500 backdrop-blur-md"
      >
        <div className="flex items-center gap-3 w-full">
          <div className="bg-white/10 p-2.5 rounded-xl flex items-center justify-center animate-spin shrink-0">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight text-white">App Update Available</h4>
            <p className="text-[11px] text-sky-100 mt-0.5 leading-tight font-medium">
              A new version with revisions has been deployed.
            </p>
          </div>
        </div>
        <button
          onClick={handleUpdate}
          className="flex items-center gap-1.5 px-3 py-2 bg-white text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-100 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
        >
          Update Now
        </button>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Keep splash screen visible for at least 2.2 seconds to display the logo beautifully on reload or cold boot
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppUpdatePrompt />
          <AnimatePresence mode="wait">
            {showSplash && (
              <motion.div
                key="splash"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-900 overflow-hidden select-none"
              >
                {/* Glowing subtle radial light in background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.07)_0%,transparent_65%)] animate-pulse pointer-events-none" />
                
                <div className="flex flex-col items-center gap-6 max-w-xs text-center px-4">
                  {/* Glowing, rounded-3xl logo container */}
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                    animate={{ scale: [0.6, 1.05, 1], opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-36 h-36 rounded-full overflow-hidden shadow-[0_0_40px_rgba(56,189,248,0.25)] border-2 border-sky-400/20 bg-black"
                  >
                    <img 
                      src="/logo.png" 
                      alt="TuitionHub Logo" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-transparent" />
                  </motion.div>

                  {/* Styled application title & subtitle */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                    className="space-y-1.5"
                  >
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                      Tuition<span className="text-sky-400">Hub</span>
                    </h1>
                    <p className="text-xs font-semibold text-sky-400/60 tracking-widest uppercase">
                      Smart Classroom Companion
                    </p>
                  </motion.div>

                  {/* Micro loading progress bar */}
                  <div className="w-36 h-[3px] bg-slate-800 rounded-full overflow-hidden relative mt-2 border border-slate-800/50">
                    <motion.div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-sky-400 to-wa-green rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
