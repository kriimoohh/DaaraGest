import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface AnneeScolaire {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  active: boolean;
  nb_eleves?: number;
}

const EMPTY = { libelle: '', date_debut: '', date_fin: '' };

export function AnneeScolairesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<AnneeScolaire | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<AnneeScolaire | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await api.get<AnneeScolaire[]>('/api/v1/annees-scolaires');
      setAnnees(data);
    } catch {
      toast.error(t('annee_scolaire.err_chargement'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const openAdd = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (a: AnneeScolaire) => {
    setEdit(a);
    setForm({
      libelle: a.libelle,
      date_debut: a.date_debut.slice(0, 10),
      date_fin: a.date_fin.slice(0, 10),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.libelle || !form.date_debut || !form.date_fin) {
      toast.error(t('annee_scolaire.err_champs_requis'));
      return;
    }
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/api/v1/annees-scolaires/${edit.id}`, form);
        toast.success(t('annee_scolaire.ok_modifiee'));
      } else {
        await api.post('/api/v1/annees-scolaires', form);
        toast.success(t('annee_scolaire.ok_creee'));
      }
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || t('annee_scolaire.err_enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const handleActiver = async (a: AnneeScolaire) => {
    setActivating(a.id);
    try {
      await api.put(`/api/v1/annees-scolaires/${a.id}/activer`, {});
      toast.success(t('annee_scolaire.ok_activee', { libelle: a.libelle }));
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/annees-scolaires/${confirm.id}`);
      toast.success(t('annee_scolaire.ok_supprimee'));
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message || t('annee_scolaire.err_suppression'));
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString(locale);

  return (
    <>
      <PageHeader
        eyebrow={t('annee_scolaire.administration')}
        title={t('annee_scolaire.titre')}
        subtitle={t('annee_scolaire.subtitle')}
        action={<Button onClick={openAdd}>{t('annee_scolaire.ajouter_btn')}</Button>}
      />

      <div className="card">
        {loading ? (
          <div className="empty">{t('common.chargement')}</div>
        ) : annees.length === 0 ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 36 }}>📅</span>
            <p>{t('annee_scolaire.aucune')}</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('annee_scolaire.col_libelle')}</th>
                  <th>{t('annee_scolaire.col_debut')}</th>
                  <th>{t('annee_scolaire.col_fin')}</th>
                  <th>{t('annee_scolaire.col_eleves')}</th>
                  <th>{t('annee_scolaire.col_statut')}</th>
                  <th>{t('annee_scolaire.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {annees.map((a) => (
                  <tr key={a.id}>
                    <td>{a.libelle}</td>
                    <td>{fmt(a.date_debut)}</td>
                    <td>{fmt(a.date_fin)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {a.nb_eleves != null ? a.nb_eleves : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td>
                      <Badge label={a.active ? t('annee_scolaire.active') : t('annee_scolaire.archivee')} variant={a.active ? 'success' : 'neutral'} />
                    </td>
                    <td>
                      <div className="row">
                        {!a.active && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleActiver(a)}
                            loading={activating === a.id}
                          >
                            {t('actions.activer')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>{t('actions.modifier')}</Button>
                        {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirm(a)}>{t('actions.supprimer')}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? t('annee_scolaire.modifier_titre') : t('annee_scolaire.nouvelle_titre')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('annee_scolaire.libelle')}
            value={form.libelle}
            onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
            placeholder={t('annee_scolaire.libelle_placeholder')}
          />
          <div className="grid-2">
            <Input
              label={t('annee_scolaire.date_debut')}
              type="date"
              value={form.date_debut}
              onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
            />
            <Input
              label={t('annee_scolaire.date_fin')}
              type="date"
              value={form.date_fin}
              onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.enregistrer')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={t('annee_scolaire.confirm_supprimer', { libelle: confirm?.libelle ?? '' })}
      />
    </>
  );
}
