import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Building2, Mail, Phone, Clock, Globe, Info, Save, Loader2, Utensils } from 'lucide-react';
import { motion } from 'motion/react';

const Profile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    contactInfo: 'admin@nusantaracatering.id | +62 812-3456-7890',
    operationalHours: 'Sen - Jum: 08:00 - 17:00\nSab - Min: 09:00 - 15:00',
    aboutUs: 'Nusantara Catering menyajikan cita rasa tradisional Indonesia terbaik untuk acara spesial Anda. Kami menggunakan bahan-bahan segar dan resep otentik untuk memberikan pengalaman bersantap yang tak terlupakan.',
    address: 'Jl. Merdeka No. 123, Jakarta, Indonesia',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'company_profile', 'public');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            contactInfo: data.contactInfo || '',
            operationalHours: data.operationalHours || '',
            aboutUs: data.aboutUs || '',
            address: data.address || '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'company_profile', 'public'), profile);
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'company_profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8 pb-12">
      <div className="relative h-64 rounded-3xl overflow-hidden shadow-xl">
         <img 
           src="https://images.unsplash.com/photo-1547573854-74d2a71d0826?q=80&w=2070&auto=format&fit=crop" 
           alt="Catering" 
           className="w-full h-full object-cover"
           referrerPolicy="no-referrer"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-bottom p-10 items-end">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
                 <Utensils className="text-white w-12 h-12" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold text-white">Nusantara Catering</h1>
                <p className="text-white/80 flex items-center gap-2 mt-2">
                  <Globe className="w-4 h-4" />
                  www.nusantaracatering.id
                </p>
              </div>
            </div>
         </div>
         <button 
           onClick={() => setEditing(!editing)}
           className="absolute top-6 right-6 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition-all font-display"
         >
           {editing ? 'Batal Mengedit' : 'Edit Profil'}
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
           <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-150 rotate-12">
                <Utensils className="w-32 h-32" />
             </div>
             <h3 className="text-xl font-bold font-display text-gray-900 mb-4 flex items-center gap-2">
               <Info className="w-5 h-5 text-primary" />
               Tentang Kami
             </h3>
             {editing ? (
               <textarea
                 rows={6}
                 value={profile.aboutUs}
                 onChange={(e) => setProfile({...profile, aboutUs: e.target.value})}
                 className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
               />
             ) : (
               <p className="text-gray-600 leading-relaxed text-lg">
                 {profile.aboutUs}
               </p>
             )}
           </section>

           <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
             <h3 className="text-xl font-bold font-display text-gray-900 mb-6">Lokasi & Alamat</h3>
             <div className="flex gap-4">
                <div className="p-3 bg-cream rounded-2xl">
                   <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                   {editing ? (
                     <textarea
                       rows={2}
                       value={profile.address}
                       onChange={(e) => setProfile({...profile, address: e.target.value})}
                       className="w-80 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                     />
                   ) : (
                     <p className="text-gray-700 font-medium">{profile.address}</p>
                   )}
                   <p className="text-gray-400 text-sm mt-1 uppercase tracking-tight">Kantor Pusat</p>
                </div>
             </div>
             <div className="mt-6 h-48 bg-gray-100 rounded-2xl overflow-hidden">
                {/* Mock Map Placeholder */}
                <img 
                  src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop" 
                  alt="Map"
                  className="w-full h-full object-cover grayscale opacity-50"
                  referrerPolicy="no-referrer"
                />
             </div>
           </section>
        </div>

        <div className="space-y-6">
           <section className="bg-primary text-white p-8 rounded-3xl shadow-xl shadow-primary/20">
              <h3 className="text-lg font-bold font-display mb-6">Informasi Kontak</h3>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                       <Mail className="w-5 h-5 text-white" />
                    </div>
                    {editing ? (
                      <input 
                        type="text" 
                        value={profile.contactInfo}
                        onChange={(e) => setProfile({...profile, contactInfo: e.target.value})}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                      />
                    ) : (
                      <span className="text-sm font-medium">{profile.contactInfo}</span>
                    )}
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                       <Phone className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium">+62 812-3456-7890</span>
                 </div>
              </div>
           </section>

           <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold font-display text-gray-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Jam Operasional
              </h3>
              <div className="space-y-2">
                 {editing ? (
                   <textarea
                     rows={3}
                     value={profile.operationalHours}
                     onChange={(e) => setProfile({...profile, operationalHours: e.target.value})}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                   />
                 ) : (
                   profile.operationalHours.split('\n').map((line, i) => (
                     <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">{line.split(':')[0]}</span>
                        <span className="font-bold text-gray-900">{line.split(':')[1]}</span>
                     </div>
                   ))
                 )}
              </div>
           </section>

           {editing && (
             <button
               onClick={handleSaveProfile}
               disabled={loading}
               className="w-full bg-gray-900 text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
               Simpan Profil Lengkap
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
