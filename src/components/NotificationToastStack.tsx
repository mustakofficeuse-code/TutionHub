import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bell, 
  Calendar, 
  MessageSquare, 
  CreditCard, 
  UserPlus, 
  X, 
  Clock, 
  BookOpen, 
  HelpCircle 
} from "lucide-react";

interface InAppToast {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt?: any;
}

export default function NotificationToastStack() {
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  useEffect(() => {
    const handleNewToast = (event: Event) => {
      const customEvent = event as CustomEvent;
      const notif = customEvent.detail;
      if (!notif) return;

      const newToast: InAppToast = {
        id: notif.id || "toast_" + Date.now() + Math.random(),
        title: notif.title || "New Notification",
        message: notif.message || "",
        type: notif.type || "general",
        createdAt: notif.createdAt || new Date(),
      };

      // Add to toasts list (limit to max 4 concurrent visible toasts to keep screen clean)
      setToasts((prev) => [newToast, ...prev].slice(0, 4));
    };

    window.addEventListener("NEW_INAPP_NOTIFICATION", handleNewToast);
    return () => {
      window.removeEventListener("NEW_INAPP_NOTIFICATION", handleNewToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getToastConfig = (type: string) => {
    switch (type) {
      case "schedule_change":
        return {
          icon: Calendar,
          bgColor: "bg-amber-500",
          itemBg: "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/30",
          iconColor: "text-white",
          accentLine: "bg-amber-500",
        };
      case "doubt_reply":
      case "doubt_raised":
        return {
          icon: HelpCircle,
          bgColor: "bg-emerald-500",
          itemBg: "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/30",
          iconColor: "text-white",
          accentLine: "bg-emerald-500",
        };
      case "material_upload":
        return {
          icon: BookOpen,
          bgColor: "bg-blue-500",
          itemBg: "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/30",
          iconColor: "text-white",
          accentLine: "bg-blue-500",
        };
      case "fee_payment":
      case "fee_confirmed":
        return {
          icon: CreditCard,
          bgColor: "bg-purple-500",
          itemBg: "bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-900/30",
          iconColor: "text-white",
          accentLine: "bg-purple-500",
        };
      case "chat_message":
      case "group_chat_message":
        return {
          icon: MessageSquare,
          bgColor: "bg-sky-500",
          itemBg: "bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-900/30",
          iconColor: "text-white",
          accentLine: "bg-sky-500",
        };
      case "new_student":
        return {
          icon: UserPlus,
          bgColor: "bg-teal-500",
          itemBg: "bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-900/30",
          iconColor: "text-white",
          accentLine: "bg-teal-500",
        };
      default:
        return {
          icon: Bell,
          bgColor: "bg-slate-500",
          itemBg: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
          iconColor: "text-white",
          accentLine: "bg-slate-500",
        };
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[3000] w-full max-w-sm px-4 md:px-0 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = getToastConfig(toast.type);
          const IconComponent = config.icon;

          return (
            <ToastItem
              key={toast.id}
              toast={toast}
              config={config}
              IconComponent={IconComponent}
              onClose={() => removeToast(toast.id)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  config,
  IconComponent,
  onClose,
}: {
  key?: string;
  toast: InAppToast;
  config: any;
  IconComponent: any;
  onClose: () => void;
}) {
  useEffect(() => {
    // Automatically auto-dismiss toast after 6 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 6000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.2 } }}
      className={`pointer-events-auto w-full relative overflow-hidden rounded-2xl shadow-xl border flex gap-4 p-4 ${config.itemBg} backdrop-blur-md`}
    >
      {/* Decorative vertical colored accent bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-[5px] ${config.accentLine}`} />

      {/* Visual Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${config.bgColor}`}>
        <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
      </div>

      {/* Main text content */}
      <div className="flex-1 min-w-0 pr-6">
        <h5 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 uppercase text-xs opacity-90">
          {toast.title}
        </h5>
        <p className="text-slate-600 dark:text-slate-300 text-xs mt-1.5 font-medium leading-relaxed break-words">
          {toast.message}
        </p>
        <div className="flex items-center gap-1.5 mt-2.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
          <Clock className="w-3 h-3" />
          <span>Just now</span>
        </div>
      </div>

      {/* Action button: Close / Dismiss toast */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
