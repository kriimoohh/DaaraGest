import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface Matiere {
  id: string;
  nom_fr: string;
  nom_ar: string;
  filiere: 'FR' | 'AR';
  coeff_defaut: number;
  ordre_bulletin: number;
  active: boolean;
}

const EMPTY = { nom_fr: '', nom_ar: '', filiere: 'FR', coeff_defaut: '1', ordre_bulletin: '0' };

export function MatieresPage() {
  const api = useApi();
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [filiere, setFiliere] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Matiere | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Matiere | null>(null);
  const [deleting, setDeleting] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const url = filiere ? `/api/v1/matieres?filiere=${filiere}` : '/api/v1/matieres';
      const data = await api.get<Matiere[]>(url);
      setMatieres(data);
    } catch {
      toast.error('Erreur lors du chargement des matières');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, [filiere]);

  const openAdd = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (m: Matiere) => {
    setEdit(m);
    setForm({
      nom_fr: m.nom_fr,
      nom_ar: m.nom_ar,
      filiere: m.filiere,
      coeff_defaut: String(m.coeff_defaut),
      ordre_bulletin: String(m.ordre_bulletin),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.nom_fr || !form.nom_ar || !form.filiere) {
      toast.error('Nom FR, nom AR et filière sont requis');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom_fr: form.nom_fr,
        nom_ar: form.nom_ar,
        filiere: form.filiere,
        coeff_defaut: parseFloat(form.coeff_defaut) || 1,
        ordre_bulletin: parseInt(form.ordre_bulletin) || 0,
      };
      if (edit) {
        await api.put(`/api/v1/matieres/${edit.id}`, payload);
        toast.success('Matière modifiée');
      } else {
        await api.post('/api/v1/matieres', payload);
        toast.success('Matière créée');
      }
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/matieres/${confirm.id}`);
      toast.success('Matière désactivée');
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matières"
        subtitle="Gérer les matières FR et AR"
        action={<Button onClick={openAdd}>+ Ajouter une matière</Button>}
      />

      <div className="flex gap-3">
        <Select
          value={filiere}
          onChange={(e) => setFiliere(e.target.value)}
          options={[
            { value: '', label: 'Toutes les filières' },
            { value: 'FR', label: 'Filière Française' },
            { value: 'AR', label: 'Filière Arabe' },
          ]}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : matieres.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-gray-500">Aucune matière trouvée.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Nom FR', 'Nom AR', 'Filière', 'Coefficient', 'Ordre', 'Actions'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {matieres.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.nom_fr}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300" dir="rtl">{m.nom_ar}</td>
                  <td className="px-4 py-3">
                    <Badge label={m.filiere} variant={m.filiere === 'FR' ? 'info' : 'warning'} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{m.coeff_defaut}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{m.ordre_bulletin}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm(m)}>Supprimer</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier la matière' : 'Nouvelle matière'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom (Français)"
              value={form.nom_fr}
              onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))}
              placeholder="Mathématiques"
            />
            <Input
              label="Nom (Arabe)"
              value={form.nom_ar}
              onChange={(e) => setForm((f) => ({ ...f, nom_ar: e.target.value }))}
              placeholder="الرياضيات"
              dir="rtl"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Filière"
              value={form.filiere}
              onChange={(e) => setForm((f) => ({ ...f, filiere: e.target.value }))}
              options={[{ value: 'FR', label: 'Française' }, { value: 'AR', label: 'Arabe' }]}
            />
            <Input
              label="Coefficient"
              type="number"
              step="0.25"
              min="0.25"
              value={form.coeff_defaut}
              onChange={(e) => setForm((f) => ({ ...f, coeff_defaut: e.target.value }))}
            />
            <Input
              label="Ordre bulletin"
              type="number"
              min="0"
              value={form.ordre_bulletin}
              onChange={(e) => setForm((f) => ({ ...f, ordre_bulletin: e.target.value }))}
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
        message={`Désactiver la matière "${confirm?.nom_fr}" ?`}
      />
    </div>
  );
}
