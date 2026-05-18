type BadgeVariant = 'success' | 'warning' | 'error' | 'danger' | 'info' | 'neutral' | 'accent' | 'outline';

interface BadgeProps { label: string; variant: BadgeVariant; dot?: boolean; onClick?: () => void; }

const variantMap: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error:   'badge-danger',
  danger:  'badge-danger',
  info:    'badge-info',
  neutral: 'badge-neutral',
  accent:  'badge-accent',
  outline: 'badge-outline',
};

export function Badge({ label, variant, dot, onClick }: BadgeProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`badge ${variantMap[variant]}`}
        style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
      >
        {dot && <span className="badge-dot" />}
        {label}
      </button>
    );
  }
  return (
    <span className={`badge ${variantMap[variant]}`}>
      {dot && <span className="badge-dot" />}
      {label}
    </span>
  );
}
