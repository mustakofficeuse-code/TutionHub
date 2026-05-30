import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  Shield, 
  Copy, 
  Check, 
  Calendar, 
  Hash,
  Activity,
  Award,
  Lock,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userData?: any | null;
}

export default function UserProfileModal({ isOpen, onClose, userId, userData }: UserProfileModalProps) {
  const { profile: currentUserProfile } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<boolean>(false);
  const [fetchedUserData, setFetchedUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFetchedUserData(null);
      setLoading(false);
      return;
    }

    if (userData) {
      setFetchedUserData(userData);
      return;
    }

    if (userId) {
      setLoading(true);
      const docRef = doc(db, 'users', userId);
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setFetchedUserData({ uid: docSnap.id, ...docSnap.data() });
          } else {
            setFetchedUserData(null);
          }
        })
        .catch((err) => {
          console.error("Error fetching user profile:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [userId, userData, isOpen]);

  // Determine which profile target to show
  // If we had a specific userId or userData, show fetchedUserData (if resolved)
  // Otherwise default to the current logged-in user profile
  const displayProfile = userData || userId ? fetchedUserData : currentUserProfile;

  const isOwnProfile = displayProfile && currentUserProfile && (
    displayProfile.uid === currentUserProfile.uid || 
    displayProfile.id === currentUserProfile.uid
  );

  useEffect(() => {
    if (isOpen && isOwnProfile) {
      onClose();
    }
  }, [isOpen, isOwnProfile, onClose]);

  if (!isOpen || isOwnProfile) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'teacher':
        return 'bg-wa-teal/10 text-wa-teal dark:text-wa-green border-wa-teal/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Active Member';
      return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Active Member';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md select-none">
          {/* Backdrop Click */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full sm:w-[480px] h-full sm:h-auto max-h-full sm:max-h-[90vh] bg-white dark:bg-[#111b21] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-white/5"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-wa-teal dark:bg-[#202c33] text-white flex justify-between items-center shrink-0 border-b border-wa-teal/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg tracking-tight">Identity Profile</h3>
                  <p className="text-xs text-white/70 font-medium">All about your TuitionHub credentials</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin flex flex-col min-h-0">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-10 h-10 text-wa-teal dark:text-wa-green animate-spin" />
                  <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Fetching Credentials...</p>
                </div>
              ) : !displayProfile ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div className="p-4 bg-red-500/10 text-red-500 rounded-full">
                    <User className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Profile details are unavailable.</p>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    This user might be registered externally or the session lookup resulted in an empty identity scope.
                  </p>
                </div>
              ) : (
                <>
                  {/* Profile Avatar section */}
                  <div className="flex flex-col items-center text-center pb-2">
                    <div 
                      onClick={() => displayProfile.avatarUrl && setZoomedImage(true)}
                      className={`relative w-28 h-28 rounded-full shadow-lg border-4 border-slate-50 dark:border-[#202c33] overflow-hidden bg-slate-100 dark:bg-slate-850 flex items-center justify-center ${displayProfile.avatarUrl ? 'cursor-zoom-in hover:scale-105 duration-300 transition-transform' : ''}`}
                    >
                      {displayProfile.avatarUrl ? (
                        <img 
                          src={displayProfile.avatarUrl} 
                          alt="Profile Avatar" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-3xl font-extrabold text-slate-500 dark:text-slate-400 capitalize">
                          {displayProfile.name ? displayProfile.name.charAt(0) : 'U'}
                        </div>
                      )}
                      {displayProfile.avatarUrl && (
                        <div className="absolute inset-x-0 bottom-0 py-0.5 bg-black/40 text-[8px] font-bold uppercase tracking-wider text-white select-none">
                          Zoom
                        </div>
                      )}
                    </div>

                    <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-4 leading-snug">
                      {displayProfile.name || 'Anonymous User'}
                    </h4>
                    
                    <span className={`mt-2.5 inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold tracking-wider uppercase border rounded-full ${getRoleBadgeColor(displayProfile.role)}`}>
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      {displayProfile.role || 'Guest'} ACCOUNT
                    </span>
                  </div>

                  {/* Detail fields grouped */}
                  <div className="space-y-3.5">
                    <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1">
                      System Attributes
                    </p>

                    {/* Database UID Field */}
                    {displayProfile.uid && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex justify-between items-center group transition-all hover:bg-slate-100/30 dark:hover:bg-[#202c33]/60">
                        <div className="min-w-0 flex-1 pr-3">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Account UID</span>
                          <span className="font-mono text-xs text-slate-800 dark:text-slate-200 block truncate font-medium">
                            {displayProfile.uid}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleCopy(displayProfile.uid, 'uid')}
                          className="p-2 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 rounded-xl hover:text-wa-teal dark:hover:text-wa-green transition-all shadow-sm shrink-0"
                          title="Copy UID"
                        >
                          {copiedKey === 'uid' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {/* Email Field */}
                    {displayProfile.email && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex justify-between items-center group transition-all hover:bg-slate-100/30 dark:hover:bg-[#202c33]/60">
                        <div className="min-w-0 flex-1 pr-2 flex gap-3 items-center">
                          <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Primary email address</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 block truncate font-bold">
                              {displayProfile.email}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(displayProfile.email, 'email')}
                          className="p-2 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 rounded-xl hover:text-wa-teal dark:hover:text-wa-green transition-all shadow-sm shrink-0"
                        >
                          {copiedKey === 'email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {/* Secondary/Real Email Field */}
                    {displayProfile.realEmail && displayProfile.realEmail !== displayProfile.email && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex justify-between items-center group transition-all hover:bg-slate-100/30 dark:hover:bg-[#202c33]/60">
                        <div className="min-w-0 flex-1 pr-2 flex gap-3 items-center">
                          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Contact address (real email)</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 block truncate font-bold">
                              {displayProfile.realEmail}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(displayProfile.realEmail, 'realEmail')}
                          className="p-2 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 rounded-xl hover:text-wa-teal dark:hover:text-wa-green transition-all shadow-sm shrink-0"
                        >
                          {copiedKey === 'realEmail' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {/* Phone Field */}
                    {displayProfile.phoneNumber && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex justify-between items-center group transition-all hover:bg-slate-100/30 dark:hover:bg-[#202c33]/60">
                        <div className="min-w-0 flex-1 pr-2 flex gap-3 items-center">
                          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Verified number</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 block font-bold">
                              {displayProfile.phoneNumber}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(displayProfile.phoneNumber, 'phone')}
                          className="p-2 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 rounded-xl hover:text-wa-teal dark:hover:text-wa-green transition-all shadow-sm shrink-0"
                        >
                          {copiedKey === 'phone' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {/* Course Study Field */}
                    {(displayProfile.courseName || displayProfile.department) && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex gap-3 items-center">
                        <div className="p-2 bg-violet-500/10 text-violet-500 rounded-xl shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Faculty / Course</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200 block font-bold leading-none mt-0.5">
                            {displayProfile.courseName || displayProfile.department} ({displayProfile.courseId || 'N/A'})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Semester Field */}
                    {displayProfile.semester && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex gap-3 items-center">
                        <div className="p-2 bg-pink-500/10 text-pink-500 rounded-xl shrink-0">
                          <Hash className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Study semester (grade tier)</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200 block font-bold leading-none mt-0.5">
                            Semester {displayProfile.semester}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Student specific fields */}
                    {displayProfile.role === 'student' && displayProfile.studentId && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex gap-3 items-center">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Unique registration ID</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200 block font-mono font-bold leading-none mt-0.5">
                            {displayProfile.studentId}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Registration Date */}
                    {displayProfile.createdAt && (
                      <div className="p-3 bg-slate-50 dark:bg-[#202c33]/40 rounded-2xl border border-slate-100/50 dark:border-white/5 flex gap-3 items-center">
                        <div className="p-2 bg-teal-550/10 dark:bg-[#00a884]/12 text-wa-teal dark:text-[#00a884] rounded-xl shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Enrolled on</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200 block font-bold leading-none mt-0.5">
                            {formatDate(displayProfile.createdAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Backdrop visual signature */}
            <div className="p-5 bg-slate-50 dark:bg-[#1f2c34] flex items-center justify-center gap-1.5 shrink-0 border-t border-slate-150 dark:border-white/5">
              <Activity className="w-3.5 h-3.5 text-wa-teal dark:text-wa-green" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                TUITIONHUB ONLINE VERIFIED SECURITY
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Profile Zoom Lightbox */}
      {zoomedImage && displayProfile && displayProfile.avatarUrl && (
        <div 
          className="fixed inset-0 z-[3200] bg-black/95 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setZoomedImage(false)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all focus:outline-none"
            onClick={() => setZoomedImage(false)}
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={displayProfile.avatarUrl} 
            alt="Expanded Avatar" 
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl animate-[scaleIn_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </AnimatePresence>
  );
}

