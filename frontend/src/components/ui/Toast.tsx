import { useToastStore } from '../../store/toastStore';

const styles = {
  success: 'bg-[#10B981]',
  error: 'bg-red-500',
  info: 'bg-[#14B8A6]',
  warning: 'bg-[#F59E0B]',
};

const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

export function ToastContainer() {
  const { items, remove } = useToastStore();
  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 end-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`${styles[t.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-72 max-w-sm pointer-events-auto`}
        >
          <span className="font-bold text-sm">{icons[t.type]}</span>
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="opacity-70 hover:opacity-100 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
