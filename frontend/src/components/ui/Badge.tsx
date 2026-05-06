type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
interface BadgeProps { label: string; variant: BadgeVariant; }
const styles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/20',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-600/20',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-red-600/20',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-600/20',
  neutral: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-600/10',
};
export function Badge({ label, variant }: BadgeProps) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[variant]}`}>{label}</span>;
}
