import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, logError } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, User, Lock, BookOpen, Layers, Key, CheckCircle, Eye, EyeOff, Mail, Phone } from 'lucide-react';

export default function AuthGateway() {
  const [view, setView] = useState<'loading' | 'teacher-setup' | 'teacher-login' | 'student-enroll' | 'student-login'>('loading');
  const [teacherName, setTeacherName] = useState('Barun Maity');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Student fields
  const [studentName, setStudentName] = useState('');
  const [semester, setSemester] = useState('1');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [studentInviteCode, setStudentInviteCode] = useState('');
  const [studentRealEmail, setStudentRealEmail] = useState('');
  const [studentPhoneNumber, setStudentPhoneNumber] = useState('');
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

    // Departments listener
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const depts = snap.docs.map(doc => doc.data().name);
      setDepartments(depts);
      if (depts.length > 0 && !department) {
        setDepartment(depts[0]);
      }
    });
    
    // Auto-recover deleted profile if user is already authenticated
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        try {
          const blacklistByEmail = user.email ? doc(db, 'blacklist', user.email) : null;
          const blacklistByUid = doc(db, 'blacklist', user.uid);
          
          const emailSnap = blacklistByEmail ? await getDoc(blacklistByEmail) : null;
          const uidSnap = await getDoc(blacklistByUid);
          
          if ((emailSnap && emailSnap.exists()) || uidSnap.exists()) {
             await auth.signOut();
             return;
          }

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
               courseName: 'BCA',
               courseId: 'BCA',
               createdAt: new Date().toISOString(),
               profileComplete: true
             });
             refreshProfile();
             navigate('/');
          }
        } catch (e: any) {
          // Be very silent about auto-recovery errors unless they aren't auth/network related
          const isExpected = e.code?.startsWith('auth/') || 
                             e.message?.includes('offline') || 
                             e.message?.includes('failed-precondition');
          
          if (!isExpected) {
            logError("Auto recovery system note:", e);
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [navigate, refreshProfile]);

  const checkSetup = async () => {
    try {
      const docRef = doc(db, 'config', 'appSettings');
      // Using a standard getDoc which will try to use cache if server is temporarily unreachable
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTeacherName(data.teacherName || 'Barun Maity');
        setInviteCode(data.inviteCode || '');
        setView('student-login');
      } else {
        setView('teacher-setup');
      }
    } catch (err: any) {
      console.warn("Setup check deferred or failed:", err.message);
      // If it's a connection issue, we might want to wait or just fall back to login
      // instead of forcing setup view if it might actually exist
      if (err.message && err.message.includes('offline')) {
         setView('student-login'); // Assume it exists and let login handle the connectivity error
      } else {
         setView('teacher-setup'); // Fallback for new projects
      }
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
      logError("Teacher setup error:", err);
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
      logError("Teacher login error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.message?.includes('auth/invalid-credential')) {
        setError('Invalid password. Please check your credentials and try again.');
      } else {
        setError(err.message || 'Teacher account not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cleanId = studentId.trim().toLowerCase();
      let emailsToTry: string[] = [];

      // 1. If it's already an email, try it first
      if (cleanId.includes('@')) {
        emailsToTry.push(cleanId);
      }

      // 2. Try to find the student in the database to get their registered email
      try {
        const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const matchedUser = studentsSnap.docs.find(doc => {
          const data = doc.data();
          const sId = (data.studentId || '').toLowerCase();
          const sName = (data.name || '').toLowerCase();
          const sEmail = (data.email || '').toLowerCase();
          const sRealEmail = (data.realEmail || '').toLowerCase();
          const sPhone = (data.phoneNumber || '').toLowerCase();
          return sId === cleanId || sName === cleanId || sEmail === cleanId || sRealEmail === cleanId || sPhone === cleanId;
        });
        
        if (matchedUser && matchedUser.data().email && !emailsToTry.includes(matchedUser.data().email)) {
          emailsToTry.push(matchedUser.data().email);
        }
      } catch (dbErr) {
        console.warn("DB search failed, falling back to pattern matching", dbErr);
      }

      // 3. Fallback patterns
      if (!emailsToTry.length || !cleanId.includes('@')) {
        // If it's just numbers (e.g., 84921) -> th84921
        if (/^\d+$/.test(cleanId)) {
          emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
        } 
        // If it's TH + numbers (e.g., th84921) -> th84921
        else if (cleanId.startsWith('th') && /^\d+$/.test(cleanId.substring(2))) {
          emailsToTry.push(`${cleanId}@student.tutionhub.com`);
        } 
        else {
          emailsToTry.push(`${cleanId}@student.tutionhub.com`);
          if (!cleanId.startsWith('th')) {
            emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
          }
        }
      }

      // Remove duplicates
      emailsToTry = Array.from(new Set(emailsToTry));

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
              courseName: 'BCA',
              courseId: 'BCA',
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
        }
      }

      if (!loginSuccess) {
        if (lastError?.code === 'auth/invalid-credential' || lastError?.code === 'auth/user-not-found' || lastError?.code === 'auth/wrong-password') {
          throw new Error('Invalid credentials. Please check your Student ID and password.');
        }
        throw lastError || new Error('Invalid Student ID or Password.');
      }

      localStorage.setItem('isExistingStudent', 'true');
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      // Only log if it's not a common auth error which we handle with UI messages
      logError("Student login error:", err);
      let userMsg = err.message || 'Invalid Student ID or Password.';
      if (userMsg.includes('auth/invalid-credential') || userMsg.includes('auth/user-not-found')) {
        userMsg = 'Invalid credentials. Please check your Student ID and password.';
      }
      setError(userMsg);
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

      // Basic validation
      if (!/^\d{10}$/.test(studentPhoneNumber)) {
        throw new Error('Please enter a valid 10-digit phone number');
      }

      // Stronger email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(studentRealEmail)) {
        throw new Error('Please enter a valid email address (e.g. name@gmail.com)');
      }

      // 1. Check if name, phone, or email is blacklisted
      const blacklistSnap = await getDocs(collection(db, 'blacklist'));
      const isBlacklisted = blacklistSnap.docs.some(doc => {
        const data = doc.data();
        const nameMatch = (data.name || '').toLowerCase() === studentName.toLowerCase();
        const phoneMatch = studentPhoneNumber && data.phoneNumber === studentPhoneNumber;
        const emailMatch = studentRealEmail && (data.realEmail || '').toLowerCase() === studentRealEmail.toLowerCase();
        return nameMatch || phoneMatch || emailMatch;
      });

      if (isBlacklisted) {
        throw new Error('Your enrollment has been blocked by the teacher. Please contact your teacher for permission.');
      }

      // 2. Check for duplicate student (already enrolled)
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const isDuplicate = studentsSnap.docs.some(doc => {
        const data = doc.data();
        return (data.name || '').toLowerCase() === studentName.toLowerCase() && 
               data.courseName === department && 
               data.semester === semester;
      });

      if (isDuplicate) {
        throw new Error('A student with this name is already enrolled in this department and semester. If you forgot your ID, contact the teacher.');
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
        realEmail: studentRealEmail || null,
        phoneNumber: studentPhoneNumber || null,
        role: 'student',
        semester,
        courseName: department,
        courseId: department.toUpperCase(),
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
      logError("Student enroll error:", err);
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
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
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
              <div className="flex justify-between mt-4">
                {!isExistingStudent && (
                  <button
                    type="button"
                    onClick={() => setView('student-enroll')}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                  >
                    New Student? Enroll Here
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setView('teacher-login')}
                  className={`text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors ${isExistingStudent ? 'w-full text-center' : ''}`}
                >
                  Teacher Login
                </button>
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={studentPhoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 10) setStudentPhoneNumber(val);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Gmail)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="email"
                      required
                      placeholder="student@gmail.com"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={studentRealEmail}
                      onChange={(e) => setStudentRealEmail(e.target.value)}
                    />
                  </div>
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
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
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

