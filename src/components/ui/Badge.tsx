import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'indigo';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-900 text-white',
    secondary: 'bg-slate-100 text-slate-700 border border-slate-200/60',
    outline: 'border border-slate-300 text-slate-700 bg-white',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    destructive: 'bg-rose-50 text-rose-700 border border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
