import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantMap: Record<Variant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  ghost:     'btn-ghost',
  accent:    'btn-accent',
};

const sizeMap: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export function Button({ variant = 'primary', size = 'md', loading = false, icon, children, disabled, className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={['btn', variantMap[variant], sizeMap[size], className].filter(Boolean).join(' ')}
    >
      {loading ? (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
          <circle cx={12} cy={12} r={10} strokeOpacity={0.25} />
          <path d="M12 2a10 10 0 0110 10" />
        </svg>
      ) : (icon && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>)}
      {children}
    </button>
  );
}
