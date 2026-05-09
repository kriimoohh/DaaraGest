import React, { useState, useEffect, useRef } from 'react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right });
    }
    setOpen(v => !v);
  }

  return (
    <>
      <button ref={btnRef} className="action-menu-btn" onClick={toggle} aria-label="Actions">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
          <circle cx={12} cy={5} r={2} />
          <circle cx={12} cy={12} r={2} />
          <circle cx={12} cy={19} r={2} />
        </svg>
      </button>
      {open && (
        <div
          className="action-menu-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              className={`action-menu-item${item.variant === 'danger' ? ' danger' : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              {item.icon && <span className="action-menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
