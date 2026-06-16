import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building2, Mail, Phone, Clock, Globe, Info, Utensils } from 'lucide-react';
import { motion } from 'motion/react';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState({
    cateringName: '',
    contactEmail: '',
    phoneNumber: '',
    businessAddress: '',
    website: '',
    aboutUs: '',
    weekdayHours: '',
    weekendHours: '',
  });

  useEffect(() => {
    const docRef = doc(db, 'company_profile', 'public');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          cateringName: data.cateringName || '',
          contactEmail: data.contactEmail || '',
          phoneNumber: data.phoneNumber || '',
          businessAddress: data.businessAddress || '',
          website: data.website || '',
          aboutUs: data.aboutUs || '',
          weekdayHours: data.weekdayHours || '08:00 - 17:00',
          weekendHours: data.weekendHours || '09:00 - 15:00',
        });
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Premium Hero Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-[300px] lg:h-[400px] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-orange-100/50 group"
      >
         <img 
           src="https://images.unsplash.com/photo-1547573854-74d2a71d0826?q=80&w=2070&auto=format&fit=crop" 
           alt="Catering" 
           className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
           referrerPolicy="no-referrer"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-bottom p-6 sm:p-10 lg:p-12 items-end">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 w-full">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-24 h-24 sm:w-32 sm:h-32 bg-primary rounded-3xl flex items-center justify-center shadow-2xl border-4 border-white/10 backdrop-blur-sm shadow-primary/20"
              >
                 <Utensils className="text-white w-12 h-12 sm:w-16 sm:h-16" />
              </motion.div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-white tracking-tight">{profile.cateringName}</h1>
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 mt-3">
                  <p className="text-white/90 flex items-center gap-2 text-sm sm:text-base font-medium">
                    <Globe className="w-4 h-4 text-primary-light" />
                    {profile.website}
                  </p>
                  <span className="hidden sm:inline w-1 h-1 bg-white/30 rounded-full" />
                  <p className="text-white/80 text-sm sm:text-base font-medium">Est. 2010 • Premium Service</p>
                </div>
              </div>
            </div>
         </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: About & Location */}
        <div className="lg:col-span-8 space-y-8">
           <motion.section 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.1 }}
             className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-orange-50 shadow-sm relative overflow-hidden group"
           >
             <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-150 rotate-12 transition-transform duration-700 group-hover:rotate-45">
                <Utensils className="w-48 h-48" />
             </div>
             <div className="relative z-10">
               <h3 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                 <div className="p-2 bg-orange-50 rounded-xl">
                   <Info className="w-6 h-6 text-primary" />
                 </div>
                 Tentang Kami
               </h3>
               <p className="text-slate-600 leading-relaxed text-lg font-medium">
                 {profile.aboutUs}
               </p>
             </div>
           </motion.section>

           <motion.section 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 }}
             className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-orange-50 shadow-sm"
           >
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
               <h3 className="text-2xl font-bold font-display text-gray-900">Lokasi & Alamat</h3>
               <div className="px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100">
                 Aktif & Terverifikasi
               </div>
             </div>
             
             <div className="flex gap-6 items-start">
                <div className="p-4 bg-orange-50 rounded-2xl shrink-0">
                   <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                   <p className="text-gray-900 font-bold text-xl leading-tight">{profile.businessAddress}</p>
                   <p className="text-primary font-bold text-[10px] sm:text-xs mt-3 uppercase tracking-[0.2em]">Kantor Pusat Operasional</p>
                </div>
             </div>
             
             <div className="mt-10 h-72 rounded-[2rem] overflow-hidden border-4 border-slate-50 relative group shadow-sm">
                <img 
                  src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop" 
                  alt="Map"
                  className="w-full h-full object-cover grayscale opacity-60 transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                <div className="absolute bottom-6 right-6">
                </div>
             </div>
           </motion.section>
        </div>

        {/* Right Column: Contact & Hours */}
        <div className="lg:col-span-4 space-y-8">
           <motion.section 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.3 }}
             className="bg-primary text-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-primary/30 relative overflow-hidden h-fit"
           >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <h3 className="text-xl font-bold font-display mb-8 relative z-10">Informasi Kontak</h3>
              <div className="space-y-8 relative z-10">
                 <div className="flex items-center gap-5">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                       <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/60 font-black uppercase tracking-widest mb-1">Email Resmi</span>
                      <span className="text-sm font-bold tracking-tight">{profile.contactEmail}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-5">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                       <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/60 font-black uppercase tracking-widest mb-1">Hotline CS</span>
                      <span className="text-sm font-bold tracking-tight">{profile.phoneNumber}</span>
                    </div>
                 </div>

              </div>
           </motion.section>

           <motion.section 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.4 }}
             className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-orange-50 shadow-sm h-fit"
           >
              <h3 className="text-xl font-bold font-display text-gray-900 mb-8 flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-xl">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                Jam Operasional
              </h3>
              <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 border border-slate-50 hover:bg-slate-50 transition-colors">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Senin-Jumat</span>
                     <span className="text-xs font-black text-slate-800">{profile.weekdayHours}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 border border-slate-50 hover:bg-slate-50 transition-colors">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Sabtu-Minggu</span>
                     <span className="text-xs font-black text-slate-800">{profile.weekendHours}</span>
                  </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-50">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] text-center italic">Sinkronisasi Realtime Terjamin</p>
              </div>
           </motion.section>
        </div>
      </div>
    </div>
  );
};

export default Profile;

