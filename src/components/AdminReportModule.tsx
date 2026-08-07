import { useState, useEffect } from 'react';
import { ALL_DEPARTMENTS } from '../types';
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  Loader2, 
  TrendingUp, 
  BarChart2, 
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  Building,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface AdminReportModuleProps {
  token: string;
  adminName: string;
}

export default function AdminReportModule({ token, adminName }: AdminReportModuleProps) {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('All');
  const [status, setStatus] = useState('All');

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any | null>(null);

  // Fetch report summary
  const fetchReportSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        dateRange,
        department,
        status,
        ...(dateRange === 'Custom' && { startDate, endDate })
      });

      const res = await fetch(`/api/admin/reports/summary?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch report summary');
      }
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading report data.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger download helper
  const handleExport = async (type: 'pdf' | 'excel' | 'csv') => {
    setExporting(type);
    try {
      const params = new URLSearchParams({
        dateRange,
        department,
        status,
        ...(dateRange === 'Custom' && { startDate, endDate })
      });

      const response = await fetch(`/api/admin/reports/${type}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${type.toUpperCase()}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `PSR_Report_${dateStr}.${type === 'excel' ? 'xlsx' : type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  // Automatically fetch report summary on load or filter change
  useEffect(() => {
    if (dateRange !== 'Custom' || (startDate && endDate)) {
      fetchReportSummary();
    }
  }, [dateRange, startDate, endDate, department, status]);

  // Color mapping for Status Pie Chart/Bar Chart
  const COLORS_STATUS = {
    'Submitted': '#3b82f6',
    'Pending Inventory Review': '#f59e0b',
    'Pending Admin Approval': '#8b5cf6',
    'Under Review': '#f59e0b',
    'Approved': '#10b981',
    'Rejected': '#ef4444',
    'Need Info': '#8b5cf6',
    'Need More Information': '#8b5cf6',
    'Completed': '#6366f1'
  };

  const COLORS_DEPT = [
    '#1e293b', // Slate
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#6366f1', // Indigo
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#ec4899', // Pink
    '#0ea5e9', // Sky
    '#d946ef', // Fuchsia
    '#84cc16'  // Lime
  ];

  return (
    <div id="admin_reports_container" className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-2xl p-6 space-y-6 text-slate-100">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/15 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 p-2 rounded-2xl">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight drop-shadow-sm">Generate Summary Report</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">Filter criteria, render interactive preview, and download professional reports.</p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn_refresh_report"
            onClick={fetchReportSummary}
            disabled={loading}
            className="flex items-center justify-center p-2.5 border border-white/20 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition cursor-pointer backdrop-blur-md"
            title="Refresh Preview"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            id="btn_export_pdf"
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null || loading}
            className="flex items-center space-x-1.5 py-2.5 px-3.5 bg-rose-500/20 border border-rose-400/30 hover:bg-rose-500/30 text-rose-200 rounded-2xl text-xs font-bold cursor-pointer transition backdrop-blur-md"
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export PDF</span>
          </button>

          <button
            id="btn_export_excel"
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || loading}
            className="flex items-center space-x-1.5 py-2.5 px-3.5 bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-200 rounded-2xl text-xs font-bold cursor-pointer transition backdrop-blur-md"
          >
            {exporting === 'excel' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export Excel</span>
          </button>

          <button
            id="btn_export_csv"
            onClick={() => handleExport('csv')}
            disabled={exporting !== null || loading}
            className="flex items-center space-x-1.5 py-2.5 px-3.5 bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200 rounded-2xl text-xs font-bold cursor-pointer transition backdrop-blur-md"
          >
            {exporting === 'csv' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 border border-white/15 p-4 rounded-2xl backdrop-blur-md">
        
        {/* Date Range Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center">
            <Calendar className="h-3 w-3 mr-1 text-slate-400" /> Date Range
          </label>
          <div className="relative">
            <select
              id="report_date_range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-slate-900 border border-white/20 rounded-xl text-xs py-2 px-3 pr-8 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 appearance-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Time</option>
              <option value="Today" className="bg-slate-900 text-white">Today</option>
              <option value="Last 7 Days" className="bg-slate-900 text-white">Last 7 Days</option>
              <option value="Last 30 Days" className="bg-slate-900 text-white">Last 30 Days</option>
              <option value="This Month" className="bg-slate-900 text-white">This Month</option>
              <option value="Custom" className="bg-slate-900 text-white">Custom Date Range</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Department Filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center">
            <Building className="h-3 w-3 mr-1 text-slate-400" /> Department
          </label>
          <div className="relative">
            <select
              id="report_department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-900 border border-white/20 rounded-xl text-xs py-2 px-3 pr-8 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 appearance-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Departments</option>
              {ALL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900 text-white">
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center">
            <Activity className="h-3 w-3 mr-1 text-slate-400" /> Status
          </label>
          <div className="relative">
            <select
              id="report_status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-white/20 rounded-xl text-xs py-2 px-3 pr-8 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 appearance-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Statuses</option>
              <option value="Pending Inventory Review" className="bg-slate-900 text-white">Pending Inventory Review</option>
              <option value="Pending Admin Approval" className="bg-slate-900 text-white">Pending Admin Approval</option>
              <option value="Approved" className="bg-slate-900 text-white">Approved</option>
              <option value="Rejected" className="bg-slate-900 text-white">Rejected</option>
              <option value="Completed" className="bg-slate-900 text-white">Completed</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Custom Date Range Picker Block */}
        {dateRange === 'Custom' ? (
          <div className="md:col-span-1 grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start</label>
              <input
                type="date"
                id="report_start_date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/20 rounded-xl text-xs p-1.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End</label>
              <input
                type="date"
                id="report_end_date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/20 rounded-xl text-xs p-1.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-end pb-1.5 pl-4">
            <div className="text-[10px] font-semibold text-slate-400 flex items-center">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Realtime synced reporting database.
            </div>
          </div>
        )}
      </div>

      {/* Main Preview Block */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">Compiling Report Preview & Fetching Data...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button 
            onClick={fetchReportSummary}
            className="mt-3 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-xl font-bold cursor-pointer"
          >
            Retry Fetching
          </button>
        </div>
      ) : reportData ? (
        <div className="space-y-8 animate-fade-in">
          
          {/* Metadata Display */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-2xl border border-white/15 backdrop-blur-md">
            <div>
              <strong className="text-white">Company:</strong> PSR Request Management System
            </div>
            <div className="mt-1 sm:mt-0">
              <strong className="text-white">Generated By:</strong> {adminName} | <strong className="text-white">Date:</strong> {new Date().toLocaleString()}
            </div>
          </div>

          {/* 1. Overall Summary Cards */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Overall Summary Cards</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
              
              <div className="bg-slate-950/60 border border-white/15 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Total Requests</span>
                <p className="text-2xl font-black text-white mt-1">{reportData.summary.total}</p>
              </div>

              <div className="bg-blue-950/40 border border-blue-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Submitted</span>
                <p className="text-2xl font-black text-blue-300 mt-1">{reportData.summary.submitted}</p>
              </div>

              <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Under Review</span>
                <p className="text-2xl font-black text-amber-300 mt-1">{reportData.summary.underReview}</p>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Approved</span>
                <p className="text-2xl font-black text-emerald-300 mt-1">{reportData.summary.approved}</p>
              </div>

              <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Rejected</span>
                <p className="text-2xl font-black text-rose-300 mt-1">{reportData.summary.rejected}</p>
              </div>

              <div className="bg-purple-950/40 border border-purple-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Need More Info</span>
                <p className="text-2xl font-black text-purple-300 mt-1">{reportData.summary.needMoreInfo}</p>
              </div>

              <div className="bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-2xl text-center backdrop-blur-md shadow-md">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Completed</span>
                <p className="text-2xl font-black text-indigo-300 mt-1">{reportData.summary.completed || 0}</p>
              </div>

            </div>
          </div>

          {/* 2. Department Breakdown Cards */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Department Summary Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              
              {ALL_DEPARTMENTS.map((dept) => {
                const deptStats = reportData.departmentSummary[dept] || { total: 0, approved: 0, rejected: 0, pending: 0 };
                return (
                  <div key={dept} className="border border-white/15 rounded-2xl p-4 space-y-3 bg-slate-950/60 backdrop-blur-md hover:border-white/30 transition shadow-md">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-sm font-bold text-white truncate" title={dept}>{dept}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 border border-white/10 font-bold px-2 py-0.5 rounded-full shrink-0">Dept</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
                        <p className="text-base font-extrabold text-white">{deptStats.total}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-emerald-400 uppercase">Approved</span>
                        <p className="text-base font-extrabold text-emerald-300">{deptStats.approved}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-rose-400 uppercase">Rejected</span>
                        <p className="text-base font-extrabold text-rose-300">{deptStats.rejected}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-amber-400 uppercase">Pending</span>
                        <p className="text-base font-extrabold text-amber-300">{deptStats.pending}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>

          {/* 3. Recharts Graphics Section */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Report Visualizations & Charts</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Requests by Status Bar Chart */}
              <div className="bg-slate-950/60 border border-white/15 rounded-2xl p-4 flex flex-col h-[290px] backdrop-blur-md shadow-md">
                <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                  <span>Requests by Status</span>
                  <span className="text-[10px] text-slate-400">Bar Chart</span>
                </h4>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={reportData.charts.byStatus}
                      margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', borderRadius: '12px', backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {reportData.charts.byStatus.map((entry: any, index: number) => {
                          const statusKey = entry.name as keyof typeof COLORS_STATUS;
                          return <Cell key={`cell-${index}`} fill={COLORS_STATUS[statusKey] || '#3b82f6'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Requests by Department Pie Chart */}
              <div className="bg-slate-950/60 border border-white/15 rounded-2xl p-4 flex flex-col h-[290px] backdrop-blur-md shadow-md">
                <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                  <span>Requests by Department</span>
                  <span className="text-[10px] text-slate-400">Pie Chart</span>
                </h4>
                <div className="flex-1 w-full min-h-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.charts.byDepartment.filter((d: any) => d.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {reportData.charts.byDepartment.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS_DEPT[index % COLORS_DEPT.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Request Trend Line Chart */}
              <div className="bg-slate-950/60 border border-white/15 rounded-2xl p-4 flex flex-col h-[290px] backdrop-blur-md shadow-md">
                <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                  <span>Monthly Request Trend</span>
                  <span className="text-[10px] text-slate-400 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1 text-emerald-400" /> Line Chart
                  </span>
                </h4>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={reportData.charts.monthlyTrend}
                      margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#0f172a' }} 
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

          {/* 4. Requests Details Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Request Details Table Preview ({reportData.requests.length} Records)
            </h3>
            
            <div className="border border-white/15 rounded-2xl overflow-hidden bg-slate-950/60 backdrop-blur-md shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-white/15 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-4 text-center">Request ID</th>
                      <th className="py-3.5 px-4">Title</th>
                      <th className="py-3.5 px-4 text-center">Department</th>
                      <th className="py-3.5 px-4 text-center">Priority</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Requested By</th>
                      <th className="py-3.5 px-4">Admin Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {reportData.requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                          No records match the applied report filter settings.
                        </td>
                      </tr>
                    ) : (
                      reportData.requests.map((r: any) => (
                        <tr key={r.id} className="hover:bg-white/5 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-300 text-center">{r.id}</td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white">{r.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Submitted: {new Date(r.created_at).toLocaleString()}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-white/10">
                              {r.department}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.priority === 'Urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30' :
                              r.priority === 'High' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' :
                              r.priority === 'Medium' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' :
                              'bg-slate-800 text-slate-300 border border-white/10'
                            }`}>
                              {r.priority}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                              r.status === 'Completed' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' :
                              r.status === 'Rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30' :
                              r.status === 'Under Review' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' :
                              r.status === 'Need More Information' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' :
                              'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-200">{r.creator_name}</div>
                            <div className="text-[10px] text-slate-400">{r.creator_email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 italic max-w-[180px] truncate" title={r.adminComments}>
                            {r.adminComments || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-10">
          <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Filters selected. Click Generate Report to display.</p>
        </div>
      )}

    </div>
  );
}
