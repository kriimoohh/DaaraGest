interface SearchInputProps { value: string; onChange: (v: string) => void; placeholder?: string; }
export function SearchInput({ value, onChange, placeholder = "Rechercher..." }: SearchInputProps) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 start-3.5 flex items-center text-slate-400 text-sm pointer-events-none">🔍</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full ps-9 pe-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all" />
      {value && <button onClick={() => onChange("")} className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 text-xs">✕</button>}
    </div>
  );
}
