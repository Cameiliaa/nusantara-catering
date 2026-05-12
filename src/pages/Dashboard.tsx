import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  ShoppingBag, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    key={value}
    transition={{ duration: 0.3 }}
    className="bg-white p-5 rounded-2xl border border-orange-50 shadow-sm"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
          trend.startsWith('+') || trend === "Surplus" || trend === "Realtime" ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
  </motion.div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompletedOrders: 0,
    dailyRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setRecentOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const completedOrdersQuery = query(collection(db, 'orders'), where('status', '==', 'completed'));
    const unsubCompleted = onSnapshot(completedOrdersQuery, (snapshot) => {
      setStats(prev => ({ ...prev, totalCompletedOrders: snapshot.size }));
    });

    // Financial Analysis Logic
    const transactionsQuery = query(collection(db, 'transactions'));
    const unsubTrans = onSnapshot(transactionsQuery, (snapshot) => {
      const transDocs = snapshot.docs.map(doc => doc.data());
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const dailyRev = transDocs
        .filter(t => t.date === today && t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalExp = transDocs
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalInc = transDocs
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      setStats(prev => ({
        ...prev,
        dailyRevenue: dailyRev,
        totalExpenses: totalExp,
        netProfit: totalInc - totalExp
      }));

      // Weekly Revenue Logic (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const chartData = last7Days.map(date => {
        const dayTotal = transDocs
          .filter(t => t.date === date && t.type === 'income')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        return {
          day: new Date(date).toLocaleDateString('id-ID', { weekday: 'short' }),
          amount: dayTotal
        };
      });
      setRevenueData(chartData);
    });

    const stockQuery = query(collection(db, 'ingredients'));
    const unsubStock = onSnapshot(stockQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const lowItems = items.filter((data: any) => (data.quantity || 0) <= (data.minimumThreshold || 0));
      setLowStockItems(lowItems);
    });

    setLoading(false);

    return () => {
      unsubOrders();
      unsubCompleted();
      unsubStock();
      unsubTrans();
    };
  }, []);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">Ringkasan Dashboard</h2>
          <p className="text-slate-500 text-sm">Selamat datang kembali! Inilah yang terjadi hari ini.</p>
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-xl border border-orange-50 shadow-sm w-fit">
          <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Pendapatan Hari Ini" 
          value={formatIDR(stats.dailyRevenue)} 
          icon={TrendingUp} 
          color="bg-green-500" 
          trend="Realtime" 
        />
        <StatCard 
          title="Total Pengeluaran" 
          value={formatIDR(stats.totalExpenses)} 
          icon={TrendingDown} 
          color="bg-red-500" 
          trend="Akumulasi" 
        />
        <StatCard 
          title="Saldo Bersih" 
          value={formatIDR(stats.netProfit)} 
          icon={BarChart} 
          color="bg-blue-500" 
          trend={stats.netProfit >= 0 ? "Surplus" : "Defisit"} 
        />
        <StatCard 
          title="Pesanan Selesai" 
          value={stats.totalCompletedOrders} 
          icon={ShoppingBag} 
          color="bg-orange-600" 
          trend="Total" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-orange-50 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700">Pesanan Terbaru</h3>
            <button className="text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-primary">Lihat Semua</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-orange-50 text-orange-800">
                <tr>
                  <th className="p-3 font-semibold rounded-l-lg">ID Pesanan</th>
                  <th className="p-3 font-semibold">Pelanggan</th>
                  <th className="p-3 font-semibold">Tanggal</th>
                  <th className="p-3 font-semibold">Harga</th>
                  <th className="p-3 font-semibold rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOrders.length > 0 ? recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-50/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-slate-500">#{order.id.slice(0, 8).toUpperCase()}</td>
                    <td className="p-3 font-medium text-slate-700">{order.customerName}</td>
                    <td className="p-3 text-slate-500">
                      {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{formatIDR(order.totalPrice)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'processing' ? 'bg-orange-100 text-orange-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status === 'completed' ? 'Selesai' :
                         order.status === 'processing' ? 'Diproses' :
                         order.status === 'cancelled' ? 'Dibatalkan' :
                         'Menunggu'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Tidak ada pesanan terbaru</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50 flex flex-col min-h-[350px]">
          <h3 className="font-bold text-slate-700 mb-6">Pertumbuhan Pendapatan</h3>
          <div className="flex-1 h-64 min-w-0">
            {isMounted && !loading && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E67E22" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#E67E22" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="amount" stroke="#E67E22" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [formatIDR(v), 'Pendapatan']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-50 rounded-xl">
                <BarChart className="w-8 h-8 opacity-20" />
                <p className="text-xs font-medium">{loading ? 'Memuat grafik...' : 'Data grafik belum tersedia'}</p>
              </div>
            )}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between">
            <span className="text-sm text-orange-800 font-bold">Target Bulanan</span>
            <span className="text-sm font-bold text-slate-800">78%</span>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm"
        >
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500 rounded-lg">
                 <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                 <h3 className="font-bold text-red-900">Peringatan Stok Kritis</h3>
                 <p className="text-red-700 text-xs">Barang-barang berikut berada di bawah ambang batas minimum dan memerlukan pengisian segera.</p>
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {lowStockItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                   <div>
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{item.name}</p>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">{item.quantity} {item.unit} TERSISA</p>
                   </div>
                   <div className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded uppercase">Kritis</div>
                </div>
              ))}
           </div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
