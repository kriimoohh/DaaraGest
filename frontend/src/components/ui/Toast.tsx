import { useToastStore } from '../../store/toastStore';

const colorMap = {
  success: 'var(--success-text)',
  error:   'var(--danger-text)',
  info:    'var(--info-text)',
  warning: 'var(--warning-text)',
};

const iconMap = {
  success: (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  error: (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  ),
  info: (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  ),
  warning: (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  ),
};

export function ToastContainer() {
  const { items, remove } = useToastStore();
  if (items.length === 0) return null;

  return (
    <div className="toast-stack">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <span style={{ color: colorMap[t.type], display: 'flex', flexShrink: 0 }}>{iconMap[t.type]}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="tb-btn"
            style={{ width: 24, height: 24 }}
            aria-label="Fermer"
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
