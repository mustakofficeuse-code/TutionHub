import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";

import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  console.log(`Initializing Firebase Admin for project: ${firebaseConfig.projectId}`);

  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
        });
        console.log("Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT");
      } catch(e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
      }
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log("Firebase Admin initialized with Application Default Credentials");
    }
  }

  app.use(express.json({ limit: '50mb' }));

  // API to send push notification using FCM
  app.post("/api/send-push", async (req, res) => {
    try {
      const { title, body, recipientId, targetRole } = req.body;
      const db = admin.firestore();

      if (recipientId) {
        // Send to specific user
        const userDoc = await db.collection("users").doc(recipientId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.fcmToken) {
            await admin.messaging().send({
              token: userData.fcmToken,
              notification: { title, body },
            });
            return res.json({ success: true, message: "Push sent to specific user" });
          }
        }
        return res.json({ success: false, message: "No FCM token directly found for user" });
      } else if (targetRole && targetRole !== "ALL") {
         // Send to users matching role
         const usersSnap = await db.collection("users").where("role", "==", targetRole).get();
         const tokens: string[] = [];
         usersSnap.forEach((doc) => {
           const userData = doc.data();
           if (userData.fcmToken) tokens.push(userData.fcmToken);
         });

         if (tokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
               tokens,
               notification: { title, body },
            });
            return res.json({ success: true, message: `Push sent to ${tokens.length} users with role ${targetRole}` });
         }
      }
      return res.json({ success: false, message: "No target for notification or no tokens found" });
    } catch (e: any) {
      console.error("Push send error:", e);
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
      const db = admin.firestore();
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
      const db = admin.firestore();
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
