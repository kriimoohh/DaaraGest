import React from 'react';

// Encre constante : la couleur de fond vient de la config filière (pastel clair
// stocké en DB), elle ne suit pas le thème — le texte doit donc rester sombre.
const FILIERE_INK = '#1B254A';

interface FiliereBadgeProps {
  couleur?: string | null;
  dot?: boolean;
  children: React.ReactNode;
}

export function FiliereBadge({ couleur, dot, children }: FiliereBadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: couleur ?? 'var(--paper-3)',
      color: couleur ? FILIERE_INK : 'var(--ink-2)',
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', opacity: 0.55 }} />}
      {children}
    </span>
  );
}
