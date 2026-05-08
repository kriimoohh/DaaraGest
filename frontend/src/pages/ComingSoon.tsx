import { useTranslation } from 'react-i18next';

interface Props {
  pageKey: keyof ReturnType<typeof useTranslation>['t'] extends never ? string : string;
}

export function ComingSoon({ pageKey }: Props) {
  const { t } = useTranslation();
  return (
    <div className="empty" style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <svg width={40} height={40} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-4)' }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', margin: 0 }}>
        {t(`nav.${pageKey}`)}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Module en cours de développement</p>
    </div>
  );
}
