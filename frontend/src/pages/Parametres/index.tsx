import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

interface Etablissement {
  id: string; nom_fr: string; nom_ar: string; adresse?: string; telephone?: string; devise: string;
}
interface ConfigNotes {
  note_max: number; note_min: number; nb_periodes: number; arrondi: number; chiffres_arabes: boolean;
}

export function ParametresPage() {
  const { t } = useTranslation();
  const api = useApi();

  const [etab, setEtab] = useState<Etablissement | null>(null);
  const [config, setConfig] = useState<ConfigNotes | null>(null);
  const [saving, setSaving] = useState<'etab' | 'notes' | null>(null);
  const [success, setSuccess] = useState<'etab' | 'notes' | null>(null);

  useEffect(() => {
    api.get<Etablissement>('/api/v1/parametres').then(setEtab).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
    api.get<ConfigNotes>('/api/v1/parametres/notes').then(setConfig).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, []);

  const saveEtab = async () => {
    if (!etab) return;
    setSaving('etab');
    try {
      await api.put('/api/v1/parametres', {
        nom_fr: etab.nom_fr, nom_ar: etab.nom_ar, adresse: etab.adresse,
        telephone: etab.telephone, devise: etab.devise,
      });
      setSuccess('etab');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(null);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving('notes');
    try {
      await api.put('/api/v1/parametres/notes', config);
      setSuccess('notes');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('parametre.titre')} />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('parametre.etablissement')}</h3>
          {success === 'etab' && <span className="text-sm text-emerald-600">✓ Enregistré</span>}
        </div>
        {etab && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nom (Français)" value={etab.nom_fr} onChange={(e) => setEtab((p) => p ? { ...p, nom_fr: e.target.value } : p)} />
              <Input label="Nom (Arabe)" value={etab.nom_ar} onChange={(e) => setEtab((p) => p ? { ...p, nom_ar: e.target.value } : p)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Adresse" value={etab.adresse ?? ''} onChange={(e) => setEtab((p) => p ? { ...p, adresse: e.target.value } : p)} />
              <Input label="Téléphone" value={etab.telephone ?? ''} onChange={(e) => setEtab((p) => p ? { ...p, telephone: e.target.value } : p)} />
            </div>
            <Input label="Devise" value={etab.devise} onChange={(e) => setEtab((p) => p ? { ...p, devise: e.target.value } : p)} />
            <div className="flex justify-end">
              <Button onClick={saveEtab} loading={saving === 'etab'}>{t('actions.enregistrer')}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('parametre.config_notes')}</h3>
          {success === 'notes' && <span className="text-sm text-emerald-600">✓ Enregistré</span>}
        </div>
        {config && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label={t('parametre.note_max')}
                type="number"
                value={String(config.note_max)}
                onChange={(e) => setConfig((p) => p ? { ...p, note_max: parseFloat(e.target.value) } : p)}
              />
              <Input
                label={t('parametre.note_min')}
                type="number"
                value={String(config.note_min)}
                onChange={(e) => setConfig((p) => p ? { ...p, note_min: parseFloat(e.target.value) } : p)}
              />
              <Input
                label={t('parametre.nb_periodes')}
                type="number"
                value={String(config.nb_periodes)}
                onChange={(e) => setConfig((p) => p ? { ...p, nb_periodes: parseInt(e.target.value) } : p)}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="chiffres_arabes"
                checked={config.chiffres_arabes}
                onChange={(e) => setConfig((p) => p ? { ...p, chiffres_arabes: e.target.checked } : p)}
                className="w-4 h-4 accent-emerald-600"
              />
              <label htmlFor="chiffres_arabes" className="text-sm text-gray-700 dark:text-gray-300">
                Utiliser les chiffres arabes (٠١٢٣٤٥٦٧٨٩)
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
