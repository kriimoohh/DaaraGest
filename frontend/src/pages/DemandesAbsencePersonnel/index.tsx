import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { Segmented } from '../../components/ui/Segmented';
import { useApi } from '../../hooks/useApi';
import { fmtDate } from '../../lib/dates';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type TypeAbsence = 'CONGE_ANNUEL' | 'MALADIE' | 'PERMISSION' | 'AUTRE';
type StatutDemande = 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE';

interface Demande {
  id: string;
  personnel_id: string;
  date_debut: string;
  date_fin: string;
  motif: string;
  type_absence: TypeAbsence;
  statut: StatutDemande;
  commentaire: string | null;
  traite_le: string | null;
  created_at: string;
  personnel: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
  traiteur: { nom_fr: string; prenom_fr: string | null } | null;
}

// GET /api/v1/personnel renvoie des Utilisateur avec leur fiche Personnel imbriquée.
interface PersonnelRow {
  id: string;
  nom_fr: string;
  prenom_fr: string | null;
  personnel: { id: string } | null;
}

const TYPE_KEYS: Record<TypeAbsence, string> = {
  CONGE_ANNUEL: 'demande_absence.type_conge',
  MALADIE:      'demande_absence.type_maladie',
  PERMISSION:   'demande_absence.type_permission',
  AUTRE:        'demande_absence.type_autre',
};

const STATUT_KEYS: Record<StatutDemande, string> = {
  EN_ATTENTE: 'demande_absence.statut_attente',
  APPROUVE:   'demande_absence.statut_approuve',
  REFUSE:     'demande_absence.statut_refuse',
};

const STATUT_VARIANTS: Record<StatutDemande, 'warning' | 'success' | 'danger'> = {
  EN_ATTENTE: 'warning',
  APPROUVE:   'success',
  REFUSE:     'danger',
};

export function DemandesAbsencePersonnelPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const isDirection = ['admin', 'directeur', 'gestionnaire'].includes(role);

  const api = useApi();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);

  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showTraiterModal, setShowTraiterModal] = useState<{ id: string; action: 'APPROUVE' | 'REFUSE' } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    personnel_id: '',
    date_debut: '',
    date_fin: '',
    type_absence: 'CONGE_ANNUEL' as TypeAbsence,
    motif: '',
  });

  const refresh = () => {
    setLoading(true);
    api.get<Demande[]>('/api/v1/demandes-absence-personnel')
      .then(d => { setDemandes(d); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    api.get<{ data: PersonnelRow[] }>('/api/v1/personnel?limit=200')
      .then(d => setPersonnel(d.data ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = demandes.filter(d => !filtreStatut || d.statut === filtreStatut);

  async function handleSubmit() {
    if (!form.personnel_id || !form.date_debut || !form.date_fin || !form.motif) {
      toast.error(t('demande_absence.champs_obligatoires')); return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/demandes-absence-personnel', form);
      toast.success(t('demande_absence.ok_enregistree'));
      setShowModal(false);
      setForm({ personnel_id: '', date_debut: '', date_fin: '', type_absence: 'CONGE_ANNUEL', motif: '' });
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.erreur', 'Erreur'));
    } finally { setSaving(false); }
  }

  async function handleTraiter() {
    if (!showTraiterModal) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/demandes-absence-personnel/${showTraiterModal.id}/traiter`, {
        statut: showTraiterModal.action,
        commentaire,
      });
      toast.success(t(showTraiterModal.action === 'APPROUVE' ? 'demande_absence.ok_approuvee' : 'demande_absence.ok_refusee'));
      setShowTraiterModal(null);
      setCommentaire('');
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.erreur', 'Erreur'));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.delete(`/api/v1/demandes-absence-personnel/${deleteId}`);
      setDeleteId(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.erreur', 'Erreur'));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title={t('demande_absence.titre')}
        subtitle={t('demande_absence.subtitle')}
        action={
          <Button onClick={() => setShowModal(true)}>{t('demande_absence.nouvelle')}</Button>
        }
      />

      {/* Filtres */}
      <div style={{ margin: '16px 0' }}>
        <Segmented
          variant="outline"
          ariaLabel={t('demande_absence.col_statut')}
          value={filtreStatut}
          onChange={setFiltreStatut}
          options={[
            { value: '', label: t('demande_absence.filtre_toutes') },
            ...(['EN_ATTENTE', 'APPROUVE', 'REFUSE'] as const).map(s => ({ value: s, label: t(STATUT_KEYS[s]) })),
          ]}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="empty">{t('demande_absence.chargement')}</div>
      ) : error ? (
        <div style={{ padding: '10px 14px', background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)' }}>
          {t('demande_absence.err_chargement')}
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('demande_absence.col_professeur')}</th>
                  <th>{t('demande_absence.col_type')}</th>
                  <th>{t('demande_absence.col_periode')}</th>
                  <th>{t('demande_absence.col_motif')}</th>
                  <th>{t('demande_absence.col_statut')}</th>
                  <th>{t('demande_absence.col_traite_par')}</th>
                  <th>{t('demande_absence.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">{t('demande_absence.aucune')}</div>
                    </td>
                  </tr>
                ) : filtered.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>
                      {d.personnel.utilisateur.nom_fr} {d.personnel.utilisateur.prenom_fr ?? ''}
                    </td>
                    <td>{t(TYPE_KEYS[d.type_absence])}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {fmtDate(d.date_debut)} → {fmtDate(d.date_fin)}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.motif}
                    </td>
                    <td>
                      <Badge label={t(STATUT_KEYS[d.statut])} variant={STATUT_VARIANTS[d.statut]} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {d.traiteur ? `${d.traiteur.nom_fr} ${d.traiteur.prenom_fr ?? ''}` : '—'}
                      {d.traite_le ? <><br /><span style={{ color: 'var(--ink-4)' }}>{fmtDate(d.traite_le)}</span></> : ''}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isDirection && d.statut === 'EN_ATTENTE' && (
                          <>
                            <Button size="sm" onClick={() => setShowTraiterModal({ id: d.id, action: 'APPROUVE' })}>
                              {t('demande_absence.approuver_btn')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setShowTraiterModal({ id: d.id, action: 'REFUSE' })}>
                              {t('demande_absence.refuser_btn')}
                            </Button>
                          </>
                        )}
                        {d.statut === 'EN_ATTENTE' && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteId(d.id)}>
                            {t('demande_absence.supprimer_btn')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal : nouvelle demande */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t('demande_absence.nouvelle_titre')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSubmit} loading={saving}>{t('actions.enregistrer')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select
            label={t('demande_absence.professeur_label')}
            value={form.personnel_id}
            onChange={e => setForm(f => ({ ...f, personnel_id: e.target.value }))}
            placeholder={t('demande_absence.professeur_placeholder')}
            options={personnel.filter(p => p.personnel).map(p => ({
              value: p.personnel!.id,
              label: `${p.nom_fr} ${p.prenom_fr ?? ''}`.trim(),
            }))}
          />

          <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('demande_absence.date_debut')} type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            <Input label={t('demande_absence.date_fin')} type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
          </div>

          <Select
            label={t('demande_absence.type_label')}
            value={form.type_absence}
            onChange={e => setForm(f => ({ ...f, type_absence: e.target.value as TypeAbsence }))}
            options={(Object.keys(TYPE_KEYS) as TypeAbsence[]).map(k => ({ value: k, label: t(TYPE_KEYS[k]) }))}
          />

          <div className="field">
            <label className="field-label" htmlFor="demande-motif">{t('demande_absence.motif_label')}</label>
            <textarea
              id="demande-motif"
              className="input"
              value={form.motif}
              onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
              rows={3}
              placeholder={t('demande_absence.motif_placeholder')}
            />
          </div>
        </div>
      </Modal>

      {/* Modal : traiter (approuver / refuser) */}
      <Modal
        isOpen={showTraiterModal !== null}
        onClose={() => { setShowTraiterModal(null); setCommentaire(''); }}
        title={showTraiterModal?.action === 'APPROUVE' ? t('demande_absence.approuver_titre') : t('demande_absence.refuser_titre')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowTraiterModal(null); setCommentaire(''); }}>{t('actions.annuler')}</Button>
            <Button
              variant={showTraiterModal?.action === 'APPROUVE' ? 'primary' : 'danger'}
              onClick={handleTraiter}
              loading={saving}
            >
              {showTraiterModal?.action === 'APPROUVE' ? t('demande_absence.approuver_confirm') : t('demande_absence.refuser_confirm')}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="demande-commentaire">{t('demande_absence.commentaire_label')}</label>
          <textarea
            id="demande-commentaire"
            className="input"
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>

      {/* Confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('demande_absence.confirm_suppression')}
        loading={saving}
      />
    </div>
  );
}
