import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
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
}

const EMPTY = { libelle: '', date_debut: '', date_fin: '' };

export function AnneeScolairesPage() {
  const api = useApi();
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
    <div className="space-y-6">
      <PageHeader
        title="Années scolaires"
        subtitle="Gérer les années scolaires de l'établissement"
        action={<Button onClick={openAdd}>+ Ajouter une année</Button>}
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : annees.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-slate-500">Aucune année scolaire. Commencez par en créer une.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Libellé', 'Début', 'Fin', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {annees.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{a.libelle}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{fmt(a.date_debut)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{fmt(a.date_fin)}</td>
                  <td className="px-4 py-3">
                    <Badge label={a.active ? 'Active' : 'Inactive'} variant={a.active ? 'success' : 'neutral'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
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
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm(a)}>Supprimer</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier l\'année' : 'Nouvelle année scolaire'} size="md">
        <div className="space-y-4">
          <Input
            label="Libellé (ex: 2025-2026)"
            value={form.libelle}
            onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
            placeholder="2025-2026"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date de début"
              type="date"
              value={form.date_debut}
              onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
            />
            <Input
              label="Date de fin"
              type="date"
              value={form.date_fin}
              onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={handleSave} loading={saving}>Enregistrer</Button>
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
    </div>
  );
}
