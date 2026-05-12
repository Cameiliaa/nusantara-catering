import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, Calendar, ArrowUpRight, ArrowDownRight, FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { exportToCSV, exportToExcel } from '../lib/exportUtils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const Reports: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return unsubscribe;
  }, []);

  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Process Monthly Data
  const getMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const data: {[key: string]: {name: string, revenue: number, expense: number}} = {};
    
    // Initialize last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[d.getMonth()];
      data[monthName] = { name: monthName, revenue: 0, expense: 0 };
    }

    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthName = months[date.getMonth()];
      if (data[monthName]) {
        if (t.type === 'income') data[monthName].revenue += t.amount || 0;
        else data[monthName].expense += t.amount || 0;
      }
    });

    return Object.values(data);
  };

  const monthlyChartsData = getMonthlyData();

  // Process Expense Breakdown
  const getExpenseBreakdown = () => {
    const categories: {[key: string]: number} = {};
    const colors: {[key: string]: string} = {
      'Stock Purchase': '#F27D26',
      'Packaging': '#3B82F6',
      'Kitchen Equipment': '#10B981',
      'Electricity': '#F59E0B',
      'Gas': '#EF4444',
      'Transportation': '#8B5CF6',
      'Salary': '#EC4899',
      'Other Expense': '#64748B'
    };

    const categoryTranslations: {[key: string]: string} = {
      'Stock Purchase': 'Bahan Baku',
      'Packaging': 'Kemasan',
      'Kitchen Equipment': 'Peralatan',
      'Electricity': 'Listrik',
      'Gas': 'Gas',
      'Transportation': 'Transport',
      'Salary': 'Gaji',
      'Other Expense': 'Lainnya'
    };

    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'Other Expense';
      categories[cat] = (categories[cat] || 0) + (t.amount || 0);
    });

    return Object.entries(categories).map(([name, value]) => ({
      name: categoryTranslations[name] || name,
      value,
      color: colors[name] || '#CBD5E1'
    })).sort((a, b) => b.value - a.value);
  };

  const expenseBreakdownData = getExpenseBreakdown();

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleExport = (format: 'csv' | 'excel') => {
    setExportLoading(true);
    try {
      // 1. Data Summary
      const summaryData = [
        { Kategori: 'Total Pendapatan', Jumlah: totalRevenue },
        { Kategori: 'Total Pengeluaran', Jumlah: totalExpenses },
        { Kategori: 'Saldo Bersih', Jumlah: netProfit }
      ];

      // 2. Data Rincian Pengeluaran
      const rincianPengeluaranData = expenseBreakdownData.map(item => ({
        Kategori: item.name,
        Jumlah: item.value
      }));

      const dateStr = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toLowerCase().replace(' ', '-');
      const filename = `laporan-keuangan-${dateStr}`;

      if (format === 'csv') {
        exportToCSV([...summaryData, { Kategori: '', Jumlah: '' }, ...rincianPengeluaranData], `${filename}.csv`);
        toast.success('Laporan CSV berhasil diunduh');
      } else {
        const worksheetSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.sheet_add_aoa(worksheetSummary, [[]], { origin: -1 });
        XLSX.utils.sheet_add_json(worksheetSummary, rincianPengeluaranData, { origin: -1 });
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Ringkasan');
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        toast.success('Laporan Excel berhasil diunduh');
      }
    } catch (err) {
      toast.error('Gagal mengekspor laporan');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-gray-500 text-sm">Analisis pendapatan, pengeluaran, dan pertumbuhan bisnis secara keseluruhan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {exportLoading ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-orange-100 rounded-xl text-slate-400">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span className="text-xs font-bold uppercase tracking-widest">Ekspor...</span>
            </div>
          ) : (
            <div className="flex bg-white border border-orange-100 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => handleExport('csv')}
                className="px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-bold text-slate-600 border-r border-orange-50"
              >
                <FileText className="w-4 h-4" />
                CSV
              </button>
              <button 
                onClick={() => handleExport('excel')}
                className="px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs font-bold text-slate-600"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>
          )}
          <button className="bg-white border border-gray-100 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Calendar className="w-4 h-4 text-gray-400" />
            Statistik Realtime
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-green-50 rounded-lg text-green-600">
                <ArrowUpRight className="w-6 h-6" />
             </div>
             <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Realtime</span>
          </div>
          <p className="text-gray-500 text-sm font-medium">Total Pendapatan</p>
          <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{formatIDR(totalRevenue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-red-50 rounded-lg text-red-600">
                <ArrowDownRight className="w-6 h-6" />
             </div>
             <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Realtime</span>
          </div>
          <p className="text-gray-500 text-sm font-medium">Total Pengeluaran</p>
          <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{formatIDR(totalExpenses)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm bg-cream">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <DollarSign className="w-6 h-6" />
             </div>
             <span className="text-xs font-bold text-primary bg-white px-2 py-1 rounded-full">{netProfit >= 0 ? 'Surplus' : 'Defisit'}</span>
          </div>
          <p className="text-primary/70 text-sm font-medium text-primary">Saldo Bersih</p>
          <h3 className="text-2xl font-display font-bold text-gray-900 mt-1">{formatIDR(netProfit)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Tren Pendapatan vs Pengeluaran</h3>
           <div className="flex-1 min-h-[320px] min-w-0">
            {isMounted && !loading && monthlyChartsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyChartsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: '#F8FAFC'}}
                    formatter={(value: number) => formatIDR(value)}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="revenue" name="Pendapatan" fill="#F27D26" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-50 rounded-xl">
                <PieChartIcon className="w-8 h-8 opacity-20" />
                <p className="text-xs font-medium">{loading ? 'Memuat grafik...' : 'Data grafik belum tersedia'}</p>
              </div>
            )}
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Rincian Pengeluaran</h3>
           <div className="flex-1 min-h-[256px] min-w-0">
             {isMounted && !loading && expenseBreakdownData.length > 0 ? (
               <ResponsiveContainer width="100%" height={256}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdownData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => formatIDR(value)}
                    />
                  </PieChart>
               </ResponsiveContainer>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-50 rounded-xl">
                  <PieChartIcon className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-medium">{loading ? 'Memuat rincian...' : 'Rincian belum tersedia'}</p>
                </div>
             )}
           </div>
           <div className="space-y-3 mt-4 overflow-y-auto max-h-48 pr-2">
              {expenseBreakdownData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                    {item.name}
                  </div>
                  <span className="font-bold text-gray-900 text-xs">
                    {formatIDR(item.value)}
                  </span>
                </div>
              ))}
              {expenseBreakdownData.length === 0 && (
                <p className="text-center text-gray-400 text-xs italic">Belum ada pengeluaran tercatat.</p>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
