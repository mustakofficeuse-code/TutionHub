import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star } from 'lucide-react';
import { Logo } from './Logo';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || document.referrer.includes('android-app://');
    setIsStandalone(!!standalone);

    if (standalone) return;

    // Show after a brief delay
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    }, 1500);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } else {
      alert(`To install the application:

1. Tap your browser's menu (⋮ on Android/Chrome or Action Button ⇧ on iOS/Safari).
2. Select 'Install App' or 'Add to Home Screen'.

Note: Browsers may disable the native prompt in Incognito Mode or inside iframes.`);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <AnimatePresence>
      {/* Mobile Sticky Bottom Banner (Like Reddit/Twitter/Instagram) */}
      <motion.div
        initial={{ y: 150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 150, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[5000] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] p-3 pb-safe flex items-center gap-3"
      >
        <button 
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -ml-1 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-100 dark:border-slate-800 bg-slate-50 flex items-center justify-center">
          <Logo size="100%" />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate leading-tight">TuitionHub</h4>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="flex items-center text-amber-400">
              <Star className="w-3 h-3 fill-current" />
              <Star className="w-3 h-3 fill-current" />
              <Star className="w-3 h-3 fill-current" />
              <Star className="w-3 h-3 fill-current" />
              <Star className="w-3 h-3 fill-current" />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">FREE</span>
          </div>
        </div>
        
        <button
          onClick={handleInstallClick}
          className="shrink-0 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full font-bold text-[13px] uppercase tracking-wide transition-colors"
        >
          Get
        </button>
      </motion.div>
    </AnimatePresence>
  );
};