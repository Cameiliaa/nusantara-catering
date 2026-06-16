/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Stock from './pages/Stock';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Customers from './pages/Customers';
import Menu from './pages/Menu';
import ReportHistory from './pages/ReportHistory';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import { Toaster } from 'sonner';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Memuat...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { close } = useSidebar();
  
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <Toaster position="top-right" richColors />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
            <Route path="/orders" element={<PrivateRoute><Layout><Orders /></Layout></PrivateRoute>} />
            <Route path="/production" element={<PrivateRoute><Layout><Production /></Layout></PrivateRoute>} />
            <Route path="/stock" element={<PrivateRoute><Layout><Stock /></Layout></PrivateRoute>} />
            <Route path="/menu" element={<PrivateRoute><Layout><Menu /></Layout></PrivateRoute>} />
            <Route path="/customers" element={<PrivateRoute><Layout><Customers /></Layout></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><Layout><Reports /></Layout></PrivateRoute>} />
            <Route path="/report-history" element={<PrivateRoute><Layout><ReportHistory /></Layout></PrivateRoute>} />
            <Route path="/transactions" element={<PrivateRoute><Layout><Transactions /></Layout></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </SidebarProvider>
    </AuthProvider>
  );
}
