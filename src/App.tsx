/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
