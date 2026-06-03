import admin from "firebase-admin";

export const formatTime12h = (timeStr: string) => {
  if (!timeStr) return "";
  try {
    const [hours, minutes] = timeStr.split(":");
    let h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

export async function checkScheduleNotifications(db: admin.firestore.Firestore) {
  try {
    const now = new Date();
    const nowMs = now.getTime();
    
    const schedulesSnap = await db.collection("schedules").get();
    
    for (const doc of schedulesSnap.docs) {
      const schedule = doc.data();
      const scheduleId = doc.id;
      
      const { date, startTime, endTime, subject, department, semester, teacherId } = schedule;
      if (!date || !startTime) continue;
      
      // Standardize YYYY-MM-DD
      let formattedDate = date;
      if (date.includes("-")) {
        const parts = date.split("-");
        if (parts[0].length === 2) {
          formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      const startStr = `${formattedDate}T${startTime}`;
      const classStart = new Date(startStr);
      const classStartMs = classStart.getTime();
      
      if (isNaN(classStartMs)) {
        continue;
      }

      const endStr = `${formattedDate}T${endTime || startTime}`;
      const classEnd = new Date(endStr);
      let classEndMs = classEnd.getTime();
      if (isNaN(classEndMs)) {
        classEndMs = classStartMs + 2 * 60 * 60 * 1000;
      }

      // Check if the attendance system is now active (15 mins before starting class up to 1 hour after class end)
      // If it was not notified yet, we notify students to mark attendance and attend.
      const activeStartVal = classStartMs - 15 * 60 * 1000;
      const activeEndVal = classEndMs + 60 * 60 * 1000;
      
      if (nowMs >= activeStartVal && nowMs <= activeEndVal) {
        if (!schedule.attendanceActiveNotified) {
          console.log(`[Scheduler] Attendance active for class "${subject}". Sending reminders...`);
          const durationStr = `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
          const title = `📋 Attendance System ACTIVE - ${subject}`;
          const body = `Class is starting soon (${durationStr}). The attendance system is now active! Please log in, scan the QR code to mark your attendance, and make sure to attend. Let's make today's class incredible! 🚀`;
          
          const host = "tuitionhubapp.firebaseapp.com";
          const origin = `https://${host}`;
          const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
          const absoluteBadge = `${origin}/notification-badge.png`;
          
          const searchDept = String(department || "").trim().toUpperCase();
          const searchSem = String(semester || "").trim();

          // Send Companion Telegram/WhatsApp alerts
          sendCompanionNotifications(db, {
            targetRole: "student",
            targetDept: searchDept,
            targetSem: searchSem,
            title,
            body
          }).catch(e => console.error("[Cron-Helper Companion Error]:", e));
          
          // Record this in the "notifications" collection
          const notifyId = `active_attn_${scheduleId}_${nowMs}`;
          await db.collection("notifications").doc(notifyId).set({
            recipientId: "all_matched",
            targetDept: searchDept,
            targetSem: searchSem,
            teacherId: teacherId || schedule.teacherUid || "auto",
            senderId: "system",
            senderName: "Class System",
            title,
            message: body,
            type: "attendance_active",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            relatedId: scheduleId
          });
          
          // Mark as notified in DB
          await db.collection("schedules").doc(scheduleId).update({
            attendanceActiveNotified: true,
            attendanceNotified: true
          }).catch(() => {});

          // Mirror to attendance_schedules so student client-side snapshots receive it
          await db.collection("attendance_schedules").doc(`ATT_SCHED_${scheduleId}`).update({
            attendanceActiveNotified: true,
            attendanceNotified: true
          }).catch(() => {});
        }
      }
      
      const diffMs = classStartMs - nowMs;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      
      // Only trigger reminders within the 24 hours before class starts
      if (diffMs > 0 && diffMs <= twentyFourHoursMs) {
        let lastNotifiedMs = 0;
        if (schedule.lastNotifiedAt) {
          lastNotifiedMs = new Date(schedule.lastNotifiedAt).getTime();
        }
        
        // Trigger a notification every 30 minutes inside this window
        const thirtyMinutesMs = 30 * 60 * 1000;
        
        if (nowMs - lastNotifiedMs >= thirtyMinutesMs) {
          console.log(`[Scheduler] Reminding for class "${subject}" on ${date} at ${startTime}`);
          
          const timeForDiff = Math.round(diffMs / 60000);
          const hoursLeft = Math.floor(timeForDiff / 60);
          const minsLeft = timeForDiff % 60;
          let timeMsg = "";
          if (hoursLeft > 0) {
            timeMsg = `${hoursLeft}h ${minsLeft}m`;
          } else {
            timeMsg = `${minsLeft}m`;
          }
          
          const durationStr = `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
          const title = `Upcoming Class: ${subject}`;
          const body = `Class schedule: ${durationStr}. Starting in ${timeMsg}.`;
          
          // Build absolute URLs for FCM payload
          const host = "tuitionhubapp.firebaseapp.com";
          const origin = `https://${host}`;
          const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
          const absoluteBadge = `${origin}/notification-badge.png`;
          
          const teachId = teacherId || schedule.teacherUid;
          const searchDept = String(department || "").trim().toUpperCase();
          const searchSem = String(semester || "").trim();

          // Record this in "notifications" collection so it is visible inside the UI Notification Inbox too
          const notifyId = `remind_${scheduleId}_${nowMs}`;
          await db.collection("notifications").doc(notifyId).set({
            recipientId: "all_matched",
            targetDept: searchDept,
            targetSem: searchSem,
            teacherId: teachId || "auto",
            senderId: "system",
            senderName: "Class System",
            title,
            message: body,
            type: "class_reminder",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            relatedId: scheduleId
          });

          // Send Companion Telegram/WhatsApp alerts
          sendCompanionNotifications(db, {
            targetRole: "student",
            targetDept: searchDept,
            targetSem: searchSem,
            title,
            body
          }).catch(e => console.error("[Cron-Helper Companion Error]:", e));

          // Persist the lastNotifiedAt timestamp on the schedule doc to prevent double triggering
          await db.collection("schedules").doc(scheduleId).update({
            lastNotifiedAt: now.toISOString()
          }).catch(() => {});

          await db.collection("attendance_schedules").doc(`ATT_SCHED_${scheduleId}`).update({
            lastNotifiedAt: now.toISOString()
          }).catch(() => {});
        }
      }

      // --- NEW: Insistent 15-minute attendance reminders during active window ---
      const gp = schedule.gracePeriod || "until_end";
      let reminderActiveEnd = classEndMs;
      if (gp !== "until_end") {
        const minutes = parseInt(gp, 10);
        if (!isNaN(minutes)) {
          reminderActiveEnd = classStartMs + minutes * 60 * 1000;
        }
      }
      const reminderActiveStart = classStartMs - 15 * 60 * 1000;

      if (nowMs >= reminderActiveStart && nowMs <= reminderActiveEnd) {
        const searchDept = String(department || "").trim().toUpperCase();
        const searchSem = String(semester || "").trim();

        const studentsSnap = await db.collection("users").where("role", "==", "student").get();
        
        for (const sDoc of studentsSnap.docs) {
          const studentUid = sDoc.id;
          const sData = sDoc.data();
          
          let matches = true;
          if (searchDept && searchDept !== "ALL") {
            const uDept = String(sData.courseId || sData.courseName || sData.department || "").trim().toUpperCase();
            if (uDept && uDept !== searchDept) {
              matches = false;
            }
          }
          if (searchSem && searchSem !== "ALL") {
            const uSem = String(sData.semester || "").trim();
            if (uSem && uSem !== searchSem) {
              matches = false;
            }
          }
          
          if (!matches) continue;
          
          // Check if student already marked attendance
          const attendanceId = `${studentUid}_${formattedDate}_${scheduleId}`;
          const attDoc = await db.collection("attendance").doc(attendanceId).get();
          if (attDoc.exists) {
            continue; // Exited / Already marked present
          }
          
          // Check last persistent reminder timestamp
          const trackerId = `${studentUid}_${scheduleId}`;
          const trackerDoc = await db.collection("attendance_reminders").doc(trackerId).get();
          
          let allowReminder = false;
          let lastRemindedMs = 0;
          if (trackerDoc.exists) {
            const trackerData = trackerDoc.data();
            if (trackerData && trackerData.lastRemindedAt) {
              lastRemindedMs = new Date(trackerData.lastRemindedAt).getTime();
            }
          }
          
          const fifteenMinutesMs = 15 * 60 * 1000;
          if (nowMs - lastRemindedMs >= fifteenMinutesMs) {
            allowReminder = true;
          }
          
          if (allowReminder) {
            console.log(`[Scheduler] Sending insistent 15-min attendance reminder to student ${studentUid} for class ${subject}`);
            
            const rTitle = `⚠️ Attendance Pending: ${subject}`;
            const rBody = `Your attendance is pending for the class: ${subject}. Please open the app and scan the QR code to record your attendance! 🕒`;
            
            // Send Companion Telegram/WhatsApp alert
            sendCompanionNotifications(db, {
              recipientId: studentUid,
              title: rTitle,
              body: rBody
            }).catch(e => console.error("[Cron-Helper Companion Error]:", e));
            
            // Persist tracker document
            await db.collection("attendance_reminders").doc(trackerId).set({
              studentUid,
              scheduleId,
              lastRemindedAt: now.toISOString(),
              subject,
              date: formattedDate
            }, { merge: true }).catch(() => {});
          }
        }
      }

      // --- NEW: Class Missed notifications after attendance active window closes ---
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      if (nowMs > reminderActiveEnd && (nowMs - reminderActiveEnd) <= twoDaysMs) {
        if (!schedule.missedClassNotified) {
          console.log(`[Scheduler] Checking for students who missed class: scheduleId=${scheduleId}`);
          
          const searchDept = String(department || "").trim().toUpperCase();
          const searchSem = String(semester || "").trim();

          const studentsSnap = await db.collection("users").where("role", "==", "student").get();
          const missedStudents: string[] = [];

          for (const sDoc of studentsSnap.docs) {
            const studentUid = sDoc.id;
            const sData = sDoc.data();
            
            let matches = true;
            if (searchDept && searchDept !== "ALL") {
              const uDept = String(sData.courseId || sData.courseName || sData.department || "").trim().toUpperCase();
              if (uDept && uDept !== searchDept) {
                matches = false;
              }
            }
            if (searchSem && searchSem !== "ALL") {
              const uSem = String(sData.semester || "").trim();
              if (uSem && uSem !== searchSem) {
                matches = false;
              }
            }
            
            if (!matches) continue;
            
            // Check attendance
            const attendanceId = `${studentUid}_${formattedDate}_${scheduleId}`;
            const attDoc = await db.collection("attendance").doc(attendanceId).get();
            if (!attDoc.exists) {
              missedStudents.push(studentUid);
              
              const mTitle = `❌ Class Missed: ${subject}`;
              const durationStr = `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
              const mBody = `You have missed today's class of ${subject} scheduled on ${date} (${durationStr}). Please contact your teacher if you have any valid excuses. 📝`;
              
              // Record in general notifications collection so they see it in the app's Inbox
              const userNotifId = `missed_${scheduleId}_${studentUid}`;
              await db.collection("notifications").doc(userNotifId).set({
                recipientId: studentUid,
                teacherId: teacherId || "auto",
                senderId: "system",
                senderName: "Class System",
                title: mTitle,
                message: mBody,
                type: "class_missed",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                relatedId: scheduleId
              }).catch(() => {});
              
              // Send Companion Telegram/WhatsApp alert
              sendCompanionNotifications(db, {
                recipientId: studentUid,
                title: mTitle,
                body: mBody
              }).catch(e => console.error("[Cron-Helper Companion Error]:", e));
            }
          }
          
          // Mark missedClassNotified on schedules so it won't repeat next turn
          await db.collection("schedules").doc(scheduleId).update({
            missedClassNotified: true
          }).catch(() => {});
          
          await db.collection("attendance_schedules").doc(`ATT_SCHED_${scheduleId}`).update({
            missedClassNotified: true
          }).catch(() => {});
          
          console.log(`[Scheduler] Finished missed class notification for schedule ${scheduleId}. Missed student count: ${missedStudents.length}`);
        }
      }

      // --- NEW: Class Ending notification ---
      const classEndingWindowEnd = classEndMs + 24 * 60 * 60 * 1000;
      if (nowMs >= classEndMs && nowMs <= classEndingWindowEnd) {
        if (!schedule.classEndingNotified) {
          console.log(`[Scheduler] Class ending for "${subject}". Sending notifications...`);
          const durationStr = `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
          const title = `🏁 Class Ended - ${subject}`;
          const body = `The class for ${subject} (${durationStr}) has officially ended. Great job today! Please make sure you have submitted any assignments or pending attendance.`;
          
          const host = "tuitionhubapp.firebaseapp.com";
          const origin = `https://${host}`;
          const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
          const absoluteBadge = `${origin}/notification-badge.png`;
          
          const teachId = teacherId || schedule.teacherUid;
          const searchDeptEnding = String(department || "").trim().toUpperCase();
          const searchSemEnding = String(semester || "").trim();

          // Send Companion Telegram/WhatsApp alert
          sendCompanionNotifications(db, {
            targetRole: "student",
            targetDept: searchDeptEnding,
            targetSem: searchSemEnding,
            title,
            body
          }).catch(e => console.error("[Cron-Helper Companion Error]:", e));
          
          const notifyId = `ending_${scheduleId}_${nowMs}`;
          await db.collection("notifications").doc(notifyId).set({
            recipientId: "all_matched",
            targetDept: searchDeptEnding,
            targetSem: searchSemEnding,
            teacherId: teachId || "auto",
            senderId: "system",
            senderName: "Class System",
            title,
            message: body,
            type: "class_ending",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            relatedId: scheduleId
          }).catch(() => {});
          
          await db.collection("schedules").doc(scheduleId).update({
            classEndingNotified: true
          }).catch(() => {});

          await db.collection("attendance_schedules").doc(`ATT_SCHED_${scheduleId}`).update({
            classEndingNotified: true
          }).catch(() => {});
        }
      }
    }
  } catch (error: any) {
    if (error && error.message && error.message.includes("PERMISSION_DENIED")) {
      console.warn("[Scheduler] checkScheduleNotifications: Permission Denied. This is expected if the FIREBASE_SERVICE_ACCOUNT is not configured in your current environment.");
    } else {
      console.error("[Scheduler] checkScheduleNotifications failed:", error);
    }
  }
}

function getTelegramReplyMarkup(title: string, body: string) {
  const t = (title + " " + body).toLowerCase();
  const portalUrl = "https://ais-pre-oahrpb6rn47hcj6z2buf4u-826144498385.asia-southeast1.run.app";
  
  let buttons: Array<{ text: string; url: string }> = [];
  
  if (t.includes("chat") || t.includes("reply") || t.includes("message") || t.includes("doubt")) {
    buttons.push({ text: "✉️ Reply / Chat List", url: `${portalUrl}/chat` });
  } else if (t.includes("attendance") || t.includes("class starting") || t.includes("schedule")) {
    buttons.push({ text: "📋 Scan QR & Attend", url: `${portalUrl}/student/attendance` });
  } else if (t.includes("fee") || t.includes("payment") || t.includes("dues")) {
    buttons.push({ text: "💳 View Fees/Receipts", url: `${portalUrl}/student/fees` });
  } else {
    buttons.push({ text: "🔔 Open Personal Inbox", url: `${portalUrl}/student/dashboard` });
  }
  
  buttons.push({ text: "🏠 TuitionHub Portal", url: portalUrl });
  
  return {
    inline_keyboard: [
      buttons
    ]
  };
}

// Option 2 Web/Telegram Notification Broadcaster for Cron Jobs (Fully Interactive)
export async function sendCompanionNotifications(
  db: admin.firestore.Firestore,
  options: {
    recipientId?: string;
    targetRole?: string;
    targetDept?: string;
    targetSem?: string;
    title: string;
    body: string;
  }
) {
  const { recipientId, targetRole, targetDept, targetSem, title, body } = options;
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : "";
  const globalChatId = (process.env.TELEGRAM_CHAT_ID || "8848327573").trim();

  try {
    const markup = getTelegramReplyMarkup(title, body);

    // 1. Send live Telegram alert to global/admin chat ID in the backend with beautiful interactive reply buttons
    if (botToken && globalChatId) {
      const telegramMessage = `<b>🔔 TuitionHub Alert</b>\n\n<b>${title}</b>\n\n${body}\n\n📱 <i>Access Portal instantly from button or link below:</i> <a href="https://ais-pre-oahrpb6rn47hcj6z2buf4u-826144498385.asia-southeast1.run.app">TuitionHub Portal</a>`;
      console.log(`[Companion-Cron] Forwarding interactive alert to global Telegram Chat ID: ${globalChatId}`);
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const fetchResult = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: globalChatId,
            text: telegramMessage,
            parse_mode: "HTML",
            reply_markup: markup
          })
        });
        const fetchResultJson = await fetchResult.json();
        console.log(`[Companion-Cron] Global Telegram response:`, fetchResultJson);
      } catch (tErr) {
        console.error(`[Companion-Cron] Error firing global Telegram chat:`, tErr);
      }
    }

    // 2. Fallback to sending to custom student IDs registered in Firestore
    let usersToAlert: any[] = [];
    
    try {
      if (recipientId) {
        const uDoc = await db.collection("users").doc(recipientId).get();
        if (uDoc.exists) {
          usersToAlert.push({ id: uDoc.id, ...uDoc.data() });
        }
      } else if (targetRole) {
        let snap;
        if (targetRole === "ALL") {
          snap = await db.collection("users").get();
        } else {
          snap = await db.collection("users").where("role", "==", targetRole).get();
        }
        snap.forEach((doc) => {
          const userData = doc.data();
          let matched = true;
          if (targetDept) {
            const searchDept = String(targetDept).trim().toUpperCase();
            const userDept = String(userData.courseId || userData.courseName || userData.department || "").trim().toUpperCase();
            if (searchDept !== "ALL" && userDept !== "ALL" && userDept && userDept !== searchDept) {
              matched = false;
            }
          }
          if (targetSem) {
            const searchSem = String(targetSem).trim();
            const userSem = String(userData.semester || "").trim();
            if (searchSem !== "ALL" && userSem !== "ALL" && userSem && userSem !== searchSem) {
              matched = false;
            }
          }
          if (matched) {
            usersToAlert.push({ id: doc.id, ...userData });
          }
        });
      }
    } catch (adminErr: any) {
      console.warn("[Companion-Cron Warning] Admin SDK Firestore query failed or had insufficient permissions. Falling back to secure public REST API bypass: ", adminErr.message || adminErr);
      
      // Helper to parse Firestore REST JSON fields
      const parseREST = (fields: any) => {
        const result: any = {};
        if (!fields) return result;
        for (const [key, val] of Object.entries(fields)) {
          const v = val as any;
          if ("stringValue" in v) {
            result[key] = v.stringValue;
          } else if ("booleanValue" in v) {
            result[key] = v.booleanValue;
          } else if ("integerValue" in v) {
            result[key] = parseInt(v.integerValue);
          } else if ("doubleValue" in v) {
            result[key] = parseFloat(v.doubleValue);
          } else if ("arrayValue" in v) {
            result[key] = (v.arrayValue.values || []).map((arrVal: any) => {
              const itemObj = parseREST({ temp: arrVal });
              return itemObj.temp;
            });
          } else if ("mapValue" in v) {
            result[key] = parseREST(v.mapValue.fields);
          } else {
            result[key] = v;
          }
        }
        return result;
      };

      // Safe load firebase config
      let projId = "tutionhub-e41cd";
      try {
        const fs = require("fs");
        const path = require("path");
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          if (config.projectId) {
            projId = config.projectId;
          }
        }
      } catch (e) {
        // Fallback to import or default
      }

      if (recipientId) {
        try {
          const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projId}/databases/(default)/documents/users/${recipientId}`);
          if (res.status === 200) {
            const docJson: any = await res.json();
            usersToAlert.push({ id: recipientId, ...parseREST(docJson.fields) });
          }
        } catch (fetchErr) {
          console.error("[Companion-Cron REST Fallback Error] Failed to get single user via REST API:", fetchErr);
        }
      } else if (targetRole) {
        try {
          const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projId}/databases/(default)/documents/users?pageSize=400`);
          if (res.status === 200) {
            const collectionJson: any = await res.json();
            const allUsers = (collectionJson.documents || []).map((docObj: any) => {
              const docId = docObj.name.split("/").pop();
              return { id: docId, ...parseREST(docObj.fields) };
            });
            
            // Apply safe memory filters
            usersToAlert = allUsers.filter((userData: any) => {
              if (targetRole !== "ALL" && userData.role !== targetRole) {
                return false;
              }
              if (targetDept) {
                const searchDept = String(targetDept).trim().toUpperCase();
                const userDept = String(userData.courseId || userData.courseName || userData.department || "").trim().toUpperCase();
                if (searchDept !== "ALL" && userDept !== "ALL" && userDept && userDept !== searchDept) {
                  return false;
                }
              }
              if (targetSem) {
                const searchSem = String(targetSem).trim();
                const userSem = String(userData.semester || "").trim();
                if (searchSem !== "ALL" && userSem !== "ALL" && userSem && userSem !== searchSem) {
                  return false;
                }
              }
              return true;
            });
          }
        } catch (fetchErr) {
          console.error("[Companion-Cron REST Fallback Error] Failed to list users via REST API:", fetchErr);
        }
      }
    }

    for (const u of usersToAlert) {
      if (u.telegramChatId && String(u.telegramChatId).trim() === globalChatId) {
        continue;
      }

      if (u.enableTelegramNotification && u.telegramChatId) {
        const chat_id = String(u.telegramChatId).trim();
        const telegramMessage = `<b>🔔 TuitionHub Alert</b>\n\n<b>${title}</b>\n\n${body}\n\n📱 <i>Access Portal instantly from button or link below:</i> <a href="https://ais-pre-oahrpb6rn47hcj6z2buf4u-826144498385.asia-southeast1.run.app">TuitionHub Portal</a>`;
        
        if (botToken) {
          console.log(`[Companion-Cron] Sending interactive Telegram alert to User Chat ID: ${chat_id}`);
          try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const fetchResult = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id,
                text: telegramMessage,
                parse_mode: "HTML",
                reply_markup: markup
              })
            });
            const fetchResultJson = await fetchResult.json();
            console.log(`[Companion-Cron] User Telegram API response:`, fetchResultJson);
          } catch (tErr) {
            console.error(`[Companion-Cron] Error firing Telegram bot:`, tErr);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Companion-Cron Alert error]:", err);
  }
}
