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
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill="#0F172A" />

      {/* Outer emerald arc — ~270° from bottom-left clockwise */}
      <path
        d="M 50 88 A 38 38 0 1 1 88 50"
        stroke="#10B981"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Inner gold arc — ~180° */}
      <path
        d="M 22 68 A 30 30 0 0 1 72 26"
        stroke="#F59E0B"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Letter D — geometric, hollow */}
      <path
        d="M 34 28 L 34 72 M 34 28 Q 34 28 44 28 Q 66 28 66 50 Q 66 72 44 72 L 34 72"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Gold dot — accent point */}
      <circle cx="86" cy="54" r="4.5" fill="#F59E0B" />
    </svg>
  );
}
