import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { exportToCSV, exportToExcel } from '../lib/exportUtils';
import { 
  History, 
  Search, 
  Calendar, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet,
  Loader2,
  Save,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const ReportHistory: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const q = query(
      collection(db, 'financial_history'), 
      orderBy('year', 'desc'),
      orderBy('month', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'financial_history'));

    return () => unsubscribe();
  }, []);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' });
  };

  const generateMonthlyReport = async () => {
    const now = new Date();
    setIsGenerating(true);
    try {
      const targetMonth = now.getMonth() + 1;
      const targetYear = now.getFullYear();

      const q = query(
        collection(db, 'financial_history'), 
        where('month', '==', getMonthName(targetMonth)),
        where('year', '==', targetYear)
      );
      const existing = await getDocs(q);
      
      const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      const transQ = query(
        collection(db, 'transactions'),
        where('date', '>=', startOfMonth.toISOString()),
        where('date', '<=', endOfMonth.toISOString())
      );
      const transSnap = await getDocs(transQ);
      
      let income = 0;
      let expense = 0;

      transSnap.forEach(d => {
        const data = d.data();
        if (data.type === 'income') income += data.amount;
        else expense += data.amount;
      });

      const reportData = {
        month: getMonthName(targetMonth),
        year: targetYear,
        total_income: income,
        total_expense: expense,
        net_balance: income - expense,
        total_transactions: transSnap.size,
        generated_at: serverTimestamp(),
      };

      if (!existing.empty) {
        if (window.confirm(`Laporan untuk ${getMonthName(targetMonth)} ${targetYear} sudah ada. Perbarui?`)) {
          await addDoc(collection(db, 'financial_history'), reportData);
          toast.success('Laporan bulanan berhasil diperbarui (Snapshot baru dibuat)');
        }
      } else {
        await addDoc(collection(db, 'financial_history'), reportData);
        toast.success('Laporan bulanan berhasil diarsipkan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat laporan');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportReport = (report: any, format: 'csv' | 'excel') => {
    const data = [{
      'Bulan': report.month,
      'Tahun': report.year,
      'Pemasukan': report.total_income,
      'Pengeluaran': report.total_expense,
      'Saldo Bersih': report.net_balance,
      'Jumlah Transaksi': report.total_transactions,
      'Tanggal Arsip': report.generated_at?.toDate()?.toLocaleString('id-ID') || ''
    }];

    const filename = `Laporan_${report.month}_${report.year}`;
    
    if (format === 'csv') {
      exportToCSV(data, `${filename}.csv`);
    } else {
      exportToExcel(data, `${filename}.xlsx`, 'Laporan Bulanan');
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesYear = yearFilter === 'all' || r.year.toString() === yearFilter;
    const matchesSearch = r.month.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesYear && matchesSearch;
  });

  const years = Array.from(new Set(reports.map(r => r.year.toString()))).sort((a: any, b: any) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            Riwayat Laporan Keuangan
          </h1>
          <p className="text-slate-500 text-sm">Arsip laporan bulanan permanen untuk audit dan monitoring.</p>
        </div>
        <button 
          onClick={generateMonthlyReport}
          disabled={isGenerating}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 w-full md:w-auto"
        >
          {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>Simpan Laporan Bulanan</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-orange-50 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari bulan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Semua Tahun</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white h-64 rounded-2xl border border-slate-100 animate-pulse" />
          ))
        ) : filteredReports.length > 0 ? filteredReports.map((report) => (
          <motion.div
            layout
            key={report.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-orange-50 shadow-sm overflow-hidden hover:shadow-md transition-all group"
          >
            <div className="p-5 border-b border-orange-50 flex justify-between items-center bg-orange-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-orange-100 text-primary">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{report.month}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.year}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportReport(report, 'csv')}
                  className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-green-600 hover:border-green-100 transition-all"
                  title="Download CSV"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => exportReport(report, 'excel')}
                  className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-green-600 hover:border-green-100 transition-all"
                  title="Download Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Pemasukan</label>
                  <p className="text-sm font-bold text-green-600">{formatIDR(report.total_income)}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Pengeluaran</label>
                  <p className="text-sm font-bold text-red-600">{formatIDR(report.total_expense)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Saldo Bersih</label>
                    <span className="text-base font-black text-slate-800">{formatIDR(report.net_balance)}</span>
                  </div>
                  <div className={`p-2 rounded-lg ${report.net_balance >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {report.net_balance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[9px] text-slate-400 italic">
                  Diarsipkan: {report.generated_at?.toDate()?.toLocaleDateString('id-ID')}
                </span>
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {report.total_transactions} Transaksi
                </span>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center">
            <History className="w-16 h-16 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 italic">Belum ada laporan yang diarsipkan.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportHistory;
