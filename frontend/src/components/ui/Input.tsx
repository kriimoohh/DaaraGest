import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={[
          'w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:border-transparent',
          error
            ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500',
          className,
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}
