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
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors ${isEmbedded ? 'pb-24' : ''}`}>
      {!isEmbedded && (
        <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
                <Shield className="text-white w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin <span className="text-indigo-600">Panel</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">System Administrator</p>
              </div>
              <div 
                onClick={() => {
                  if (isEmbedded && onTabChange) onTabChange('profile');
                  else navigate('/profile');
                }}
                className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden cursor-pointer shadow-sm"
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.name?.charAt(0) || 'A'
                )}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Total Users</h3>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{users.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Teachers</h3>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {users.filter(u => u.role === 'teacher').length}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Blocked</h3>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{blacklistDocs.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Danger Zone</h3>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-100 dark:shadow-none"
            >
              Factory Reset
            </button>
          </div>
        </div>

        {/* Blocks List Section - MOVED HERE */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-500" /> Block List
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Users suspended from accessing TuitionHub. Blocking applies to login ID, real email, and phone number.</p>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {blacklistDocs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500">
                  No blocked users.
                </div>
              ) : (
                blacklistDocs.map((user) => (
                  <div key={user.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl border bg-red-50/20 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 gap-4 transition-all hover:shadow-md hover:shadow-red-100 dark:hover:shadow-none">
                    <div className="flex items-center gap-4">
                      <motion.button 
                        layoutId={`avatar-${user.id}`}
                        onClick={() => user.avatarUrl && setZoomedImage({ url: user.avatarUrl, id: user.id })}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border ${user.avatarUrl ? 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-800 group relative cursor-pointer' : 'bg-red-100 dark:bg-red-900/40 text-red-600 border-red-100 dark:border-red-900/20'}`}
                        title={user.avatarUrl ? "Click to zoom" : "Blocked User"}
                      >
                        {user.avatarUrl ? (
                          <>
                            <motion.img 
                              layoutId={`image-${user.id}`}
                              src={user.avatarUrl} 
                              alt="" 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                              referrerPolicy="no-referrer" 
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Search className="w-4 h-4 text-white" />
                            </div>
                          </>
                        ) : (
                          <UserX className="w-6 h-6" />
                        )}
                      </motion.button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize tracking-wider border border-slate-200 dark:border-slate-700 shadow-sm">
                            {user.role || 'Student'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 mt-1.5">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Login ID: {user.email}</p>
                          {user.realEmail && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" /> Real Email: {user.realEmail}
                            </p>
                          )}
                          {user.phoneNumber && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5" /> Phone: {user.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                      <button 
                        onClick={() => setUserToUnblock(user)}
                        className="px-6 py-2.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" /> Unblock
                      </button>
                      <button 
                        onClick={() => setUserToDelete(user)}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Management</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={() => navigate('/admin/students/add')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                <UserPlus className="w-4 h-4" /> Enroll Student
              </button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider text-nowrap">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Dept / Sem</th>
                  <th className="px-6 py-4">Call</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <motion.button 
                            layoutId={`avatar-${user.id}`}
                            onClick={() => user.avatarUrl && setZoomedImage({ url: user.avatarUrl, id: user.id })}
                            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200 dark:border-slate-800 group relative"
                            title={user.avatarUrl ? "Click to zoom" : ""}
                          >
                            {user.avatarUrl ? (
                              <>
                                <motion.img 
                                  layoutId={`image-${user.id}`}
                                  src={user.avatarUrl} 
                                  alt="" 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                  referrerPolicy="no-referrer" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Search className="w-4 h-4 text-white" />
                                </div>
                              </>
                            ) : (
                              <Users className="w-5 h-5" />
                            )}
                          </motion.button>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                              {user.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {user.realEmail || user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'admin' 
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' 
                            : user.role === 'teacher'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'student' ? (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{user.department || user.courseName || user.courseId || '-'}</p>
                            <p className="text-[10px] text-slate-400">Semester {user.semester || '-'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.phoneNumber ? (
                          <a 
                            href={`tel:${user.phoneNumber}`}
                            className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {user.phoneNumber}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">No Phone</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button
                            onClick={() => setUserToBlock(user)}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all"
                            title="Block User"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-3"
          >
            <UserCheck className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Delete User?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{userToDelete.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={deleteUser}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {userToBlock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <UserX className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Block User?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to block <span className="font-bold text-slate-900 dark:text-white">{userToBlock.name}</span>? 
              They will be suspended from accessing the application immediately.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToBlock(null)}
                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  toggleBlock(userToBlock, false);
                  setUserToBlock(null);
                }}
                className="flex-1 px-6 py-4 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-all flex items-center justify-center gap-2 text-sm text-nowrap"
              >
                Suspend Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Confirmation Modal */}
      {userToUnblock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <UserCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Unblock User?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to restore access for <span className="font-bold text-slate-900 dark:text-white">{userToUnblock.name}</span>? 
              They will be able to log in to the application again.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToUnblock(null)}
                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await toggleBlock(userToUnblock, true);
                  setUserToUnblock(null);
                }}
                className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm text-nowrap"
              >
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              layoutId={`avatar-${zoomedImage.id}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-2xl w-full aspect-square rounded-3xl overflow-hidden shadow-2xl"
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
                className="absolute top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all shadow-lg border border-white/20 group"
              >
                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Factory Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">FACTORY RESET?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              This will irreversibly delete ALL users, teachers, payments, assignments, and config from Firebase. 
              The application will return back to its "Teacher Setup" initial state.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleFactoryReset}
                disabled={isResetting}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
