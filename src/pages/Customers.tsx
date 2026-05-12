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
  where,
  writeBatch,
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Search, 
  Plus, 
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
        const q = query(collection(db, 'customers'), where('phone', '==', formData.phone));
        const querySnap = await getDocs(q);
        
        if (!editingId && !querySnap.empty) {
          toast.error('Nomor telepon sudah terdaftar');
          setBtnLoading(false);
          return;
        }

        if (editingId) {
          await updateDoc(doc(db, 'customers', editingId), {
            ...formData,
            updatedAt: serverTimestamp(),
          });

          // Sync to other collections
          const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', editingId));
          const prodQuery = query(collection(db, 'production'), where('customerId', '==', editingId));
          const transQuery = query(collection(db, 'transactions'), where('customerId', '==', editingId));
          
          const [ordersSnap, prodSnap, transSnap] = await Promise.all([
            getDocs(ordersQuery),
            getDocs(prodQuery),
            getDocs(transQuery)
          ]);

          const batch = writeBatch(db);
          ordersSnap.forEach(d => batch.update(d.ref, { customerName: formData.name, customerPhone: formData.phone }));
          prodSnap.forEach(d => batch.update(d.ref, { customerName: formData.name }));
          transSnap.forEach(d => batch.update(d.ref, { customerName: formData.name }));
          await batch.commit();

          toast.success('Pelanggan dan data terkait berhasil diperbarui');
        } else {
          await addDoc(collection(db, 'customers'), {
            ...formData,
            createdAt: serverTimestamp(),
          });
          toast.success('Pelanggan berhasil ditambahkan');
        }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'customers');
      toast.error('Gagal menyimpan pelanggan');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'customers', deleteId));
      toast.success('Pelanggan berhasil dihapus');
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'customers');
      toast.error('Gagal menghapus pelanggan');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const openModal = (customer?: any) => {
    if (customer) {
      setEditingId(customer.id);
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', email: '', address: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', phone: '', email: '', address: '' });
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pelanggan</h1>
          <p className="text-slate-500 text-sm">Kelola database klien Anda untuk pemesanan yang lebih mudah.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          Tambah Pelanggan
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau telepon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-orange-50 animate-pulse" />
          ))
        ) : filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
          <motion.div 
            layout
            key={customer.id}
            className="bg-white p-6 rounded-2xl border border-orange-50 shadow-sm relative group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-primary font-bold text-xl">
                {customer.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(customer)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => confirmDelete(customer.id)} 
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-110"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-4">{customer.name}</h3>
            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{customer.email || 'Tidak ada email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{customer.address}</span>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-2xl border border-orange-50">
            Pelanggan tidak ditemukan.
          </div>
        )}
      </div>

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
                <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] md:max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Misal: Budi Santoso"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telepon</label>
                      <input
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="0812..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="opsional"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alamat</label>
                    <textarea
                      required
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Alamat pengiriman lengkap..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={btnLoading}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {btnLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {editingId ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                  </button>
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
        title="Hapus Pelanggan?"
        description="Data pelanggan ini akan dihapus secara permanen. Pastikan tidak ada pesanan aktif untuk pelanggan ini."
      />
    </div>
  );
};

export default Customers;
