import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Star } from 'lucide-react';
import { Logo } from './Logo';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    // 1. Detect if the app is already running in standalone/installed mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone || 
                       document.referrer.includes('android-app://') || 
                       window.location.search.includes('standalone=true');
    setIsStandalone(!!standalone);

    if (standalone) return;

    // 2. Handler for beforeinstallprompt event
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Only show if the user hasn't dismissed it in the current session
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    };

    // 3. Listen for event captured in index.html (or wait for it here)
    if ((window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    }

    const handlePromptReady = () => {
      const capturedPrompt = (window as any).deferredPWAInstallPrompt;
      if (capturedPrompt) {
        setDeferredPrompt(capturedPrompt);
        if (!sessionStorage.getItem('pwa_install_dismissed')) {
          setShowPrompt(true);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPWAInstallPrompt;
    
    if (!promptEvent) {
      console.warn("Direct PWA installation prompt is not available yet.");
      return;
    }

    // Trigger the native browse install banner directly
    promptEvent.prompt();
    
    try {
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        setDeferredPrompt(null);
        (window as any).deferredPWAInstallPrompt = null;
        setShowPrompt(false);
      } else {
        console.log('User dismissed the PWA install prompt');
      }
    } catch (err) {
      console.error('Error during PWA installation:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  // Only show the banner if installable event was caught AND we are not in standalone mode
  if (!showPrompt || isStandalone || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -120, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 right-0 z-[6000] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.1)] p-3 flex items-center justify-between gap-3 px-4 md:px-8"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-100 dark:border-slate-800 bg-slate-50 flex items-center justify-center p-0.5">
            <Logo size="100%" />
          </div>
          
          <div className="min-w-0 flex flex-col justify-center">
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm truncate leading-tight">
              TuitionHub App
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] sm:text-xs text-sky-500 font-bold uppercase tracking-wider">Fast & Free</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <div className="flex items-center text-amber-400">
                <Star className="w-2.5 h-2.5 fill-current" />
                <Star className="w-2.5 h-2.5 fill-current" />
                <Star className="w-2.5 h-2.5 fill-current" />
                <Star className="w-2.5 h-2.5 fill-current" />
                <Star className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleInstallClick}
          className="shrink-0 px-4 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-full font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" /> Install Now
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
