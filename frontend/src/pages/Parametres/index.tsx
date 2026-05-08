import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

interface Etablissement {
  id: string; nom_fr: string; adresse?: string; telephone?: string; devise: string;
}
interface ConfigNotes {
  note_max: number; note_min: number; nb_periodes: number; arrondi: number; chiffres_arabes: boolean; montant_mensualite: number;
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
    api.get<ConfigNotes>('/api/v1/parametres/notes').then(data => data && setConfig({
      ...data,
      note_max: Number(data.note_max),
      note_min: Number(data.note_min),
      montant_mensualite: Number(data.montant_mensualite),
    })).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, []);

  const saveEtab = async () => {
    if (!etab) return;
    setSaving('etab');
    try {
      await api.put('/api/v1/parametres', {
        nom_fr: etab.nom_fr, adresse: etab.adresse,
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
    <>
      <PageHeader title={t('parametre.titre')} />

      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('parametre.etablissement')}</h3>
          {success === 'etab' && <span style={{ fontSize: 13, color: 'var(--success-text)' }}>✓ Enregistré</span>}
        </div>
        {etab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label={t('common.nom_fr')} value={etab.nom_fr} onChange={(e) => setEtab((p) => p ? { ...p, nom_fr: e.target.value } : p)} />
            <div className="grid-2">
              <Input label={t('common.adresse')} value={etab.adresse ?? ''} onChange={(e) => setEtab((p) => p ? { ...p, adresse: e.target.value } : p)} />
              <Input label={t('common.telephone')} value={etab.telephone ?? ''} onChange={(e) => setEtab((p) => p ? { ...p, telephone: e.target.value } : p)} />
            </div>
            <Input label={t('common.devise')} value={etab.devise} onChange={(e) => setEtab((p) => p ? { ...p, devise: e.target.value } : p)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={saveEtab} loading={saving === 'etab'}>{t('actions.enregistrer')}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="card-pad">
        <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('parametre.config_notes')}</h3>
          {success === 'notes' && <span style={{ fontSize: 13, color: 'var(--success-text)' }}>✓ Enregistré</span>}
        </div>
        {config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-3">
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
            <Input
              label="Montant mensualité (FCFA)"
              type="number"
              value={String(config.montant_mensualite ?? 7500)}
              onChange={(e) => setConfig((p) => p ? { ...p, montant_mensualite: parseFloat(e.target.value) } : p)}
            />
            <div className="row" style={{ gap: 12 }}>
              <input
                type="checkbox"
                id="chiffres_arabes"
                checked={config.chiffres_arabes}
                onChange={(e) => setConfig((p) => p ? { ...p, chiffres_arabes: e.target.checked } : p)}
              />
              <label htmlFor="chiffres_arabes" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Utiliser les chiffres arabes (٠١٢٣٤٥٦٧٨٩)
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
