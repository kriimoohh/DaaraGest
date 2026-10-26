import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export interface EcoleChoisie { code: string; nom: string }
const CLE = 'daaragest_ecole';
const ANCIENNE_CLE = 'daaragest_code_ecole';
const MIN = 3;

/** École mémorisée sur cet appareil (dernière connexion réussie). */
export function ecoleMemorisee(): EcoleChoisie | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as EcoleChoisie;
    const code = localStorage.getItem(ANCIENNE_CLE);
    return code ? { code, nom: code } : null;
  } catch { return null; }
}

export function memoriserEcole(ecole: EcoleChoisie): void {
  try { localStorage.setItem(CLE, JSON.stringify(ecole)); localStorage.removeItem(ANCIENNE_CLE); } catch { /* stockage indisponible */ }
}

/**
 * Champ « Votre école » de la page de connexion : recherche par nom (ou code) à partir de 3 lettres.
 * La liste complète des écoles n'est jamais affichée. `valeur` = école choisie ; `saisie` = texte libre
 * (utilisé tel quel comme code si l'utilisateur ne choisit pas dans la liste).
 */
export function ChampEcole({ valeur, onChoix, saisie, onSaisie }: {
  valeur: EcoleChoisie | null;
  onChoix: (e: EcoleChoisie | null) => void;
  saisie: string;
  onSaisie: (s: string) => void;
}) {
  const { t } = useTranslation();
  const [resultats, setResultats] = useState<{ code: string; nom_fr: string }[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [chargement, setChargement] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = saisie.trim();
    if (valeur || q.replace(/[^\p{L}\p{N}]/gu, '').length < MIN) { setResultats([]); return; }
    let annule = false;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      try {
        const r = await api.get<{ code: string; nom_fr: string }[]>(`/api/v1/auth/ecoles?q=${encodeURIComponent(q)}`);
        if (!annule) { setResultats(r); setActif(r.length ? 0 : -1); }
      } catch { if (!annule) setResultats([]); }
      finally { if (!annule) setChargement(false); }
    }, 250);
    return () => { annule = true; clearTimeout(minuteur); };
  }, [saisie, valeur]);

  const choisir = (e: { code: string; nom_fr: string }) => {
    onChoix({ code: e.code, nom: e.nom_fr });
    onSaisie('');
    setOuvert(false);
  };

  const clavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!ouvert || resultats.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => (i + 1) % resultats.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => (i - 1 + resultats.length) % resultats.length); }
    else if (e.key === 'Enter' && actif >= 0) { e.preventDefault(); choisir(resultats[actif]); }
    else if (e.key === 'Escape') setOuvert(false);
  };

  if (valeur) {
    return (
      <div className="field">
        <span className="field-label">{t('auth.ecole')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--rule-2)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)' }}>
          <span style={{ flex: 1, fontSize: 14, lineHeight: 1.35 }}>{valeur.nom}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChoix(null); setTimeout(() => champ.current?.focus(), 0); }}>
            {t('auth.ecole_changer')}
          </button>
        </div>
      </div>
    );
  }

  const montrer = ouvert && saisie.trim().length >= MIN;
  return (
    <div className="field">
      <label className="field-label" htmlFor="ecole">{t('auth.ecole')}</label>
      <div style={{ position: 'relative' }}>
      <input
        ref={champ}
        id="ecole"
        type="text"
        className="input"
        role="combobox"
        aria-expanded={montrer && resultats.length > 0}
        aria-controls="ecole-liste"
        aria-autocomplete="list"
        aria-activedescendant={actif >= 0 ? `ecole-${actif}` : undefined}
        value={saisie}
        onChange={e => { onSaisie(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onKeyDown={clavier}
        autoComplete="organization"
        maxLength={60}
        placeholder={t('auth.ecole_placeholder')}
        style={{ width: '100%' }}
      />
      {montrer && (
        <ul id="ecole-liste" role="listbox" style={{
          position: 'absolute', insetInline: 0, top: '100%', zIndex: 20, margin: '4px 0 0', padding: 4, listStyle: 'none',
          background: 'var(--card)', border: '1px solid var(--rule-2)', borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {chargement && resultats.length === 0 && <li style={{ padding: '8px 10px', fontSize: 13, color: 'var(--ink-3)' }}>{t('auth.ecole_recherche')}</li>}
          {!chargement && resultats.length === 0 && <li style={{ padding: '8px 10px', fontSize: 13, color: 'var(--ink-3)' }}>{t('auth.ecole_aucune')}</li>}
          {resultats.map((r, i) => (
            <li
              key={r.code}
              id={`ecole-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseDown={e => { e.preventDefault(); choisir(r); }}
              onMouseEnter={() => setActif(i)}
              style={{ padding: '8px 10px', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer', fontSize: 14, background: i === actif ? 'var(--terra-soft)' : 'transparent' }}
            >
              {r.nom_fr}
            </li>
          ))}
        </ul>
      )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{t('auth.ecole_aide')}</div>
    </div>
  );
}
