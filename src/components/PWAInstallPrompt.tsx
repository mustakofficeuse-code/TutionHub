import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';
import { Logo } from './Logo';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      // Do not show immediately if previously dismissed
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-sm px-4"
      >
        <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 relative">
          <button 
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shrink-0 border border-slate-700 bg-slate-800 flex items-center justify-center p-1">
              <Logo size="100%" />
            </div>
            <div className="flex-1 pr-6">
              <h4 className="font-bold text-white text-sm">Install TuitionHub</h4>
              <p className="text-[11px] text-slate-400 leading-tight">Add to your home screen for quick access, push notifications, and a full-screen experience.</p>
            </div>
          </div>
          
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Install App
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};