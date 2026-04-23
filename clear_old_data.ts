import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)" && config.firestoreDatabaseId !== "")
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

async function clearData() {
  console.log("Clearing old courses...");
  const coursesSnap = await getDocs(collection(db, "courses"));
  for (const d of coursesSnap.docs) {
    await deleteDoc(doc(db, "courses", d.id));
    console.log("Deleted course:", d.id);
  }
  console.log("Done clearing courses.");
}

clearData().catch(console.error);
