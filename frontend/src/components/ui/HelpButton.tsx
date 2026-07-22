import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { findRoute } from '../../config/routes';

// Aide contextuelle légère : un bouton « ? » dans la topbar qui affiche, pour la
// page courante, un rappel de son objectif et quelques astuces d'utilisation.
// Contenu piloté par i18n (help.<clé de route>) — s'il n'existe pas encore pour
// une route, le bouton ne s'affiche simplement pas (déploiement incrémental).
export function HelpButton() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const route = findRoute(location.pathname);
  const key = route?.key;
  const intro = key ? t(`help.${key}.intro`, { defaultValue: '' }) : '';
  const tips = key
    ? (t(`help.${key}.tips`, { returnObjects: true, defaultValue: [] }) as unknown as string[])
    : [];

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!key || !intro) return null;

  const title = t(`nav.${key}`, key);

  return (
    <div className="tb-help-btn" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        className="tb-btn"
        onClick={() => setOpen(v => !v)}
        title={t('aide.titre', 'Aide')}
        aria-label={t('aide.titre', 'Aide')}
        aria-expanded={open}
      >
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a2.9 2.9 0 015.68.9c0 1.9-2.83 1.9-2.83 3.6" />
          <line x1="12" y1="17.5" x2="12" y2="17.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            insetInlineEnd: 0,
            marginTop: 8,
            width: 320,
            maxWidth: '90vw',
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--rule)',
              background: 'var(--paper-2)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{title}</span>
          </div>

          <div style={{ padding: '12px 14px', maxHeight: 360, overflowY: 'auto' }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '0 0 10px', lineHeight: 1.55 }}>
              {intro}
            </p>
            {tips.length > 0 && (
              <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tips.map((tip, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
