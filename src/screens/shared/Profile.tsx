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
  QrCode,
  Edit2,
  X,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile({ isEmbedded }: { isEmbedded?: boolean }) {
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(profile?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [realEmail, setRealEmail] = useState(profile?.realEmail || '');
  const [semester, setSemester] = useState(profile?.semester || '');
  const [courseId, setCourseId] = useState(profile?.courseId || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [isEditing, setIsEditing] = useState(false);
  const hiddenFileInput = React.useRef<HTMLInputElement>(null);

  const triggerUpload = () => {
    hiddenFileInput.current?.click();
  };
  
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
      setAvatarUrl(profile.avatarUrl || '');
      
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

  const randomizeAvatar = (style = 'notionists') => {
    const seed = Math.random().toString(36).substring(2, 9);
    let baseUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
    
    if (style === 'notionists') {
      baseUrl += `&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    } else if (style === 'initials') {
      baseUrl += `&backgroundColor=3b82f6,0ea5e9,6366f1&fontFamily=Arial,sans-serif&fontWeight=700`;
    } else if (style === 'shapes') {
      baseUrl += `&backgroundColor=f8fafc&shape1Color=3b82f6&shape2Color=6366f1&shape3Color=0ea5e9`;
    }
    
    setAvatarUrl(baseUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB to stay safe with Firestore)
    if (file.size > 500 * 1024) {
      setMessage({ type: 'error', text: 'Image too large. Please select a photo under 500KB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
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
        avatarUrl,
        profileComplete: true
      };

      if (profile.role === 'student') {
        updates.semester = semester;
        updates.courseId = courseId.toUpperCase();
        updates.courseName = courseId.toUpperCase();
      }

      await updateDoc(userRef, updates);

      // If teacher, also update global app settings for students to see
      if (profile.role === 'teacher' || profile.role === 'admin') {
        try {
          const appSettingsRef = doc(db, 'config', 'appSettings');
          await updateDoc(appSettingsRef, {
            teacherName: name,
            teacherPhone: phoneNumber,
            teacherEmail: realEmail,
            teacherAvatarUrl: avatarUrl
          });
        } catch (err) {
          console.warn("Failed to update appSettings, might not exist yet:", err);
        }
      }

      await refreshProfile();
      setIsEditing(false);
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
    <div className={`min-h-screen bg-wa-bg dark:bg-wa-bg-dark p-6 transition-colors ${isEmbedded ? '' : 'pb-24'}`}>
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              layoutId="profile-avatar-zoom"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-2xl w-full aspect-square rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomedImage} 
                alt="Zoomed DP" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all shadow-lg border border-white/20 group"
              >
                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          {!isEmbedded ? (
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-600 dark:text-[#8696a0] font-semibold hover:text-wa-teal dark:hover:text-wa-green transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
          ) : (
            <div></div>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-[#202c33] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-[#8696a0] hover:text-wa-teal dark:hover:text-wa-green transition-all"
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

        <div className="bg-white dark:bg-[#202c33] rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden">
          <div className="bg-wa-teal dark:bg-wa-header h-32 relative">
            <div className="absolute -bottom-12 left-8">
              <div className="w-24 h-24 bg-white dark:bg-[#202c33] rounded-3xl p-1 shadow-lg">
                <div 
                  onClick={() => avatarUrl && !isEditing && setZoomedImage(avatarUrl)}
                  className={`w-full h-full bg-slate-100 dark:bg-[#111b21] rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 relative group overflow-hidden ${!isEditing && avatarUrl ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-12 h-12" />
                  )}
                  {isEditing && (
                    <>
                      <button 
                        type="button"
                        onClick={triggerUpload}
                        className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white"
                      >
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-xs font-bold">Upload Photo</span>
                      </button>
                      <input 
                        type="file"
                        ref={hiddenFileInput}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-16 p-5 sm:p-5 sm:p-6">
            {isEditing && (
              <div className="mb-0">
                <label className="text-xs font-bold text-slate-400  tracking-normal block mb-3">Profile Picture Settings</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button 
                    type="button"
                    onClick={triggerUpload}
                    className="px-4 py-2 bg-wa-teal text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-wa-teal/20 hover:bg-wa-teal-dark transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    Upload Photo
                  </button>
                  <div className="w-px h-8 bg-slate-100 dark:bg-white/5 self-center mx-1"></div>
                  <button 
                    type="button"
                    onClick={() => randomizeAvatar('notionists')}
                    className="px-3 py-2 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-[#8696a0] hover:border-wa-teal transition-all flex items-center gap-2"
                  >
                    Minimalist
                  </button>
                  <button 
                    type="button"
                    onClick={() => randomizeAvatar('initials')}
                    className="px-3 py-2 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-[#8696a0] hover:border-wa-teal transition-all flex items-center gap-2"
                  >
                    Initials
                  </button>
                  <button 
                    type="button"
                    onClick={() => randomizeAvatar('shapes')}
                    className="px-3 py-2 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-[#8696a0] hover:border-wa-teal transition-all flex items-center gap-2"
                  >
                    Geometric
                  </button>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-wa-teal outline-none transition-all"
                    placeholder="Or paste an image URL here..."
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic">Pro-tip: PNG or JPG works best for profile photos.</p>
              </div>
            )}

            <div className="my-8 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.name}</h1>
                <p className="text-slate-500 dark:text-slate-400 capitalize">{profile?.role} Account {profile?.role === 'student' && `• ${profile?.courseName} Sem ${profile?.semester}`}</p>
                
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                )}
                
                {isEditing && (
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      // Reset fields to original profile values
                      setName(profile?.name || '');
                      setPhoneNumber(profile?.phoneNumber || '');
                      setRealEmail(profile?.realEmail || '');
                      setSemester(profile?.semester || '');
                      setCourseId(profile?.courseId || '');
                      setAvatarUrl(profile?.avatarUrl || '');
                    }}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Editing
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                {profile?.role === 'student' && (
                  <button 
                    onClick={() => navigate('/attendance/scan')}
                    className="flex items-center gap-2 px-4 py-2 bg-wa-teal text-white rounded-xl font-bold text-sm shadow-lg shadow-wa-teal/20 hover:bg-wa-teal-dark transition-all"
                  >
                    <QrCode className="w-4 h-4" /> Scan Attendance
                  </button>
                )}
                {profile?.role === 'student' && profile?.studentId && (
                  <div className="bg-wa-teal/5 dark:bg-wa-teal/10 px-4 py-2 rounded-xl border border-wa-teal/10 flex items-center gap-3">
                    <div>
                      <p className="text-xs  font-bold text-wa-teal dark:text-wa-green">Student ID</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">{profile.studentId}</p>
                    </div>
                    <button onClick={copyStudentId} className="text-wa-teal dark:text-wa-green hover:bg-wa-teal/10 p-1.5 rounded-lg transition-colors">
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
                    disabled={!isEditing}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
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
                    maxLength={10}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) setPhoneNumber(val);
                    }}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {phoneNumber.length}/10 digits
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" /> Real Email (Gmail)
                  </label>
                  <input 
                    type="email" 
                    disabled={!isEditing}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                    placeholder="student@gmail.com"
                    value={realEmail}
                    onChange={(e) => setRealEmail(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">
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
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-wa-teal outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      disabled={!isEditing || (profile?.role === 'student' && !!profile?.semester)}
                    >
                      <option value="">Select Semester</option>
                      {[1,2,3,4,5,6].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {profile?.role === 'student' && !!profile?.semester && (
                      <p className="text-xs text-wa-teal dark:text-wa-green font-bold flex items-center gap-1 mt-1">
                        <Lock className="w-3 h-3" /> Locked. Contact teacher to change.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-[#8696a0] flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-[#8696a0]" /> Department
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-wa-teal outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed "
                      placeholder="e.g. BCA, MCA, B.Tech"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value.toUpperCase())}
                      disabled={!isEditing || (profile?.role === 'student' && (!!profile?.courseId || !!profile?.department || !!profile?.courseName))}
                    />
                    {profile?.role === 'student' && (!!profile?.courseId || !!profile?.department || !!profile?.courseName) ? (
                      <p className="text-xs text-wa-teal dark:text-wa-green font-bold flex items-center gap-1 mt-1">
                        <Lock className="w-3 h-3" /> Locked. Contact teacher to change.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-[#8696a0]">Update your Department (e.g. "bca") if it says "legacy"</p>
                    )}
                    </div>
                  </>
                )}
              </div>

              {isEditing && (
                <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-wa-teal hover:bg-wa-teal-dark text-white font-bold py-4 rounded-2xl shadow-lg shadow-wa-teal/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Changes</>}
                  </button>
                </div>
              )}
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-wa-teal" /> Change Password
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
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-mono font-bold text-slate-900 dark:text-white tracking-normal text-center">
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
