import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  CreditCard, 
  User,
  Shield,
  QrCode,
  Bell,
  Moon,
  Sun,
  X,
  Trash2,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { subscribeToNotifications, markAsRead, deleteNotification, Notification } from '../../services/notificationService';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import TeacherDashboard from './Dashboard';
import MaterialManager from './MaterialManager';
import DoubtSection from '../shared/DoubtSection';
import TeacherAnalytics from './Analytics';
import FeeManagement from './FeeManagement';
import Profile from '../shared/Profile';
import AttendanceGenerator from './AttendanceGenerator';
import AdminDashboard from '../admin/AdminDashboard';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: Home, component: TeacherDashboard },
  { id: 'attendance', label: 'Attendance', icon: QrCode, component: AttendanceGenerator },
  { id: 'materials', label: 'Materials', icon: BookOpen, component: MaterialManager },
  { id: 'doubts', label: 'Doubts', icon: MessageSquare, component: DoubtSection },
  { id: 'stats', label: 'Stats', icon: TrendingUp, component: TeacherAnalytics },
  { id: 'fees', label: 'Fees', icon: CreditCard, component: FeeManagement },
  { id: 'admin', label: 'Admin', icon: Shield, component: AdminDashboard },
  { id: 'profile', label: 'Profile', icon: User, component: Profile },
];

export default function TeacherView() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab ] = useState(0);
  const [direction, setDirection] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isClearingNotifs, setIsClearingNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToNotifications(profile.uid, 'teacher', (list) => {
        setNotifications(list);
    });
    return () => unsub();
  }, [profile]);

  const handleClearNotifications = async () => {
    if (!notifications.length) return;
    setIsClearingNotifs(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        if(notif.id) batch.delete(doc(db, 'notifications', notif.id));
      });
      await batch.commit();
      setShowNotifications(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearingNotifs(false);
    }
  };

  const changeTab = (newIndex: number) => {
    setDirection(newIndex > activeTab ? 1 : -1);
    setActiveTab(newIndex);
  };

  // Swipe logic
  const handleDragEnd = (event: any, info: any) => {
    const threshold = 50;
    if (info.offset.x < -threshold && activeTab < TABS.length - 1) {
      changeTab(activeTab + 1);
    } else if (info.offset.x > threshold && activeTab > 0) {
      changeTab(activeTab - 1);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] dark:bg-[#111b21] overflow-hidden flex flex-col font-sans">
      {/* WhatsApp Header */}
      <header className="bg-wa-teal dark:bg-[#202c33] text-white pt-2 px-6 shadow-lg z-[60] border-b border-wa-teal/10">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10 group">
              <GraduationCap className="text-white w-6 h-6 group-hover:rotate-12 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal leading-none  italic">Tuition<span className="text-wa-green">Hub</span></h1>
              <p className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-white/60 mt-1.5 ml-0.5">Faculty Protocol</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowNotifications(true)}
              className="relative w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95 border border-white/5"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-wa-green text-xs font-bold flex items-center justify-center rounded-full text-white ring-4 ring-wa-teal dark:ring-[#202c33] animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={toggleTheme}
              className="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95 border border-white/5"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-0 sm:p-6 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-full sm:w-[450px] h-full sm:h-auto sm:max-h-[85vh] bg-[#f0f2f5] dark:bg-[#111b21] sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-white/5"
            >
              <div className="p-5 sm:p-5 sm:p-6 bg-wa-teal dark:bg-[#202c33] flex justify-between items-center text-white border-b border-wa-teal/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-normal  italic">Bulletin <span className="opacity-70">Feed</span></h3>
                    <p className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 opacity-60 mt-1">System Broadcasts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleClearNotifications}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center text-white"
                    title="Purge All"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="w-10 h-10 bg-white/10 hover:bg-red-500 rounded-xl transition-all flex items-center justify-center text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-[#f0f2f5] dark:bg-slate-800/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Bell className="w-10 h-10 text-[#8696a0]/30" />
                    </div>
                    <p className="text-xs font-bold text-[#8696a0]  tracking-normal">Void frequency detected</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={notif.id} 
                      className={`p-6 rounded-2xl border transition-all cursor-pointer group ${
                        !notif.read 
                          ? 'bg-white dark:bg-[#202c33] border-wa-teal shadow-md' 
                          : 'bg-white/50 dark:bg-slate-800/20 border-transparent hover:bg-white dark:hover:bg-[#202c33]'
                      }`}
                      onClick={() => {
                        markAsRead(notif.id!);
                        setShowNotifications(false);
                        if (['doubt_reply', 'doubt_raised'].includes(notif.type)) {
                           changeTab(3);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-[#e9edef] tracking-normal group-hover:text-wa-teal transition-colors">{notif.title}</h4>
                        <div className="w-2 h-2 rounded-full bg-wa-teal" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                        {notif.isAnonymous ? notif.message.replace(notif.senderName, 'A student') : notif.message}
                      </p>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50 dark:border-white/5">
                        <p className="text-xs font-bold text-wa-teal  tracking-normal leading-none">{notif.type.replace('_', ' ')}</p>
                        <p className="text-xs font-bold text-[#8696a0]  tracking-normal flex items-center gap-1.5 leading-none">
                          {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 relative bg-[#f0f2f5] dark:bg-[#111b21]">
        {/* WhatsApp-style Floating Action Button if needed, but components handle their own UI */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={activeTab}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 overflow-y-auto no-scrollbar"
          >
            {(() => {
              const Component = TABS[activeTab].component;
              return <Component isEmbedded onTabChange={(id: string) => {
                const index = TABS.findIndex(t => t.id === id);
                if (index !== -1) changeTab(index);
              }} />;
            })()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Static Footer Navigation */}
      <footer className="bg-white dark:bg-[#202c33] border-t border-slate-200 dark:border-white/5 pb-2 pt-1 z-[60]">
        <div className="w-full flex sm:justify-center bg-white dark:bg-[#202c33] overflow-x-auto no-scrollbar items-center px-2 gap-1 sm:gap-4">
        {TABS.map((tab, index) => {
          const isActive = activeTab === index;
          return (
          <button
            key={tab.id}
            onClick={() => changeTab(index)}
            className={`flex flex-col items-center justify-center min-w-[60px] sm:min-w-[80px] py-1 px-2 relative transition-all duration-300 rounded-xl ${
              isActive 
                ? 'text-wa-teal dark:text-wa-green bg-slate-50 dark:bg-slate-800/50' 
                : 'text-slate-500 dark:text-[#8696a0] hover:text-wa-teal hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <tab.icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-wa-teal/20 dark:fill-wa-green/20' : ''}`} />
            
            <span 
              className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-wa-teal dark:text-wa-green font-bold' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {tab.label}
            </span>
          </button>
        )})}
        </div>
      </footer>
    </div>
  );
}
