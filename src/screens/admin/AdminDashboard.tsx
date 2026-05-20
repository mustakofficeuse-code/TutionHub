import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, setDoc, writeBatch, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  Settings, 
  ArrowLeft, 
  Loader2, 
  Search, 
  Filter,
  MoreVertical,
  Trash2,
  UserCheck,
  UserX,
  UserPlus,
  Phone,
  Mail,
  Moon,
  Sun,
  LayoutDashboard,
  X
} from 'lucide-react';

export default function AdminDashboard({ isEmbedded, onTabChange }: { isEmbedded?: boolean, onTabChange?: (id: string) => void }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistDocs, setBlacklistDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [userToBlock, setUserToBlock] = useState<any | null>(null);
  const [userToUnblock, setUserToUnblock] = useState<any | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string, id: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchBlacklist();
  }, []);

  const fetchBlacklist = async () => {
    try {
      const q = query(collection(db, 'blacklist'));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBlacklistDocs(docs);
      setBlacklist(docs.map(d => d.id));
    } catch (error) {
      console.error("Error fetching blacklist:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // Delete from users (multiple possible docs if indexing is weird, but usually 1)
      const q = query(collection(db, 'users'), where('email', '==', userToDelete.email));
      const snap = await getDocs(q);
      snap.docs.forEach(d => batch.delete(doc(db, 'users', d.id)));
      
      // Also delete from blacklist if it's a block list permanent delete
      batch.delete(doc(db, 'blacklist', userToDelete.email));
      if (userToDelete.phoneNumber) batch.delete(doc(db, 'blacklist_phones', userToDelete.phoneNumber));
      if (userToDelete.realEmail) batch.delete(doc(db, 'blacklist_emails', userToDelete.realEmail.toLowerCase()));
      
      await batch.commit();
      fetchUsers();
      fetchBlacklist();
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFactoryReset = async () => {
    setIsResetting(true);
    try {
      const collectionsToWipe = ['users', 'blacklist', 'assignments', 'schedules', 'quizzes', 'materials', 'doubts', 'payments', 'attendance', 'notifications', 'config'];
      for (const colName of collectionsToWipe) {
        const querySnapshot = await getDocs(query(collection(db, colName)));
        for (const document of querySnapshot.docs) {
           await deleteDoc(doc(db, colName, document.id));
        }
      }
      setShowResetConfirm(false);
      window.location.href = '/'; // Redirect to start setup again
    } catch (error) {
      console.error("Error resetting database:", error);
      alert("Failed to reset the database. See console for details.");
    } finally {
      setIsResetting(false);
    }
  };

  const toggleBlock = async (user: any, currentlyBlocked: boolean) => {
    const email = user.email || user.id;
    if (!email) {
      alert("User email is missing.");
      return;
    }
    try {
      const batch = writeBatch(db);
      const blacklistRef = doc(db, 'blacklist', email);
      
      if (currentlyBlocked) {
        batch.delete(blacklistRef);
        if (user.phoneNumber) batch.delete(doc(db, 'blacklist_phones', user.phoneNumber));
        if (user.realEmail) batch.delete(doc(db, 'blacklist_emails', user.realEmail.toLowerCase()));
      } else {
        const blockData = {
          email: email,
          phoneNumber: user.phoneNumber || null,
          realEmail: user.realEmail || null,
          name: user.name || 'Unknown User',
          blockedAt: new Date().toISOString(),
          reason: 'Blocked by admin'
        };
        batch.set(blacklistRef, blockData);
        if (user.phoneNumber) batch.set(doc(db, 'blacklist_phones', user.phoneNumber), { blocked: true, userId: user.id });
        if (user.realEmail) batch.set(doc(db, 'blacklist_emails', user.realEmail.toLowerCase()), { blocked: true, userId: user.id });
      }
      
      await batch.commit();
      setSuccessMessage(currentlyBlocked ? "User unblocked successfully" : "User suspended successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBlacklist();
      await fetchUsers(); // Refresh main list too
    } catch (error: any) {
      console.error("Error toggling block status:", error);
      alert(`Failed to update block status: ${error.message || 'Missing or insufficient permissions.'}`);
    }
  };

  const [filter, setFilter] = useState<'all' | 'blocked'>('all');

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && !blacklist.includes(u.email);
  });

  const blockedUsers = users.filter(u => blacklist.includes(u.email));

  return (
    <div className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] transition-colors font-sans ${isEmbedded ? 'pb-24 pt-12' : ''}`}>
      {!isEmbedded && (
        <nav className="bg-white dark:bg-[#202c33] border-b border-slate-100 dark:border-white/5 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50 transition-colors shadow-sm">
          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={() => navigate('/')}
              className="p-3 hover:bg-[#f0f2f5] dark:hover:bg-[#111b21] rounded-2xl transition-all active:scale-95 text-[#8696a0] hover:text-wa-teal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/10 shadow-lg bg-white/5">
                <img src="/logo.png" alt="TuitionHub Logo" className="w-full h-full object-cover hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-[#e9edef] leading-tight tracking-normal">Access <span className="text-wa-teal">Control</span></h1>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Root Authority</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="w-11 h-11 rounded-2xl bg-[#f0f2f5] dark:bg-[#111b21] text-[#8696a0] hover:text-wa-teal transition-all flex items-center justify-center border border-transparent hover:border-wa-teal/20"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-4 pl-4 border-l border-slate-100 dark:border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">{profile?.name}</p>
                <p className="text-xs font-bold text-wa-teal  tracking-normal leading-none mt-1">System Core</p>
              </div>
              <div 
                onClick={() => {
                  if (isEmbedded && onTabChange) onTabChange('profile');
                  else navigate('/profile');
                }}
                className="w-11 h-11 rounded-2xl bg-wa-teal/10 p-1 cursor-pointer shadow-inner border border-slate-100 dark:border-white/10 group"
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover rounded-xl group-hover:rotate-3 transition-transform" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-wa-teal font-bold text-xl">
                    {profile?.name?.charAt(0) || 'A'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto p-4 sm:p-5 sm:p-5 sm:p-6 space-y-2 sm:space-y-4 sm:space-y-8">
        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 group-hover:scale-110 transition-transform">
              <Users className="w-16 h-16 text-wa-teal" />
            </div>
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 bg-wa-teal/10 rounded-2xl flex items-center justify-center text-wa-teal">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Total Students</h3>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal relative z-10">{users.filter(u => u.role === 'student').length}</p>
          </div>
          
          <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 group-hover:scale-110 transition-transform">
              <UserCheck className="w-16 h-16 text-wa-green" />
            </div>
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 bg-wa-green/10 rounded-2xl flex items-center justify-center text-wa-green">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Teachers</h3>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal relative z-10">
              {users.filter(u => u.role === 'teacher').length}
            </p>
          </div>

          <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 group-hover:scale-110 transition-transform">
              <UserX className="w-16 h-16 text-orange-500" />
            </div>
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Suspended</h3>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal relative z-10">{blacklistDocs.length}</p>
          </div>

          <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-[#8696a0]  tracking-normal">Danger Zone</h3>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-[1.5rem] text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Factory Reset
            </button>
          </div>
        </div>

        {/* Blocks List Section - MOVED HERE */}
        <div className="bg-white dark:bg-[#202c33] rounded-3xl shadow-sm border border-slate-50 dark:border-white/5 overflow-hidden">
          <div className="p-4 sm:p-6 sm:p-10 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-[#f0f2f5]/50 dark:bg-slate-800/10">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-normal">
                <UserX className="w-6 h-6 text-red-500" /> Blacklist / Suspended
              </h2>
              <p className="text-xs font-bold text-[#8696a0]  tracking-normal mt-2">Manage Suspended Users</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
              {blacklistDocs.length === 0 ? (
                <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-50 dark:border-white/5 rounded-3xl">
                  <p className="text-xs font-bold text-[#8696a0]  tracking-normal">No suspended users found</p>
                </div>
              ) : (
                blacklistDocs.map((user) => (
                  <div key={user.id} className="group flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl border bg-red-50/10 dark:bg-red-900/5 border-red-100/50 dark:border-red-900/20 gap-3 sm:gap-6 transition-all hover:bg-red-50/20 dark:hover:bg-red-900/10">
                    <div className="flex items-center gap-3 sm:gap-6">
                      <motion.button 
                        layoutId={`avatar-${user.id}`}
                        onClick={() => user.avatarUrl && setZoomedImage({ url: user.avatarUrl, id: user.id })}
                        className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center overflow-hidden border-2 transition-all group-hover:rotate-3 shadow-inner ${user.avatarUrl ? 'bg-[#f0f2f5] border-white dark:bg-slate-800 dark:border-slate-800 cursor-zoom-in' : 'bg-red-100 dark:bg-red-900/40 text-red-500 border-red-100 dark:border-red-900/40'}`}
                        title={user.avatarUrl ? "Click to zoom" : "Blocked User"}
                      >
                        {user.avatarUrl ? (
                          <motion.img 
                            layoutId={`image-${user.id}`}
                            src={user.avatarUrl} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <UserX className="w-8 h-8" />
                        )}
                      </motion.button>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">{user.name}</p>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-800 text-[#8696a0]  tracking-normal border border-slate-100 dark:border-white/10 shadow-sm">
                            {user.role}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-[#8696a0] font-bold  tracking-normal">ID: {user.email}</p>
                          {user.phoneNumber && (
                            <div className="flex items-center gap-2 text-wa-teal font-bold text-xs  tracking-normal leading-none">
                              <Phone className="w-3 h-3" /> {user.phoneNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button 
                        onClick={() => setUserToUnblock(user)}
                        className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-2xl border border-wa-green/20 hover:bg-wa-green hover:text-white transition-all flex items-center justify-center shadow-lg shadow-wa-green/10 active:scale-90"
                        title="Unblock User"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setUserToDelete(user)}
                        className="w-12 h-12 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-90"
                        title="Delete User"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="bg-white dark:bg-[#202c33] rounded-3xl shadow-sm border border-slate-50 dark:border-white/5 overflow-hidden">
          <div className="p-4 sm:p-6 sm:p-10 border-b border-slate-50 dark:border-white/5 flex flex-col lg:flex-row justify-between items-center gap-5 sm:gap-4 sm:gap-8 bg-[#f0f2f5]/50 dark:bg-slate-800/10">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal">User Register</h2>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal mt-2">All authenticated system users</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <button 
                onClick={() => navigate('/admin/students/add')}
                className="bg-wa-teal hover:bg-wa-teal-dark text-white px-5 sm:px-8 py-4 rounded-[1.5rem] text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 flex items-center justify-center gap-3 transition-all shadow-lg shadow-wa-teal/20 active:scale-95"
              >
                <UserPlus className="w-4 h-4" /> Add Student
              </button>
              <div className="relative w-full sm:w-80 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8696a0] w-4 h-4 group-focus-within:text-wa-teal transition-colors" />
                <input 
                  type="text" 
                  placeholder="SEARCH..."
                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-[1.5rem] text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-900 dark:text-[#e9edef] focus:ring-2 focus:ring-wa-teal outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto"><table className="w-full min-w-max text-left">
              <thead>
                <tr className="bg-[#f0f2f5]/30 dark:bg-slate-800/20 text-slate-600 dark:text-slate-300 text-sm font-bold tracking-normal">
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 text-nowrap">User Name</th>
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 text-nowrap">Role</th>
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 text-nowrap">Department / Semester</th>
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 text-nowrap">Call</th>
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 text-nowrap">Joined date</th>
                  <th className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 text-right border-b border-slate-50 dark:border-white/5 text-nowrap sticky right-0 bg-[#f0f2f5]/30 dark:bg-[#111b21] z-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 sm:px-10 py-20 text-center">
                      <Loader2 className="w-12 h-12 text-wa-teal animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 sm:px-10 py-20 text-center">
                      <p className="text-xs font-bold text-[#8696a0]  tracking-normal leading-relaxed">No users match your query parameters</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors group">
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 whitespace-nowrap">
                        <div className="flex items-center gap-3 sm:gap-6">
                          <motion.button 
                            layoutId={`avatar-${user.id}`}
                            onClick={() => user.avatarUrl && setZoomedImage({ url: user.avatarUrl, id: user.id })}
                            className="w-12 h-12 bg-[#f0f2f5] dark:bg-[#111b21] rounded-2xl flex items-center justify-center text-[#8696a0] overflow-hidden border border-slate-100 dark:border-white/10 group relative transition-all group-hover:rotate-2 shadow-inner"
                            title={user.avatarUrl ? "Click to zoom" : ""}
                          >
                            {user.avatarUrl ? (
                              <motion.img 
                                layoutId={`image-${user.id}`}
                                src={user.avatarUrl} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <Users className="w-5 h-5" />
                            )}
                          </motion.button>
                          <div className="min-w-0">
                            <p className="text-lg font-bold text-slate-900 dark:text-[#e9edef] tracking-normal truncate leading-tight">
                              {user.name}
                            </p>
                            <p className="text-xs font-bold text-wa-teal  tracking-normal truncate mt-0.5 opacity-80">
                              {user.realEmail || user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 ${
                          user.role === 'admin' 
                            ? 'bg-wa-teal/10 text-wa-teal border border-wa-teal/20' 
                            : user.role === 'teacher'
                            ? 'bg-wa-green/10 text-wa-green border border-wa-green/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-[#8696a0] border border-transparent'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 text-nowrap">
                        {user.role === 'student' ? (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-bold text-slate-700 dark:text-[#e9edef]  tracking-normal">{user.department || user.courseName || user.courseId || '-'}</p>
                            <p className="text-xs font-bold text-[#8696a0]  tracking-normal">Sem {user.semester || '-'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-200 dark:text-slate-800 tracking-normal">---</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 text-nowrap">
                        {user.phoneNumber ? (
                          <a 
                            href={`tel:${user.phoneNumber}`}
                            className="flex items-center gap-2 text-wa-teal dark:text-wa-green hover:underline font-bold text-[11px]  tracking-normal"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {user.phoneNumber}
                          </a>
                        ) : (
                          <p className="text-[#8696a0]/40 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">Offline</p>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 text-[11px] text-[#8696a0] font-bold  tracking-normal whitespace-nowrap">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 sm:px-10 py-4 sm:py-6 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#202c33] z-10 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/10 shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-end gap-3 transition-all">
                           <button
                            onClick={() => setUserToBlock(user)}
                            className="w-10 h-10 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-90"
                            title="Suspend User"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="w-10 h-10 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-90"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
        </div>

      </main>
      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[210] bg-wa-green text-white px-4 sm:px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-3"
          >
            <UserCheck className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/5 text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-8 mx-auto shadow-inner">
              <Trash2 className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal mb-4">Delete User?</h3>
            <p className="text-[#8696a0] font-semibold text-sm leading-relaxed mb-4 sm:mb-6 sm:mb-10">
              Are you sure you want to permanently delete <span className="text-slate-900 dark:text-[#e9edef] font-bold">{userToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={deleteUser}
                disabled={isDeleting}
                className="w-full py-4 bg-red-500 text-white font-bold  tracking-normal text-xs rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete User'}
              </button>
              <button 
                onClick={() => setUserToDelete(null)}
                className="w-full py-4 text-[#8696a0] font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {userToBlock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/5 text-center">
            <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-4 sm:mb-8 mx-auto shadow-inner">
              <UserX className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal mb-4">Suspend User?</h3>
            <p className="text-[#8696a0] font-semibold text-sm leading-relaxed mb-4 sm:mb-6 sm:mb-10">
              Suspend <span className="text-slate-900 dark:text-[#e9edef] font-bold">{userToBlock.name}</span>? They will no longer be able to log in.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  toggleBlock(userToBlock, false);
                  setUserToBlock(null);
                }}
                className="w-full py-4 bg-orange-500 text-white font-bold  tracking-normal text-xs rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
              >
                Suspend User
              </button>
              <button
                onClick={() => setUserToBlock(null)}
                className="w-full py-4 text-[#8696a0] font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Confirmation Modal */}
      {userToUnblock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/5 text-center">
            <div className="w-20 h-20 bg-wa-green/10 rounded-2xl flex items-center justify-center mb-4 sm:mb-8 mx-auto shadow-inner">
              <UserCheck className="w-10 h-10 text-wa-green" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal mb-4">Unblock User?</h3>
            <p className="text-[#8696a0] font-semibold text-sm leading-relaxed mb-4 sm:mb-6 sm:mb-10">
              Unblock <span className="text-slate-900 dark:text-[#e9edef] font-bold">{userToUnblock.name}</span>? They will be able to log in again.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  await toggleBlock(userToUnblock, true);
                  setUserToUnblock(null);
                }}
                className="w-full py-4 bg-wa-green text-white font-bold  tracking-normal text-xs rounded-2xl hover:bg-wa-green-dark transition-all shadow-lg shadow-wa-green/20 active:scale-95"
              >
                Unblock User
              </button>
              <button
                onClick={() => setUserToUnblock(null)}
                className="w-full py-4 text-[#8696a0] font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[300] p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              layoutId={`avatar-${zoomedImage.id}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-xl w-full aspect-square rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img 
                layoutId={`image-${zoomedImage.id}`}
                src={zoomedImage.url} 
                alt="Zoomed DP" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-6 right-6 w-12 h-12 bg-black/50 hover:bg-wa-teal backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all shadow-lg border border-white/5"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Factory Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-white/5 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mb-4 sm:mb-8 mx-auto shadow-inner">
              <Trash2 className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-[#e9edef] tracking-normal mb-4">FACTORY RESET?</h3>
            <p className="text-[#8696a0] font-semibold text-sm leading-relaxed mb-4 sm:mb-6 sm:mb-10">
              WARNING: This will irreversibly delete ALL users, teachers, payments, assignments, and config from Firebase. The system will be empty.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleFactoryReset}
                disabled={isResetting}
                className="w-full py-4 bg-red-600 text-white font-bold  tracking-normal text-xs rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Reset'}
              </button>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-4 text-[#8696a0] font-bold  tracking-normal text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
