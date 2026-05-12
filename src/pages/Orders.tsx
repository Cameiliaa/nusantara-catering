import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { deductStockForOrder, createIncomeTransaction } from '../lib/stockService';
import { createNotification } from '../lib/notificationService';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  User,
  Edit2,
  Trash2,
  Loader2,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    orderDate: '',
    deliveryAddress: '',
    status: 'pending',
    note: '',
    selectedItems: [] as { menuId: string, name: string, price: number, quantity: number }[],
  });

  const [menuSearch, setMenuSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const unsubscribeMenu = onSnapshot(collection(db, 'menu'), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeMenu();
      unsubscribeCustomers();
    };
  }, []);

  const calculateTotal = () => {
    return formData.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleAddItem = (menu: any) => {
    const existing = formData.selectedItems.find(i => i.menuId === menu.id);
    if (existing) {
      setFormData({
        ...formData,
        selectedItems: formData.selectedItems.map(i => 
          i.menuId === menu.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      });
    } else {
      setFormData({
        ...formData,
        selectedItems: [...formData.selectedItems, {
          menuId: menu.id,
          name: menu.name,
          price: menu.price,
          quantity: 1
        }]
      });
    }
    setMenuSearch('');
  };

  const handleRemoveItem = (menuId: string) => {
    setFormData({
      ...formData,
      selectedItems: formData.selectedItems.filter(i => i.menuId !== menuId)
    });
  };

  const handleUpdateQuantity = (menuId: string, delta: number) => {
    setFormData({
      ...formData,
      selectedItems: formData.selectedItems.map(i => 
        i.menuId === menuId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedItems.length === 0) {
      toast.error('Silakan tambahkan setidaknya satu item menu');
      return;
    }
    setBtnLoading(true);
    try {
      let finalCustomerId = formData.customerId;

      // Ensure customer exists or update it (phone as key)
      const customerData = {
        name: formData.customerName,
        phone: formData.customerPhone,
        address: formData.customerAddress || formData.deliveryAddress,
        updatedAt: serverTimestamp(),
      };

      const q = query(collection(db, 'customers'), where('phone', '==', formData.customerPhone));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        finalCustomerId = querySnap.docs[0].id;
        await updateDoc(doc(db, 'customers', finalCustomerId), customerData);
      } else {
        const custRef = await addDoc(collection(db, 'customers'), {
          ...customerData,
          createdAt: serverTimestamp(),
        });
        finalCustomerId = custRef.id;
      }

      const orderData = {
        customerId: finalCustomerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        orderDate: formData.orderDate,
        deliveryAddress: formData.deliveryAddress,
        status: formData.status,
        note: formData.note,
        menuItems: formData.selectedItems,
        totalPrice: calculateTotal(),
        updatedAt: serverTimestamp(),
      };

      let orderId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'orders', editingId), orderData);
        
        // Update corresponding production record if exists
        const pQuery = query(collection(db, 'production'), where('orderId', '==', editingId));
        const pSnap = await getDocs(pQuery);
        if (!pSnap.empty) {
          const productionId = pSnap.docs[0].id;
          await updateDoc(doc(db, 'production', productionId), {
            customerName: formData.customerName,
            productionDate: formData.orderDate,
            menuItems: formData.selectedItems,
            quantity: formData.selectedItems.reduce((sum, item) => sum + item.quantity, 0),
            updatedAt: serverTimestamp(),
          });
        }
        
        toast.success('Pesanan berhasil diperbarui');
      } else {
        const orderRef = await addDoc(collection(db, 'orders'), {
          ...orderData,
          createdAt: serverTimestamp(),
        });
        orderId = orderRef.id;
        toast.success('Pesanan berhasil dibuat');

        // Notification for new pending order
        await createNotification({
          title: 'Pesanan Baru Diterima',
          message: `Pesanan baru dari ${formData.customerName} menunggu untuk dijadwalkan.`,
          type: 'order_pending'
        });

        // Automatically create production schedule
        await addDoc(collection(db, 'production'), {
          orderId: orderId,
          customerName: formData.customerName,
          productionDate: formData.orderDate,
          menuItems: formData.selectedItems,
          quantity: formData.selectedItems.reduce((sum, item) => sum + item.quantity, 0),
          status: 'scheduled',
          assignedTo: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success('Jadwal produksi otomatis dibuat');
      }

      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'orders');
      toast.error('Gagal menyimpan pesanan');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      // Cascading delete: Find related production and transactions
      const pQuery = query(collection(db, 'production'), where('orderId', '==', deleteId));
      const tQuery = query(collection(db, 'transactions'), where('orderId', '==', deleteId));
      
      const [pSnap, tSnap] = await Promise.all([
        getDocs(pQuery),
        getDocs(tQuery)
      ]);

      // Delete order itself
      await deleteDoc(doc(db, 'orders', deleteId));

      // Batch delete related records
      const batch = writeBatch(db);
      
      pSnap.forEach(pDoc => batch.delete(pDoc.ref));
      tSnap.forEach(tDoc => batch.delete(tDoc.ref));
      
      await batch.commit();

      toast.success('Pesanan dan data terkait berhasil dihapus');
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'orders');
      toast.error('Gagal menghapus pesanan');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const openModal = (order?: any) => {
    if (order) {
      setEditingId(order.id);
      setFormData({
        customerId: order.customerId || '',
        customerName: order.customerName || '',
        customerPhone: order.customerPhone || '',
        customerAddress: order.customerAddress || '',
        orderDate: order.orderDate || '',
        deliveryAddress: order.deliveryAddress || '',
        status: order.status || 'pending',
        note: order.note || '',
        selectedItems: order.menuItems || [],
      });
    } else {
      setEditingId(null);
      setFormData({
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        orderDate: '',
        deliveryAddress: '',
        status: 'pending',
        note: '',
        selectedItems: []
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderDate: '',
      deliveryAddress: '',
      status: 'pending',
      note: '',
      selectedItems: []
    });
    setMenuSearch('');
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredMenuItems = menuItems.filter(m => 
    m.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    m.category.toLowerCase().includes(menuSearch.toLowerCase())
  ).slice(0, 5);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pesanan</h1>
          <p className="text-slate-500 text-sm">Pantau dan kelola semua pesanan katering di satu tempat.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          Tambah Pesanan Baru
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan ID atau nama pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="processing">Diproses</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-orange-50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-orange-50 border-b border-orange-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID Pesanan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Menu</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-4 h-16 bg-slate-50/50" />
                  </tr>
                ))
              ) : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">#{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">{order.customerName}</span>
                      <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {order.menuItems?.map((item: any, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 text-[10px] rounded text-slate-600 border border-slate-200">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                    {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{formatIDR(order.totalPrice)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'completed' ? 'Selesai' :
                       order.status === 'processing' ? 'Diproses' :
                       order.status === 'cancelled' ? 'Dibatalkan' :
                       'Menunggu'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(order)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => confirmDelete(order.id)} 
                        disabled={isDeleting}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-110"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <ShoppingBag className="w-12 h-12 opacity-20" />
                      <p className="text-sm italic">Pesanan tidak ditemukan.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
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
              className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden relative shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-orange-50 flex items-center justify-between bg-orange-50/50">
                  <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Pesanan' : 'Tambah Pesanan Baru'}</h2>
                  <button type="button" onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-white">
                  {/* Left Column: Customer & Details */}
                  <div className="w-full md:flex-1 p-6 md:p-8 space-y-6 md:overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-2">Informasi Pelanggan</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Pelanggan</label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              value={formData.customerName}
                              onChange={(e) => {
                                setFormData({...formData, customerName: e.target.value});
                                setCustomerSearch(e.target.value);
                                setShowCustomerDropdown(true);
                              }}
                              onFocus={() => setShowCustomerDropdown(true)}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                              placeholder="Cari atau ketik nama..."
                            />
                            {showCustomerDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[60] overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto">
                                {customers.filter(c => 
                                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                  c.phone.includes(customerSearch)
                                ).slice(0, 5).map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        customerId: c.id,
                                        customerName: c.name,
                                        customerPhone: c.phone,
                                        customerAddress: c.address || '',
                                        deliveryAddress: c.address || formData.deliveryAddress
                                      });
                                      setCustomerSearch(c.name);
                                      setShowCustomerDropdown(false);
                                    }}
                                    className="w-full p-3 text-left hover:bg-orange-50 transition-colors flex justify-between items-center"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-800">{c.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                  </button>
                                ))}
                                {customerSearch && customers.filter(c => 
                                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                  c.phone.includes(customerSearch)
                                ).length === 0 && (
                                  <div className="p-3 text-center text-[10px] text-slate-400 italic">
                                    Pelanggan baru: "{customerSearch}"
                                    <button 
                                      type="button"
                                      onClick={() => setShowCustomerDropdown(false)}
                                      className="block w-full text-primary font-bold mt-1"
                                    >
                                      Teruskan sebagai data baru
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nomor Telepon</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              value={formData.customerPhone}
                              onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                              placeholder="0812345..."
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Pengiriman</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                          <textarea
                            required
                            rows={2}
                            value={formData.deliveryAddress}
                            onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm shadow-sm"
                            placeholder="Alamat pengiriman lengkap..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Pengiriman</label>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="date"
                              required
                              value={formData.orderDate}
                              onChange={(e) => setFormData({...formData, orderDate: e.target.value})}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Pesanan</label>
                          <div className="flex items-center h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                              formData.status === 'completed' ? 'bg-green-100 text-green-700' :
                              formData.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                              formData.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {formData.status === 'completed' ? 'Selesai' :
                               formData.status === 'processing' ? 'Diproses' :
                               formData.status === 'cancelled' ? 'Dibatalkan' :
                               'Menunggu'}
                            </span>
                            <span className="ml-2 text-[10px] text-slate-400 italic font-medium">Dikelola melalui modul Produksi</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catatan Khusus</label>
                        <textarea
                          rows={2}
                          value={formData.note}
                          onChange={(e) => setFormData({...formData, note: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm shadow-sm"
                          placeholder="Alergi, permintaan khusus, dll..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Menu Items Selection */}
                  <div className="w-full md:w-[450px] bg-slate-50/50 p-6 md:p-8 flex flex-col md:overflow-hidden min-h-[400px]">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-2 mb-4">Pilihan Menu</h3>
                    
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari item menu..."
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                      />
                      {menuSearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[70] overflow-hidden divide-y divide-slate-50 max-h-60 overflow-y-auto">
                          {filteredMenuItems.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleAddItem(m)}
                              className="w-full p-4 text-left hover:bg-orange-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800">{m.name}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{m.category}</span>
                              </div>
                              <span className="text-sm font-bold text-primary">{formatIDR(m.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 md:overflow-y-auto space-y-3 mb-6 min-h-[200px]">
                      {formData.selectedItems.length > 0 ? formData.selectedItems.map((item, idx) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={item.menuId} 
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 truncate">{item.name}</h4>
                            <p className="text-[10px] text-slate-400">{formatIDR(item.price)} / porsi</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200">
                              <button 
                                type="button" 
                                onClick={() => handleUpdateQuantity(item.menuId, -1)}
                                className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors font-bold text-lg"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                              <button 
                                type="button" 
                                onClick={() => handleUpdateQuantity(item.menuId, 1)}
                                className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors font-bold text-lg"
                              >
                                +
                              </button>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveItem(item.menuId)}
                              className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                          <Plus className="w-8 h-8 opacity-20" />
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Belum ada menu dipilih.<br/>Gunakan kolom pencarian di atas.</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto md:sticky md:bottom-0 bg-slate-50/80 backdrop-blur-sm p-4 rounded-2xl border border-primary/10 shadow-inner">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimasi Total</span>
                        <span className="text-2xl font-black text-primary">{formatIDR(calculateTotal())}</span>
                      </div>
                      <button 
                        type="submit" 
                        disabled={btnLoading}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold font-display text-lg shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                      >
                        {btnLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                        {editingId ? 'SIMPAN PERUBAHAN' : 'BUAT PESANAN'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Pesanan?"
        description="Menghapus pesanan ini juga akan menghapus data produksi dan transaksi terkait. Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
};

export default Orders;
