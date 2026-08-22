import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { APP_NAME } from '../../lib/constants';

export function Sidebar() {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/jobs', label: 'Job Openings', icon: Briefcase },
    { to: '/settings', label: 'Settings & Models', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950 flex flex-col shrink-0 h-full overflow-hidden transition-colors">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-neutral-200/70 dark:border-neutral-800 shrink-0">
        <img src="/app-icon.png" alt={APP_NAME} className="h-9 w-9 rounded-xl shadow-xs object-cover" />
        <div>
          <h1 className="font-bold text-neutral-950 dark:text-white text-base tracking-tight">{APP_NAME}</h1>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium leading-none mt-0.5">Privacy-First AI</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain">
        <div className="px-3 py-2 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
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
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-900'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Privacy Guarantee Badge */}
      <div className="p-4 border-t border-neutral-200/70 dark:border-neutral-800 shrink-0">
        <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-neutral-900 dark:text-white shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">100% Local Processing</p>
            <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
              Resumes never leave your device.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
