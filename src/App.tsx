import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  Plus, 
  RefreshCw, 
  ShieldAlert, 
  User as UserIcon, 
  Sparkles, 
  AlertCircle,
  X,
  FileText,
  Package,
  Layers
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import KpiCards from './components/KpiCards';
import RequestTable from './components/RequestTable';
import RequestDetail from './components/RequestDetail';
import RequestModal from './components/RequestModal';
import AdminReportModule from './components/AdminReportModule';
import AdminInventoryModule from './components/AdminInventoryModule';
import { Request, DashboardStats, RequestStatus, RequestDepartment, RequestPriority, UserRole } from './types';
import workshopBg from './assets/images/workshop_login_bg_1784718579517.jpg';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: UserRole } | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    needMoreInfo: 0,
    completed: 0
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals and Toasts
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'reports' | 'inventory'>('queue');

  // Show customized toast notifications
  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const newToast: Toast = {
      id: Math.random().toString(),
      message,
      type
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: typeof user) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    triggerToast(`Welcome back, ${newUser?.name}!`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setRequests([]);
    setSelectedRequest(null);
    triggerToast('Logged out successfully.', 'info');
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Build filter parameters
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (deptFilter) params.append('department', deptFilter);

      // Fetch requests
      const reqRes = await fetch(`/api/requests?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const reqData = await reqRes.json();
      
      if (reqRes.ok) {
        setRequests(reqData.requests || []);
        // Refresh currently selected request details if one was open
        if (selectedRequest) {
          const freshSelected = (reqData.requests || []).find((r: Request) => r.id === selectedRequest.id);
          if (freshSelected) {
            setSelectedRequest(freshSelected);
          }
        }
      } else {
        if (reqRes.status === 401) handleLogout();
        throw new Error(reqData.message || 'Failed to fetch requests');
      }

      // Fetch stats
      const statsRes = await fetch('/api/requests/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setStats(statsData.stats);
      }
    } catch (err: any) {
      triggerToast(err.message || 'Error connecting to server.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, searchTerm, statusFilter, deptFilter, selectedRequest, triggerToast]);

  // Handle URL parameters for direct request targeting
  useEffect(() => {
    if (!token) return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetRequestId = urlParams.get('request');
    if (targetRequestId) {
      const found = requests.find(r => r.id === targetRequestId);
      if (found) {
        setSelectedRequest(found);
        // Clear param so user can deselect later
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [token, requests]);

  // Reload data whenever filters or tokens change
  useEffect(() => {
    fetchData();
  }, [token, searchTerm, statusFilter, deptFilter]);

  const handleCreateRequestSubmit = async (data: {
    title: string;
    department: RequestDepartment;
    description: string;
    priority: RequestPriority;
  }) => {
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to submit request');
      }
      triggerToast('Request submitted and Admin notified!', 'success');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleStatusChangeAction = async (id: string, nextStatus: RequestStatus, comments: string) => {
    try {
      const res = await fetch(`/api/requests/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus, comments })
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to update request status');
      }
      triggerToast(`Request ${nextStatus} successfully. Notification sent!`, 'success');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleAddCommentAction = async (id: string, comments: string) => {
    try {
      const res = await fetch(`/api/requests/${id}/comment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comments })
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to add comment');
      }
      triggerToast('Comment added and activity timeline logged.', 'success');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteRequestAction = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to delete request');
      }
      triggerToast('Request and associated history logs deleted.', 'success');
      setSelectedRequest(null);
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleCompleteRequestAction = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to complete request');
      }
      triggerToast('Work Completed confirmed successfully.', 'success');
      setSelectedRequest(body.request);
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  if (!token || !user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="dashboard_root" className="relative min-h-screen w-full flex flex-col font-sans text-slate-100 antialiased overflow-x-hidden select-none">
      
      {/* Workshop Background Image with Dark Blur Overlay */}
      <div className="fixed inset-0 z-0">
        <img 
          src={workshopBg} 
          alt="Workshop Background" 
          className="w-full h-full object-cover object-center scale-105 filter brightness-75 transition-all duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-slate-950/80" />
      </div>

      {/* Floating Ambient Light Orbs */}
      <div className="fixed top-10 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Header Apple Control Panel Pill */}
      <header className="relative z-30 pt-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto bg-slate-900/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/20 shadow-xl rounded-2xl px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            
            {/* Logo & App Title */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/30 border border-white/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-extrabold text-white tracking-tight drop-shadow-sm block leading-tight">
                  Service Request Management System
                </span>
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest hidden sm:inline-block">
                  Control Center Dashboard
                </span>
              </div>
            </div>

            {/* User Profile Bubble & Action Buttons */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-2.5 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-2xl shadow-inner">
                <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left leading-tight">
                  <p className="text-xs font-bold text-white">{user.name}</p>
                  <p className="text-[10px] font-semibold text-blue-300 flex items-center mt-0.5 uppercase tracking-wider">
                    <UserIcon className="h-2.5 w-2.5 mr-0.5 text-blue-400" />
                    {user.role}
                  </p>
                </div>
              </div>

              {/* Refresh Control Bubble */}
              <button
                id="btn_refresh"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl backdrop-blur-md transition cursor-pointer active:scale-95 shadow-sm"
                title="Refresh Database"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              {/* Logout Button */}
              <button
                id="btn_logout"
                onClick={handleLogout}
                className="flex items-center space-x-1.5 py-2 px-3.5 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-2xl text-xs font-bold text-red-200 hover:text-white cursor-pointer transition active:scale-95 shadow-sm backdrop-blur-md"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Statistics KPI Control Row */}
        <KpiCards 
          stats={stats} 
          role={user.role} 
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />

        {/* Apple Control Center Tab Bar (Admin / Officer Navigation) */}
        {(user.role === 'Admin' || user.role === 'Inventory Officer') && (
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-lg max-w-fit">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border border-white/20'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Requests Queue</span>
            </button>
            {user.role === 'Admin' && (
              <button
                id="btn_tab_reports"
                onClick={() => setActiveTab('reports')}
                className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 border border-white/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Summary Reports</span>
              </button>
            )}
            {(user.role === 'Inventory Officer' || user.role === 'Admin') && (
              <button
                id="btn_tab_inventory"
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 border border-white/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Inventory {user.role === 'Admin' ? '(View Only)' : ''}</span>
              </button>
            )}
          </div>
        )}

        {/* Active Tab View */}
        {activeTab === 'queue' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Requests Queue Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Requests Dispatcher</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Live Queue
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">Filter, search, and manage active service requests</p>
                </div>

                {/* User Only: Submit Request Trigger */}
                {user.role === 'User' && (
                  <button
                    id="btn_open_submit_modal"
                    onClick={() => setShowSubmitModal(true)}
                    className="flex items-center space-x-1.5 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/30 border border-white/20 cursor-pointer transition active:scale-95 backdrop-blur-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Submit Request</span>
                  </button>
                )}
              </div>

              {/* Requests Table Glass Component */}
              <RequestTable
                requests={requests}
                selectedId={selectedRequest ? selectedRequest.id : null}
                onSelectRequest={(req) => setSelectedRequest(req)}
                role={user.role}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                deptFilter={deptFilter}
                setDeptFilter={setDeptFilter}
              />
            </div>

            {/* Interactive Detail Panel Column */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-bold text-white tracking-tight mb-4 px-1">
                Request Detail & Activity
              </h2>
              
              {selectedRequest ? (
                <RequestDetail
                  request={selectedRequest}
                  role={user.role}
                  onStatusChange={handleStatusChangeAction}
                  onAddComment={handleAddCommentAction}
                  onDeleteRequest={handleDeleteRequestAction}
                  onComplete={handleCompleteRequestAction}
                  onRefreshData={() => fetchData(true)}
                />
              ) : (
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 p-10 rounded-[28px] text-center shadow-xl">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">No Request Selected</h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                    Select a request from the dispatcher queue to review full details, timeline logs, and perform workflow actions.
                  </p>
                </div>
              )}
            </div>

          </div>
        ) : activeTab === 'reports' && user.role === 'Admin' ? (
          <AdminReportModule token={token} adminName={user.name} />
        ) : activeTab === 'inventory' && (user.role === 'Inventory Officer' || user.role === 'Admin') ? (
          <AdminInventoryModule token={token} triggerToast={triggerToast} userRole={user.role} readOnly={user.role === 'Admin'} />
        ) : null}
      </main>

      {/* Footer Notice */}
      <footer className="relative z-10 mt-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-center sm:justify-end">
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/15 px-4 py-1.5 rounded-full text-[11px] font-semibold text-slate-300 flex items-center gap-2 shadow-lg">
          <span>© {new Date().getFullYear()} PSR Request Management. All Rights Reserved</span>
          <span className="text-slate-500">•</span>
          <span className="text-blue-300 font-extrabold tracking-wider uppercase">THILINATHARU</span>
        </div>
      </footer>

      {/* Slide-over Submit Form Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <RequestModal
            onClose={() => setShowSubmitModal(false)}
            onSubmit={handleCreateRequestSubmit}
          />
        )}
      </AnimatePresence>

      {/* Floating Action Notifications Toasts */}
      <div id="toast_wrapper" className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`p-4 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center space-x-3 pointer-events-auto min-w-[280px] max-w-sm backdrop-blur-xl ${
                toast.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-100 shadow-emerald-900/20'
                  : toast.type === 'error'
                  ? 'bg-red-950/80 border-red-500/40 text-red-100 shadow-red-900/20'
                  : 'bg-slate-900/90 border-slate-700 text-white shadow-slate-950/40'
              }`}
            >
              {toast.type === 'success' ? (
                <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-blue-400 shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

