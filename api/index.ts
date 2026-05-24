import express from "express";
import { v2 as cloudinary } from 'cloudinary';
import admin from 'firebase-admin';

// Re-initialize Firebase Admin for Vercel
if (!admin.apps.length) {
  try {
    let projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let serviceAccount;
      const str = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (str.startsWith('{')) {
        serviceAccount = JSON.parse(str);
      } else {
        serviceAccount = JSON.parse(Buffer.from(str, 'base64').toString('utf-8'));
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id
      });
      console.log("Firebase Admin initialized on Vercel with FIREBASE_SERVICE_ACCOUNT");
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
      console.log("Firebase Admin initialized on Vercel with Application Default Credentials");
    }
  } catch(e) {
    console.error("Vercel Firebase Admin init error:", e);
    try {
      let projectId = process.env.VITE_FIREBASE_PROJECT_ID;
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
    } catch(e2) {
      console.error("Fallback init failed", e2);
    }
  }
}

// Re-initialize Cloudinary
cloudinary.config({ 
    cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.VITE_CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(express.json({ limit: '50mb' }));

// Dynamic session version tag that changes on server restart (which happens automatically on file edits)
const SERVER_BOOT_VERSION = "build_" + Date.now();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/upload-capture", async (req, res) => {
    try {
      const { base64, fileName, contentType } = req.body;
      if (!base64 || !fileName) return res.status(400).json({ error: "Missing data" });

      if (!process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ error: "Missing Cloudinary configuration" });
      }

      let uploadString = base64;
      if (!uploadString.startsWith('data:')) {
        uploadString = `data:${contentType || 'auto'};base64,${base64}`;
      }

      const uploadResult = await cloudinary.uploader.upload(uploadString, {
        resource_type: "auto",
        public_id: fileName.replace(/\.[^/.]+$/, "") 
      });

      res.status(200).json({ success: true, url: uploadResult.secure_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
});

app.post("/api/admin/create-student", async (req, res) => {
    try {
      const { name, password, semester, department } = req.body;
      if (!name || !password || !semester || !department) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const uniqueId = 'TH' + Math.floor(10000 + Math.random() * 90000);
      const generatedEmail = `${uniqueId.toLowerCase()}@student.tutionhub.com`;

      const userRecord = await admin.auth().createUser({
        email: generatedEmail,
        password: password,
        displayName: name,
      });

      const db = admin.firestore();
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        studentId: uniqueId,
        name,
        email: generatedEmail,
        role: 'student',
        semester: semester.toString(),
        courseName: department,
        courseId: department.toUpperCase(),
        createdAt: new Date().toISOString(),
        profileComplete: true
      });

      const notifId = `enroll_admin_${userRecord.uid}`;
      await db.collection('notifications').doc(notifId).set({
        title: 'New Student Added',
        message: `${name} has been enrolled.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'enrollment'
      });

      res.status(200).json({ success: true, studentId: uniqueId, email: generatedEmail });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create student user" });
    }
});

app.post("/api/admin/clear-fees", async (req, res) => {
    try {
      const db = admin.firestore();
      const feeSnap = await db.collection('fees').get();
      const paymentSnap = await db.collection('payments').get();
      
      const batch = db.batch();
      feeSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
      paymentSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
      
      await batch.commit();
      res.status(200).json({ success: true, message: "Fees and payments cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
});

app.post("/api/send-push", async (req, res) => {
  try {
    const { title, body, recipientId, targetRole, delayMs, targetDept, targetSem } = req.body;
    const db = admin.firestore();

    const host = req.get("host") || "tuitionhubapp.firebaseapp.com";
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const origin = `${protocol}://${host}`;
    const absoluteLogo = `${origin}/logo.png`;
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
        android: {
          priority: "high"
        },
        webpush: {
          headers: {
            Urgency: "high"
          }
        }
      };

      if (recipientId) {
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
              // Auto-heal/cleanup stale or invalid tokens so we don't try again
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
         let usersSnap;
         if (targetRole === "ALL") {
             usersSnap = await db.collection("users").get();
         } else {
             usersSnap = await db.collection("users").where("role", "==", targetRole).get();
         }
         const tokens: string[] = [];
         usersSnap.forEach((doc: any) => {
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
    const absoluteLogo = `${origin}/logo.png`;
    const absoluteBadge = `${origin}/notification-badge.png`;

    const db = admin.firestore();
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
           await admin.messaging().send({
              token: recipientDoc.data().fcmToken,
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
                headers: {
                  Urgency: "high"
                },
                notification: {
                  icon: absoluteLogo,
                  badge: absoluteBadge
                }
              }
           } as any);
       }
    }

    res.json({ success: true, messageId: docRef.id });
  } catch(e: any) {
    console.error("Chat reply error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default app;
