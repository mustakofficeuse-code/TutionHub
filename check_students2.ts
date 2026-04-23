import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkStudents() {
  const app = initializeApp({
    credential: applicationDefault()
  });

  const db = getFirestore(app);
  const students = await db.collection('users').where('role', '==', 'student').get();
  
  console.log(`Found ${students.size} students`);
  students.forEach(doc => {
      console.log(doc.id, doc.data());
  });
}
checkStudents().catch(console.error);
