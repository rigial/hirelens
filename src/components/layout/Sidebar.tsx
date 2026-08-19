import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Settings, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { APP_NAME } from '../../lib/constants';

export function Sidebar() {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/jobs', label: 'Job Openings', icon: Briefcase },
    { to: '/settings', label: 'Settings & Models', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-slate-50/60 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200/60">
        <img src="/app-icon.png" alt={APP_NAME} className="h-9 w-9 rounded-xl shadow-xs object-cover" />
        <div>
          <h1 className="font-bold text-slate-900 text-base tracking-tight">{APP_NAME}</h1>
          <p className="text-[11px] text-slate-500 font-medium leading-none">Privacy-First AI</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Privacy Guarantee Badge */}
      <div className="p-4 border-t border-slate-200/60">
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-emerald-900">100% Local Processing</p>
            <p className="text-emerald-700/90 text-[11px] mt-0.5 leading-relaxed">
              Resumes never leave your device.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
