type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusOption {
  value: string;
  label: string;
  tone: Tone;
}

interface StatusPickerProps {
  options: StatusOption[];
  value: string;
  /** Reçoit la nouvelle valeur ('' quand on déselectionne, si `toggle`). */
  onChange: (value: string) => void;
  /** Recliquer l'option active la déselectionne (saisie de pointage). */
  toggle?: boolean;
}

// « error » (variante Badge) → « danger » (token sémantique).
const TONE_CLASS: Record<Tone, string> = {
  success: 'tone-success',
  warning: 'tone-warning',
  danger: 'tone-danger',
  info: 'tone-info',
  neutral: '',
};

// Sélecteur de statut en cellule de tableau : couleur sémantique par option,
// utilisé pour la saisie du pointage personnel et des absences élèves.
export function StatusPicker({ options, value, onChange, toggle = false }: StatusPickerProps) {
  return (
    <div className="status-pick">
      {options.map(opt => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`${on ? `on ${TONE_CLASS[opt.tone]}` : ''}`}
            aria-pressed={on}
            onClick={() => onChange(toggle && on ? '' : opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
