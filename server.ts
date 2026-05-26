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
              icon: absoluteLogo,
              badge: absoluteBadge
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
