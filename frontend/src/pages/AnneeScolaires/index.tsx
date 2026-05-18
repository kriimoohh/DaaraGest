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
  const { t } = useTranslation();
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
      toast.error('Erreur lors du chargement des années scolaires');
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
      toast.error('Tous les champs sont requis');
      return;
    }
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/api/v1/annees-scolaires/${edit.id}`, form);
        toast.success('Année scolaire modifiée');
      } else {
        await api.post('/api/v1/annees-scolaires', form);
        toast.success('Année scolaire créée');
      }
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleActiver = async (a: AnneeScolaire) => {
    setActivating(a.id);
    try {
      await api.put(`/api/v1/annees-scolaires/${a.id}/activer`, {});
      toast.success(`"${a.libelle}" est maintenant l'année active`);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/annees-scolaires/${confirm.id}`);
      toast.success('Année scolaire supprimée');
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Années scolaires"
        subtitle="Gérer les années scolaires de l'établissement"
        action={<Button onClick={openAdd}>+ Ajouter une année</Button>}
      />

      <div className="card">
        {loading ? (
          <div className="empty">Chargement...</div>
        ) : annees.length === 0 ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 36 }}>📅</span>
            <p>Aucune année scolaire. Commencez par en créer une.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {['Libellé', 'Début', 'Fin', 'Élèves', 'Statut', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
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
                      <Badge label={a.active ? 'Active' : 'Archivée'} variant={a.active ? 'success' : 'neutral'} />
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
                            Activer
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier l\'année' : 'Nouvelle année scolaire'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('annee_scolaire.libelle')}
            value={form.libelle}
            onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
            placeholder="2025-2026"
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
        message={`Supprimer l'année "${confirm?.libelle}" ?`}
      />
    </>
  );
}
