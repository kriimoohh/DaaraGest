import React from 'react';
interface SelectOption { value: string; label: string; }
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; options: SelectOption[]; placeholder?: string; }
export function Select({ label, error, options, placeholder, id, className = '', ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={selectId} className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{label}</label>}
      <select id={selectId} {...rest} className={["w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:border-transparent appearance-none cursor-pointer", error ? "border-red-400 focus:ring-red-500/30" : "border-slate-200 dark:border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500", className].join(" ")}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}
