import { useState, useMemo } from 'react';
import { Request, RequestPriority, RequestStatus, ALL_DEPARTMENTS, UserRole } from '../types';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  User, 
  Briefcase,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame
} from 'lucide-react';

interface RequestTableProps {
  requests: Request[];
  selectedId: string | null;
  onSelectRequest: (req: Request) => void;
  role: UserRole;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  deptFilter: string;
  setDeptFilter: (val: string) => void;
}

export default function RequestTable({
  requests,
  selectedId,
  onSelectRequest,
  role,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  deptFilter,
  setDeptFilter,
}: RequestTableProps) {
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<'priority-desc' | 'priority-asc' | 'newest' | 'oldest'>('priority-desc');

  const getPriorityStyle = (priority: RequestPriority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-500/20 text-red-200 border-red-400/40 shadow-red-500/10';
      case 'High':
        return 'bg-amber-500/20 text-amber-200 border-amber-400/40 shadow-amber-500/10';
      case 'Medium':
        return 'bg-blue-500/20 text-blue-200 border-blue-400/40 shadow-blue-500/10';
      case 'Low':
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  const priorityWeight: Record<string, number> = {
    'Urgent': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
  };

  const processedRequests = useMemo(() => {
    let list = [...requests];

    if (priorityFilter) {
      list = list.filter(r => r.priority === priorityFilter);
    }

    return list.sort((a, b) => {
      if (sortMode === 'priority-desc') {
        const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === 'priority-asc') {
        const diff = (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  }, [requests, priorityFilter, sortMode]);

  const togglePrioritySort = () => {
    if (sortMode === 'priority-desc') {
      setSortMode('priority-asc');
    } else {
      setSortMode('priority-desc');
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'Pending Inventory Review':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/40 backdrop-blur-md max-w-[180px] sm:max-w-none truncate">
            <Clock className="w-3 h-3 mr-1 text-amber-300 animate-pulse shrink-0" />
            <span className="truncate">Pending Inventory Review</span>
          </span>
        );
      case 'Pending Admin Approval':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/40 backdrop-blur-md max-w-[180px] sm:max-w-none truncate">
            <Clock className="w-3 h-3 mr-1 text-purple-300 animate-pulse shrink-0" />
            <span className="truncate">Pending Admin Approval</span>
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 backdrop-blur-md">
            <CheckCircle className="w-3 h-3 mr-1 text-emerald-300 shrink-0" />
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-200 border border-rose-400/40 backdrop-blur-md">
            <XCircle className="w-3 h-3 mr-1 text-rose-300 shrink-0" />
            Rejected
          </span>
        );
      case 'Need More Information':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/40 backdrop-blur-md">
            <AlertTriangle className="w-3 h-3 mr-1 text-blue-300 shrink-0" />
            Need Info
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/40 backdrop-blur-md">
            <CheckCircle className="w-3 h-3 mr-1 text-indigo-300 shrink-0" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-slate-200 border border-white/20 truncate">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-2xl overflow-hidden flex flex-col h-full">
      {/* Search & Filter Header */}
      <div className="p-5 border-b border-white/15 bg-white/5 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:space-x-3">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            id="search_input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={role !== 'User' ? "Search ID, Department, Status, Priority, Requester..." : "Search ID, Department, Status, Priority..."}
            className="block w-full pl-10 pr-4 py-2.5 border border-white/20 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white/10 hover:bg-white/15 focus:bg-white/20 text-xs font-medium transition backdrop-blur-md"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Priority Filter Dropdown */}
          <div className="flex items-center space-x-1">
            <Flame className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <select
              id="priority_filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="py-2 pl-2.5 pr-8 border border-white/20 rounded-2xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900/80 backdrop-blur-md cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">All Priorities</option>
              <option value="Urgent" className="bg-slate-900 text-red-300 font-bold">🔴 Urgent</option>
              <option value="High" className="bg-slate-900 text-amber-300 font-bold">🟠 High</option>
              <option value="Medium" className="bg-slate-900 text-blue-300 font-bold">🔵 Medium</option>
              <option value="Low" className="bg-slate-900 text-slate-300 font-bold">⚪ Low</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center space-x-1 min-w-0">
            <Filter className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            <select
              id="status_filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 pl-2.5 pr-8 border border-white/20 rounded-2xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900/80 backdrop-blur-md cursor-pointer max-w-[180px] truncate"
            >
              <option value="" className="bg-slate-900 text-white">All Statuses</option>
              <option value="Pending Inventory Review" className="bg-slate-900 text-white">Pending Inventory Review</option>
              <option value="Pending Admin Approval" className="bg-slate-900 text-white">Pending Admin Approval</option>
              <option value="Approved" className="bg-slate-900 text-white">Approved</option>
              <option value="Rejected" className="bg-slate-900 text-white">Rejected</option>
              <option value="Need More Information" className="bg-slate-900 text-white">Need More Info</option>
              <option value="Completed" className="bg-slate-900 text-white">Completed</option>
            </select>
          </div>

          {/* Department Dropdown */}
          <select
            id="dept_filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="py-2 pl-2.5 pr-8 border border-white/20 rounded-2xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900/80 backdrop-blur-md cursor-pointer max-w-[150px] truncate"
          >
            <option value="" className="bg-slate-900 text-white">All Departments</option>
            {ALL_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept} className="bg-slate-900 text-white">
                {dept}
              </option>
            ))}
          </select>

          {/* Sort Order Selector */}
          <div className="flex items-center space-x-1 min-w-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            <select
              id="sort_order_select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="py-2 pl-2.5 pr-8 border border-white/20 rounded-2xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900/80 backdrop-blur-md cursor-pointer max-w-[170px] truncate"
            >
              <option value="priority-desc" className="bg-slate-900 text-white">Priority: Highest First</option>
              <option value="priority-asc" className="bg-slate-900 text-white">Priority: Lowest First</option>
              <option value="newest" className="bg-slate-900 text-white">Date: Newest First</option>
              <option value="oldest" className="bg-slate-900 text-white">Date: Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-[350px] max-h-[550px] w-full">
        {processedRequests.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-200 font-bold text-sm">No requests found matching your filters.</p>
            <p className="text-slate-400 text-xs mt-1">Try resetting your search term, priority, or status selection.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5 sticky top-0 backdrop-blur-xl z-10">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Request
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Department
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <button
                    onClick={togglePrioritySort}
                    className="flex items-center space-x-1.5 hover:text-white transition cursor-pointer group"
                    title="Click to toggle Priority sorting order"
                  >
                    <span>Priority</span>
                    {sortMode === 'priority-desc' && <ArrowDown className="h-3.5 w-3.5 text-amber-300" />}
                    {sortMode === 'priority-asc' && <ArrowUp className="h-3.5 w-3.5 text-amber-300" />}
                    {sortMode !== 'priority-desc' && sortMode !== 'priority-asc' && <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />}
                  </button>
                </th>
                {role !== 'User' && (
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Requester
                  </th>
                )}
                <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {processedRequests.map((req) => {
                const isSelected = selectedId === req.id;
                return (
                  <tr
                    key={req.id}
                    id={`request_row_${req.id}`}
                    onClick={() => onSelectRequest(req)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isSelected 
                        ? 'bg-blue-600/30 border-l-4 border-l-blue-400' 
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-blue-300">{req.id}</span>
                        <span className="text-sm font-bold text-white line-clamp-1 mt-0.5">{req.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-300">{req.department}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold border backdrop-blur-md shadow-sm ${getPriorityStyle(req.priority)}`}>
                        {req.priority === 'Urgent' && <span className="mr-1">🔴</span>}
                        {req.priority === 'High' && <span className="mr-1">🟠</span>}
                        {req.priority === 'Medium' && <span className="mr-1">🔵</span>}
                        {req.priority === 'Low' && <span className="mr-1">⚪</span>}
                        {req.priority}
                      </span>
                    </td>
                    {role !== 'User' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                            <User className="h-3 w-3 text-slate-300" />
                          </div>
                          <span className="text-xs font-medium text-slate-200 max-w-[120px] truncate">{req.creator_name}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

