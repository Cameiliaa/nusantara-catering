import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Settings as SettingsIcon, BookOpen, Building2, ExternalLink, Smartphone, Clock } from 'lucide-react';
import { motion } from 'motion/react';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    cateringName: 'Nusantara Catering',
    contactEmail: 'admin@nusantaracatering.id',
    phoneNumber: '+62 812-3456-7890',
    businessAddress: 'Jl. Merdeka No. 123, Jakarta, Indonesia',
    website: 'www.nusantaracatering.id',
    aboutUs: 'Nusantara Catering menyajikan cita rasa tradisional Indonesia terbaik untuk acara spesial Anda.',
  });
  const [operatingHours, setOperatingHours] = useState({
    weekdayHours: '08:00 - 17:00',
    weekendHours: '09:00 - 15:00',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileDoc = await getDoc(doc(db, 'company_profile', 'public'));
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setCompanyInfo({
            cateringName: data.cateringName || '',
            contactEmail: data.contactEmail || '',
            phoneNumber: data.phoneNumber || '',
            businessAddress: data.businessAddress || '',
            website: data.website || '',
            aboutUs: data.aboutUs || '',
          });
          setOperatingHours({
            weekdayHours: data.weekdayHours || '08:00 - 17:00',
            weekendHours: data.weekendHours || '09:00 - 15:00',
          });
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  const handleSaveCompanyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'company_profile', 'public'), { ...companyInfo, ...operatingHours }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'company_profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOperatingHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'company_profile', 'public'), { ...companyInfo, ...operatingHours }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'company_profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4">
      <div>
        <h1 className="text-3xl font-display font-black text-gray-900 tracking-tight">Pengaturan Sistem</h1>
        <p className="text-slate-500 font-medium">Konfigurasi pusat untuk informasi perusahaan dan sistem.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Company Information */}
        <section className="bg-white p-8 rounded-3xl border border-orange-50 shadow-sm col-span-full">
            <h3 className="text-xl font-bold font-display text-gray-900 mb-8 flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-xl"><Building2 className="w-5 h-5 text-primary" /></div>
              Informasi Perusahaan
            </h3>
            <form onSubmit={handleSaveCompanyInfo} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {Object.entries(companyInfo).map(([key, value]) => (
                   <div key={key} className={key === 'businessAddress' || key === 'aboutUs' ? 'md:col-span-2' : ''}>
                      <label className='text-xs font-black text-slate-400 uppercase'>{key.replace(/([A-Z])/g, ' $1')}</label>
                      {key === 'businessAddress' || key === 'aboutUs' ? (
                        <textarea value={value} onChange={e => setCompanyInfo({...companyInfo, [key]: e.target.value})} className='w-full p-3 rounded-xl border mt-1' rows={3} />
                      ) : (
                        <input type='text' value={value} onChange={e => setCompanyInfo({...companyInfo, [key]: e.target.value})} className='w-full p-3 rounded-xl border mt-1' />
                      )}
                      
                   </div>
                 ))}
              </div>
              <button type="submit" disabled={loading} className='bg-primary text-white font-bold py-3 px-6 rounded-2xl hover:bg-primary-dark transition-all'>Simpan Informasi</button>
            </form>
        </section>

        {/* Section 2: Operating Hours */}
        <section className="bg-white p-8 rounded-3xl border border-orange-50 shadow-sm">
            <h3 className="text-xl font-bold font-display text-gray-900 mb-8 flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-xl"><Clock className="w-5 h-5 text-primary" /></div>
              Jam Operasional
            </h3>
            <form onSubmit={handleSaveOperatingHours} className="space-y-6">
              <div>
                  <label className='text-xs font-black text-slate-400 uppercase'>Senin–Jumat</label>
                  <input type='text' value={operatingHours.weekdayHours} onChange={e => setOperatingHours({...operatingHours, weekdayHours: e.target.value})} className='w-full p-3 rounded-xl border mt-1' />
              </div>
              <div>
                  <label className='text-xs font-black text-slate-400 uppercase'>Sabtu–Minggu</label>
                  <input type='text' value={operatingHours.weekendHours} onChange={e => setOperatingHours({...operatingHours, weekendHours: e.target.value})} className='w-full p-3 rounded-xl border mt-1' />
              </div>
              <button type="submit" disabled={loading} className='bg-primary text-white font-bold py-3 px-6 rounded-2xl hover:bg-primary-dark transition-all'>Simpan Jam Operasional</button>
            </form>
        </section>

        {/* Section 3 & 4 */}
        <div className="space-y-8">
            <section className="bg-white p-8 rounded-3xl border border-orange-50 shadow-sm">
              <h3 className="text-xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-xl"><BookOpen className="w-5 h-5 text-primary" /></div>
                Panduan Penggunaan
              </h3>
              <p className="text-slate-600 mb-6">Akses manual book untuk mempelajari seluruh fitur dan alur penggunaan sistem Nusantara Catering.</p>
              <a href="https://drive.google.com/drive/folders/1emxccodawr_G9eMOor_OphULFFykFPJA" target="_blank" rel="noopener noreferrer" className="text-primary font-bold underline flex items-center gap-2 mb-4 hover:opacity-80">
                Buka Manual Book
              </a>
              <a href="https://drive.google.com/drive/folders/1emxccodawr_G9eMOor_OphULFFykFPJA" target="_blank" rel="noopener noreferrer" className="inline-block bg-slate-100 text-slate-800 font-bold py-3 px-6 rounded-2xl hover:bg-slate-200 transition-all">
                Buka Panduan
              </a>
            </section>

            <section className="bg-white p-8 rounded-3xl border border-orange-50 shadow-sm">
              <h3 className="text-xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-xl"><Smartphone className="w-5 h-5 text-primary" /></div>
                Kontak Bantuan
              </h3>
              <p className="text-slate-600 mb-6">Hubungi kontak berikut apabila mengalami kendala teknis atau membutuhkan bantuan penggunaan sistem.</p>
              <p className="font-bold text-gray-900 mb-1">Ziza</p>
              <p className="font-bold text-gray-700 mb-6">087855891218</p>
              <a href="https://api.whatsapp.com/send/?phone=6287855891218&text&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="inline-block bg-green-500 text-white font-bold py-3 px-6 rounded-2xl hover:bg-green-600 transition-all">
                Hubungi WhatsApp
              </a>
            </section>
        </div>

        {/* Section 5: System Info */}
        <section className="bg-slate-900 text-slate-300 p-8 rounded-3xl border border-slate-700 shadow-sm col-span-full">
            <h3 className="text-xl font-bold font-display text-white mb-8 flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Informasi Sistem
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { label: 'Versi Sistem', value: 'v1.0.0' },
                { label: 'Database', value: 'Firebase Firestore' },
                { label: 'Framework', value: 'React + Vite' },
                { label: 'Status', value: 'Online', badge: 'bg-green-500' },
                { label: 'Developer', value: 'CIM' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-800 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                  <p className="font-bold text-white mt-1 flex items-center gap-2">
                    {item.badge && <span className={`w-2 h-2 rounded-full ${item.badge}`}></span>}
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
        </section>
      </div>
    </div>
  );
};
export default Settings;
