interface Props {
  size?: number;
  className?: string;
  /** Variante de couleur. 'terra' (défaut) = mark terracotta sur fond clair.
   *  'paper' = mark papier sur fond sombre. 'inverse' = mark papier sur
   *  fond terra. */
  variant?: 'terra' | 'paper' | 'inverse';
}

export function LogoMark({ size = 64, className = '', variant = 'terra' }: Props) {
  const colors = {
    terra:   { body: '#B85433', detail: '#FAF6EE' },
    paper:   { body: '#FAF6EE', detail: '#1B1812' },
    inverse: { body: '#FAF6EE', detail: '#B85433' },
  }[variant];

  return (
    <svg
      width={size}
      height={Math.round(size * 64 / 56)}
      viewBox="0 0 56 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DaaraGest"
    >
      {/* Poignée (ergot du haut) */}
      <rect x="20" y="0" width="16" height="8" rx="4" fill={colors.body} />
      {/* Corps de la planchette */}
      <rect x="4" y="6" width="48" height="52" rx="6" fill={colors.body} />
      {/* Encoche sous la poignée */}
      <rect x="18" y="6" width="20" height="6" rx="2" fill={colors.detail} opacity="0.25" />
      {/* Lignes d'écriture */}
      <g stroke={colors.detail} strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
        <line x1="14" y1="28" x2="42" y2="28" />
        <line x1="14" y1="36" x2="42" y2="36" />
        <line x1="14" y1="44" x2="34" y2="44" />
      </g>
      {/* Monogramme */}
      <text
        x="28"
        y="22"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="700"
        fontSize="13"
        fill={colors.detail}
      >
        Dg
      </text>
    </svg>
  );
}
