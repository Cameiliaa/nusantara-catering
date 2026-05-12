import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  serverTimestamp, 
  orderBy,
  where,
  getDocs,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { deductStockForOrder, createIncomeTransaction, calculateRequiredItems } from '../lib/stockService';
import { createNotification } from '../lib/notificationService';
import { 
  ChefHat, 
  Plus, 
  Search, 
  Filter,
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  X,
  Edit2,
  Trash2,
  Loader2,
  PackageCheck,
  AlertTriangle,
  ClipboardList,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Production: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    orderId: '',
    customerName: '',
    productionDate: '',
    menuItems: [] as any[],
    quantity: 0,
    assignedTo: '',
    status: 'scheduled',
  });

  const [orderSearch, setOrderSearch] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    // We'll fetch all and sort in memory for more complex priority sorting
    const qSchedules = query(collection(db, 'production'), orderBy('productionDate', 'asc'));
    const unsubscribeSchedules = onSnapshot(qSchedules, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'production'));

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qIngredients = query(collection(db, 'ingredients'));
    const unsubscribeIngredients = onSnapshot(qIngredients, (snapshot) => {
      setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeSchedules();
      unsubscribeOrders();
      unsubscribeIngredients();
    };
  }, []);

  const getStatusPriority = (status: string) => {
    switch (status) {
      case 'scheduled': return 1;
      case 'in progress': return 2;
      case 'completed': return 3;
      case 'cancelled': return 4;
      default: return 5;
    }
  };

  const filteredAndSortedSchedules = schedules
    .filter(s => {
      const matchesSearch = 
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.menuItems?.some((m: any) => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const prioA = getStatusPriority(a.status);
      const prioB = getStatusPriority(b.status);
      
      if (prioA !== prioB) return prioA - prioB;
      
      // Secondary sort: nearest production date first
      return new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime();
    });

  const syncOrderStatus = async (orderId: string, prodStatus: string, customerRef?: string) => {
    if (!orderId) return;
    let orderStatus = 'pending';
    
    if (prodStatus === 'scheduled') orderStatus = 'pending';
    else if (prodStatus === 'in progress') orderStatus = 'processing';
    else if (prodStatus === 'completed') orderStatus = 'completed';
    else if (prodStatus === 'cancelled') orderStatus = 'cancelled';

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: orderStatus,
        updatedAt: serverTimestamp()
      });

      if (prodStatus === 'completed') {
        await createNotification({
          title: 'Pesanan Selesai',
          message: `Produksi untuk pesanan dari ${customerRef || 'pelanggan'} telah selesai.`,
          type: 'order_completed'
        });
      } else if (prodStatus === 'in progress') {
        await createNotification({
          title: 'Produksi Dimulai',
          message: `Pesanan ${customerRef || ''} mulai diproses di dapur.`,
          type: 'production_today'
        });
      }
    } catch (err) {
      console.error('Failed to sync order status:', err);
    }
  };

  const handleCompleteProduction = async (productionId: string, scheduleData: any) => {
    setBtnLoading(true);
    try {
      // 1. Deduct Stock using the utility
      const stockResult = await deductStockForOrder(scheduleData.orderId, scheduleData.menuItems);
      if (stockResult.alreadyDeducted) {
        toast.info('Stok sudah dikurangi sebelumnya');
      }

      // 2. Update production status (must be done separately to confirm local state)
      await updateDoc(doc(db, 'production', productionId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      // 3. Update order status if not already done
      await updateDoc(doc(db, 'orders', scheduleData.orderId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      toast.success('Produksi selesai dan stok diperbarui!');

      // 4. Automatically create income transaction
      const transCreated = await createIncomeTransaction(scheduleData.orderId, scheduleData);
      if (transCreated) {
        toast.success('Pendapatan berhasil diperbarui');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Operasi gagal');
    } finally {
      setBtnLoading(false);
    }
  };

  const handlePreviewUsage = async (item: any) => {
    setBtnLoading(true);
    try {
      const usage = await calculateRequiredItems(item.menuItems);
      setPreviewData(usage as any[]);
      setCurrentSchedule(item);
      setShowPreviewModal(true);
    } catch (err) {
      toast.error('Gagal menghitung penggunaan');
    } finally {
      setBtnLoading(false);
    }
  };

  const [currentSchedule, setCurrentSchedule] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orderId) {
      toast.error('Silakan pilih pesanan terlebih dahulu');
      return;
    }
    setBtnLoading(true);
    try {
      const data = {
        ...formData,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        if (formData.status === 'completed') {
           const schedule = schedules.find(s => s.id === editingId);
           if (schedule.status !== 'completed') {
              await handleCompleteProduction(editingId, formData);
           } else {
              await updateDoc(doc(db, 'production', editingId), data);
           }
        } else {
          await updateDoc(doc(db, 'production', editingId), data);
          await syncOrderStatus(formData.orderId, formData.status);
        }
        toast.success('Jadwal produksi diperbarui');
      } else {
        const prodRef = await addDoc(collection(db, 'production'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'orders', formData.orderId), {
          productionId: prodRef.id,
          updatedAt: serverTimestamp()
        });
        await syncOrderStatus(formData.orderId, formData.status);
        toast.success('Jadwal produksi ditambahkan');
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'production');
      toast.error('Gagal menyimpan jadwal');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'production', deleteId));
      toast.success('Jadwal produksi berhasil dihapus');
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'production');
      toast.error('Gagal menghapus jadwal');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleSelectOrder = (order: any) => {
    setFormData({
      ...formData,
      orderId: order.id,
      customerName: order.customerName,
      productionDate: order.orderDate || '',
      menuItems: order.menuItems || [],
      quantity: order.menuItems?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
      status: 'scheduled'
    });
    setOrderSearch('');
  };

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        orderId: item.orderId || '',
        customerName: item.customerName || '',
        productionDate: item.productionDate || '',
        menuItems: item.menuItems || [],
        quantity: item.quantity || 0,
        assignedTo: item.assignedTo || '',
        status: item.status || 'scheduled',
      });
    } else {
      setEditingId(null);
      setFormData({
        orderId: '',
        customerName: '',
        productionDate: '',
        menuItems: [],
        quantity: 0,
        assignedTo: '',
        status: 'scheduled',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      orderId: '',
      customerName: '',
      productionDate: '',
      menuItems: [],
      quantity: 0,
      assignedTo: '',
      status: 'scheduled',
    });
    setOrderSearch('');
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.id.toLowerCase().includes(orderSearch.toLowerCase())
  ).slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in progress': return <PlayCircle className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'cancelled': return <Ban className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-orange-500" />;
    }
  };

  const handleQuickStatusChange = async (schedule: any, newStatus: string) => {
    if (schedule.status === newStatus) return;
    setUpdatingStatusId(schedule.id);
    try {
      if (newStatus === 'completed') {
        await handleCompleteProduction(schedule.id, schedule);
      } else {
        // Update production status
        await updateDoc(doc(db, 'production', schedule.id), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        // Sync to order
        await syncOrderStatus(schedule.orderId, newStatus, schedule.customerName);
        toast.success(`Status produksi diperbarui menjadi ${newStatus}`);
      }
    } catch (err: any) {
      console.error('Quick status change failed:', err);
      toast.error('Gagal memperbarui status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const scheduledCount = schedules.filter(s => s.status === 'scheduled').length;
  const inProgressCount = schedules.filter(s => s.status === 'in progress').length;
  const completedCount = schedules.filter(s => s.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 bg-gray-50/50 backdrop-blur-md py-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Kontrol Produksi</h1>
          <p className="text-gray-500 text-sm">Pelacakan inventaris otomatis untuk operasional dapur.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          Rencanakan Produksi
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari pelanggan, menu, ID pesanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 flex-1 md:flex-none uppercase font-bold text-slate-600"
          >
            <option value="all">Semua Status</option>
            <option value="scheduled">Dijadwalkan</option>
            <option value="in progress">Diproses</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex items-center justify-between shadow-sm">
           <div>
              <p className="text-orange-600 font-bold text-xs uppercase tracking-wider">Dijadwalkan</p>
              <h3 className="text-3xl font-bold text-orange-800 tracking-tighter">{scheduledCount}</h3>
           </div>
           <Clock className="w-10 h-10 text-orange-200" />
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm">
           <div>
              <p className="text-blue-600 font-bold text-xs uppercase tracking-wider">Memasak Aktif</p>
              <h3 className="text-3xl font-bold text-blue-800 tracking-tighter">{inProgressCount}</h3>
           </div>
           <PlayCircle className="w-10 h-10 text-blue-200" />
        </div>
        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between shadow-sm">
           <div>
              <p className="text-green-600 font-bold text-xs uppercase tracking-wider">Selesai Hari Ini</p>
              <h3 className="text-3xl font-bold text-green-800 tracking-tighter">{completedCount}</h3>
           </div>
           <CheckCircle2 className="w-10 h-10 text-green-200" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-orange-50 shadow-sm overflow-hidden">
        {/* Mobile & Tablet Card Layout */}
        <div className="block lg:hidden divide-y divide-slate-50">
          {filteredAndSortedSchedules.length > 0 ? filteredAndSortedSchedules.map((item) => (
            <div key={item.id} className="p-5 space-y-4 hover:bg-slate-50/30 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-primary uppercase leading-none mb-1">
                    {new Date(item.productionDate).toLocaleDateString('id-ID', { weekday: 'long' })}
                  </span>
                  <span className="text-base font-bold text-slate-800">
                    {new Date(item.productionDate).toLocaleDateString()}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 uppercase">
                    #{item.orderId?.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {updatingStatusId === item.id ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Updating...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        disabled={updatingStatusId === item.id || item.status === 'completed'}
                        value={item.status}
                        onChange={(e) => handleQuickStatusChange(item, e.target.value)}
                        className={`appearance-none cursor-pointer pl-7 pr-7 py-1 rounded-full text-[9px] font-bold uppercase border transition-all h-7 ${
                          item.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                          item.status === 'in progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          item.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-orange-100 text-orange-700 border-orange-200'
                        }`}
                        style={{
                          backgroundImage: (item.status !== 'completed' && item.status !== 'cancelled') ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` : 'none',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 6px center'
                        }}
                      >
                        <option value="scheduled">Dijadwalkan</option>
                        <option value="in progress">Proses</option>
                        <option value="completed">Selesai</option>
                        <option value="cancelled">Batal</option>
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none scale-75">
                        {getStatusIcon(item.status)}
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => handlePreviewUsage(item)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 text-primary rounded-lg font-bold text-[9px] uppercase border border-primary/10"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Bahan
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-orange-200">
                    {item.assignedTo?.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Penugasan</span>
                    <span className="text-sm font-bold text-slate-700">{item.assignedTo || 'Belum Ditugaskan'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {item.menuItems?.map((m: any, idx: number) => (
                    <span key={idx} className="text-[10px] bg-white px-2.5 py-1 rounded-xl text-slate-600 border border-slate-100 font-bold uppercase shadow-sm">
                      {m.quantity}x {m.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openModal(item)} 
                    className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl transition-all active:scale-90"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => confirmDelete(item.id)} 
                    disabled={isDeleting}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl transition-all active:scale-90 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {item.status !== 'completed' && item.status !== 'cancelled' && (
                  <button 
                    onClick={async () => {
                      if(confirm('Tandai sebagai SELESAI? Ini akan secara otomatis mengurangi bahan dari stok.')) {
                        await handleCompleteProduction(item.id, item);
                      }
                    }} 
                    disabled={btnLoading}
                    className="bg-green-600 text-white px-5 h-11 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95 transition-all disabled:opacity-70 text-xs uppercase tracking-wider"
                  >
                    {btnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                    Selesaikan
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className="p-16 text-center">
              <ChefHat className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-400 italic">Data produksi tidak ditemukan.</p>
            </div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-orange-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Target</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penugasan</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Dapur</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventaris</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAndSortedSchedules.length > 0 ? filteredAndSortedSchedules.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                       <span className="text-sm font-bold text-slate-800">{new Date(item.productionDate).toLocaleDateString()}</span>
                       <span className="text-[10px] font-bold text-primary uppercase">{new Date(item.productionDate).toLocaleDateString('id-ID', { weekday: 'long' })}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-[10px] font-bold text-primary border border-orange-200">
                             {item.assignedTo?.slice(0, 1).toUpperCase() || '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-600">{item.assignedTo || 'Belum Ditugaskan'}</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400">#{item.orderId?.slice(0,8).toUpperCase()}</span>
                          </div>
                       </div>
                       <div className="flex flex-wrap gap-1">
                          {item.menuItems?.map((m: any, idx: number) => (
                            <span key={idx} className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500 border border-slate-200 font-bold uppercase">
                              {m.quantity}x {m.name}
                            </span>
                          ))}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {updatingStatusId === item.id ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Updating...</span>
                      </div>
                    ) : (
                      <div className="relative group/pstatus">
                        <select
                          disabled={updatingStatusId === item.id || item.status === 'completed'}
                          value={item.status}
                          onChange={(e) => handleQuickStatusChange(item, e.target.value)}
                          className={`appearance-none cursor-pointer pl-8 pr-8 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all hover:ring-2 hover:ring-offset-1 h-8 ${
                            item.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200 cursor-default' :
                            item.status === 'in progress' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:ring-blue-400' :
                            item.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200 hover:ring-red-400' :
                            'bg-orange-100 text-orange-700 border-orange-200 hover:ring-orange-400'
                          }`}
                          style={{
                            backgroundImage: (item.status !== 'completed' && item.status !== 'cancelled') ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` : 'none',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 8px center'
                          }}
                        >
                          <option value="scheduled">Dijadwalkan</option>
                          <option value="in progress">Dalam Proses</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Dibatalkan</option>
                        </select>
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          {getStatusIcon(item.status)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                     <button 
                       onClick={() => handlePreviewUsage(item)}
                       className="p-2 hover:bg-primary/5 text-primary rounded-xl transition-all flex items-center gap-1 ml-auto"
                       title="View ingredient requirements"
                     >
                        <ClipboardList className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">Penggunaan</span>
                     </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                        {item.status !== 'completed' && item.status !== 'cancelled' && (
                          <button 
                            onClick={async () => {
                              if(confirm('Tandai sebagai SELESAI? Ini akan secara otomatis mengurangi bahan dari stok.')) {
                                await handleCompleteProduction(item.id, item);
                              }
                            }} 
                            disabled={btnLoading}
                            className="p-2 hover:bg-green-50 text-green-500 rounded-xl transition-colors"
                          >
                           {btnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => openModal(item)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-xl transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(item.id)} 
                          disabled={isDeleting}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                     <ChefHat className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                     <p className="text-sm font-medium text-slate-400 italic">Data produksi tidak ditemukan.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden relative shadow-2xl"
            >
              <div className="p-6 border-b border-orange-50 flex items-center justify-between bg-orange-50/50">
                <h2 className="text-xl font-bold text-slate-800 text-center flex-1 tracking-tight">{editingId ? 'Perhalus Rencana Produksi' : 'Mulai Batch Baru'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 absolute right-6">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] md:max-h-[75vh] overflow-y-auto custom-scrollbar">
                {!editingId && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lampirkan Pesanan Terverifikasi</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari berdasarkan pelanggan atau indeks pesanan..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-slate-700"
                      />
                      {orderSearch && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden divide-y divide-slate-50">
                          {filteredOrders.map(o => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => handleSelectOrder(o)}
                              className="w-full p-4 text-left hover:bg-orange-50 transition-colors"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{o.customerName}</div>
                                  <div className="text-[10px] text-primary font-mono font-black italic">#{o.id.slice(0,8).toUpperCase()}</div>
                                </div>
                                <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-lg border border-primary/10 font-bold uppercase tracking-widest">{o.status === 'completed' ? 'Selesai' : o.status === 'processing' ? 'Diproses' : 'Menunggu'}</div>
                              </div>
                            </button>
                          ))}
                          {filteredOrders.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Pesanan yang cocok tidak terdeteksi</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {formData.orderId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-gradient-to-br from-orange-50/50 to-white border border-orange-100 rounded-3xl space-y-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start border-b border-orange-100 pb-4">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Klien Target</h4>
                        <p className="text-sm font-black text-slate-800 uppercase italic tracking-tighter">{formData.customerName}</p>
                      </div>
                      <div className="text-right">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tanggal Produksi</h4>
                         <p className="text-sm font-bold text-primary">{new Date(formData.productionDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Beban Dapur</h4>
                      <div className="space-y-2">
                        {formData.menuItems.map((m: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-50">
                             <span className="text-slate-600">{m.name}</span>
                             <span className="text-primary tracking-widest">{m.quantity} PORSI</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t-2 border-dashed border-orange-100 pt-3 font-black text-[11px] uppercase tracking-widest">
                           <span className="text-slate-400">Total Output</span>
                           <span className="text-slate-800">{formData.quantity} PORSI</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Koki yang Ditugaskan</label>
                    <input
                      type="text"
                      required
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-slate-700"
                      placeholder="Masukkan nama staf"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Dapur</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-slate-800"
                    >
                      <option value="scheduled">Dijadwalkan</option>
                      <option value="in progress">Dalam Proses</option>
                      <option value="completed">Selesai</option>
                      <option value="cancelled">Dibatalkan</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={btnLoading}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                  >
                    {btnLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {editingId ? 'Ubah Rencana' : 'Konfirmasi Rencana'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Usage Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && currentSchedule && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreviewModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden relative shadow-2xl flex flex-col"
            >
               <div className="p-6 border-b border-orange-50 bg-orange-50/50 flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Kebutuhan Dapur
                  </h3>
                  <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="p-8 flex-1 overflow-y-auto space-y-6 max-h-[80vh] md:max-h-[70vh] custom-scrollbar">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <span className="text-xs font-bold text-slate-500 uppercase italic">Hidangan untuk:</span>
                     <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{currentSchedule.customerName}</span>
                  </div>

                  <div className="space-y-3">
                     {previewData.length > 0 ? previewData.map((req: any) => {
                       const stockItem = ingredients.find(i => i.id === req.id);
                       const currentStock = stockItem?.quantity || 0;
                       const isInsufficient = currentStock < req.quantity;

                       return (
                         <div key={req.id} className={`p-4 rounded-2xl border transition-all ${isInsufficient ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-3">
                               <div>
                                  <p className="text-xs font-black text-slate-800 uppercase">{req.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">{req.unit}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-sm font-black text-primary tracking-widest">{req.quantity}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">DIBUTUHKAN</p>
                               </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-100">
                               <div className="flex items-center gap-2 font-bold text-[10px] text-slate-500">
                                  <span>STOK SAAT INI:</span>
                                  <span className={isInsufficient ? 'text-red-600' : 'text-slate-800'}>{currentStock}</span>
                               </div>
                               {isInsufficient && (
                                 <div className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-white px-2 py-1 rounded-lg border border-red-100 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    PERINGATAN: TIDAK CUKUP
                                 </div>
                               )}
                            </div>
                         </div>
                       );
                     }) : (
                       <div className="py-20 text-center flex flex-col items-center gap-3 italic">
                          <PackageCheck className="w-10 h-10 text-slate-100" />
                          <p className="text-xs text-slate-400 px-10">Belum ada bahan yang ditentukan untuk produksi ini. Periksa Resep Menu.</p>
                       </div>
                     )}
                  </div>
               </div>

               <div className="p-8 bg-slate-50/50 border-t border-orange-50">
                  <button 
                    onClick={() => setShowPreviewModal(false)}
                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Mengerti
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Jadwal Produksi?"
        description="Data jadwal produksi ini akan dihapus permanen. Hal ini tidak akan mengembalikan stok yang sudah dikurangi jika status sudah Selesai."
      />
    </div>
  );
};

export default Production;

