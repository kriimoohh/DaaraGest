import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

interface EleveResult {
  id: string;
  nom_fr: string;
  prenom_fr: string;
  matricule: string;
  classe?: { nom_fr: string };
}

interface PageItem {
  label: string;
  path: string;
  roles: string[];
  icon?: string;
}

interface ActionItem {
  label: string;
  path: string;
  icon?: string;
}

const PAGES: PageItem[] = [
  { label: 'Tableau de bord', path: '/dashboard', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
  { label: 'Élèves', path: '/eleves', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'] },
  { label: 'Professeurs', path: '/professeurs', roles: ['admin', 'directeur', 'gestionnaire'] },
  { label: 'Classes', path: '/classes', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
  { label: 'Années scolaires', path: '/annees-scolaires', roles: ['admin', 'directeur', 'gestionnaire'] },
  { label: 'Matières', path: '/matieres', roles: ['admin', 'directeur', 'gestionnaire'] },
  { label: 'Notes', path: '/notes', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
  { label: 'Évaluations', path: '/evaluations', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
  { label: 'Bulletins', path: '/bulletins', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
  { label: 'Progression', path: '/progression', roles: ['admin', 'directeur', 'gestionnaire'] },
  { label: 'Activités', path: '/activites', roles: ['admin', 'directeur', 'gestionnaire', 'professeur'] },
  { label: 'Absences', path: '/absences', roles: ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'] },
  { label: 'Pointage', path: '/pointage', roles: ['admin', 'directeur', 'gestionnaire', 'pointeur'] },
  { label: 'Finances', path: '/finances', roles: ['admin', 'gestionnaire', 'agent de scolarité'] },
  { label: 'Documents', path: '/documents', roles: ['admin', 'directeur', 'gestionnaire'] },
  { label: 'Emploi du temps', path: '/emploi-du-temps', roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
  { label: 'Calendrier', path: '/calendrier', roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
  { label: 'Messagerie', path: '/messagerie', roles: ['admin', 'directeur', 'gestionnaire', 'professeur', 'agent de scolarité', 'pointeur'] },
  { label: 'Utilisateurs', path: '/utilisateurs', roles: ['admin'] },
  { label: 'Paramètres', path: '/parametres', roles: ['admin'] },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const [query, setQuery] = useState('');
  const [eleves, setEleves] = useState<EleveResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const actions: ActionItem[] = [
    { label: t('cmd.new_eleve'), path: '/eleves?new=1' },
    { label: t('cmd.new_paiement'), path: '/finances?new=1' },
    { label: t('cmd.generer_bulletins'), path: '/bulletins?generer=1' },
  ];

  const filteredPages = PAGES.filter(p =>
    p.roles.includes(role) &&
    (!query || p.label.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredActions = actions.filter(a =>
    !query || a.label.toLowerCase().includes(query.toLowerCase())
  );

  const searchEleves = useCallback(async (q: string) => {
    if (q.length < 2) { setEleves([]); return; }
    try {
      const res = await api.get<{ data: EleveResult[] }>(`/api/v1/eleves?search=${encodeURIComponent(q)}&limit=6`);
      setEleves(res.data ?? []);
    } catch {
      setEleves([]);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchEleves(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchEleves]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setEleves([]);
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allItems = [
    ...eleves.map(e => ({ label: `${e.prenom_fr} ${e.nom_fr}`, sub: e.matricule, path: `/eleves`, type: 'eleve' as const })),
    ...filteredPages.map(p => ({ label: p.label, sub: p.path, path: p.path, type: 'page' as const })),
    ...filteredActions.map(a => ({ label: a.label, sub: t('cmd.action_label'), path: a.path, type: 'action' as const })),
  ];

  function go(path: string) {
    const [pathname, search] = path.split('?');
    navigate(pathname + (search ? `?${search}` : ''));
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && allItems[highlighted]) {
      go(allItems[highlighted].path);
    }
  }

  if (!open) return null;

  const hasEleves = eleves.length > 0;
  const hasPages = filteredPages.length > 0;
  const hasActions = filteredActions.length > 0;
  const noResults = allItems.length === 0;

  let itemIdx = 0;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
    >
      <div
        className="modal"
        style={{ maxWidth: 560, maxHeight: 480, borderRadius: 'var(--r-xl)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
            placeholder={t('tb.search')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: 'var(--ink)' }}
          />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 6px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 4, color: 'var(--ink-3)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {noResults ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              {t('cmd.no_results')}
            </div>
          ) : (
            <>
              {hasEleves && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {t('cmd.eleves_section')}
                  </div>
                  {eleves.map(e => {
                    const idx = itemIdx++;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => go('/eleves')}
                        className="sb-item"
                        style={{
                          borderRadius: 0,
                          background: highlighted === idx ? 'var(--terra-soft)' : 'transparent',
                          color: highlighted === idx ? 'var(--terra-ink)' : 'var(--ink)',
                          width: '100%',
                        }}
                        onMouseEnter={() => setHighlighted(idx)}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--indigo-soft)', color: 'var(--indigo-ink)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                          {e.prenom_fr?.[0]}{e.nom_fr?.[0]}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.prenom_fr} {e.nom_fr}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{e.matricule}{e.classe ? ` · ${e.classe.nom_fr}` : ''}</div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {(hasPages || hasActions) && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 600, borderTop: hasEleves ? '1px solid var(--rule)' : undefined, marginTop: hasEleves ? 4 : 0 }}>
                    {t('cmd.pages_section')}
                  </div>
                  {filteredPages.map(p => {
                    const idx = itemIdx++;
                    return (
                      <button
                        key={p.path}
                        type="button"
                        onClick={() => go(p.path)}
                        className="sb-item"
                        style={{
                          borderRadius: 0,
                          background: highlighted === idx ? 'var(--terra-soft)' : 'transparent',
                          color: highlighted === idx ? 'var(--terra-ink)' : 'var(--ink)',
                          width: '100%',
                        }}
                        onMouseEnter={() => setHighlighted(idx)}
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        <span style={{ fontSize: 13 }}>{p.label}</span>
                        <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{p.path}</span>
                      </button>
                    );
                  })}
                  {filteredActions.map(a => {
                    const idx = itemIdx++;
                    return (
                      <button
                        key={a.path}
                        type="button"
                        onClick={() => go(a.path)}
                        className="sb-item"
                        style={{
                          borderRadius: 0,
                          background: highlighted === idx ? 'var(--terra-soft)' : 'transparent',
                          color: highlighted === idx ? 'var(--terra-ink)' : 'var(--ink)',
                          width: '100%',
                        }}
                        onMouseEnter={() => setHighlighted(idx)}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                        <span style={{ fontSize: 13 }}>{a.label}</span>
                        <span style={{ marginInlineStart: 'auto' }}>
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>{t('cmd.action_label')}</span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
