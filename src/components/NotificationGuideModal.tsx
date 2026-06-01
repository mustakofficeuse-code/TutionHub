import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  Bell, 
  ShieldCheck, 
  Settings2, 
  Check, 
  AlertTriangle,
  Info,
  ChevronRight,
  BatteryCharging,
  Zap,
  Globe
} from 'lucide-react';

interface NotificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeviceOS = 'android' | 'ios' | 'browser';

export default function NotificationGuideModal({ isOpen, onClose }: NotificationGuideModalProps) {
  const [activeOS, setActiveOS] = useState<DeviceOS>('android');

  if (!isOpen) return null;

  const androidSteps = [
    {
      title: "Disable Battery Optimization",
      desc: "Device manufacturers kill background processes to save battery. Change this setting to ensure constant push delivery.",
      action: "Go to Phone Settings > Apps > Chrome (or TuitionHub) > Battery > Select 'Unrestricted' or 'No Restrictions'."
    },
    {
      title: "Enable 'Autostart' or 'Background Launch'",
      desc: "Allows Chrome and TuitionHub to receive real-time push events from Google Play Services even when you swipe the app closed.",
      action: "Go to Settings > Apps & Permissions > Autostart (or Background Run) > Enable switch."
    },
    {
      title: "Lock App in Recents Tray",
      desc: "Prevents immediate disposal of the browser engine when cleaning background tasks.",
      action: "Open Recents screen, press-and-hold the Chrome / TuitionHub card, and select the padlock (🔒) icon."
    },
    {
      title: "Ensure Notification Category is Priority",
      desc: "Allows instant high-urgency notifications to ring through.",
      action: "Tap-and-hold the PWA icon > App Info > Notifications > Choose 'Urgent' or allow 'Pop on screen'."
    }
  ];

  const iosSteps = [
    {
      title: "Add App to Home Screen",
      desc: "iOS Web Push is only supported if you install the app directly on your device repository.",
      action: "Tap the share button in Safari (icon with arrow up) and select 'Add to Home Screen'."
    },
    {
      title: "Enable System Level Notifications",
      desc: "Safari PWA notifications won't ring if the main app setting is turned off.",
      action: "Go to Apple Settings > Scroll to 'TuitionHub' > Tap Notifications > Enable 'Allow Notifications'."
    },
    {
      title: "Keep Background App Refresh Active",
      desc: "Allows real-time state synchronization to run periodically.",
      action: "Go to Settings > General > Background App Refresh > Turn on 'Wi-Fi & Cellular Data'."
    }
  ];

  const browserSteps = [
    {
      title: "Allow Notifications in Permission Panel",
      desc: "Grant TuitionHub absolute priority to broadcast and ring alerts.",
      action: "Click the lock icon (🔒) or settings toggle in the address bar and set Notifications to 'Allow'."
    },
    {
      title: "Disable Quiet Notifications",
      desc: "Allows instant sliding banners instead of silenced taskbar items.",
      action: "Go to Browser Settings > Privacy and Security > Site Settings > Notifications > Turn off 'Use quieter messaging'."
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-[#111b21] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden border border-slate-100 dark:border-white/5 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-wa-teal to-wa-teal-dark dark:from-[#202c33] dark:to-[#2b3942] text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Notification Troubleshooter</h3>
                <p className="text-xs text-white/70">Receive alerts even when app is swiped closed</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 bg-white/10 hover:bg-black/20 rounded-xl transition-all flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Warning notice about closed Apps */}
          <div className="bg-amber-500/10 border-b border-amber-500/20 p-4 text-xs text-amber-800 dark:text-amber-400 font-medium flex gap-3 shrink-0">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-bold mb-0.5">Why notifications get delayed when closed?</p>
              <p className="opacity-90 leading-relaxed">
                Unlike native apps (WhatsApp/Instagram) which run native system-level background processes, Web Apps (PWAs) rely on browser Service Workers. If you swipe the app closed from Recents, devices with eager memory cleaners will silence background browser processes unless configured correctly below.
              </p>
            </div>
          </div>

          {/* OS Tab Selector */}
          <div className="flex bg-slate-50 dark:bg-[#202c33] p-1.5 border-b border-slate-100 dark:border-white/5 shrink-0">
            <button 
              onClick={() => setActiveOS('android')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeOS === 'android' 
                  ? 'bg-white dark:bg-[#111b21] text-wa-teal dark:text-wa-green shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Android Optimization
            </button>
            <button 
              onClick={() => setActiveOS('ios')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeOS === 'ios'
                  ? 'bg-white dark:bg-[#111b21] text-wa-teal dark:text-wa-green shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              iOS / Safari
            </button>
            <button 
              onClick={() => setActiveOS('browser')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeOS === 'browser'
                  ? 'bg-white dark:bg-[#111b21] text-wa-teal dark:text-wa-green shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Desktop / Browser
            </button>
          </div>

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              <Settings2 className="w-4 h-4 text-wa-teal dark:text-wa-green" />
              <span>Step-by-step Setup Checklist</span>
            </div>

            {activeOS === 'android' && androidSteps.map((step, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] hover:bg-slate-100/50 dark:hover:bg-[#202c33]/40 border border-slate-100 dark:border-white/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-wa-teal/10 text-wa-teal dark:bg-wa-teal/20 dark:text-wa-green flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-[#e9edef]">{step.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                  <div className="mt-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/10 flex items-start gap-1.5">
                     <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                     <span><strong>How to:</strong> {step.action}</span>
                  </div>
                </div>
              </div>
            ))}

            {activeOS === 'ios' && iosSteps.map((step, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] hover:bg-slate-100/50 dark:hover:bg-[#202c33]/40 border border-slate-100 dark:border-white/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-wa-teal/10 text-wa-teal dark:bg-wa-teal/20 dark:text-wa-green flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-[#e9edef]">{step.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                  <div className="mt-2 text-xs font-semibold bg-[#53bdeb]/10 text-[#53bdeb] px-3 py-1.5 rounded-lg border border-[#53bdeb]/10 flex items-start gap-1.5">
                     <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#53bdeb]" />
                     <span><strong>How to:</strong> {step.action}</span>
                  </div>
                </div>
              </div>
            ))}

            {activeOS === 'browser' && browserSteps.map((step, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] hover:bg-slate-100/50 dark:hover:bg-[#202c33]/40 border border-slate-100 dark:border-white/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-wa-teal/10 text-wa-teal dark:bg-wa-teal/20 dark:text-wa-green flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-[#e9edef]">{step.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                  <div className="mt-2 text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/10 flex items-start gap-1.5">
                     <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                     <span><strong>How to:</strong> {step.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Action */}
          <div className="p-4 bg-slate-50 dark:bg-[#202c33] border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end shrink-0">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 bg-wa-teal text-white hover:opacity-90 rounded-2xl text-xs font-bold tracking-tight transition-opacity flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Done, settings updated!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
