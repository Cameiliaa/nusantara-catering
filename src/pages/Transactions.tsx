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
  getDocs,
  where,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { createNotification } from '../lib/notificationService';
import { 
  Wallet, 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search, 
  X, 
  Calendar,
  Edit2,
  Trash2,
  Loader2,
  TrendingDown,
  ShoppingBag,
  Package,
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import { exportToCSV, exportToExcel } from '../lib/exportUtils';

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]); // To store either ingredients or packaging for dropdowns
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Categories
  const expenseCategories = [
    'Stock Purchase',
    'Packaging',
    'Kitchen Equipment',
    'Electricity',
    'Gas',
    'Transportation',
    'Salary',
    'Other Expense'
  ];

  // Translation mapping for display
  const categoryTranslations: {[key: string]: string} = {
    'Stock Purchase': 'Pembelian Stok',
    'Packaging': 'Kemasan',
    'Kitchen Equipment': 'Peralatan Dapur',
    'Electricity': 'Listrik',
    'Gas': 'Gas',
    'Transportation': 'Transportasi',
    'Salary': 'Gaji',
    'Other Expense': 'Biaya Lainnya',
    'Order Payment': 'Pembayaran Pesanan'
  };

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income',
    description: '',
    category: 'Stock Purchase',
    amount: '',
    itemName: '',
    quantity: '',
    unit: '',
    notes: '',
    addToStock: true, // New field to decide if new items should be added to stock
  });

  const [activeTypeTab, setActiveTypeTab] = useState<'expense'>('expense');
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return unsubscribe;
  }, []);

  // Fetch items when category is Stock Purchase or Packaging
  useEffect(() => {
    if (formData.category === 'Stock Purchase' || formData.category === 'Packaging') {
      const collectionName = formData.category === 'Stock Purchase' ? 'ingredients' : 'packaging';
      const q = query(collection(db, collectionName), orderBy('name', 'asc'));
      getDocs(q).then(snapshot => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }).catch(err => {
        console.error('Failed to fetch items:', err);
      });
    } else {
      setItems([]);
    }
  }, [formData.category]);

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const handleSelectItem = (item: any) => {
    setFormData({
      ...formData,
      itemName: item.name,
      unit: item.unit || formData.unit,
      description: `Pembelian ${item.name}`
    });
    setItemSearch(item.name);
    setShowItemDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      const data = {
        ...formData,
        amount: Number(formData.amount),
        quantity: formData.quantity ? Number(formData.quantity) : null,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), data);
        toast.success('Transaksi diperbarui');
      } else {
        // Use a Firestore Transaction to ensure stock update and financial entry are atomic
        if (formData.category === 'Stock Purchase' || formData.category === 'Packaging') {
          const collectionName = formData.category === 'Stock Purchase' ? 'ingredients' : 'packaging';
          
          await runTransaction(db, async (transaction) => {
            // Find item by name (to update quantity)
            const itemQuery = query(collection(db, collectionName), where('name', '==', formData.itemName));
            const itemSnap = await getDocs(itemQuery);
            
            let itemId = '';
            
            if (!itemSnap.empty) {
              const itemRef = doc(db, collectionName, itemSnap.docs[0].id);
              const currentItem = itemSnap.docs[0].data();
              const newQuantity = (currentItem.quantity || 0) + Number(formData.quantity);
              itemId = itemSnap.docs[0].id;
              
              transaction.update(itemRef, { 
                quantity: newQuantity,
                status: newQuantity <= (currentItem.minimumThreshold || 0) ? 'low stock' : 'safe',
                updatedAt: serverTimestamp() 
              });

              // Create stock log
              const logRef = doc(collection(db, 'stock_logs'));
              transaction.set(logRef, {
                ingredientId: itemId,
                ingredientName: formData.itemName,
                previousQuantity: currentItem.quantity || 0,
                usedQuantity: -Number(formData.quantity),
                remainingQuantity: newQuantity,
                type: 'purchase',
                createdAt: serverTimestamp()
              });
            } else if (formData.addToStock) {
              // Create new item in stock if not found and addToStock is true
              const newItemRef = doc(collection(db, collectionName));
              itemId = newItemRef.id;
              transaction.set(newItemRef, {
                name: formData.itemName,
                quantity: Number(formData.quantity),
                unit: formData.unit,
                category: formData.category === 'Stock Purchase' ? 'Sayuran' : 'Plastik', // Defaults
                minimumThreshold: 5,
                status: 'safe',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });

              // Create stock log for new item
              const logRef = doc(collection(db, 'stock_logs'));
              transaction.set(logRef, {
                ingredientId: itemId,
                ingredientName: formData.itemName,
                previousQuantity: 0,
                usedQuantity: -Number(formData.quantity),
                remainingQuantity: Number(formData.quantity),
                type: 'purchase',
                createdAt: serverTimestamp()
              });
            }

            // Create transaction document
            const newTransactionRef = doc(collection(db, 'transactions'));
            transaction.set(newTransactionRef, {
              ...data,
              itemId: itemId || null,
              createdAt: serverTimestamp(),
            });
          });
          toast.success('Transaksi dan Stok berhasil diperbarui');
        } else {
          await addDoc(collection(db, 'transactions'), {
            ...data,
            createdAt: serverTimestamp(),
          });
          toast.success('Transaksi ditambahkan');
        }
      }

      if (data.type === 'expense' && data.amount >= 2000000) {
        await createNotification({
          title: 'Pengeluaran Besar Terdeteksi',
          message: `Pengeluaran sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.amount)} untuk ${data.description}.`,
          type: 'large_expense'
        });
      }

      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
      toast.error('Gagal menyimpan transaksi');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'transactions', deleteId));
      toast.success('Transaksi berhasil dihapus');
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
      toast.error('Gagal menghapus transaksi');
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
        date: item.date || new Date().toISOString().split('T')[0],
        type: item.type || 'income',
        description: item.description || '',
        category: item.category || '',
        amount: item.amount?.toString() || '',
        itemName: item.itemName || '',
        quantity: item.quantity?.toString() || '',
        unit: item.unit || '',
        notes: item.notes || '',
        addToStock: true,
      });
      setItemSearch(item.itemName || '');
    } else {
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        description: '',
        category: 'Stock Purchase',
        amount: '',
        itemName: '',
        quantity: '',
        unit: '',
        notes: '',
        addToStock: true,
      });
      setItemSearch('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setItemSearch('');
    setShowItemDropdown(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      description: '',
      category: 'Stock Purchase',
      amount: '',
      itemName: '',
      quantity: '',
      unit: '',
      notes: '',
      addToStock: true,
    });
  };

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);

  const handleExport = (format: 'csv' | 'excel') => {
    setExportLoading(true);
    try {
      const dataToExport = transactions.map(t => ({
        'ID Transaksi': t.id.slice(0, 8).toUpperCase(),
        'Tanggal': t.date,
        'Tipe': t.type === 'income' ? 'Pendapatan' : 'Pengeluaran',
        'Kategori': categoryTranslations[t.category] || t.category || 'Umum',
        'Deskripsi': t.description,
        'Jumlah (IDR)': t.amount,
        'Catatan': t.notes || ''
      }));

      const dateStr = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toLowerCase().replace(' ', '-');
      const filename = `transaksi-katering-${dateStr}`;

      if (format === 'csv') {
        exportToCSV(dataToExport, `${filename}.csv`);
        toast.success('CSV berhasil diunduh');
      } else {
        exportToExcel(dataToExport, `${filename}.xlsx`, 'Transaksi');
        toast.success('Excel berhasil diunduh');
      }
    } catch (err) {
      toast.error('Gagal mengekspor data');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Log Transaksi</h1>
          <p className="text-slate-500 text-sm">Catatan rinci pendapatan dan pengeluaran bisnis Anda.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="flex bg-white border border-orange-100 rounded-xl overflow-hidden shadow-sm w-full sm:w-auto font-bold text-xs">
            <button 
              onClick={() => handleExport('csv')}
              disabled={exportLoading || transactions.length === 0}
              className="flex-1 sm:flex-none px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-slate-600 disabled:opacity-50 border-r border-orange-50"
              title="Download CSV"
            >
              <FileText className="w-4 h-4" />
              CSV
            </button>
            <button 
              onClick={() => handleExport('excel')}
              disabled={exportLoading || transactions.length === 0}
              className="flex-1 sm:flex-none px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-slate-600 disabled:opacity-50"
              title="Download Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
          </div>
          <button 
            onClick={() => openModal()}
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Transaksi Baru</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-orange-50 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
              <ArrowUpCircle className="w-5 h-5 text-green-500" />
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Pendapatan</span>
           </div>
           <h3 className="text-2xl font-bold text-slate-800">{formatIDR(totalIncome)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-orange-50 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Pengeluaran</span>
           </div>
           <h3 className="text-2xl font-bold text-slate-800">{formatIDR(totalExpense)}</h3>
        </div>
        <div className="bg-primary p-6 rounded-2xl shadow-lg shadow-primary/20">
           <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-5 h-5 text-white/70" />
              <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">Saldo Bersih</span>
           </div>
           <h3 className="text-2xl font-bold text-white">{formatIDR(totalIncome - totalExpense)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-orange-50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-orange-50 border-b border-orange-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID Transaksi</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.length > 0 ? transactions.map((t) => (
                <tr key={t.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] font-mono text-slate-400">#{t.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.type === 'income' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                      {t.type === 'income' ? (t.orderId ? 'Pendapatan (Otomatis)' : 'Pendapatan') : 'Pengeluaran'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">{t.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    {categoryTranslations[t.category] || t.category || 'Umum'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                    t.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.type === 'income' ? '+' : '-'}{formatIDR(t.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(t)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(t.id)} 
                          disabled={isDeleting}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Belum ada transaksi yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-orange-50 flex items-center justify-between bg-orange-50/50 flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe</label>
                      <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        Pengeluaran
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kategori</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {formData.type === 'income' ? (
                        <option value="Order Payment">Pembayaran Pesanan</option>
                      ) : (
                        expenseCategories.map(cat => (
                          <option key={cat} value={cat}>{categoryTranslations[cat]}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {(formData.category === 'Stock Purchase' || formData.category === 'Packaging') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Barang</label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                          <input
                            type="text"
                            required
                            value={itemSearch}
                            onChange={(e) => {
                              setItemSearch(e.target.value);
                              setFormData({...formData, itemName: e.target.value});
                              setShowItemDropdown(true);
                            }}
                            onFocus={() => setShowItemDropdown(true)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                            placeholder="Cari atau ketik nama barang..."
                          />
                          
                          <AnimatePresence>
                            {showItemDropdown && (formData.category === 'Stock Purchase' || formData.category === 'Packaging') && (
                              <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setShowItemDropdown(false)} />
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[70] overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-50"
                                >
                                  {filteredItems.length > 0 ? filteredItems.map(item => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleSelectItem(item)}
                                      className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-center justify-between group"
                                    >
                                      <div>
                                        <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Stok: {item.quantity} {item.unit}</p>
                                      </div>
                                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                                    </button>
                                  )) : itemSearch && (
                                    <div className="p-4 text-center">
                                      <p className="text-xs text-slate-500 mb-2">"{itemSearch}" tidak ditemukan</p>
                                      <button
                                        type="button"
                                        onClick={() => setShowItemDropdown(false)}
                                        className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                                      >
                                        Gunakan sebagai item baru
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        {itemSearch && !items.find(i => i.name.toLowerCase() === itemSearch.toLowerCase()) && (
                          <div className="flex items-center gap-2 mt-2 px-2">
                            <input 
                              type="checkbox" 
                              id="add-to-stock"
                              checked={formData.addToStock}
                              onChange={(e) => setFormData({...formData, addToStock: e.target.checked})}
                              className="rounded border-slate-300 text-primary focus:ring-primary h-3 w-3"
                            />
                            <label htmlFor="add-to-stock" className="text-[10px] font-bold text-slate-500 uppercase tracking-tight cursor-pointer">
                              Tambahkan ke Inventaris
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumlah</label>
                          <input
                            type="number"
                            required
                            value={formData.quantity}
                            onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Satuan</label>
                          <input
                            type="text"
                            required
                            value={formData.unit}
                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                            placeholder="kg, pcs, dll"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deskripsi / Judul</label>
                    <input
                      type="text"
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="misal: Pembayaran Pesanan #12345 atau Pembelian Beras"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total (IDR)</label>
                      <input
                        type="number"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Tambahan</label>
                      <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Catatan kecil (opsional)"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex gap-4 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 bg-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-300 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={btnLoading}
                    className="flex-1 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {btnLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {editingId ? 'Simpan Perubahan' : 'Simpan Transaksi'}
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
        title="Hapus Transaksi?"
        description="Catatan keuangan ini akan dihapus permanen. Hal ini tidak akan mengembalikan stok yang sudah ditambahkan jika ini adalah transaksi pembelian."
      />
    </div>
  );
};

export default Transactions;
