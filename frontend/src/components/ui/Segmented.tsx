interface SegOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  options: SegOption[];
  value: string;
  onChange: (value: string) => void;
  /** accent = terra (période, bascule primaire) · neutral = encre (filtres) · outline = fond clair */
  variant?: 'accent' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

// Groupe de pills à sélection unique (filtres, sélecteurs de période, bascules).
// Remplace le pattern inline dupliqué dans une demi-douzaine de pages.
export function Segmented({ options, value, onChange, variant = 'accent', size = 'md', ariaLabel }: SegmentedProps) {
  return (
    <div className={`seg seg-${variant}${size === 'sm' ? ' seg-sm' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`seg-pill${opt.value === value ? ' active' : ''}`}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
