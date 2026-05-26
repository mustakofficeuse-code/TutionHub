import React, { useState, useEffect } from "react";

interface ClassCountdownProps {
  date: string;       // "YYYY-MM-DD" or "DD-MM-YYYY"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
}

export function ClassCountdown({ date, startTime, endTime }: ClassCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTime = () => {
      try {
        const now = new Date();
        const nowMs = now.getTime();

        // Standardize date input format
        let formattedDate = date;
        if (date.includes("-")) {
          const parts = date.split("-");
          if (parts[0].length === 2) {
            // Converts DD-MM-YYYY to YYYY-MM-DD
            formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        // Combine date and time
        const startDateTime = new Date(`${formattedDate}T${startTime}`);
        const endDateTime = new Date(`${formattedDate}T${endTime}`);

        const startMs = startDateTime.getTime();
        const endMs = endDateTime.getTime();

        if (isNaN(startMs) || isNaN(endMs)) {
          setTimeLeft("");
          return;
        }

        if (nowMs < startMs) {
          const diff = startMs - nowMs;
          const secs = Math.floor((diff / 1000) % 60);
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));

          let timerStr = "";
          if (days > 0) timerStr += `${days}d `;
          if (hours > 0 || days > 0) timerStr += `${hours}h `;
          timerStr += `${mins}m ${secs}s`;
          setTimeLeft(`Starts in ${timerStr}`);
        } else if (nowMs >= startMs && nowMs <= endMs) {
          const diff = endMs - nowMs;
          const secs = Math.floor((diff / 1000) % 60);
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);

          let timerStr = "";
          if (hours > 0) timerStr += `${hours}h `;
          timerStr += `${mins}m ${secs}s`;
          setTimeLeft(`Live: ${timerStr} left`);
        } else {
          setTimeLeft("Class completed");
        }
      } catch (e) {
        setTimeLeft("");
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [date, startTime, endTime]);

  if (!timeLeft) return null;

  const isLive = timeLeft.startsWith("Live");
  const isCompleted = timeLeft === "Class completed";

  return (
    <span
      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
        isLive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse"
          : isCompleted
          ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-white/5"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
      }`}
    >
      {timeLeft}
    </span>
  );
}
