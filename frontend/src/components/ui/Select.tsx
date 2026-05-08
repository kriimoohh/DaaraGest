import React from 'react';

interface SelectOption { value: string; label: string; }
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, id, className = '', ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return (
    <div className="field">
      {label && <label htmlFor={selectId} className="field-label">{label}</label>}
      <select
        id={selectId}
        {...rest}
        className={['select', className].filter(Boolean).join(' ')}
        style={error ? { borderColor: 'var(--danger)' } : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p style={{ fontSize: 12, color: 'var(--danger-text)', marginTop: 2 }}>{error}</p>}
    </div>
  );
}
