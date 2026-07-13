import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// Icônes œil (afficher / masquer), inline pour éviter une dépendance.
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.47" />
      <path d="M6.06 6.06A13.2 13.2 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.94-.94" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function Input({ label, error, id, className = '', ...rest }: InputProps) {
  const { t } = useTranslation();
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const [visible, setVisible] = useState(false);
  const isPassword = rest.type === 'password';
  const effectiveType = isPassword && visible ? 'text' : rest.type;

  const inputEl = (
    <input
      id={inputId}
      {...rest}
      type={effectiveType}
      className={['input', error ? 'input-error' : '', className].filter(Boolean).join(' ')}
      style={{
        ...(error ? { borderColor: 'var(--danger)' } : undefined),
        ...(isPassword ? { paddingInlineEnd: 38 } : undefined),
        ...rest.style,
      }}
    />
  );

  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className="field-label">{label}</label>
      )}
      {isPassword ? (
        <div style={{ position: 'relative' }}>
          {inputEl}
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? t('input.masquer_mdp') : t('input.afficher_mdp')}
            title={visible ? t('input.masquer_mdp') : t('input.afficher_mdp')}
            tabIndex={-1}
            style={{
              position: 'absolute',
              insetInlineEnd: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: 'var(--ink-4)',
            }}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        inputEl
      )}
      {error && <p style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 2 }}>{error}</p>}
    </div>
  );
}
