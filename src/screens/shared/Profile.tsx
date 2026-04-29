import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  Hash, 
  Save, 
  ArrowLeft, 
  Loader2,
  LogOut,
  Camera,
  Moon,
  Sun,
  Key,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form state
  const [name, setName] = useState(profile?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [realEmail, setRealEmail] = useState(profile?.realEmail || '');
  const [semester, setSemester] = useState(profile?.semester || '');
  const [courseId, setCourseId] = useState(profile?.courseId || '');
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhoneNumber(profile.phoneNumber || '');
      setRealEmail(profile.realEmail || '');
      setSemester(profile.semester || '');
      setCourseId(profile.courseId || '');
      
      if (profile.role === 'teacher') {
        fetchInviteCode();
      }
    }
  }, [profile]);

  const fetchInviteCode = async () => {
    try {
      const docRef = doc(db, 'config', 'appSettings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInviteCode(docSnap.data().inviteCode || '');
      }
    } catch (err) {
      console.error("Error fetching invite code:", err);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyStudentId = () => {
    if (profile?.studentId) {
      navigator.clipboard.writeText(profile.studentId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {
        name,
        phoneNumber,
        realEmail,
        profileComplete: true
      };

      if (profile.role === 'student') {
        updates.semester = semester;
        updates.courseId = courseId.toLowerCase();
        updates.courseName = courseId.toUpperCase();
      }

      await updateDoc(userRef, updates);
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      if (auth.currentUser.email) {
        // Re-authenticate first to prevent 'auth/requires-recent-login' error
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        try {
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (reauthErr: any) {
          if (reauthErr.code !== 'auth/wrong-password' && 
              reauthErr.code !== 'auth/invalid-credential' &&
              !reauthErr.message?.includes('auth/invalid-credential')) {
            console.error("Re-authentication failed:", reauthErr);
          }
          if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential' || reauthErr.message?.includes('auth/invalid-credential')) {
             setPasswordMessage({ type: 'error', text: 'Incorrect current password.' });
             setPasswordLoading(false);
             return;
          }
          throw reauthErr; // Let the main catch block handle other reauth errors
        }
      }

      await updatePassword(auth.currentUser, newPassword);
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code !== 'auth/wrong-password' && 
          error.code !== 'auth/invalid-credential' && 
          error.code !== 'auth/requires-recent-login' &&
          !error.message?.includes('auth/invalid-credential')) {
        console.error("Error updating password:", error);
      }
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.message?.includes('auth/invalid-credential')) {
        setPasswordMessage({ type: 'error', text: 'Incorrect current password.' });
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordMessage({ type: 'error', text: 'Session expired. Please logout and login again to change your password.' });
      } else {
        setPasswordMessage({ type: 'error', text: 'Failed to update password. ' + (error.message || '') });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-2 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="bg-blue-600 h-32 relative">
            <div className="absolute -bottom-12 left-8">
              <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-3xl p-1 shadow-lg">
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 relative group">
                  <User className="w-12 h-12" />
                  <button className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-16 p-8">
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.name}</h1>
                <p className="text-slate-500 dark:text-slate-400 capitalize">{profile?.role} Account {profile?.role === 'student' && `• ${profile?.courseName} Sem ${profile?.semester}`}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {profile?.role === 'student' && (
                  <button 
                    onClick={() => navigate('/attendance/scan')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all"
                  >
                    <QrCode className="w-4 h-4" /> Scan Attendance
                  </button>
                )}
                {profile?.role === 'student' && profile?.studentId && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Student ID</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">{profile.studentId}</p>
                    </div>
                    <button onClick={copyStudentId} className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 p-1.5 rounded-lg transition-colors">
                      {idCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {message.text && (
              <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
                message.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
              }`}>
                {message.type === 'success' ? <Save className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" /> Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" /> Phone Number
                  </label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) setPhoneNumber(val);
                    }}
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {phoneNumber.length}/10 digits
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" /> Real Email (Gmail)
                  </label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="student@gmail.com"
                    value={realEmail}
                    onChange={(e) => setRealEmail(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    This is your personal contact email.
                  </p>
                </div>

                {profile?.role === 'student' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" /> Semester
                      </label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        disabled={profile?.role === 'student' && !!profile?.semester}
                      >
                        <option value="">Select Semester</option>
                        {[1,2,3,4,5,6].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {profile?.role === 'student' && !!profile?.semester && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Locked. Contact teacher to change.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-slate-400" /> Department
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="e.g. BCA, MCA, B.Tech"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value.toLowerCase())}
                        disabled={profile?.role === 'student' && (!!profile?.courseId || !!profile?.department || !!profile?.courseName)}
                      />
                      {profile?.role === 'student' && (!!profile?.courseId || !!profile?.department || !!profile?.courseName) ? (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Locked. Contact teacher to change.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Update your Department (e.g. "bca") if it says "legacy"</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Changes</>}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" /> Change Password
              </h3>
              
              {passwordMessage.text && (
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
                  passwordMessage.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                }`}>
                  {passwordMessage.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="text-sm font-medium">{passwordMessage.text}</p>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2 max-w-xl">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? "text" : "password"} 
                      required
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password to verify"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">New Password</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Confirm Password</label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        required
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {passwordLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                </button>
              </form>
            </div>

            {profile?.role === 'teacher' && (
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" /> Invite Students
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Share this code with your students so they can access TutionHub.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-mono font-bold text-slate-900 dark:text-white tracking-widest text-center">
                    {inviteCode || 'Loading...'}
                  </div>
                  <button
                    onClick={copyInviteCode}
                    className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
