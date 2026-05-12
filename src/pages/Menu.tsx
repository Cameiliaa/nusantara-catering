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
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Search, 
  Plus, 
  X,
  Loader2,
  Edit2,
  Trash2,
  UtensilsCrossed,
  Clock,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Menu: React.FC = () => {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [packaging, setPackaging] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentMenu, setCurrentMenu] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Menu Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Catering Box',
    preparationTime: '30',
    imageUrl: '',
  });

  // Recipe State
  const [recipes, setRecipes] = useState<any[]>([]);
  const [newRecipe, setNewRecipe] = useState({
    ingredientId: '',
    itemType: 'ingredients' as 'ingredients' | 'packaging',
    quantityNeeded: '',
  });

  useEffect(() => {
    const qMenu = query(collection(db, 'menu'), orderBy('name', 'asc'));
    const unsubscribeMenu = onSnapshot(qMenu, (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'menu'));

    const qIngredients = query(collection(db, 'ingredients'), orderBy('name', 'asc'));
    const unsubscribeIngredients = onSnapshot(qIngredients, (snapshot) => {
      setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ingredients'));

    const qPackaging = query(collection(db, 'packaging'), orderBy('name', 'asc'));
    const unsubscribePackaging = onSnapshot(qPackaging, (snapshot) => {
      setPackaging(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'packaging'));

    return () => {
      unsubscribeMenu();
      unsubscribeIngredients();
      unsubscribePackaging();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      const data = {
        ...formData,
        price: Number(formData.price),
        preparationTime: Number(formData.preparationTime),
        imageUrl: formData.imageUrl || '',
      };

      if (editingId) {
        await updateDoc(doc(db, 'menu', editingId), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success('Item menu berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'menu'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success('Item menu berhasil ditambahkan');
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'menu');
      toast.error('Gagal menyimpan item menu');
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      // Cascading delete: Find related recipes
      const rQuery = query(collection(db, 'menu_recipes'), where('menuId', '==', deleteId));
      const rSnap = await getDocs(rQuery);

      // Delete menu itself
      await deleteDoc(doc(db, 'menu', deleteId));

      // Batch delete recipes
      const batch = writeBatch(db);
      rSnap.forEach(rDoc => batch.delete(rDoc.ref));
      await batch.commit();

      toast.success('Item menu dan resep terkait berhasil dihapus');
      setShowDeleteModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'menu');
      toast.error('Gagal menghapus item menu');
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
        description: item.description || '',
        price: (item.price || 0).toString(),
        category: item.category || 'Catering Box',
        preparationTime: (item.preparationTime || 30).toString(),
        imageUrl: item.imageUrl || '',
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', price: '', category: 'Catering Box', preparationTime: '30', imageUrl: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', description: '', price: '', category: 'Catering Box', preparationTime: '30', imageUrl: '' });
  };

  const openRecipeModal = async (item: any) => {
    setCurrentMenu(item);
    setShowRecipeModal(true);
    // Fetch recipes for this menu item
    const q = query(collection(db, 'menu_recipes'), where('menuId', '==', item.id));
    const snapshot = await getDocs(q);
    setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const addRecipeIngredient = async () => {
    if (!newRecipe.ingredientId || !newRecipe.quantityNeeded) {
      toast.error('Silakan pilih bahan dan tentukan jumlahnya');
      return;
    }

    setBtnLoading(true);
    try {
      const itemsList = newRecipe.itemType === 'ingredients' ? ingredients : packaging;
      const ingredient = itemsList.find(i => i.id === newRecipe.ingredientId);
      if (!ingredient) {
        toast.error('Item tidak ditemukan');
        return;
      }

      const recipeData = {
        menuId: currentMenu.id,
        menuName: currentMenu.name,
        ingredientId: newRecipe.ingredientId,
        ingredientName: ingredient.name,
        itemType: newRecipe.itemType,
        quantityNeeded: Number(newRecipe.quantityNeeded),
        unit: ingredient.unit,
      };

      const docRef = await addDoc(collection(db, 'menu_recipes'), recipeData);
      setRecipes([...recipes, { id: docRef.id, ...recipeData }]);
      setNewRecipe({ ingredientId: '', itemType: 'ingredients', quantityNeeded: '' });
      toast.success('Bahan/Kemasan berhasil ditambahkan ke resep');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'menu_recipes');
    } finally {
      setBtnLoading(false);
    }
  };

  const removeRecipeIngredient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'menu_recipes', id));
      setRecipes(recipes.filter(r => r.id !== id));
      toast.success('Bahan berhasil dihapus dari resep');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'menu_recipes');
    }
  };

  const filteredMenu = menuItems.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Menu Katering</h1>
          <p className="text-slate-500 text-sm">Rancang hidangan Anda dan tentukan komponen bahan bakunya.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 w-full md:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          <span>Item Menu Baru</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari katalog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold text-slate-600 shadow-inner"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto h-full items-stretch">
           <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">{menuItems.length} Total Item</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-white rounded-2xl border border-orange-50 animate-pulse" />
          ))
        ) : filteredMenu.length > 0 ? filteredMenu.map((item) => (
          <motion.div 
            layout
            key={item.id}
            className="bg-white flex flex-col rounded-3xl border border-orange-50 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all"
          >
            <div className="h-44 bg-orange-50 relative overflow-hidden">
               {item.imageUrl ? (
                 <img 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop';
                    }}
                 />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-slate-50">
                    <UtensilsCrossed className="w-12 h-12 text-primary opacity-20" />
                 </div>
               )}
               <span className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-primary uppercase shadow-sm border border-orange-100 italic">
                 {item.category}
               </span>
               <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(item)} className="p-2 bg-white text-blue-500 rounded-xl shadow-sm hover:bg-blue-50 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => confirmDelete(item.id)} 
                  disabled={isDeleting}
                  className="p-2 bg-white text-red-500 rounded-xl shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col bg-white">
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h3>
                <div className="text-[11px] font-black text-primary bg-orange-50 px-2 py-0.5 rounded-md whitespace-nowrap">{formatIDR(item.price)}</div>
              </div>
              <p className="text-[11px] text-slate-500 mb-4 line-clamp-2 leading-relaxed h-8">{item.description}</p>
              
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>{item.preparationTime} MENIT</span>
                </div>
                <button 
                  onClick={() => openRecipeModal(item)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline group/btn"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  RESEP
                  <ChevronRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-dashed border-orange-100">
            <UtensilsCrossed className="w-12 h-12 text-slate-200" />
            <p className="text-sm font-medium text-slate-400">Menu katering Anda masih sepi. Mari tambahkan beberapa hidangan lezat!</p>
          </div>
        )}
      </div>

      {/* Menu Item Form Modal */}
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
                <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Ubah Hidangan' : 'Entri Kuliner Baru'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] md:max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presentasi Visual (URL)</label>
                    <input
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                      placeholder="Alamat gambar..."
                    />
                    {formData.imageUrl && (
                      <div className="mt-2 w-full h-32 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-inner">
                        <img 
                          src={formData.imageUrl} 
                          alt="Pratinjau" 
                          className="w-full h-full object-cover"
                          onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Hidangan</label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                      placeholder="Apa yang kita masak?"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (IDR)</label>
                      <input
                        required
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Persiapan (Menit)</label>
                      <input
                        required
                        type="number"
                        value={formData.preparationTime}
                        onChange={(e) => setFormData({...formData, preparationTime: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                        placeholder="30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bagian Dapur</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                    >
                      <option value="Catering Box">Kotak Katering</option>
                      <option value="Buffet">Prasmanan</option>
                      <option value="Snack Box">Kotak Camilan</option>
                      <option value="Drink">Minuman</option>
                      <option value="Dessert">Pencuci Mulut</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Kuliner</label>
                    <textarea
                      required
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-medium text-slate-600 text-sm leading-relaxed"
                      placeholder="Jelaskan rasa dan bahan-bahannya..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={closeModal}
                      className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all text-xs uppercase"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit" 
                      disabled={btnLoading}
                      className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      {btnLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                      {editingId ? 'Simpan Perubahan' : 'Simpan Hidangan'}
                    </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipe Management Modal */}
      <AnimatePresence>
        {showRecipeModal && currentMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecipeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-white w-full max-w-2xl h-[90vh] rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-orange-50 bg-gradient-to-r from-orange-50/50 to-white">
                <div className="flex justify-between items-start mb-2">
                   <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Blueprint Dapur</h2>
                    <p className="text-primary font-bold text-sm tracking-widest">HIDANGAN: {currentMenu.name}</p>
                   </div>
                   <button onClick={() => setShowRecipeModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                     <X className="w-6 h-6" />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                   <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Tambah Komponen Resep</h3>
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <select 
                          value={newRecipe.itemType}
                          onChange={(e) => setNewRecipe({...newRecipe, itemType: e.target.value as any, ingredientId: ''})}
                          className="w-full px-4 py-3 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                        >
                          <option value="ingredients">Bahan Baku</option>
                          <option value="packaging">Kemasan</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <select 
                          value={newRecipe.ingredientId}
                          onChange={(e) => setNewRecipe({...newRecipe, ingredientId: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                        >
                          <option value="">Pilih...</option>
                          {(newRecipe.itemType === 'ingredients' ? ingredients : packaging).map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <input 
                          type="number"
                          placeholder="Jumlah"
                          value={newRecipe.quantityNeeded}
                          onChange={(e) => setNewRecipe({...newRecipe, quantityNeeded: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-primary/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button 
                          onClick={addRecipeIngredient}
                          disabled={btnLoading}
                          className="w-full h-full bg-primary text-white p-3 rounded-xl hover:scale-105 transition-transform flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between">
                     <span>Komponen yang Dibutuhkan</span>
                     <span>{recipes.length} ITEM</span>
                   </h3>
                   <div className="grid grid-cols-1 gap-2">
                     {recipes.length > 0 ? recipes.map((r) => (
                       <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group hover:border-primary/20 hover:bg-white transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-primary font-black uppercase text-[10px]">
                                {r.ingredientName.substring(0, 2)}
                             </div>
                             <div>
                                <p className="font-bold text-slate-800 text-sm">{r.ingredientName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{r.unit} • {r.itemType === 'ingredients' ? 'Bahan' : 'Kemasan'}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                             <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-lg">
                               {r.quantityNeeded}
                             </span>
                             <button 
                                onClick={() => removeRecipeIngredient(r.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                     )) : (
                       <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30 italic">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                             <Plus className="w-8 h-8 font-thin" />
                          </div>
                          <p className="text-sm text-slate-400">Tambahkan bahan untuk membuat resep</p>
                       </div>
                     )}
                   </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50/30">
                 <div className="flex items-start gap-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 text-orange-800">
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                       <p className="text-xs font-bold uppercase tracking-widest mb-1 italic">Petunjuk Produksi</p>
                       <p className="text-[11px] leading-relaxed opacity-90">Menentukan resep memungkinkan sistem untuk secara otomatis mengurangi stok setiap kali Anda menyelesaikan batch produksi untuk menu ini.</p>
                    </div>
                 </div>
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
        title="Hapus Menu?"
        description="Menghapus menu ini juga akan menghapus blueprint resep yang terkait. Data yang dihapus tidak dapat dikembalikan."
      />
    </div>
  );
};

export default Menu;

