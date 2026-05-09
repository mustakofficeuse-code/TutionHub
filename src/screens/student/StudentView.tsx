import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  CreditCard, 
  User,
  Shield,
  GraduationCap,
  Bell,
  Moon,
  Sun,
  X,
  Trash2,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { signOut } from 'firebase/auth';
import { subscribeToNotifications, markAsRead, deleteNotification, Notification } from '../../services/notificationService';
import { writeBatch, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import Home from './Home';
import Materials from './Materials';
import DoubtSection from '../shared/DoubtSection';
import Analytics from './Analytics';
import PaymentHistory from './PaymentHistory';
import Profile from '../shared/Profile';
import AttendanceScanner from './AttendanceScanner';
import { QrCode } from 'lucide-react';
import SidebarNavigation from '../../components/SidebarNavigation';

const TABS = [
  { id: 'home', label: 'Home', icon: Calendar, component: Home, hidden: false },
  { id: 'materials', label: 'Materials', icon: BookOpen, component: Materials, hidden: false },
  { id: 'doubts', label: 'Doubts', icon: MessageSquare, component: DoubtSection, hidden: false },
  { id: 'stats', label: 'Stats', icon: TrendingUp, component: Analytics, hidden: false },
  { id: 'fees', label: 'Fees', icon: CreditCard, component: PaymentHistory, hidden: false },
  { id: 'profile', label: 'Profile', icon: User, component: Profile, hidden: false },
  { id: 'scan', label: 'Scan', icon: QrCode, component: AttendanceScanner, hidden: true },
];

export default function StudentView() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab ] = useState(0);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [direction, setDirection] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  // Calculate unread chat messages for badges
  const unreadChatCount = notifications.filter(n => !n.read && (n.type === 'chat_message' || n.type === 'group_chat_message')).length;
  const badges: Record<string, number> = {
    doubts: unreadChatCount
  };

  useEffect(() => {
    if (!profile) return;
    const dept = profile.courseId || profile.courseName || profile.department;
    const unsub = subscribeToNotifications(profile.uid, 'student', (list) => {
        setNotifications(list.filter(n => {
            if(n.type === 'chat_message' || n.type === 'group_chat_message') {
                return activeTabRef.current !== 2;
            }
            return true;
        }));
    }, dept, String(profile.semester));
    return () => unsub();
  }, [profile]);

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
    <div className="fixed inset-0 bg-[#f0f2f5] dark:bg-[#111b21] overflow-hidden flex flex-col md:flex-row font-sans">
      <SidebarNavigation 
        tabs={TABS} 
        activeTab={activeTab} 
        onTabChange={changeTab} 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        badges={badges}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
      {/* WhatsApp Header */}
      <header className="bg-wa-teal dark:bg-[#202c33] text-white pt-2 px-4 sm:px-6 shadow-lg z-[60] border-b border-wa-teal/10">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10 group">
              <GraduationCap className="text-white w-6 h-6 group-hover:rotate-12 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal leading-none">Tuition<span className="opacity-80">Hub</span></h1>
              <p className="text-sm font-bold tracking-normal text-white/80 mt-1.5 ">Student Account</p>
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
            <button 
              onClick={() => signOut(auth)}
              className="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-red-500 rounded-2xl transition-all active:scale-95 border border-white/5 text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-white/10 overflow-hidden border border-white/20 shadow-inner group cursor-pointer hover:scale-105 transition-transform" onClick={() => changeTab(5)}>
               {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                  {profile?.name?.charAt(0) || 'S'}
                </div>
              )}
            </div>
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
              <div className="p-4 sm:p-5 sm:p-5 sm:p-6 bg-wa-teal dark:bg-[#202c33] flex justify-between items-center text-white border-b border-wa-teal/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-normal">Bulletin <span className="opacity-70">Feed</span></h3>
                    <p className="text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 opacity-60">System Broadcasts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                     onClick={async () => {
                        const batch = writeBatch(db);
                        notifications.forEach(notif => {
                          if(notif.id) batch.delete(doc(db, 'notifications', notif.id));
                        });
                        await batch.commit();
                        setShowNotifications(false);
                     }}
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
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 sm:space-y-4 no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-[#f0f2f5] dark:bg-slate-800/10 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
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
                      className={`p-4 sm:p-6 rounded-2xl border transition-all cursor-pointer group ${
                        !notif.read 
                          ? 'bg-white dark:bg-[#202c33] border-wa-teal shadow-md' 
                          : 'bg-white/50 dark:bg-slate-800/20 border-transparent hover:bg-white dark:hover:bg-[#202c33]'
                      }`}
                      onClick={() => {
                        markAsRead(notif.id!);
                        setShowNotifications(false);
                        if (['doubt_reply', 'doubt_raised', 'chat_message', 'group_chat_message'].includes(notif.type)) {
                           changeTab(2);
                           if (notif.relatedId) {
                             setTimeout(() => {
                               window.dispatchEvent(new CustomEvent('OPEN_CHAT', { detail: { chatId: notif.relatedId } }));
                             }, 100);
                           }
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
                        <p className="text-xs font-bold text-wa-teal  tracking-normal">{notif.type.replace('_', ' ')}</p>
                        <p className="text-xs font-bold text-[#8696a0]  tracking-normal flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
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
      <div className="flex-1 relative overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21]">
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
            drag={window.innerWidth < 768 ? "x" : false}
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
      <footer className="bg-white dark:bg-[#202c33] border-t border-slate-200 dark:border-white/5 pb-safe z-[60] md:hidden">
        <div className="w-full flex justify-between items-center px-2 sm:px-8 py-2 md:py-3 max-w-full md:max-w-5xl mx-auto md:gap-4">
        {TABS.filter(t => !t.hidden).map((tab) => {
          const index = TABS.findIndex(t => t.id === tab.id);
          const isActive = activeTab === index;
          return (
          <button
            key={tab.id}
            onClick={() => changeTab(index)}
            className={`flex flex-col items-center justify-center flex-1 md:flex-initial md:min-w-[100px] py-1 px-1 relative transition-all duration-300 rounded-xl ${
              isActive 
                ? 'text-wa-teal dark:text-wa-green bg-slate-50 dark:bg-slate-800/50' 
                : 'text-slate-500 dark:text-[#8696a0] hover:text-wa-teal hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="relative">
              <tab.icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 ${isActive ? 'fill-wa-teal/20 dark:fill-wa-green/20 scale-110' : ''} transition-transform`} />
              {badges[tab.id] > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white dark:border-[#202c33]">
                  {badges[tab.id]}
                </span>
              )}
            </div>
            
            <span 
              className={`text-[10px] sm:text-xs font-bold tracking-wide truncate w-full text-center ${isActive ? 'text-wa-teal dark:text-wa-green' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {tab.label}
            </span>
          </button>
        )})}
        </div>
      </footer>
      </div>
    </div>
  );
}
