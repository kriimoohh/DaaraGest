interface Props {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 36, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Disque terracotta */}
      <circle cx="50" cy="50" r="50" fill="#B85433" />
      {/* Monogramme Dg en blanc */}
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="700"
        fontSize="46"
        fill="#FFFFFF"
        letterSpacing="-2"
      >Dg</text>
    </svg>
  );
}
