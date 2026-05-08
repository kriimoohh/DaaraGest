import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
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
  note_max: number;
  note_min: number;
  ordre_bulletin: number;
  active: boolean;
}

const EMPTY = { nom_fr: '', nom_ar: '', filiere: 'FR', coeff_defaut: '1', note_max: '20', note_min: '0', ordre_bulletin: '0' };

export function MatieresPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
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
      note_max: String(m.note_max),
      note_min: String(m.note_min),
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
        note_max: parseFloat(form.note_max) || 20,
        note_min: parseFloat(form.note_min) || 0,
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
    <>
      <PageHeader
        title="Matières"
        subtitle="Gérer les matières FR et AR"
        action={<Button onClick={openAdd}>+ Ajouter une matière</Button>}
      />

      {/* Bandeau guide filière */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <span className="text-lg shrink-0">ℹ️</span>
        <div>
          <strong>Configuration des notes par filière :</strong> chaque matière possède sa propre plage de notation (Note Max / Note Min).
          Les matières arabes peuvent avoir une notation différente des matières françaises (ex. sur 10 au lieu de 20).
          Pour modifier la plage d'une matière, cliquez sur <em>Modifier</em>.
        </div>
      </div>

      <div className="filter-row">
        <Select
          value={filiere}
          onChange={(e) => setFiliere(e.target.value)}
          options={[
            { value: '', label: t('classe.toutes_filieres') },
            { value: 'FR', label: t('classe.filiere_fr') },
            { value: 'AR', label: t('classe.filiere_ar') },
          ]}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : matieres.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-slate-500">Aucune matière trouvée.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Nom FR', 'Nom AR', 'Filière', 'Coefficient', 'Note Max', 'Note Min', 'Actions'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {matieres.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{m.nom_fr}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300" dir="rtl">{m.nom_ar}</td>
                  <td className="px-4 py-3">
                    <Badge label={m.filiere} variant={m.filiere === 'FR' ? 'info' : 'warning'} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{m.coeff_defaut}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{m.note_max}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{m.note_min}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>{t('actions.modifier')}</Button>
                      {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirm(m)}>{t('actions.supprimer')}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Modifier la matière' : 'Nouvelle matière'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <Input
              label={t('common.nom_fr')}
              value={form.nom_fr}
              onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))}
              placeholder="Mathématiques"
            />
            <Input
              label={t('common.nom_ar')}
              value={form.nom_ar}
              onChange={(e) => setForm((f) => ({ ...f, nom_ar: e.target.value }))}
              placeholder="الرياضيات"
              dir="rtl"
            />
          </div>
          <div className="grid-4">
            <Select
              label={t('classe.filiere')}
              value={form.filiere}
              onChange={(e) => setForm((f) => ({ ...f, filiere: e.target.value }))}
              options={[{ value: 'FR', label: t('classe.filiere_fr') }, { value: 'AR', label: t('classe.filiere_ar') }]}
            />
            <Input
              label={t('note.coefficient')}
              type="number"
              step="0.25"
              min="0.25"
              value={form.coeff_defaut}
              onChange={(e) => setForm((f) => ({ ...f, coeff_defaut: e.target.value }))}
            />
            <Input
              label={t('parametre.note_max')}
              type="number"
              step="1"
              min="1"
              max="100"
              value={form.note_max}
              onChange={(e) => setForm((f) => ({ ...f, note_max: e.target.value }))}
            />
            <Input
              label={t('parametre.note_min')}
              type="number"
              step="1"
              min="0"
              value={form.note_min}
              onChange={(e) => setForm((f) => ({ ...f, note_min: e.target.value }))}
            />
            <Input
              label={t('matiere.ordre_bulletin')}
              type="number"
              min="0"
              value={form.ordre_bulletin}
              onChange={(e) => setForm((f) => ({ ...f, ordre_bulletin: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
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
        message={`Désactiver la matière "${confirm?.nom_fr}" ?`}
      />
    </>
  );
}
