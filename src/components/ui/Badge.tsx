import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'indigo';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default:
      'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-2xs',
    secondary:
      'bg-neutral-100 text-neutral-800 border border-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
    outline:
      'border border-neutral-300 text-neutral-800 bg-white dark:border-neutral-700 dark:text-neutral-200 dark:bg-neutral-900',
    success:
      'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold border border-neutral-900 dark:border-white',
    warning:
      'bg-neutral-100 text-neutral-900 border border-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-600',
    destructive:
      'bg-neutral-100 text-neutral-900 border border-neutral-400 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-600',
    indigo:
      'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border border-neutral-900 dark:border-white',
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
