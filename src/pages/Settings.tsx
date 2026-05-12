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
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-500 text-sm">Perbarui informasi bisnis dan preferensi keamanan Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Informasi Umum
          </h3>
          <p className="text-sm text-gray-500 mt-1">Detail dasar tentang bisnis katering Anda.</p>
        </div>
        <div className="md:col-span-2">
          <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-orange-50 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Katering</label>
              <input
                type="text"
                value={settings.cateringName}
                onChange={(e) => setSettings({...settings, cateringName: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alamat Bisnis</label>
              <textarea
                rows={3}
                value={settings.businessAddress}
                onChange={(e) => setSettings({...settings, businessAddress: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Kontak</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      </div>

      <hr className="border-orange-50" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
        <div className="md:col-span-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Keamanan
          </h3>
          <p className="text-sm text-slate-500 mt-1">Amankan akun Anda dengan kata sandi yang kuat.</p>
        </div>
        <div className="md:col-span-2">
          <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-2xl border border-orange-50 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kata Sandi Baru</label>
              <input
                type="password"
                required
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Konfirmasi Kata Sandi Baru</label>
              <input
                type="password"
                required
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Harus cocok dengan kata sandi baru"
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Perbarui Kata Sandi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
