import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Settings as SettingsIcon, Save, Lock, Building, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    cateringName: 'Nusantara Catering',
    businessAddress: 'Jl. Merdeka No. 123, Jakarta',
    contactEmail: 'admin@nusantaracatering.id',
  });
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            cateringName: data.cateringName || '',
            businessAddress: data.businessAddress || '',
            contactEmail: data.contactEmail || '',
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      toast.success('Pengaturan berhasil diperbarui');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings');
      toast.error('Gagal memperbarui pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Kata sandi tidak cocok');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('Kata sandi minimal 6 karakter');
      return;
    }
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      await updatePassword(auth.currentUser, passwords.newPassword);
      toast.success('Kata sandi berhasil diperbarui');
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui kata sandi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-gray-900 tracking-tight">Pengaturan</h1>
          <p className="text-slate-500 font-medium">Perbarui informasi bisnis dan preferensi keamanan Anda.</p>
        </div>
        <div className="hidden sm:block p-3 bg-orange-50 rounded-2xl">
          <SettingsIcon className="w-8 h-8 text-primary animate-spin-slow" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Building className="w-5 h-5 text-primary" />
              </div>
              Informasi Umum
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">Detail dasar tentang bisnis katering Anda. Informasi ini akan ditampilkan pada laporan dan profil publik.</p>
          </div>
        </div>
        <div className="lg:col-span-8">
          <form onSubmit={handleSaveSettings} className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-orange-50 shadow-sm space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] -mr-10 -mt-10 group-hover:scale-110 transition-transform">
              <Building className="w-40 h-40" />
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Katering</label>
                <input
                  type="text"
                  value={settings.cateringName}
                  onChange={(e) => setSettings({...settings, cateringName: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-bold shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Alamat Bisnis</label>
                <textarea
                  rows={3}
                  value={settings.businessAddress}
                  onChange={(e) => setSettings({...settings, businessAddress: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-medium resize-none shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Kontak</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-medium shadow-sm"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end pt-6 border-t border-slate-50">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-primary text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-3 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                SIMPAN PERUBAHAN
              </motion.button>
            </div>
          </form>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-orange-100 to-transparent" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-12">
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <h3 className="text-xl font-bold font-display text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Lock className="w-5 h-5 text-slate-600" />
              </div>
              Keamanan Akun
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">Amankan akses sistem Anda dengan memperbarui kata sandi secara berkala. Disarankan minimal 8 karakter.</p>
          </div>
        </div>
        <div className="lg:col-span-8">
          <form onSubmit={handleChangePassword} className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-orange-50 shadow-sm space-y-8 overflow-hidden group relative">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] -mr-10 -mt-10 group-hover:scale-110 transition-transform">
              <Lock className="w-40 h-40" />
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Kata Sandi Baru</label>
                <input
                  type="password"
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-medium shadow-sm"
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-medium shadow-sm"
                  placeholder="Ulangi kata sandi baru"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-6 border-t border-slate-50">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-slate-200 transition-all flex items-center gap-3 disabled:opacity-70 hover:bg-black"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                PERBARUI KATA SANDI
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
