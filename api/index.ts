import express from "express";
import { v2 as cloudinary } from 'cloudinary';
import admin from 'firebase-admin';

// Re-initialize Firebase Admin for Vercel
if (!admin.apps.length) {
  try {
    // On Vercel, use FIREBASE_SERVICE_ACCOUNT base64 string or applicationDefault
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('ascii'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  } catch(e) {
    console.error("Vercel Firebase Admin init error:", e);
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
    const { title, body, recipientId, targetRole, delayMs } = req.body;
    const db = admin.firestore();

    const sendPushWrapper = async () => {
      if (recipientId) {
        const userDoc = await db.collection("users").doc(recipientId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.fcmToken) {
            await admin.messaging().send({
              token: userData.fcmToken,
              notification: { title, body },
            });
            return;
          }
        }
      } else if (targetRole && targetRole !== "ALL") {
         const usersSnap = await db.collection("users").where("role", "==", targetRole).get();
         const tokens: string[] = [];
         usersSnap.forEach((doc: any) => {
           const userData = doc.data();
           if (userData.fcmToken) tokens.push(userData.fcmToken);
         });

         if (tokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
               tokens,
               notification: { title, body },
            });
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

export default app;
