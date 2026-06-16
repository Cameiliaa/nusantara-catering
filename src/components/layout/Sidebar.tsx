import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X,
  LayoutDashboard, 
  ShoppingBag, 
  ChefHat, 
  Package, 
  BarChart3, 
  Wallet, 
  Settings, 
  Building2, 
  LogOut,
  Utensils,
  BookOpen,
  Users,
  History
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar: React.FC = () => {
  const { isOpen, close } = useSidebar();
  
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Pesanan', icon: ShoppingBag, path: '/orders' },
    { name: 'Katalog Menu', icon: BookOpen, path: '/menu' },
    { name: 'Pelanggan', icon: Users, path: '/customers' },
    { name: 'Produksi', icon: ChefHat, path: '/production' },
    { name: 'Stok', icon: Package, path: '/stock' },
    { name: 'Laporan Keuangan', icon: BarChart3, path: '/reports' },
    { name: 'Riwayat Laporan', icon: History, path: '/report-history' },
    { name: 'Transaksi', icon: Wallet, path: '/transactions' },
    { name: 'Profil Perusahaan', icon: Building2, path: '/profile' },
    { name: 'Pengaturan', icon: Settings, path: '/settings' },
  ];

  const handleLogout = () => signOut(auth);

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-orange-100 flex flex-col h-full z-50 transition-transform duration-300 transform lg:static lg:translate-x-0 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Utensils className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-primary">Nusantara</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Catering System</p>
            </div>
          </div>
          <button onClick={close} className="p-2 hover:bg-slate-50 rounded-lg lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={close}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-orange-50 text-primary font-semibold" 
                  : "text-slate-500 hover:bg-orange-50 hover:text-primary"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-orange-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-100 font-bold text-orange-700 hover:bg-orange-200 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
