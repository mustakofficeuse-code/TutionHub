import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

import { v2 as cloudinary } from "cloudinary";


// Dynamic session version tag that changes on server restart (which happens automatically on file edits)
const SERVER_BOOT_VERSION = "build_" + Date.now();

// Configure Cloudinary globally
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dgutw0ygj",
  api_key: process.env.CLOUDINARY_API_KEY || "738423457948574",
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const getDb = () => getFirestore(undefined, firebaseConfig.firestoreDatabaseId);
  
  console.log(`Initializing Firebase Admin for project: ${firebaseConfig.projectId}`);

  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        let credentials;
        const str = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        if (str.startsWith('{')) {
          credentials = JSON.parse(str);
        } else {
          credentials = JSON.parse(Buffer.from(str, 'base64').toString('utf-8'));
        }
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
          projectId: firebaseConfig.projectId
        });
        console.log("Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT");
      } catch(e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: firebaseConfig.projectId
          });
          console.log("Firebase Admin initialized with Application Default Credentials as fallback");
        } catch (e2) {
           console.log("Fallback init failed!");
        }
      }
    } else {
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig.projectId
        });
        console.log("Firebase Admin initialized with Application Default Credentials");
      } catch(e) {
        console.log("Init Default Credentials failed!");
      }
    }
  }

  // Background Class Schedule Reminder task
  async function checkScheduleNotifications(db: admin.firestore.Firestore) {
    const formatTime12h = (timeStr: string) => {
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
      }
    } catch (error) {
      console.error("[Scheduler] checkScheduleNotifications failed:", error);
    }
  }

  // Start the background cron-like checking interval every 30 seconds
  setInterval(() => {
    checkScheduleNotifications(getDb()).catch(e => console.error("Schedule notification task error:", e));
  }, 30000);

  app.use(express.json({ limit: '50mb' }));

  // API to send push notification using FCM
  app.post("/api/send-push", async (req, res) => {
    try {
      const { title, body, recipientId, targetRole, delayMs, targetDept, targetSem } = req.body;
      const db = getDb();

      const host = req.get("host") || "tuitionhubapp.firebaseapp.com";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const origin = `${protocol}://${host}`;
      const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
      const absoluteBadge = `${origin}/notification-badge.png`;

      const sendPushWrapper = async () => {
        const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const bodyWithTime = body ? `${body} (${formattedTime})` : formattedTime;

        const payload: any = {
          data: {
            title: String(title || "New Notification"),
            body: String(bodyWithTime),
            type: String(req.body.type || "general"),
            chatId: String(req.body.chatId || ""),
            senderId: String(req.body.senderId || ""),
            targetId: String(recipientId || "")
          },
          notification: {
            title: String(title || "New Notification"),
            body: String(bodyWithTime),
            icon: absoluteLogo
          },
          android: {
            priority: "high"
          },
          apns: {
            headers: {
              "apns-priority": "10"
            }
          },
          webpush: {
            headers: { 
              Urgency: "high" 
            },
            notification: {
              title: String(title || "New Notification"),
              body: String(bodyWithTime),
              icon: absoluteLogo,
              badge: absoluteBadge,
              requireInteraction: true
            },
            fcm_options: {
              link: origin + "/"
            }
          }
        };

        if (recipientId) {
          // Send to specific user
          const userDoc = await db.collection("users").doc(recipientId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData && userData.fcmToken) {
              try {
                await admin.messaging().send({
                  ...payload,
                  token: userData.fcmToken,
                });
              } catch (err: any) {
                console.error("[FCM] Error sending single-cast push:", err);
                const errMsg = String(err?.message || "").toLowerCase();
                const errCode = String(err?.code || "").toLowerCase();
                if (
                  errCode.includes("not-registered") ||
                  errCode.includes("invalid-registration-token") ||
                  errMsg.includes("not-registered") ||
                  errMsg.includes("invalid") ||
                  errMsg.includes("bad-token") ||
                  errMsg.includes("not registered")
                ) {
                  console.log(`[FCM] Token is stale/invalid for user ${recipientId}. Resetting fcmToken field to heal the DB.`);
                  await db.collection("users").doc(recipientId).update({ fcmToken: null });
                }
              }
              return;
            }
          }
        } else if (targetRole) {
           // Send to users matching role
           let usersSnap;
           if (targetRole === "ALL") {
               usersSnap = await db.collection("users").get();
           } else {
               usersSnap = await db.collection("users").where("role", "==", targetRole).get();
           }
           const tokens: string[] = [];
           usersSnap.forEach((doc) => {
             const userData = doc.data();
             let shouldSend = true;
             
             if (targetDept) {
                const searchDept = String(targetDept).trim().toUpperCase();
                const userDept = String(userData.courseId || userData.courseName || userData.department || "").trim().toUpperCase();
                if (searchDept !== "ALL" && userDept !== "ALL" && userDept && userDept !== searchDept) {
                  shouldSend = false;
                }
              }
              if (targetSem) {
                const searchSem = String(targetSem).trim();
                const userSem = String(userData.semester || "").trim();
                if (searchSem !== "ALL" && userSem !== "ALL" && userSem && userSem !== searchSem) {
                  shouldSend = false;
                }
              }
             
             if (shouldSend && userData.fcmToken) {
                 tokens.push(userData.fcmToken);
             }
           });
  
           if (tokens.length > 0) {
              try {
                 await admin.messaging().sendEachForMulticast({
                    ...payload,
                    tokens,
                 } as admin.messaging.MulticastMessage);
              } catch (err: any) {
                 console.error("[FCM] Error sending multicast push:", err);
              }
              return;
           }
        }
      };

      if (delayMs) {
        // Send a response immediately and setup a delayed push on the server side
        setTimeout(() => {
          sendPushWrapper().catch(e => console.error("Delayed push failed:", e));
        }, delayMs);
        return res.json({ success: true, message: `Push scheduled to be sent in ${delayMs}ms` });
      }

      await sendPushWrapper();
      return res.json({ success: true, message: "Push attempt completed" });
    } catch (e: any) {
      console.error("Push send error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat-reply", async (req, res) => {
    try {
      const { text, chatId, recipientId, senderId, originalType } = req.body;
      if (!text || !chatId || !senderId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const host = req.get("host") || "tuitionhubapp.firebaseapp.com";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const origin = `${protocol}://${host}`;
      const absoluteLogo = `${origin}/gold_tuitionhub_logo_1779680854835.png`;
      const absoluteBadge = `${origin}/notification-badge.png`;

      const db = getDb();
      const userDoc = await db.collection("users").doc(senderId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userData = userDoc.data();
      const senderName = userData?.name || "Unknown";
      const senderRole = userData?.role || "student";
      
      // Attempt to find chatType by checking existing messages in this chat
      const chatMsgs = await db.collection("chat_messages").where("chatId", "==", chatId).limit(1).get();
      let chatType = 'private'; // default
      if (!chatMsgs.empty) {
        chatType = chatMsgs.docs[0].data().chatType || 'private';
      } else if (originalType === 'group_chat_message') {
        chatType = 'group';
      }

      const newMsgObj: any = {
          chatId: chatId,
          chatType: chatType,
          senderId: senderId,
          senderName: senderName,
          senderRole: senderRole,
          isAnonymous: false,
          content: text.trim(),
          attachmentUrl: "",
          attachmentName: "",
          attachmentType: "",
          createdAt: new Date().toISOString(),
          status: 'sent',
          seenBy: [],
          reactions: {},
          participants: chatType === 'private' && recipientId ? [senderId, recipientId] : []
      };

      const docRef = await db.collection("chat_messages").add(newMsgObj);

      // Also insert a notification for the recipient!
      if (chatType === 'private' && recipientId) {
         await db.collection("notifications").add({
            title: `New Message from ${senderName}`,
            message: text.trim(),
            type: 'chat_message',
            senderId: senderId,
            senderName: senderName,
            recipientId: recipientId,
            relatedId: chatId,
            isAnonymous: false,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
         });

         // Trigger push notification to the recipient of this new reply!
         // (This works nicely with our background fetch setup)
         const recipientDoc = await db.collection("users").doc(recipientId).get();
         if (recipientDoc.exists && recipientDoc.data()?.fcmToken) {
             const payload: any = {
                 data: {
                     title: String(`New Message from ${senderName}`),
                     body: String(text.trim()),
                     type: "chat_message",
                     chatId: String(chatId),
                     senderId: String(senderId),
                     targetId: String(recipientId)
                 },
                 notification: {
                   title: String(`New Message from ${senderName}`),
                   body: String(text.trim()),
                   icon: absoluteLogo
                 },
                 android: {
                   priority: "high"
                 },
                 webpush: {
                    headers: { Urgency: "high" },
                    notification: {
                      title: String(`New Message from ${senderName}`),
                      body: String(text.trim()),
                      icon: absoluteLogo,
                      badge: absoluteBadge,
                      requireInteraction: true
                    },
                    fcm_options: {
                      link: origin + "/"
                    }
                  }
             };
             await admin.messaging().send({
                ...payload,
                token: recipientDoc.data()!.fcmToken
             });
         }
      }

      return res.json({ success: true, messageId: docRef.id });
    } catch(e: any) {
      console.error("Chat reply error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // API Route for secure uploads (bypasses browser CORS)
  app.post("/api/upload-capture", async (req, res) => {
    try {
      const { base64, fileName, contentType } = req.body;
      if (!base64 || !fileName) {
        return res.status(400).json({ error: "Missing data" });
      }

      if (!process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ error: "Missing Cloudinary configuration. Please add CLOUDINARY_API_SECRET in settings." });
      }

      console.log(`Server received upload request via Cloudinary for: ${fileName}`);

      // Ensure the base64 string includes the data URI prefix required by Cloudinary
      let uploadString = base64;
      if (!uploadString.startsWith('data:')) {
        uploadString = `data:${contentType || 'auto'};base64,${base64}`;
      }

      const uploadResult = await cloudinary.uploader.upload(uploadString, {
        resource_type: "auto",
        public_id: fileName.replace(/\.[^/.]+$/, "") // Remove only the last extension
      });

      console.log(`Upload successful to Cloudinary: ${uploadResult.secure_url}`);
      return res.json({ url: uploadResult.secure_url });

    } catch (error: any) {
      console.error("Cloudinary upload error:", error);
      const errorMessage = error.message ? error.message : "Upload rejected by Cloudinary.";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/app-version", (req, res) => {
    res.json({ version: SERVER_BOOT_VERSION });
  });

  // API to create a student user (Admin only would be better, but for simplicity we'll just implement it)
  app.post("/api/admin/create-student", async (req, res) => {
    try {
      const { name, password, semester, department } = req.body;
      
      if (!name || !password || !semester || !department) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Generate a unique Student ID (consistent with AuthGateway.tsx)
      const uniqueId = 'TH' + Math.floor(10000 + Math.random() * 90000);
      const generatedEmail = `${uniqueId.toLowerCase()}@student.tutionhub.com`;

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: generatedEmail,
        password: password,
        displayName: name,
      });

      // Save student profile to Firestore
      const db = getDb();
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        studentId: uniqueId,
        name: name,
        email: generatedEmail,
        role: 'student',
        semester: semester.toString(),
        courseName: department,
        courseId: department.toUpperCase(),
        createdAt: new Date().toISOString(),
        profileComplete: true
      });

      // Create notification for teacher
      const notifId = `enroll_admin_${userRecord.uid}`;
      await db.collection('notifications').doc(notifId).set({
        title: 'New Student Added by Teacher',
        message: `${name} has been manually enrolled in ${department} (Sem ${semester}). ID: ${uniqueId}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'enrollment'
      });

      return res.json({ 
        success: true, 
        studentId: uniqueId, 
        email: generatedEmail 
      });

    } catch (error: any) {
      console.error("Error creating student:", error);
      return res.status(500).json({ error: error.message || "Failed to create student user" });
    }
  });

  // Temporary endpoint to clear fee data
  app.post("/api/admin/clear-fees", async (req, res) => {
    try {
      const db = getDb();
      const feeSnap = await db.collection('fees').get();
      const paymentSnap = await db.collection('payments').get();
      
      const batch = db.batch();
      feeSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
      paymentSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
      
      await batch.commit();
      res.status(200).json({ success: true, message: "Fees and payments cleared" });
    } catch (error: any) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
