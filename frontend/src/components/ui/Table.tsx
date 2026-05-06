import React from 'react';
export interface Column<T> { key: string; header: string; render?: (row: T) => React.ReactNode; width?: string; }
interface TableProps<T> { columns: Column<T>[]; data: T[]; loading?: boolean; emptyMessage?: string; }
function SkeletonRow({ cols }: { cols: number }) {
  return <tr>{Array.from({ length: cols }).map((_, i) => <td key={i} className="px-4 py-3.5"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-md animate-pulse" /></td>)}</tr>;
}
export function Table<T extends Record<string, unknown>>({ columns, data, loading = false, emptyMessage = 'Aucun résultat' }: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map(col => <th key={col.key} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/50" style={col.width ? { width: col.width } : undefined}>{col.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading ? (<><SkeletonRow cols={columns.length} /><SkeletonRow cols={columns.length} /><SkeletonRow cols={columns.length} /><SkeletonRow cols={columns.length} /></>)
          : data.length === 0 ? (<tr><td colSpan={columns.length} className="py-16 text-center"><div className="flex flex-col items-center gap-2"><span className="text-3xl opacity-50">📭</span><p className="text-slate-400 dark:text-slate-500 text-sm">{emptyMessage}</p></div></td></tr>)
          : data.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
              {columns.map(col => <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">{col.render ? col.render(row) : String(row[col.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
