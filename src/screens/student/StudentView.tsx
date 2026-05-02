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
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Home from './Home';
import Materials from './Materials';
import DoubtSection from '../shared/DoubtSection';
import Analytics from './Analytics';
import PaymentHistory from './PaymentHistory';
import Profile from '../shared/Profile';
import AttendanceScanner from './AttendanceScanner';
import { QrCode } from 'lucide-react';

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
  const [activeTab, setActiveTab ] = useState(0);
  const [direction, setDirection] = useState(0);

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
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-20 shrink-0 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Tuition<span className="text-blue-600">Hub</span></h1>
        </div>
      </header>

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
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-center gap-4 sm:gap-8 items-center z-50 transition-colors safe-area-bottom shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
        {TABS.filter(t => !t.hidden).map((tab) => {
          const index = TABS.findIndex(t => t.id === tab.id);
          return (
          <button
            key={tab.id}
            onClick={() => changeTab(index)}
            className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 relative group rounded-2xl transition-all ${
              activeTab === index 
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
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
                layoutId="nav-indicator-student"
                className="absolute -bottom-3 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full"
              />
            )}
          </button>
        )})}
        {profile?.role === 'admin' && (
          <button 
            onClick={() => window.location.href = '/admin'}
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 relative group rounded-2xl transition-all text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          >
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5px]" />
            <span className="absolute -top-12 scale-0 group-hover:scale-100 transition-transform origin-bottom bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-xl z-50 whitespace-nowrap pointer-events-none">
              Admin
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rotate-45"></div>
            </span>
          </button>
        )}
      </nav>
    </div>
  );
}
