import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

// Langues d'INTERFACE de l'application (≠ filière EN). Ordre affiché dans le sélecteur.
export const APP_LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
] as const;

export type AppLang = (typeof APP_LANGS)[number]['code'];

// Langue courante normalisée à partir du code i18next (repli 'fr').
export function currentLang(lng: string): AppLang {
  return lng.startsWith('ar') ? 'ar' : lng.startsWith('en') ? 'en' : 'fr';
}

// Direction (RTL pour l'arabe) + attribut lang du document.
export function applyDocumentLang(code: AppLang) {
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = code;
}

// Sélecteur de langue (fr / ar / en) — remplace l'ancien bouton à défilement.
// Change i18next + la direction, puis appelle `onChange` (ex. persistance de la
// préférence utilisateur). Style aligné sur le sélecteur d'année de la barre.
export function LanguageSelect({ onChange, style }: { onChange?: (code: AppLang) => void; style?: CSSProperties }) {
  const { i18n } = useTranslation();
  const current = currentLang(i18n.language);
  return (
    <select
      className="input"
      value={current}
      onChange={e => {
        const code = e.target.value as AppLang;
        i18n.changeLanguage(code);
        applyDocumentLang(code);
        onChange?.(code);
      }}
      aria-label="Langue"
      title="Langue"
      style={{ width: 'auto', height: 32, padding: '0 26px 0 10px', fontSize: 13, ...style }}
    >
      {APP_LANGS.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
