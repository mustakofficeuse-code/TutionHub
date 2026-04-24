import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, User, Lock, BookOpen, Layers, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function AuthGateway() {
  const [view, setView] = useState<'loading' | 'teacher-setup' | 'teacher-login' | 'student-enroll' | 'student-login'>('loading');
  const [teacherName, setTeacherName] = useState('Barun Maity');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Student fields
  const [studentName, setStudentName] = useState('');
  const [semester, setSemester] = useState('1');
  const [department, setDepartment] = useState('BCA');
  const [studentInviteCode, setStudentInviteCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [generatedId, setGeneratedId] = useState('');
  const [isExistingStudent, setIsExistingStudent] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (localStorage.getItem('isExistingStudent') === 'true') {
      setIsExistingStudent(true);
    }
    checkSetup();
    
    // Auto-recover deleted profile if user is already authenticated
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
             // Recreate minimum profile
             await setDoc(userDocRef, {
               uid: user.uid,
               name: user.email?.split('@')[0] || 'Recovered Student',
               email: user.email,
               role: user.email === 'teacher@tutionhub.com' || user.email === 'admin@tutionhub.com' ? 'teacher' : 'student',
               semester: '1',
               courseName: 'General',
               courseId: 'general',
               createdAt: new Date().toISOString(),
               profileComplete: true
             });
             refreshProfile();
             navigate('/');
          }
        } catch (e) {
          console.error("Auto recovery failed", e);
        }
      }
    });
    
    return () => unsubscribe();
  }, [navigate, refreshProfile]);

  const checkSetup = async () => {
    try {
      const docRef = doc(db, 'config', 'appSettings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTeacherName(data.teacherName || 'Barun Maity');
        setInviteCode(data.inviteCode || '');
        setView('student-login');
      } else {
        setView('teacher-setup');
      }
    } catch (err) {
      console.error("Error checking setup:", err);
      setView('teacher-setup'); // Fallback
    }
  };

  const handleTeacherSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Create teacher account
      const email = 'teacher@tutionhub.com';
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }

      const user = userCredential.user;

      // Save teacher profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: teacherName,
        email: email,
        role: 'teacher',
        createdAt: new Date().toISOString(),
        profileComplete: true
      });

      // Generate initial invite code
      const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Save app settings
      await setDoc(doc(db, 'config', 'appSettings'), {
        teacherName,
        setupComplete: true,
        inviteCode: newInviteCode
      });

      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to setup teacher account');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, 'teacher@tutionhub.com', password);
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Invalid password or teacher account not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let cleanId = studentId.replace(/\s+/g, '').toLowerCase();
      let emailsToTry = [];

      // If it's just numbers (e.g., 84921) -> th84921
      if (/^\d+$/.test(cleanId)) {
        emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
      } 
      // If it's TH + numbers (e.g., th84921) -> th84921
      else if (cleanId.startsWith('th') && /^\d+$/.test(cleanId.substring(2))) {
        emailsToTry.push(`${cleanId}@student.tutionhub.com`);
      } 
      // Otherwise, it's likely a legacy student logging in with their name
      else {
        emailsToTry.push(`${cleanId}@student.tutionhub.com`); // Legacy format (e.g., subhadipmondal)
        // Also try with 'th' just in case
        if (!cleanId.startsWith('th')) {
          emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
        }
      }

      let loginSuccess = false;
      let lastError = null;

      for (const email of emailsToTry) {
        try {
          // Check if blacklisted
          const blacklistRef = doc(db, 'blacklist', email);
          const blacklistSnap = await getDoc(blacklistRef);
          if (blacklistSnap.exists()) {
            throw new Error('Your access has been revoked by the teacher. Please contact your teacher for permission.');
          }

          const userCredential = await signInWithEmailAndPassword(auth, email, studentPassword);
          const user = userCredential.user;
          
          // Verify user document exists (recreate if deleted mistakenly)
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              studentId: cleanId.startsWith('th') ? cleanId.toUpperCase() : cleanId,
              name: 'Student (Recovered)', // They can update this in profile
              email: email,
              role: 'student',
              semester: '1',
              courseName: 'General',
              courseId: 'general',
              createdAt: new Date().toISOString(),
              profileComplete: true
            });
          }
          
          loginSuccess = true;
          break; // Stop trying if successful
        } catch (err: any) {
          lastError = err;
          // If the error is our custom blacklist error, throw it immediately
          if (err.message && err.message.includes('revoked')) {
            throw err;
          }
          
          // Legacy Auto-Migration: If it's auth/invalid-credential or user-not-found, 
          // and they are using the old Name-based login format AND we are connected to the new Firebase project,
          // instantly create their account behind the scenes so old students aren't locked out of the new project.
          if ((err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') && !cleanId.startsWith('th')) {
             try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, studentPassword);
                const user = userCredential.user;
                await setDoc(doc(db, 'users', user.uid), {
                  uid: user.uid,
                  studentId: cleanId,
                  name: studentId, // original typed text
                  email: email,
                  role: 'student',
                  semester: '1', // default fallback
                  courseName: 'Legacy Student',
                  courseId: 'legacy',
                  createdAt: new Date().toISOString(),
                  profileComplete: true
                });
                loginSuccess = true;
                break;
             } catch (createErr) {
               // ignore and let it loop
             }
          }
        }
      }

      if (!loginSuccess) {
        throw lastError || new Error('Invalid Student ID or Password.');
      }

      localStorage.setItem('isExistingStudent', 'true');
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid Student ID or Password.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (studentInviteCode !== inviteCode) {
        throw new Error('Invalid Invite Code');
      }

      // Generate a unique Student ID (e.g., TH84921)
      const uniqueId = 'TH' + Math.floor(10000 + Math.random() * 90000);
      const generatedEmail = `${uniqueId.toLowerCase()}@student.tutionhub.com`;

      // Create student account
      const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, studentPassword);
      const user = userCredential.user;

      // Save student profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        studentId: uniqueId,
        name: studentName,
        email: generatedEmail,
        role: 'student',
        semester,
        courseName: department,
        courseId: department.toLowerCase(),
        createdAt: new Date().toISOString(),
        profileComplete: true
      });

      // Create notification for teacher
      const notifId = `enroll_${user.uid}`;
      await setDoc(doc(db, 'notifications', notifId), {
        title: 'New Student Enrolled',
        message: `${studentName} (${department}, Sem ${semester}) has joined TutionHub.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'enrollment'
      });

      localStorage.setItem('isExistingStudent', 'true');
      setGeneratedId(uniqueId);
      // We don't navigate immediately, we let them see their ID first.
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to enroll');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterEnroll = async () => {
    await refreshProfile();
    navigate('/');
  };

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
        
        {view === 'teacher-setup' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teacher Setup</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Initialize TutionHub</p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
            <form onSubmit={handleTeacherSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Access Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Dashboard'}
              </button>
            </form>
          </>
        )}

        {view === 'teacher-login' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teacher Login</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Welcome back, {teacherName}</p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Access Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
              </button>
              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setView('student-login')}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => setView('student-enroll')}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  Enroll New Student
                </button>
              </div>
            </form>
          </>
        )}

        {view === 'student-login' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Login</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Access your TutionHub dashboard</p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student ID or Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. TH8492 or Your Name"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
              </button>
              {!isExistingStudent && (
                <div className="flex justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setView('student-enroll')}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                  >
                    New Student? Enroll Here
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('teacher-login')}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                  >
                    Teacher Login
                  </button>
                </div>
              )}
            </form>
          </>
        )}

        {view === 'student-enroll' && !generatedId && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enroll in TutionHub</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Teacher: {teacherName}</p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
            <form onSubmit={handleStudentEnroll} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>Sem {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="BCA">BCA</option>
                      <option value="MCA">MCA</option>
                      <option value="B.Tech">B.Tech</option>
                      <option value="B.Sc">B.Sc</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Create Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Set a secure password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invite Code</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    value={studentInviteCode}
                    onChange={(e) => setStudentInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter code from teacher"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enroll Now'}
              </button>
            </form>
            <div className="flex justify-between mt-6">
              <button 
                onClick={() => setView('student-login')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Already have an ID? Login
              </button>
              <button 
                onClick={() => setView('teacher-login')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Teacher Login
              </button>
            </div>
          </>
        )}

        {view === 'student-enroll' && generatedId && (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Enrollment Successful!</h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Your unique Student ID is:</p>
              <p className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-wider">{generatedId}</p>
              <p className="text-xs text-red-500 font-bold mt-4">⚠️ Please save this ID. You will need it to login.</p>
            </div>
            <button
              onClick={handleContinueAfterEnroll}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

