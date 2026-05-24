import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";

// Load configuration
if (!fs.existsSync("./firebase-applet-config.json")) {
  console.error("firebase-applet-config.json not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)" && config.firestoreDatabaseId !== "")
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const collectionsToClear = [
  "users", 
  "notifications", 
  "departments", 
  "blacklist", 
  "attendance", 
  "fees", 
  "exams", 
  "notes", 
  "attendance_schedules", 
  "attendance_sessions", 
  "payments", 
  "materials", 
  "announcements", 
  "schedules", 
  "assignments", 
  "submissions", 
  "doubts", 
  "replies", 
  "chat_messages", 
  "sessions", 
  "suspended_users", 
  "blacklist_phones", 
  "blacklist_emails"
];

async function runNuke() {
  console.log("=== NUKE WORKSPACE DATABASE (STARTING FROM ZERO) ===");
  
  // 1. Delete app settings
  console.log("Deleting config/appSettings...");
  try {
    await deleteDoc(doc(db, "config", "appSettings"));
    console.log("✓ Deleted config/appSettings");
  } catch (err: any) {
    console.error("✗ Failed to delete config/appSettings:", err.message);
  }

  // 2. Clear collections
  for (const coll of collectionsToClear) {
    try {
      console.log(`Checking collection: ${coll}...`);
      const snap = await getDocs(collection(db, coll));
      if (snap.empty) {
        console.log(`  Collection ${coll} is already empty.`);
        continue;
      }
      console.log(`  Deleting ${snap.size} documents from ${coll}...`);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, coll, d.id));
      }
      console.log(`✓ Cleared collection: ${coll}`);
    } catch (err: any) {
      console.warn(`✗ Failed to clear collection ${coll}:`, err.message);
    }
  }

  console.log("=== DATABASE DISPATCH COMPLETED ===");
  process.exit(0);
}

runNuke().catch((err) => {
  console.error("Critical error during nuke:", err);
  process.exit(1);
});
