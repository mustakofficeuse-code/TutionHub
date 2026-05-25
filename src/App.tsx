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
import { Logo } from './components/Logo';

function AppRoutes() {
  const { user, profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-full overflow-hidden shadow-md mb-4 bg-transparent p-0 flex items-center justify-center">
            <Logo size="100%" />
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
        } else if (data.version !== initialVersion) {
          if (isMounted && !sessionStorage.getItem("update_dismissed_" + data.version)) {
            setHasUpdate(true);
            sessionStorage.setItem("pending_update_version", data.version);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000); // Check every minute

    // Hook into Service Worker registration update listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        const handleUpdate = () => {
          const installing = reg.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                if (isMounted && !sessionStorage.getItem("update_dismissed_sw")) setHasUpdate(true);
              }
            };
          }
        };

        reg.onupdatefound = handleUpdate;

        if (reg.waiting) {
          if (isMounted && !sessionStorage.getItem("update_dismissed_sw")) setHasUpdate(true);
        }
      });
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = () => {
    const v = sessionStorage.getItem("pending_update_version");
    if (v) sessionStorage.setItem("update_dismissed_" + v, "true");
    sessionStorage.setItem("update_dismissed_sw", "true");
    setHasUpdate(false);
  };

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
        className="bg-sky-500 dark:bg-sky-600 text-white shadow-2xl rounded-2xl p-4 border border-sky-400 dark:border-sky-500 backdrop-blur-md flex flex-col gap-3"
      >
        <div className="flex items-center gap-3 w-full">
          <div className="bg-white/10 p-2.5 rounded-xl flex items-center justify-center animate-spin shrink-0">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="font-bold text-sm tracking-tight text-white mb-0.5">App Update Available</h4>
            <p className="text-[11px] text-sky-100 font-medium leading-tight">New version deployed and ready.</p>
          </div>
        </div>
        <div className="flex w-full gap-2 mt-1">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 text-sky-100 font-bold text-xs bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-800 rounded-xl transition-all"
          >
            Dismiss
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-2 bg-white text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-100 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
          >
            Update Now
          </button>
        </div>
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
                  {/* Glowing, rounded-full logo container */}
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                    animate={{ scale: [0.6, 1.05, 1], opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-36 h-36 rounded-full overflow-hidden shadow-[0_0_40px_rgba(223,183,60,0.15)] bg-transparent flex items-center justify-center"
                  >
                    <Logo size="100%" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent pointer-events-none" />
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
