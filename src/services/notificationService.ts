import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch, getDocs, or } from 'firebase/firestore';
import { db } from '../firebase';

export type NotificationType = 
  | 'profile_update' 
  | 'schedule_change' 
  | 'doubt_reply' 
  | 'material_upload' 
  | 'doubt_raised' 
  | 'fee_payment' 
  | 'fee_confirmed' 
  | 'new_student';

export interface Notification {
  id?: string;
  recipientId?: string;
  targetRole?: 'teacher' | 'student' | 'admin' | 'ALL';
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: any;
  timestamp?: any;
  relatedId?: string;
  targetDept?: string;
  targetSem?: string;
  isAnonymous?: boolean;
}

export const sendNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  await addDoc(collection(db, 'notifications'), {
    ...notification,
    read: false,
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp(),
  });
};

export const subscribeToNotifications = (userId: string, targetRole: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    or(
      where('recipientId', '==', userId),
      where('targetRole', 'in', [targetRole, 'ALL'])
    ),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notification));
    callback(notifications);
  }, (error) => {
    console.error('Error subscribing to notifications:', error);
  });
};

export const markAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const markAllAsRead = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};
