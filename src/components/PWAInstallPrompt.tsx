import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Download, Share, PlusSquare, MoreVertical, Smartphone } from 'lucide-react';
import { Logo } from './Logo';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || document.referrer.includes('android-app://') || window.location.search.includes('standalone=true');
    setIsStandalone(!!standalone);

    if (standalone) return;

    if ((window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
         setShowPrompt(true);
      }
    }

    const handlePromptReady = () => {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
         setShowPrompt(true);
      }
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    const timer = setTimeout(() => {
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPWAInstallPrompt;
    
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPWAInstallPrompt = null;
        setShowPrompt(false);
        sessionStorage.setItem('pwa_install_dismissed', 'true');
      }
    } else {
      setShowManualDialog(true);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (isStandalone) return null;

  return (
    <>
      <AnimatePresence>
        {showPrompt && !showManualDialog && (
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
              <h4 className="font-semibold text-slate-900 dark:text-white text-[13px] truncate leading-tight">TuitionHub - Smart Classroom</h4>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex items-center text-amber-400">
                  <Star className="w-3 h-3 fill-current" />
                  <Star className="w-3 h-3 fill-current" />
                  <Star className="w-3 h-3 fill-current" />
                  <Star className="w-3 h-3 fill-current" />
                  <Star className="w-3 h-3 fill-current" />
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-none">FREE APP</span>
              </div>
            </div>
            
            <button
              onClick={handleInstallClick}
              className="shrink-0 px-4 py-1.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-full font-bold text-[12px] uppercase tracking-wide transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Get
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManualDialog && (
          <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-4 sm:p-6 pb-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualDialog(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 pb-5">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md mx-auto mb-5 border border-slate-100 dark:border-slate-800 bg-white">
                   <Logo size="100%" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Install TuitionHub</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                  Add this app to your home screen for quick access and full-screen experience.
                </p>

                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-sky-500" /> On iOS (Safari)
                    </h4>
                    <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2.5">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-[11px] flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">1</span>
                        <span>Tap the <Share className="w-4 h-4 inline mx-1 text-slate-400" /> Share button at the bottom navigation.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-[11px] flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">2</span>
                        <span>Scroll and select <strong>Add to Home Screen</strong> <PlusSquare className="w-4 h-4 inline ml-0.5 text-slate-400" /></span>
                      </li>
                    </ol>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-500" /> On Android (Chrome)
                    </h4>
                    <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2.5">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-[11px] flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">1</span>
                        <span>Tap the menu <MoreVertical className="w-4 h-4 inline mx-1 text-slate-400" /> icon in the top right.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-[11px] flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">2</span>
                        <span>Select <strong>Install App</strong> or <strong>Add to Home Screen</strong></span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowManualDialog(false);
                    sessionStorage.setItem('pwa_install_dismissed', 'true');
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};