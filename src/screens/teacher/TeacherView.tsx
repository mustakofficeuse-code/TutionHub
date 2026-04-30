import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  CreditCard, 
  User,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TeacherDashboard from './Dashboard';
import MaterialManager from './MaterialManager';
import DoubtSection from '../shared/DoubtSection';
import TeacherAnalytics from './Analytics';
import FeeManagement from './FeeManagement';
import Profile from '../shared/Profile';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, component: TeacherDashboard },
  { id: 'materials', label: 'Materials', icon: BookOpen, component: MaterialManager },
  { id: 'doubts', label: 'Doubts', icon: MessageSquare, component: DoubtSection },
  { id: 'stats', label: 'Stats', icon: TrendingUp, component: TeacherAnalytics },
  { id: 'fees', label: 'Fees', icon: CreditCard, component: FeeManagement },
  { id: 'profile', label: 'Profile', icon: User, component: Profile },
];

export default function TeacherView() {
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
              return <Component isEmbedded />;
            })()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Static Footer Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-3 flex justify-between items-center z-50 transition-colors safe-area-bottom shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
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
        {profile?.role === 'admin' && (
          <button 
            onClick={() => window.location.href = '/admin'}
            className="flex-1 flex flex-col items-center gap-1 text-indigo-600 dark:text-indigo-400"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-tight">Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}
