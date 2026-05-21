import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {ArrowLeft, UserPlus, Loader2, CheckCircle, Shield, User, Lock, BookOpen, GraduationCap, Copy, Check, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendNotification } from '../../services/notificationService';
import firebaseConfig from '../../../firebase-applet-config.json';

export default function AddStudent() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [realEmail, setRealEmail] = useState('');
  const [password, setPassword] = useState('');
  const [semester, setSemester] = useState('1');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const depts = snap.docs.map(doc => doc.data().name);
      setDepartments(depts);
      if (depts.length > 0 && !department) {
        setDepartment(depts[0]);
      }
    });

    return () => unsubDepts();
  }, [department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let secondaryApp = null;
    try {
      // 1. Check if name, phone, or email is blacklisted
      const blacklistSnap = await getDocs(collection(db, 'blacklist'));
      const isBlacklisted = blacklistSnap.docs.some(doc => {
        const data = doc.data();
        const nameMatch = (data.name || '').toLowerCase() === name.toLowerCase();
        const phoneMatch = phoneNumber && data.phoneNumber === phoneNumber;
        const emailMatch = realEmail && (data.realEmail || '').toLowerCase() === realEmail.toLowerCase();
        return nameMatch || phoneMatch || emailMatch;
      });

      if (isBlacklisted) {
        throw new Error('This student (name, phone, or email) is blacklisted and cannot be enrolled.');
      }

      const uniqueId = 'TH' + Math.floor(10000 + Math.random() * 90000);
      const generatedEmail = `${uniqueId.toLowerCase()}@student.tutionhub.com`;

      // Create a secondary app to avoid signing out the teacher
      secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);

      // Create student account
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, generatedEmail, password);
      const user = userCredential.user;

      // Save student profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        studentId: uniqueId,
        name,
        email: generatedEmail,
        realEmail: realEmail || null,
        phoneNumber: phoneNumber || null,
        role: 'student',
        semester,
        courseName: department,
        courseId: department.toUpperCase(),
        createdAt: new Date().toISOString(),
        profileComplete: true
      });

      // Create notification for dashboard
      await sendNotification({
        title: 'New Student Added',
        message: `${name} has been enrolled by teacher.`,
        type: 'new_student',
        senderId: profile?.uid || 'auto',
        senderName: profile?.name || 'Teacher',
        targetRole: 'ALL',
        targetDept: department,
        targetSem: semester,
      });

      // Clean up secondary session
      await signOut(secondaryAuth);
      
      setSuccess({ success: true, studentId: uniqueId, email: generatedEmail });
    } catch (err: any) {
      console.error("Student creation error:", err);
      // Handle the case where the API might still be disabled in THEIR project
      if (err.message && err.message.includes('identitytoolkit.googleapis.com')) {
        setError('Google Identity API is not enabled for this project. Please contact the administrator to enable it in the Google Cloud Console.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This student ID might already be registered. Try again.');
      } else {
        setError(err.message || 'An error occurred while creating the student.');
      }
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Only teachers can access this page.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 sm:mt-6 px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-xl font-bold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-6 md:p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 pt-12 transition-colors font-sans">
      <div className="max-w-xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-3 text-[#8696a0] font-bold  tracking-normal text-xs hover:text-wa-teal transition-all mb-4 sm:mb-8 group"
        >
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#202c33] flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/5 group-hover:scale-110 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Center
        </button>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-10 shadow-sm border border-slate-100 dark:border-white/5"
            >
              <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-6 sm:mb-10">
                <div className="w-16 h-16 bg-wa-teal/10 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                  <UserPlus className="w-8 h-8 text-wa-teal" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal leading-tight">Student <span className="text-wa-teal">Enrollment</span></h1>
                  <p className="text-xs font-bold text-[#8696a0]  tracking-normal mt-1">Add a new student to the system</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 sm:mb-8 p-4 sm:p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-2xl flex items-center gap-4 text-red-600 dark:text-red-400 text-xs font-bold  tracking-normal leading-relaxed shadow-inner">
                  <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4 sm:space-y-8">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                    <input
                      type="text"
                      required
                      className="w-full pl-16 pr-6 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Phone Number</label>
                    <div className="relative group">
                      <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                      <input
                        type="tel"
                        maxLength={10}
                        className="w-full pl-16 pr-6 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                        placeholder="e.g. 9876543210"
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 10) setPhoneNumber(val);
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Personal Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                      <input
                        type="email"
                        className="w-full pl-16 pr-6 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                        placeholder="e.g. student@gmail.com"
                        value={realEmail}
                        onChange={(e) => setRealEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Department</label>
                    <div className="relative group">
                      <GraduationCap className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                      <select
                        required
                        className="w-full pl-16 pr-8 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none appearance-none transition-all shadow-inner  tracking-normal"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      >
                        {departments.map(dept => (
                          <option key={dept} value={dept} className="bg-white dark:bg-[#202c33]">{dept}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Semester</label>
                    <div className="relative group">
                      <BookOpen className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                      <select
                        required
                        className="w-full pl-16 pr-8 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none appearance-none transition-all shadow-inner  tracking-normal"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={s.toString()} className="bg-white dark:bg-[#202c33]">Level {s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#8696a0]  tracking-normal ml-4">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8696a0] group-focus-within:text-wa-teal transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className="w-full pl-16 pr-16 py-3 sm:py-5 bg-[#f0f2f5] dark:bg-[#111b21] border border-transparent focus:border-wa-teal/20 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none transition-all shadow-inner"
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-wa-teal transition-all"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium tracking-normal text-slate-600 dark:text-slate-300 text-[#8696a0] text-center italic">Default password for logging in</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-5 bg-wa-teal hover:bg-wa-teal-dark text-white font-bold text-xs  tracking-normal rounded-2xl transition-all shadow-xl shadow-wa-teal/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Add Student
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-white/5 text-center"
            >
              <div className="w-24 h-24 bg-wa-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-inner">
                <CheckCircle className="w-12 h-12 text-wa-green" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] mb-3 tracking-normal">Registration <span className="text-wa-green">Success</span></h2>
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal mb-4 sm:mb-6 sm:mb-10 leading-relaxed max-w-xs mx-auto">New student registered. Share these credentials securely.</p>

              <div className="bg-[#f0f2f5] dark:bg-[#111b21] p-4 sm:p-6 sm:p-10 rounded-2xl border border-slate-100 dark:border-white/5 mb-4 sm:mb-6 sm:mb-10 space-y-2 sm:space-y-4 sm:space-y-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
                    <Shield className="w-20 h-20 text-wa-teal" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#8696a0]  tracking-normal mb-4">Student ID</p>
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-3xl sm:text-4xl sm:text-5xl font-bold text-wa-teal dark:text-wa-green tracking-normal leading-none">
                      {success.studentId}
                    </span>
                    <button 
                      onClick={() => copyToClipboard(success.studentId)}
                      className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:scale-110 transition-all border border-slate-100 dark:border-white/10 flex items-center justify-center"
                    >
                      {copiedId ? <Check className="w-5 h-5 text-wa-green" /> : <Copy className="w-5 h-5 text-[#8696a0]" />}
                    </button>
                  </div>
                </div>
                
                <div className="pt-8 border-t border-slate-200 dark:border-white/5">
                  <p className="text-xs font-bold text-[#8696a0]  tracking-normal mb-4">Password</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">{password}</p>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-bold text-wa-teal  tracking-normal leading-relaxed italic opacity-80">Credentials are ready to share</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    setSuccess(null);
                    setName('');
                    setPhoneNumber('');
                    setRealEmail('');
                    setPassword('');
                  }}
                  className="w-full py-3 sm:py-5 bg-wa-teal hover:bg-wa-teal-dark text-white font-bold text-xs  tracking-normal rounded-2xl transition-all shadow-lg shadow-wa-teal/20 active:scale-95"
                >
                  Register Another Student
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3 sm:py-5 text-[#8696a0] font-bold text-xs  tracking-normal hover:bg-[#f0f2f5] dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
