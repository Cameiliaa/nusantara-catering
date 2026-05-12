import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail, Loader2, Utensils } from 'lucide-react';
import { motion } from 'motion/react';
import loginBg from '../assets/images/login-bg.jpg';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login gagal. Silakan periksa kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white flex-col lg:flex-row">
      {/* Side Image / Top Banner - 55% width on desktop */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-[55%] h-64 lg:h-screen relative"
      >
        <img 
          src={loginBg} 
          alt="Catering Service"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Warm Overlay - Reduced Opacity for better image clarity */}
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/60 via-primary/20 to-transparent lg:bg-primary/20" />
        <div className="absolute inset-0 bg-black/10" />
      </motion.div>

      {/* Login Form Section - 45% width on desktop */}
      <div className="lg:w-[45%] flex flex-col items-center justify-center p-8 md:p-12 lg:p-16 bg-white relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg space-y-10"
        >
          <div className="text-center lg:text-left space-y-3">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-gray-900 tracking-tight leading-tight">Selamat Datang Kembali</h2>
            <p className="text-slate-500 text-lg font-medium">Masuk untuk mengelola Dashboard Katering</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 tracking-wide uppercase flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-gray-800 shadow-sm text-lg"
                placeholder="admin@catering.com"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700 tracking-wide uppercase flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Kata Sandi
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-gray-800 shadow-sm text-lg"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <input type="checkbox" id="remember" className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary cursor-pointer" />
              <label htmlFor="remember" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
                Tetap masuk di perangkat ini
              </label>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-red-50 text-red-600 p-4 rounded-2xl border-2 border-red-100 text-sm font-bold"
              >
                <Loader2 className="w-5 h-5 rotate-45" /> {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white py-5 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
              MASUK SEKARANG
            </button>
          </form>

          <div className="pt-10 border-t border-slate-100 text-center">
             <p className="text-slate-400 font-medium tracking-wide">
               Butuh bantuan akses? <a href="https://wa.me/6287855891218" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">Hubungi Manager</a>
             </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
