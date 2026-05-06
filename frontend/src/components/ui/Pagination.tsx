interface PaginationProps { page: number; total: number; limit: number; onChange: (page: number) => void; }
export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);
  if (total === 0) return null;
  const pages: number[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push(-1);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push(-2);
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">{from}–{to} sur <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> résultat{total > 1 ? "s" : ""}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
        {pages.map((p, i) => p < 0 ? <span key={p} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs">…</span> : <button key={i} onClick={() => onChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${p === page ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{p}</button>)}
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
      </div>
    </div>
  );
}
