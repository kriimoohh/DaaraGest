type BadgeVariant = 'success' | 'warning' | 'error' | 'danger' | 'info' | 'neutral' | 'accent' | 'outline';

interface BadgeProps { label: string; variant: BadgeVariant; dot?: boolean; }

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

export function Badge({ label, variant, dot }: BadgeProps) {
  return (
    <span className={`badge ${variantMap[variant]}`}>
      {dot && <span className="badge-dot" />}
      {label}
    </span>
  );
}
