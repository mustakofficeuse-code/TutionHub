import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
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
  Loader2,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, query, where, onSnapshot, limit, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import TeacherDashboard from './Dashboard';
import MaterialManager from './MaterialManager';
import DoubtSection from '../shared/DoubtSection';
import TeacherAnalytics from './Analytics';
import FeeManagement from './FeeManagement';
import Profile from '../shared/Profile';
import AttendanceGenerator from './AttendanceGenerator';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, component: TeacherDashboard },
  { id: 'attendance', label: 'Attendance', icon: QrCode, component: AttendanceGenerator },
  { id: 'materials', label: 'Materials', icon: BookOpen, component: MaterialManager },
  { id: 'doubts', label: 'Doubts', icon: MessageSquare, component: DoubtSection },
  { id: 'stats', label: 'Stats', icon: TrendingUp, component: TeacherAnalytics },
  { id: 'fees', label: 'Fees', icon: CreditCard, component: FeeManagement },
  { id: 'profile', label: 'Profile', icon: User, component: Profile },
];

export default function TeacherView() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab ] = useState(0);
  const [direction, setDirection] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isClearingNotifs, setIsClearingNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      where('targetRole', 'in', ['teacher', 'admin', 'ALL']), 
      limit(50)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(list.slice(0, 20));
    });
    return unsub;
  }, []);

  const handleClearNotifications = async () => {
    if (!notifications.length) return;
    setIsClearingNotifs(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        batch.delete(doc(db, 'notifications', notif.id));
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
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col">
      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-full sm:w-[400px] h-full sm:h-auto sm:max-h-[600px] bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-600 sm:rounded-t-[2.5rem] text-white">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <h3 className="font-black tracking-tight text-white">Notifications</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleClearNotifications}
                    disabled={isClearingNotifs || notifications.length === 0}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 disabled:opacity-50"
                  >
                    {isClearingNotifs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Clear
                  </button>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-1 ${notif.type === 'schedule' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                          {notif.type === 'schedule' ? <Clock className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">{notif.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{notif.message}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(notif.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-slate-200 dark:shadow-none active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden">
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
            className="absolute inset-0 overflow-y-auto no-scrollbar scroll-smooth"
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
      </div>

      {/* Static Footer Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-3 flex justify-between items-center z-50 transition-colors safe-area-bottom shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
        {/* Desktop and Tablet: Show TABS + Admin button if role permits */}
        <div className="flex w-full justify-between items-center px-4">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => changeTab(index)}
              className={`flex-1 flex flex-col items-center gap-1 transition-all duration-300 ${
                activeTab === index 
                  ? 'text-blue-600 dark:text-blue-400 scale-105' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === index ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-bold tracking-tight ${activeTab === index ? 'opacity-100' : 'opacity-70'}`}>{tab.label}</span>
              {activeTab === index && (
                <motion.div 
                  layoutId="nav-teacher-indicator"
                  className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
          ))}
          
          {/* Hide this on small screens as requested, it's now in the Top Nav for mobile */}
          {(profile?.role === 'admin' || profile?.role === 'teacher') && (
            <button 
              onClick={() => window.location.href = '/admin'}
              className="hidden sm:flex flex-1 flex-col items-center gap-1 text-indigo-600 dark:text-indigo-400"
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-tight">Admin</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
