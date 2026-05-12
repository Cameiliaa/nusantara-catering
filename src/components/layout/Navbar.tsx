import React from 'react';
import { User, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import NotificationCenter from '../NotificationCenter';

const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { toggle } = useSidebar();

  return (
    <header className="h-20 bg-white border-b border-gray-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggle}
          className="p-2 hover:bg-slate-50 rounded-lg lg:hidden text-slate-500"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden md:block flex-1"></div>
      </div>

      <div className="flex items-center gap-6">
        <NotificationCenter />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.displayName || 'Catering Admin'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.email?.split('@')[0] || 'Admin'}</p>
          </div>
          <div className="w-10 h-10 bg-cream rounded-full border-2 border-primary/20 flex items-center justify-center overflow-hidden">
            <User className="text-primary w-6 h-6" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
