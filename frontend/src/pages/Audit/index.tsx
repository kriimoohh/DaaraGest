import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

type Params = Record<string, string | number | boolean | null>;
interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entite: string;
  acteur: string;
  acteur_role: string | null;
  phrase: { cle: string; params: Params };
}
interface AuditResponse { total: number; page: number; limit: number; data: AuditLog[]; }
interface Acteur { id: string; nom: string; role: string | null }

// Teinte du badge selon la nature de l'action (création / suppression / sécurité).
const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'neutral'> = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'danger',
  PASSWORD_RESET: 'info', USER_REACTIVATE: 'success',
  PROGRESSION_VALIDATE: 'info', PORTAIL_GENERATE: 'success', PORTAIL_REVOKE: 'danger',
  BULLETIN_DEVERROUILLAGE: 'info',
};
// Actions proposées au filtre (miroir de AUDIT_ACTIONS côté back).
const FILTER_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'PASSWORD_RESET', 'USER_REACTIVATE',
  'PROGRESSION_VALIDATE', 'PORTAIL_GENERATE', 'PORTAIL_REVOKE', 'BULLETIN_DEVERROUILLAGE',
];

const jourIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ilYa = (jours: number) => { const d = new Date(); d.setDate(d.getDate() - jours); return jourIso(d); };

type Periode = 'tout' | 'aujourdhui' | '7j' | '30j' | 'perso';

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const locale = i18n.language === 'ar' ? 'ar-SN' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [entites, setEntites] = useState<string[]>([]);
  const [acteurs, setActeurs] = useState<Acteur[]>([]);
  const [fAction, setFAction] = useState('');
  const [fEntite, setFEntite] = useState('');
  const [fActeur, setFActeur] = useState('');
  const [fDebut, setFDebut] = useState('');
  const [fFin, setFFin] = useState('');
  const [periode, setPeriode] = useState<Periode>('tout');
  const limit = 50;

  useEffect(() => {
    api.get<string[]>('/api/v1/audit/entites').then(setEntites).catch(() => {});
    api.get<Acteur[]>('/api/v1/audit/acteurs').then(setActeurs).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const charger = () => {
    setLoading(true);
    setErreur(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (fAction) params.set('action', fAction);
    if (fEntite) params.set('entite', fEntite);
    if (fActeur) params.set('utilisateur_id', fActeur);
    if (fDebut) params.set('date_debut', fDebut);
    if (fFin) params.set('date_fin', fFin);
    api.get<AuditResponse>(`/api/v1/audit?${params}`)
      .then(r => { setLogs(r.data); setTotal(r.total); })
      // Une erreur ne doit JAMAIS s'afficher comme « aucune action trouvée » : on le dit clairement.
      .catch(err => { setLogs([]); setTotal(0); setErreur((err as Error).message || t('audit.erreur_chargement')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { charger(); }, [page, fAction, fEntite, fActeur, fDebut, fFin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [fAction, fEntite, fActeur, fDebut, fFin]);

  const choisirPeriode = (p: Exclude<Periode, 'perso'>) => {
    setPeriode(p);
    if (p === 'tout') { setFDebut(''); setFFin(''); }
    else if (p === 'aujourdhui') { setFDebut(ilYa(0)); setFFin(ilYa(0)); }
    else if (p === '7j') { setFDebut(ilYa(6)); setFFin(ilYa(0)); }
    else { setFDebut(ilYa(29)); setFFin(ilYa(0)); }
  };
  const filtresActifs = !!(fAction || fEntite || fActeur || fDebut || fFin);
  const resetFiltres = () => { setFAction(''); setFEntite(''); setFActeur(''); setFDebut(''); setFFin(''); setPeriode('tout'); };
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ── Mise en mots ─────────────────────────────────────────────────────────────
  const nombre = (v: number) => v.toLocaleString(locale);
  const dateCourte = (iso: string) => {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const libellePeriode = (n: number) => (n === 0 ? t('audit.periode_annuelle') : t('audit.periode_n', { n }));
  const libelleType = (code: string) => {
    const map: Record<string, string> = {
      mensualite: t('finance.mensualite'), inscription: t('finance.inscription_fee'),
      blouse: t('finance.blouse'), autre: t('finance.autre'),
    };
    return map[code] ?? code;
  };

  // Valeurs → texte lisible dans la langue de l'utilisateur ; `null` = donnée supprimée depuis.
  const phraseDe = (l: AuditLog): string => {
    const inconnu = t('audit.inconnu');
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(l.phrase.params)) {
      if (v === null || v === undefined) { out[k] = inconnu; continue; }
      if (typeof v === 'boolean') continue;
      if ((k === 'montant' || k === 'net') && typeof v === 'number') out[k] = nombre(v);
      else if ((k === 'date' || k === 'pour_le' || k === 'du' || k === 'au') && typeof v === 'string') out[k] = dateCourte(v);
      else if (k === 'periode' && typeof v === 'number') out[k] = libellePeriode(v);
      else if (k === 'decision' && typeof v === 'string') out[k] = t(`progression.decisions.${v}`, { defaultValue: v });
      else if (k === 'type' && typeof v === 'string') out[k] = libelleType(v);
      else out[k] = v;
    }
    if (typeof l.phrase.params.avec_matieres === 'boolean') {
      out.contenu = t(l.phrase.params.avec_matieres ? 'audit.reconduction_avec' : 'audit.reconduction_sans');
    }
    if (l.phrase.cle === 'defaut') {
      out.action = t(`audit.actions.${l.action}`, { defaultValue: l.action });
      out.entite = t(`audit.entites.${l.entite}`, { defaultValue: l.entite });
    }
    return t(`audit.phrases.${l.phrase.cle}`, out);
  };

  const quand = (iso: string) => {
    const d = new Date(iso);
    const heure = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const auj = jourIso(new Date());
    const hier = ilYa(1);
    const j = jourIso(d);
    const jour = j === auj ? t('audit.periodes.aujourdhui') : j === hier ? t('audit.hier')
      : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    return { jour, heure };
  };

  const pilules: { cle: Exclude<Periode, 'perso'>; label: string }[] = [
    { cle: 'tout', label: t('audit.periodes.tout') },
    { cle: 'aujourdhui', label: t('audit.periodes.aujourdhui') },
    { cle: '7j', label: t('audit.periodes.7j') },
    { cle: '30j', label: t('audit.periodes.30j') },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t('nav.securite', 'Sécurité')}
        title={t('nav.audit', 'Journal d\'audit')}
        subtitle={t('audit.subtitle')}
      />

      <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--paper-2)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('audit.aide_titre')}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{t('audit.aide')}</div>
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        <div className="seg seg-accent seg-sm" role="group">
          {pilules.map(p => (
            <button key={p.cle} type="button" className={`seg-pill${periode === p.cle ? ' active' : ''}`} onClick={() => choisirPeriode(p.cle)}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 190 }}>
            <Select label={t('audit.acteur')} value={fActeur} onChange={e => setFActeur(e.target.value)}
              options={[{ value: '', label: t('audit.tous_acteurs') }, ...acteurs.map(a => ({ value: a.id, label: a.role ? `${a.nom} (${a.role})` : a.nom }))]} />
          </div>
          <div style={{ minWidth: 190 }}>
            <Select label={t('audit.action')} value={fAction} onChange={e => setFAction(e.target.value)}
              options={[{ value: '', label: t('audit.toutes_actions') }, ...FILTER_ACTIONS.map(a => ({ value: a, label: t(`audit.actions.${a}`, { defaultValue: a }) }))]} />
          </div>
          <div style={{ minWidth: 190 }}>
            <Select label={t('audit.entite')} value={fEntite} onChange={e => setFEntite(e.target.value)}
              options={[{ value: '', label: t('audit.tous_types') }, ...entites.map(e => ({ value: e, label: t(`audit.entites.${e}`, { defaultValue: e }) }))]} />
          </div>
          <Input label={t('audit.date_debut')} type="date" value={fDebut} onChange={e => { setPeriode('perso'); setFDebut(e.target.value); }} />
          <Input label={t('audit.date_fin')} type="date" value={fFin} onChange={e => { setPeriode('perso'); setFFin(e.target.value); }} />
          {filtresActifs && (
            <Button variant="ghost" size="sm" onClick={resetFiltres}>{t('audit.reinitialiser')}</Button>
          )}
          <div style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--ink-3)' }}>{total} {t('audit.entrees')}</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty">{t('common.chargement', 'Chargement…')}</div>
        ) : erreur ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 12 }} role="alert">
            <p style={{ color: 'var(--danger-text)' }}>{t('audit.erreur_chargement')}</p>
            <p className="muted" style={{ fontSize: 12 }}>{erreur}</p>
            <Button variant="secondary" size="sm" onClick={charger}>{t('audit.reessayer')}</Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty">{t('audit.aucun')}</div>
        ) : (
          logs.map((l, i) => {
            const q = quand(l.created_at);
            return (
              <div key={l.id} style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '14px 18px', alignItems: 'flex-start',
                borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
              }}>
                <div style={{ width: 118, flexShrink: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{q.jour}</div>
                  <div>{q.heure}</div>
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
                    <strong>{l.acteur}</strong>
                    {l.acteur_role && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}> ({l.acteur_role.charAt(0).toUpperCase() + l.acteur_role.slice(1)})</span>}
                    {' '}{phraseDe(l)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <Badge label={t(`audit.actions.${l.action}`, { defaultValue: l.action })} variant={ACTION_VARIANT[l.action] ?? 'neutral'} />
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{t(`audit.entites.${l.entite}`, { defaultValue: l.entite })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</Button>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{page} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
        </div>
      )}
    </>
  );
}
