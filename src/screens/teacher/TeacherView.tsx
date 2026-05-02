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
    <div className="fixed inset-0 bg-wa-bg dark:bg-wa-bg-dark overflow-hidden flex flex-col">
      {/* WhatsApp Header */}
      <header className="bg-wa-teal dark:bg-wa-header text-white pt-2 px-4 shadow-lg z-[60]">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TuitionHub</h1>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button 
              onClick={() => setShowNotifications(true)}
              className="relative hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-wa-green text-[10px] font-bold flex items-center justify-center rounded-full text-white ring-2 ring-wa-teal dark:ring-wa-header">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={toggleTheme}
              className="hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[600px] bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-wa-teal dark:bg-wa-header flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <h3 className="font-bold">Notifications</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleClearNotifications}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#f0f2f5] dark:bg-[#0b141a]">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-slate-500">No new notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-3 bg-white dark:bg-[#202c33] rounded-lg shadow-sm border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{notif.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-2">{notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString() : new Date(notif.createdAt).toLocaleTimeString()}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 relative bg-wa-bg dark:bg-wa-bg-dark">
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

      {/* Bottom Nav for quick access */}
      <footer className="bg-white dark:bg-wa-header border-t border-slate-200 dark:border-slate-800 px-6 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex justify-center gap-4 sm:gap-8 items-center">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => changeTab(index)}
              className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 relative group rounded-2xl transition-all ${
                activeTab === index 
                  ? 'text-wa-teal dark:text-wa-green bg-wa-teal/10 dark:bg-wa-green/10' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${activeTab === index ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              
              {/* Tooltip on Hover */}
              <span className="absolute -top-12 scale-0 group-hover:scale-100 transition-transform origin-bottom bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-xl z-50 whitespace-nowrap pointer-events-none">
                {tab.label}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45"></div>
              </span>

              {activeTab === index && (
                <motion.div 
                  layoutId="nav-indicator-teacher"
                  className="absolute -bottom-3 w-1.5 h-1.5 bg-wa-teal dark:bg-wa-green rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
