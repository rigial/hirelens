import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {label} {props.required && <span className="text-neutral-900 dark:text-white font-bold">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-sm text-neutral-900 dark:text-neutral-100 shadow-2xs transition-colors',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:border-neutral-900 dark:focus-visible:border-white',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-neutral-900 dark:border-white focus-visible:ring-neutral-900 dark:focus-visible:ring-white',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-neutral-900 dark:text-neutral-200 font-semibold">{error}</p>}
        {helperText && !error && <p className="text-xs text-neutral-500 dark:text-neutral-400">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
