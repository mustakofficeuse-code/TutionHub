/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthGateway from './screens/auth/AuthGateway';
import TeacherDashboard from './screens/teacher/Dashboard';
import StudentHome from './screens/student/Home';
import AttendanceScanner from './screens/student/AttendanceScanner';
import AttendanceGenerator from './screens/teacher/AttendanceGenerator';
import FeeManagement from './screens/teacher/FeeManagement';
import PaymentHistory from './screens/student/PaymentHistory';
import MaterialManager from './screens/teacher/MaterialManager';
import StudentMaterials from './screens/student/Materials';
import DoubtSection from './screens/shared/DoubtSection';
import StudentAnalytics from './screens/student/Analytics';
import TeacherAnalytics from './screens/teacher/Analytics';
import AdminDashboard from './screens/admin/AdminDashboard';
import Profile from './screens/shared/Profile';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
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
          role === 'teacher' ? <TeacherDashboard /> : 
          <StudentHome />
        } 
      />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/attendance/scan" element={<AttendanceScanner />} />
      <Route path="/attendance/generate" element={<AttendanceGenerator />} />
      <Route path="/fees/manage" element={<FeeManagement />} />
      <Route path="/fees/history" element={<PaymentHistory />} />
      <Route path="/materials/manage" element={<MaterialManager />} />
      <Route path="/materials/list" element={<StudentMaterials />} />
      <Route path="/doubts" element={<DoubtSection />} />
      <Route path="/student/analytics" element={<StudentAnalytics />} />
      <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

