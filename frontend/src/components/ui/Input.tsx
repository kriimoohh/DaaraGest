import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className="field-label">{label}</label>
      )}
      <input
        id={inputId}
        {...rest}
        className={['input', error ? 'input-error' : '', className].filter(Boolean).join(' ')}
        style={error ? { borderColor: 'var(--danger)' } : undefined}
      />
      {error && <p style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 2 }}>{error}</p>}
    </div>
  );
}
