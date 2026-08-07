import { DashboardStats, UserRole } from '../types';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  PackageCheck,
  ShieldCheck
} from 'lucide-react';

interface KpiCardsProps {
  stats: DashboardStats;
  role: UserRole;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function KpiCards({ stats, role, activeFilter, onFilterChange }: KpiCardsProps) {
  const isUser = role === 'User';

  const cards = [
    {
      id: 'kpi_total',
      title: isUser ? 'My Requests' : 'Total Requests',
      value: stats.totalRequests,
      icon: FileText,
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-500/20 border-blue-400/30',
      statusValue: '',
    },
    {
      id: 'kpi_pending_inventory',
      title: 'Inventory Review',
      value: stats.pendingInventoryReview || 0,
      icon: PackageCheck,
      iconColor: 'text-amber-300',
      iconBg: 'bg-amber-500/20 border-amber-400/30',
      statusValue: 'Pending Inventory Review',
    },
    {
      id: 'kpi_pending_admin',
      title: 'Admin Approval',
      value: stats.pendingAdminApproval || 0,
      icon: ShieldCheck,
      iconColor: 'text-purple-300',
      iconBg: 'bg-purple-500/20 border-purple-400/30',
      statusValue: 'Pending Admin Approval',
    },
    {
      id: 'kpi_approved',
      title: 'Approved',
      value: stats.approved,
      icon: CheckCircle,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-500/20 border-emerald-400/30',
      statusValue: 'Approved',
    },
    {
      id: 'kpi_completed',
      title: 'Completed',
      value: stats.completed,
      icon: Clock,
      iconColor: 'text-indigo-300',
      iconBg: 'bg-indigo-500/20 border-indigo-400/30',
      statusValue: 'Completed',
    }
  ];

  return (
    <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeFilter === card.statusValue;
        return (
          <div
            key={card.id}
            id={card.id}
            onClick={() => onFilterChange(card.statusValue)}
            className={`p-3.5 sm:p-4 rounded-3xl flex items-center justify-between gap-2 transition cursor-pointer select-none backdrop-blur-2xl border hover:scale-[1.02] active:scale-[0.98] shadow-lg min-w-0 ${
              isActive 
                ? 'bg-blue-600/30 border-blue-400/80 ring-2 ring-blue-400/40 shadow-blue-500/20' 
                : 'bg-slate-900/40 hover:bg-slate-900/60 border-white/20'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider truncate">{card.title}</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight drop-shadow-sm truncate">{card.value}</p>
            </div>
            <div className={`p-2.5 rounded-2xl border ${card.iconBg} ${card.iconColor} shadow-inner shrink-0`}>
              <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

