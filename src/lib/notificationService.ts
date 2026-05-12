import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'low_stock' | 'order_completed' | 'order_pending' | 'production_today' | 'large_expense' | 'info';

export interface AppNotification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: any;
  link?: string;
}

export const createNotification = async (notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notif,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

export const markAllAsRead = async () => {
  try {
    const q = query(collection(db, 'notifications'), where('read', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
};

export const deleteNotification = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (err) {
    console.error('Error deleting notification:', err);
  }
};
