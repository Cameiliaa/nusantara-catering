import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bell, Check, Trash2, X, AlertTriangle, ShoppingBag, ChefHat, ArrowDownCircle, Info, Calendar } from 'lucide-react';
import { AppNotification, markAllAsRead, deleteNotification } from '../lib/notificationService';
import { motion, AnimatePresence } from 'motion/react';

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'order_completed': return <ShoppingBag className="w-4 h-4 text-green-500" />;
      case 'order_pending': return <ShoppingBag className="w-4 h-4 text-yellow-500" />;
      case 'production_today': return <ChefHat className="w-4 h-4 text-blue-500" />;
      case 'large_expense': return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all focus:ring-2 focus:ring-primary/20"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/5 lg:bg-transparent" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed lg:absolute top-20 lg:top-auto left-4 right-4 lg:left-auto lg:right-0 lg:mt-3 lg:w-96 bg-white border border-slate-100 rounded-3xl lg:rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh] lg:max-h-none flex flex-col"
            >
              <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">Notifikasi</h3>
                  {unreadCount > 0 && (
                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} Baru
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-primary hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Baca Semua
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg lg:hidden">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-50 custom-scrollbar">
                {notifications.length > 0 ? notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    className={`p-4 md:p-5 flex gap-4 hover:bg-slate-50 transition-colors relative group cursor-pointer ${!notif.read ? 'bg-orange-50/20' : ''}`}
                    onClick={() => notif.id && markAsRead(notif.id)}
                  >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      notif.type === 'low_stock' ? 'bg-orange-100 text-orange-600' :
                      notif.type === 'order_completed' ? 'bg-green-100 text-green-600' :
                      notif.type === 'production_today' ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <h4 className={`text-xs md:text-sm font-bold truncate leading-tight mb-1 ${!notif.read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {notif.title}
                      </h4>
                      <p className="text-[10px] md:text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="w-3 h-3 text-slate-300" />
                        <span className="text-[9px] md:text-[10px] text-slate-400 font-medium">
                          {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notif.id) deleteNotification(notif.id);
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {!notif.read && (
                      <div className="absolute top-5 right-4 w-2 h-2 bg-primary rounded-full shadow-lg shadow-primary/20 group-hover:hidden" />
                    )}
                  </div>
                )) : (
                  <div className="py-16 text-center text-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100/50">
                      <Bell className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm italic font-medium">Belum ada notifikasi.</p>
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-4 bg-slate-50 text-center border-t border-slate-100 font-bold text-[10px] text-slate-400 uppercase tracking-widest shrink-0">
                  History Notifikasi Aktif
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
