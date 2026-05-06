import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

interface AnneeScolaire { id: string; libelle: string; }
interface Classe { id: string; nom_fr: string; filiere: string; }
interface Bulletin {
  id: string;
  periode: number;
  filiere: string;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  generated_at: string | null;
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string; };
  annee_scolaire: { libelle: string; };
}

export function BulletinsPage() {
  const { t } = useTranslation();
  const api = useApi();

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);

  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periode, setPeriode] = useState('1');
  const [filiere, setFiliere] = useState('FR');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<Bulletin | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingClasse, setDownloadingClasse] = useState(false);

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(setAnnees).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`).then(setClasses).catch((err) => toast.error((err as Error).message || 'Erreur de chargement'));
  }, [anneeId]);

  const chargerBulletins = async () => {
    if (!anneeId) return;
    setLoading(true);
    try {
      const data = await api.get<Bulletin[]>(
        `/api/v1/bulletins?annee_scolaire_id=${anneeId}&periode=${periode}`
      );
      setBulletins(data);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const generer = async () => {
    if (!classeId || !anneeId) return;
    setGenerating(true);
    try {
      await api.post('/api/v1/bulletins/generer', {
        classe_id: classeId,
        annee_scolaire_id: anneeId,
        periode: parseInt(periode),
        filiere,
      });
      toast.success('Bulletins générés avec succès');
      await chargerBulletins();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const getMoyenneColor = (m: number | null) => {
    if (!m) return 'neutral';
    if (m >= 14) return 'success';
    if (m >= 10) return 'info';
    if (m >= 8) return 'warning';
    return 'error';
  };

  const downloadPdf = async (b: Bulletin) => {
    setDownloading(b.id);
    try {
      const token = useAuthStore.getState().token;
      const resp = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/bulletins/${b.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Erreur génération PDF');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletin-${b.eleve.matricule}-T${b.periode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors du téléchargement');
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdfClasse = async () => {
    if (!classeId || !anneeId) {
      toast.error('Sélectionnez une classe et une année scolaire');
      return;
    }
    setDownloadingClasse(true);
    try {
      const token = useAuthStore.getState().token;
      const params = new URLSearchParams({ classe_id: classeId, annee_scolaire_id: anneeId, periode, filiere });
      const resp = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/bulletins/pdf-classe?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur génération PDF');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletins-classe-T${periode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF de la classe téléchargé (${bulletins.length} bulletin(s))`);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors du téléchargement');
    } finally {
      setDownloadingClasse(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('bulletin.titre')} />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Select
            label="Année scolaire"
            value={anneeId}
            onChange={(e) => { setAnneeId(e.target.value); setClasseId(''); }}
            options={[{ value: '', label: 'Sélectionner...' }, ...annees.map((a) => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label="Classe"
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            options={[{ value: '', label: 'Sélectionner...' }, ...classes.map((c) => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select
            label="Période"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            options={[
              { value: '1', label: '1er Trimestre' },
              { value: '2', label: '2ème Trimestre' },
              { value: '3', label: '3ème Trimestre' },
            ]}
          />
          <Select
            label="Filière"
            value={filiere}
            onChange={(e) => setFiliere(e.target.value)}
            options={[{ value: 'FR', label: 'Français' }, { value: 'AR', label: 'Arabe' }]}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={chargerBulletins} variant="secondary" loading={loading}>
            Charger les bulletins
          </Button>
          <Button onClick={generer} loading={generating} disabled={!classeId}>
            {t('bulletin.generer')}
          </Button>
          <Button
            variant="secondary"
            onClick={downloadPdfClasse}
            loading={downloadingClasse}
            disabled={!classeId || bulletins.length === 0}
          >
            ⬇ Télécharger tous ({bulletins.length})
          </Button>
        </div>
      </div>

      {bulletins.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Élève</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Filière</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Moyenne</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rang</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {bulletins.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {b.eleve.prenom_fr} {b.eleve.nom_fr}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{b.eleve.matricule}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={b.filiere} variant={b.filiere === 'FR' ? 'info' : 'warning'} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={b.moyenne !== null ? `${Number(b.moyenne).toFixed(2)}/20` : 'N/A'}
                      variant={getMoyenneColor(b.moyenne)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {b.rang ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(b)}>
                      {t('actions.voir')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={downloading === b.id}
                      onClick={() => downloadPdf(b)}
                    >
                      PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bulletins.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 dark:text-gray-400">
            Sélectionnez une année et une classe, puis cliquez sur "Générer les bulletins"
          </p>
        </div>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Détail du bulletin" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Élève:</span> <strong>{detail.eleve.prenom_fr} {detail.eleve.nom_fr}</strong></div>
              <div><span className="text-gray-500">Matricule:</span> <strong>{detail.eleve.matricule}</strong></div>
              <div><span className="text-gray-500">Période:</span> <strong>Trimestre {detail.periode}</strong></div>
              <div><span className="text-gray-500">Filière:</span> <strong>{detail.filiere}</strong></div>
              <div><span className="text-gray-500">Moyenne:</span> <strong>{detail.moyenne !== null ? `${Number(detail.moyenne).toFixed(2)}/20` : 'N/A'}</strong></div>
              <div><span className="text-gray-500">Rang:</span> <strong>{detail.rang ?? '—'}</strong></div>
            </div>
            {detail.appreciation && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                {detail.appreciation}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
