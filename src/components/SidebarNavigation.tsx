import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

interface Tab {
  id: string;
  label: string;
  icon: any;
  component: any;
}

interface SidebarProps {
  tabs: Tab[];
  activeTab: number;
  onTabChange: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  badges?: Record<string, number>;
  onProfileClick?: () => void;
}

export default function SidebarNavigation({ tabs, activeTab, onTabChange, isOpen, onToggle, badges = {}, onProfileClick }: SidebarProps) {
  const { profile } = useAuth();

  return (
    <motion.div 
      initial={false}
      animate={{ width: isOpen ? 256 : 80 }}
      className="hidden md:flex flex-col bg-white dark:bg-[#111b21] border-r border-slate-200 dark:border-white/10 z-[60]"
    >
      <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-200 dark:border-white/10 overflow-hidden">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
          {isOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </button>
        {isOpen && (
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shadow-sm">
                    <Logo size="100%" />
                </div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white truncate">TuitionHub</h1>
            </div>
        )}
      </div>
      
      <div className="flex-1 py-4 px-3 space-y-1 overflow-hidden">
        {tabs.filter(t => !('hidden' in t) || !t.hidden).map((tab, index) => {
          const actualIndex = tabs.findIndex(t => t.id === tab.id);
          const isActive = activeTab === actualIndex;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(actualIndex)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                isActive 
                  ? 'bg-wa-teal/10 text-wa-teal dark:bg-wa-teal/10 dark:text-wa-green' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title={tab.label}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5 shrink-0" />
                {badges[tab.id] > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white dark:border-[#111b21]">
                     {badges[tab.id]}
                  </span>
                )}
              </div>
              {isOpen && <span className="font-bold truncate">{tab.label}</span>}
              {isActive && <motion.div layoutId="active-nav" className="absolute left-0 w-1 h-8 bg-wa-teal rounded-r-full" />}
            </button>
          );
        })}
      </div>

      {/* Persistent User Profile Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1f2c34]/20 shrink-0">
        <button
          onClick={onProfileClick}
          className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group"
          title="View my full profile identity card"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-slate-350 dark:bg-slate-700 font-bold text-[#111b21] dark:text-white text-sm flex items-center justify-center">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
            )}
          </div>
          {isOpen && (
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-850 dark:text-white text-xs truncate leading-snug">
                {profile?.name || 'My Profile'}
              </p>
              <p className="text-[10px] font-semibold text-wa-teal dark:text-wa-green uppercase tracking-wide leading-none mt-1">
                {profile?.role || 'User'}
              </p>
            </div>
          )}
        </button>
      </div>
    </motion.div>
  );
}
