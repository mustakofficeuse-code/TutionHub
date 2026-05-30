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
          
          const activePayload: any = {
            data: {
              title,
              body,
              type: "attendance_active",
              scheduleId,
              subject: String(subject || ""),
              startTime: String(startTime || ""),
              endTime: String(endTime || "")
            },
            notification: {
              title,
              body,
              icon: absoluteLogo
            },
            android: {
              priority: "high"
            },
            webpush: {
              headers: { Urgency: "high" },
              notification: {
                title,
                body,
                icon: absoluteLogo,
                badge: absoluteBadge,
                requireInteraction: true
              },
              fcm_options: {
                link: origin + "/"
              }
            }
          };
          
          // Send push to matching students
          const studentsSnap = await db.collection("users").where("role", "==", "student").get();
          const tokens: string[] = [];
          const searchDept = String(department || "").trim().toUpperCase();
          const searchSem = String(semester || "").trim();
          
          studentsSnap.forEach((sDoc: any) => {
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
            
            if (matches && sData.fcmToken) {
              tokens.push(sData.fcmToken);
            }
          });
          
          if (tokens.length > 0) {
            try {
              await admin.messaging().sendEachForMulticast({
                ...activePayload,
                tokens
              } as any);
              console.log(`[Scheduler] Multicast active attendance push sent to ${tokens.length} students`);
            } catch (e) {
              console.error(`[Scheduler] Error sending active attendance multicast:`, e);
            }
          }
          
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
          
          const payload: any = {
            data: {
              title,
              body,
              type: "class_reminder",
              scheduleId,
              subject: String(subject || ""),
              startTime: String(startTime || ""),
              endTime: String(endTime || "")
            },
            notification: {
              title,
              body,
              icon: absoluteLogo
            },
            android: {
              priority: "high"
            },
            webpush: {
              headers: { Urgency: "high" },
              notification: {
                title,
                body,
                icon: absoluteLogo,
                badge: absoluteBadge,
                requireInteraction: true
              },
              fcm_options: {
                link: origin + "/"
              }
            }
          };

          // Notify Teacher
          const teachId = teacherId || schedule.teacherUid;
          if (teachId) {
            const teachDoc = await db.collection("users").doc(teachId).get();
            if (teachDoc.exists) {
              const teachData = teachDoc.data();
              if (teachData && teachData.fcmToken) {
                try {
                  await admin.messaging().send({
                    ...payload,
                    token: teachData.fcmToken
                  } as any);
                  console.log(`[Scheduler] Sent push to teacher ${teachId}`);
                } catch (e) {
                  console.error(`[Scheduler] Error sending to teacher:`, e);
                }
              }
            }
          }
          
          // Notify Students matching department and semester
          const studentsSnap = await db.collection("users").where("role", "==", "student").get();
          const tokens: string[] = [];
          
          const searchDept = String(department || "").trim().toUpperCase();
          const searchSem = String(semester || "").trim();
          
          studentsSnap.forEach((sDoc: any) => {
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
            
            if (matches && sData.fcmToken) {
              tokens.push(sData.fcmToken);
            }
          });
          
          if (tokens.length > 0) {
            try {
              await admin.messaging().sendEachForMulticast({
                ...payload,
                tokens
              } as any);
              console.log(`[Scheduler] Multicast push to ${tokens.length} students`);
            } catch (e) {
              console.error(`[Scheduler] Error sending multicast:`, e);
            }
          }

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

          // Persist the lastNotifiedAt timestamp on the schedule doc to prevent double triggering
          await db.collection("schedules").doc(scheduleId).update({
            lastNotifiedAt: now.toISOString()
          }).catch(() => {});

          await db.collection("attendance_schedules").doc(`ATT_SCHED_${scheduleId}`).update({
            lastNotifiedAt: now.toISOString()
          }).catch(() => {});
        }
      }

      // --- NEW: Insistent 5-minute attendance reminders during active window ---
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
          
          const fiveMinutesMs = 5 * 60 * 1000;
          if (nowMs - lastRemindedMs >= fiveMinutesMs) {
            allowReminder = true;
          }
          
          if (allowReminder) {
            console.log(`[Scheduler] Sending insistent 5-min attendance reminder to student ${studentUid} for class ${subject}`);
            
            if (sData.fcmToken) {
              const rTitle = `⚠️ Attendance Pending: ${subject}`;
              const rBody = `Your attendance is pending for the class: ${subject}. Please open the app and scan the QR code to record your attendance! 🕒`;
              
              const host = "tuitionhubapp.firebaseapp.com";
              const origin = `https://${host}`;
              const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
              const absoluteBadge = `${origin}/notification-badge.png`;
              
              const reminderPayload: any = {
                data: {
                  title: rTitle,
                  body: rBody,
                  type: "attendance_reminder_insistent",
                  scheduleId,
                  subject: String(subject || ""),
                  startTime: String(startTime || ""),
                  endTime: String(endTime || "")
                },
                notification: {
                  title: rTitle,
                  body: rBody,
                  icon: absoluteLogo
                },
                android: {
                  priority: "high"
                },
                webpush: {
                  headers: { Urgency: "high" },
                  notification: {
                    title: rTitle,
                    body: rBody,
                    icon: absoluteLogo,
                    badge: absoluteBadge,
                    requireInteraction: true
                  },
                  fcm_options: {
                    link: origin + "/"
                  }
                }
              };
              
              try {
                await admin.messaging().send({
                  ...reminderPayload,
                  token: sData.fcmToken
                });
              } catch (e) {
                console.error(`[Scheduler] Failed sending 5-min push:`, e);
              }
            }
            
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
              
              // Send push notification
              if (sData.fcmToken) {
                const host = "tuitionhubapp.firebaseapp.com";
                const origin = `https://${host}`;
                const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
                const absoluteBadge = `${origin}/notification-badge.png`;
                
                const missedPayload: any = {
                  data: {
                    title: mTitle,
                    body: mBody,
                    type: "class_missed",
                    scheduleId,
                    subject: String(subject || ""),
                    startTime: String(startTime || ""),
                    endTime: String(endTime || "")
                  },
                  notification: {
                    title: mTitle,
                    body: mBody,
                    icon: absoluteLogo
                  },
                  android: {
                    priority: "high"
                  },
                  webpush: {
                    headers: { Urgency: "high" },
                    notification: {
                      title: mTitle,
                      body: mBody,
                      icon: absoluteLogo,
                      badge: absoluteBadge,
                      requireInteraction: true
                    },
                    fcm_options: {
                      link: origin + "/"
                    }
                  }
                };
                
                try {
                  await admin.messaging().send({
                    ...missedPayload,
                    token: sData.fcmToken
                  });
                } catch (e) {
                  console.error(`[Scheduler] Failed sending missed push to ${studentUid}:`, e);
                }
              }
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
    }
  } catch (error: any) {
    if (error && error.message && error.message.includes("PERMISSION_DENIED")) {
      console.warn("[Scheduler] checkScheduleNotifications: Permission Denied. This is expected if the FIREBASE_SERVICE_ACCOUNT is not configured in your current environment.");
    } else {
      console.error("[Scheduler] checkScheduleNotifications failed:", error);
    }
  }
}
