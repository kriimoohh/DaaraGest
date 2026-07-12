import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entite: string;
  entite_id: string;
  details: unknown;
  acteur: string;
  acteur_role: string | null;
}
interface AuditResponse { total: number; page: number; limit: number; data: AuditLog[]; }

const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'neutral'> = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'danger',
};
const ACTION_LABEL: Record<string, string> = { CREATE: 'Création', UPDATE: 'Modification', DELETE: 'Suppression' };

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [entites, setEntites] = useState<string[]>([]);
  const [fAction, setFAction] = useState('');
  const [fEntite, setFEntite] = useState('');
  const [fDebut, setFDebut] = useState('');
  const [fFin, setFFin] = useState('');
  const limit = 50;

  useEffect(() => {
    api.get<string[]>('/api/v1/audit/entites').then(setEntites).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const charger = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (fAction) params.set('action', fAction);
    if (fEntite) params.set('entite', fEntite);
    if (fDebut) params.set('date_debut', fDebut);
    if (fFin) params.set('date_fin', fFin);
    api.get<AuditResponse>(`/api/v1/audit?${params}`)
      .then(r => { setLogs(r.data); setTotal(r.total); })
      .catch(() => toast.error(t('common.erreur', 'Erreur de chargement')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { charger(); }, [page, fAction, fEntite, fDebut, fFin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [fAction, fEntite, fDebut, fFin]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const resetFiltres = () => { setFAction(''); setFEntite(''); setFDebut(''); setFFin(''); };

  return (
    <>
      <PageHeader
        eyebrow={t('nav.securite', 'Sécurité')}
        title={t('nav.audit', 'Journal d\'audit')}
        subtitle={t('audit.subtitle', 'Qui a fait quoi — création, modification et suppression sur les données.')}
      />

      <div className="card card-pad" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ minWidth: 160 }}>
          <Select label={t('audit.action', 'Action')} value={fAction} onChange={e => setFAction(e.target.value)}
            options={[{ value: '', label: t('common.tous', 'Toutes') }, ...Object.keys(ACTION_LABEL).map(a => ({ value: a, label: ACTION_LABEL[a] }))]} />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select label={t('audit.entite', 'Type de donnée')} value={fEntite} onChange={e => setFEntite(e.target.value)}
            options={[{ value: '', label: t('common.tous', 'Tous') }, ...entites.map(e => ({ value: e, label: e }))]} />
        </div>
        <Input label={t('audit.date_debut', 'Du')} type="date" value={fDebut} onChange={e => setFDebut(e.target.value)} />
        <Input label={t('audit.date_fin', 'Au')} type="date" value={fFin} onChange={e => setFFin(e.target.value)} />
        {(fAction || fEntite || fDebut || fFin) && (
          <Button variant="ghost" size="sm" onClick={resetFiltres}>{t('common.reinitialiser', 'Réinitialiser')}</Button>
        )}
        <div style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--ink-3)' }}>{total} {t('audit.entrees', 'entrée(s)')}</div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('audit.date', 'Date')}</th>
                <th>{t('audit.acteur', 'Acteur')}</th>
                <th>{t('audit.action', 'Action')}</th>
                <th>{t('audit.entite', 'Type')}</th>
                <th>{t('audit.details', 'Détails')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="empty">{t('common.chargement', 'Chargement…')}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="empty">{t('audit.aucun', 'Aucune entrée')}</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-3)' }}>
                    {new Date(l.created_at).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.acteur}</div>
                    {l.acteur_role && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{l.acteur_role}</div>}
                  </td>
                  <td><Badge label={ACTION_LABEL[l.action] ?? l.action} variant={ACTION_VARIANT[l.action] ?? 'neutral'} /></td>
                  <td style={{ fontSize: 13 }}>{l.entite}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={l.details ? JSON.stringify(l.details) : ''}>
                    {l.details && Object.keys(l.details as object).length > 0 ? JSON.stringify(l.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
