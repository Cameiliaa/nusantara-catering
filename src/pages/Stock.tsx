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
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { createNotification } from '../lib/notificationService';
import { 
  Package, 
  ShoppingBag,
  Plus, 
  AlertCircle, 
  RefreshCw, 
  X, 
  TrendingDown, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Loader2,
  History,
  Info,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Stock: React.FC = () => {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [packaging, setPackaging] = useState<any[]>([]);
  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [inventoryType, setInventoryType] = useState<'ingredients' | 'packaging'>('ingredients');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: '',
    minimumThreshold: '',
  });

  useEffect(() => {
    const qIngredients = query(collection(db, 'ingredients'), orderBy('name', 'asc'));
    const unsubscribeIngredients = onSnapshot(qIngredients, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIngredients(items);
      setLoading(false);

      // Auto-migration for Ayam unit
      items.forEach(async (item: any) => {
        if (item.name.toLowerCase().includes('ayam') && item.unit !== 'potong') {
          try {
            await updateDoc(doc(db, 'ingredients', item.id), { unit: 'potong' });
          } catch (e) {
            console.error('Migration failed', e);
          }
        }
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ingredients'));

    const qPackaging = query(collection(db, 'packaging'), orderBy('name', 'asc'));
    const unsubscribePackaging = onSnapshot(qPackaging, (snapshot) => {
      setPackaging(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'packaging'));

    const qLogs = query(collection(db, 'stock_logs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      setStockLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stock_logs'));

    return () => {
      unsubscribeIngredients();
      unsubscribePackaging();
      unsubscribeLogs();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      const quantity = Number(formData.quantity);
      const threshold = Number(formData.minimumThreshold);
      const status = quantity <= threshold ? 'low stock' : 'safe';
      
      const data = {
        name: formData.name,
        quantity,
        unit: formData.unit,
        minimumThreshold: threshold,
        status,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, inventoryType, editingId), data);
        toast.success(`Barang ${inventoryType === 'ingredients' ? 'stok' : 'kemasan'} diperbarui`);
      } else {
        await addDoc(collection(db, inventoryType), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success(`Barang ${inventoryType === 'ingredients' ? 'stok' : 'kemasan'} baru ditambahkan`);
      }

      if (status === 'low stock') {
        await createNotification({
          title: 'Stok Hampir Habis',
          message: `${formData.name} tersisa ${quantity} ${formData.unit}. Segera lakukan pembelian.`,
          type: 'low_stock'
        });
      }

      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, inventoryType);
      toast.error('Gagal menyimpan barang stok');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, inventoryType, deleteId));
      toast.success(`${inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'} berhasil dihapus`);
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, inventoryType);
      toast.error('Gagal menghapus barang');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name || '',
        quantity: (item.quantity || 0).toString(),
        unit: item.unit || '',
        minimumThreshold: (item.minimumThreshold || 0).toString(),
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', quantity: '', unit: '', minimumThreshold: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', quantity: '', unit: '', minimumThreshold: '' });
  };

  const currentItems = inventoryType === 'ingredients' ? ingredients : packaging;
  const lowStockItems = [...ingredients, ...packaging].filter(i => (i.quantity || 0) <= (i.minimumThreshold || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Manajemen Inventaris</h1>
          <p className="text-gray-500 text-sm">Kontrol bahan baku Anda dan pantau kesehatan stok.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
             <button 
              onClick={() => { setActiveTab('inventory'); setInventoryType('ingredients'); }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'inventory' && inventoryType === 'ingredients' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Package className="w-3.5 h-3.5" />
               Bahan Baku
             </button>
             <button 
              onClick={() => { setActiveTab('inventory'); setInventoryType('packaging'); }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'inventory' && inventoryType === 'packaging' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <ShoppingBag className="w-3.5 h-3.5" />
               Kemasan
             </button>
             <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <History className="w-3.5 h-3.5" />
               Riwayat
             </button>
          </div>
          {activeTab === 'inventory' && (
            <button 
              onClick={() => openModal()}
              className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              Baru
            </button>
          )}
        </div>
      </div>

      {lowStockItems.length > 0 && activeTab === 'inventory' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-2xl flex items-center gap-4 text-red-700 shadow-sm"
        >
          <div className="p-2 bg-white rounded-lg text-red-500 shadow-sm">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-sm uppercase tracking-wider">Kritis: Peringatan Stok Rendah</p>
            <p className="text-xs opacity-80">{lowStockItems.length} barang berada di bawah ambang batas minimum. Disarankan untuk pengadaan.</p>
          </div>
        </motion.div>
      )}

      {activeTab === 'inventory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-orange-50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/50 border-b border-orange-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{inventoryType === 'ingredients' ? 'Bahan Baku' : 'Kemasan'}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stok Tersedia</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kesehatan</th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                       Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={4} className="px-6 py-4 h-16 bg-slate-50/50" />
                        </tr>
                      ))
                    ) : currentItems.length > 0 ? currentItems.map((item) => {
                      const isLow = (item.quantity || 0) <= (item.minimumThreshold || 0);
                      const percentage = Math.min(100, Math.max(0, (item.quantity / (item.minimumThreshold * 3)) * 100)); // Visual scale
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{item.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.unit}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-bold ${isLow ? 'text-red-500' : 'text-slate-700'}`}>
                                  {item.quantity} {item.unit}
                                </span>
                                <span className="text-[10px] text-slate-400">Min. {item.minimumThreshold}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full flex overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className={`h-full ${isLow ? 'bg-red-500 animate-pulse' : percentage < 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              isLow ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} />
                              {isLow ? 'Tidak Aman' : 'Stabil'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openModal(item)} className="p-2 hover:bg-primary/10 text-slate-400 hover:text-primary rounded-lg transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => confirmDelete(item.id)} 
                                disabled={isDeleting}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-300">
                             <Package className="w-12 h-12 opacity-20" />
                             <p className="text-sm italic">Inventaris {inventoryType === 'ingredients' ? 'bahan baku' : 'kemasan'} kosong. Mulailah menambahkan barang.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
              <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Statistik Inventaris
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div>
                     <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total {inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'}</p>
                     <p className="text-2xl font-bold text-slate-800">{currentItems.length}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Stok Rendah</p>
                     <p className="text-2xl font-bold text-red-500">{lowStockItems.length}</p>
                   </div>
                </div>
                <div className="pt-4 border-t border-primary/10">
                  <p className="text-[10px] text-slate-400 italic">"Manajemen inventaris yang baik adalah 90% dari bisnis katering yang sukses."</p>
                </div>
              </div>
            </div>

            {lowStockItems.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-red-50 shadow-sm">
                <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Perlu Isi Ulang
                </h3>
                <div className="space-y-3">
                  {lowStockItems.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                      <span className="text-xs font-bold text-slate-700">{item.name}</span>
                      <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-1 rounded-lg border border-red-100">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                  {lowStockItems.length > 5 && (
                    <p className="text-[10px] text-center text-slate-400">Dan {lowStockItems.length - 5} barang lainnya...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-orange-50 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
             <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
               <ArrowRightLeft className="w-4 h-4 text-primary" />
               Pergerakan Terkini
             </h3>
             <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Perubahan yang Dicatat Otomatis</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 border-b border-orange-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waktu</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bahan Baku</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stockLogs.length > 0 ? stockLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {log.createdAt?.toDate().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                      {log.ingredientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">
                         {log.productionId ? 'Penggunaan Dapur' : 'Entri Manual'}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-400 line-through">{log.previousQuantity}</span>
                         <div className="w-2 h-0.5 bg-slate-300" />
                         <span className="text-xs font-bold text-primary">-{log.usedQuantity}</span>
                         <div className="w-2 h-0.5 bg-slate-300" />
                         <span className="text-xs font-bold text-slate-800">{log.remainingQuantity}</span>
                       </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada log pergerakan yang ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <h2 className="text-xl font-bold text-slate-800">{editingId ? `Edit ${inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'}` : `Tambah ${inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'} Baru`}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] md:max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama {inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-700"
                    placeholder="misal: Beras, Ayam, Bumbu Halus"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stok Saat Ini</label>
                    <input
                      type="number"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Satuan</label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-700 placeholder:font-normal"
                      placeholder="kg, potong, pcs, liter"
                    />
                    {formData.name.toLowerCase().includes('ayam') && (
                      <p className="text-[9px] font-bold text-primary italic">Catatan: Untuk Ayam dianjurkan menggunakan satuan "potong".</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ambang Batas Peringatan Minimum</label>
                  <input
                    type="number"
                    required
                    value={formData.minimumThreshold}
                    onChange={(e) => setFormData({...formData, minimumThreshold: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 italic">Sistem akan memperingatkan Anda saat stok turun di bawah angka ini.</p>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={btnLoading}
                    className="flex-1 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {btnLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {editingId ? 'Simpan Perubahan' : 'Konfirmasi Barang'}
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
        title={`Hapus ${inventoryType === 'ingredients' ? 'Bahan' : 'Kemasan'}?`}
        description="Data stok ini akan dihapus permanen. Hal ini dapat mempengaruhi perhitungan resep yang menggunakan bahan ini."
      />
    </div>
  );
};

export default Stock;

