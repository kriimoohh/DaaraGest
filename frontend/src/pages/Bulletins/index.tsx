import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

interface AnneeScolaire { id: string; libelle: string; }
interface Classe { id: string; nom_fr: string; filiere: string; }
interface Bulletin {
  id: string; periode: number; filiere: string;
  moyenne: number | null; rang: number | null; appreciation: string | null;
  generated_at: string | null;
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string; };
  annee_scolaire: { libelle: string; };
}

type BulletinType = 'FR' | 'AR' | 'COMBINE' | 'ANNUEL_FR' | 'ANNUEL_AR' | 'ANNUEL_COMBINE';

const TYPE_OPTIONS = [
  { value: 'FR',             label: '📘 Par trimestre — Filière Française' },
  { value: 'AR',             label: '📗 Par trimestre — Filière Arabe' },
  { value: 'COMBINE',        label: '📕 Par trimestre — Combiné FR+AR' },
  { value: 'ANNUEL_FR',      label: '🗓 Annuel — Filière Française' },
  { value: 'ANNUEL_AR',      label: '🗓 Annuel — Filière Arabe' },
  { value: 'ANNUEL_COMBINE', label: '🗓 Annuel — Combiné FR+AR' },
];

const PERIODES = [
  { value: '1', label: '1er Trimestre' },
  { value: '2', label: '2ème Trimestre' },
  { value: '3', label: '3ème Trimestre' },
];

function filiereBadge(f: string) {
  if (f === 'FR') return <Badge label="FR" variant="info" />;
  if (f === 'AR') return <Badge label="AR" variant="warning" />;
  if (f === 'COMBINE') return <Badge label="FR+AR" variant="success" />;
  return <Badge label={f} variant="neutral" />;
}

function periodeBadge(p: number) {
  if (p === 0) return <Badge label="Annuel" variant="neutral" />;
  return <Badge label={`T${p}`} variant="info" />;
}

function moyenneColor(m: number | null): 'success' | 'error' | 'warning' | 'neutral' {
  if (m === null) return 'neutral';
  if (m >= 14) return 'success';
  if (m >= 10) return 'warning';
  return 'error';
}

export function BulletinsPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { token } = useAuthStore();

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);

  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periode, setPeriode] = useState('1');
  const [type, setType] = useState<BulletinType>('FR');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingClasse, setDownloadingClasse] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [detail, setDetail] = useState<Bulletin | null>(null);

  const isAnnuel = type.startsWith('ANNUEL');
  const filiere = isAnnuel ? type.replace('ANNUEL_', '') : type;

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(setAnnees).catch(() => toast.error('Erreur de chargement'));
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`).then(setClasses).catch(() => {});
  }, [anneeId]);

  const charger = async () => {
    if (!anneeId) return;
    setLoading(true);
    try {
      const filiereFetch = isAnnuel ? filiere : type;
      const periodeFetch = isAnnuel ? 0 : parseInt(periode);
      const params = new URLSearchParams({ annee_scolaire_id: anneeId, periode: String(periodeFetch), filiere: filiereFetch });
      const data = await api.get<Bulletin[]>(`/api/v1/bulletins?${params}`);
      setBulletins(data);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const generer = async () => {
    if (!classeId || !anneeId) { toast.error('Sélectionnez une classe'); return; }
    setGenerating(true);
    try {
      if (isAnnuel) {
        await api.post('/api/v1/bulletins/generer-annuel', { classe_id: classeId, annee_scolaire_id: anneeId, filiere });
      } else {
        await api.post('/api/v1/bulletins/generer', { classe_id: classeId, annee_scolaire_id: anneeId, periode: parseInt(periode), filiere: type });
      }
      toast.success('Bulletins générés avec succès');
      await charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async (b: Bulletin) => {
    setDownloading(b.id);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/bulletins/${b.id}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error('Erreur génération PDF');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = b.periode === 0 ? 'Annuel' : `T${b.periode}`;
      a.download = `bulletin-${b.eleve.matricule}-${suffix}-${b.filiere}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur PDF');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    if (!classeId || !anneeId || bulletins.length === 0) return;
    setDownloadingClasse(true);
    try {
      const periodeFetch = isAnnuel ? 0 : parseInt(periode);
      const filiereFetch = isAnnuel ? filiere : type;
      const params = new URLSearchParams({ classe_id: classeId, annee_scolaire_id: anneeId, periode: String(periodeFetch), filiere: filiereFetch });
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/bulletins/pdf-classe?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Erreur'); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletins-classe-${isAnnuel ? 'Annuel' : `T${periode}`}-${filiereFetch}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF de la classe téléchargé (${bulletins.length} bulletin(s))`);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur PDF classe');
    } finally {
      setDownloadingClasse(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('bulletin.titre')} />

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Select label={t('classe.annee_scolaire')}
            value={anneeId} onChange={(e) => { setAnneeId(e.target.value); setClasseId(''); setBulletins([]); }}
            options={[{ value: '', label: t('common.selectionner') }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]}
          />
          <Select label={t('nav.classes')}
            value={classeId} onChange={(e) => { setClasseId(e.target.value); setBulletins([]); }}
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map(c => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select label="Type de bulletin"
            value={type} onChange={(e) => { setType(e.target.value as BulletinType); setBulletins([]); }}
            options={TYPE_OPTIONS}
          />
          {!isAnnuel && (
            <Select label={t('note.periode')}
              value={periode} onChange={(e) => { setPeriode(e.target.value); setBulletins([]); }}
              options={PERIODES}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={charger} loading={loading} disabled={!anneeId}>
            {t('bulletin.charger')}
          </Button>
          <Button onClick={generer} loading={generating} disabled={!classeId}>
            {t('actions.generer')}
          </Button>
          {bulletins.length > 0 && (
            <Button variant="secondary" onClick={downloadAll} loading={downloadingClasse} disabled={!classeId}>
              ⬇ {t('bulletin.telecharger_tous')} ({bulletins.length})
            </Button>
          )}
        </div>
      </div>

      {/* Tableau */}
      {bulletins.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                {['Élève', 'Matricule', 'Filière', 'Période', 'Moyenne', 'Rang', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulletins.map(b => (
                <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{b.eleve.prenom_fr} {b.eleve.nom_fr}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{b.eleve.matricule}</td>
                  <td className="px-4 py-3">{filiereBadge(b.filiere)}</td>
                  <td className="px-4 py-3">{periodeBadge(b.periode)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={b.moyenne !== null ? `${Number(b.moyenne).toFixed(2)}/20` : 'N/A'}
                      variant={moyenneColor(b.moyenne)}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{b.rang ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(b)}>{t('actions.voir')}</Button>
                      <Button variant="secondary" size="sm" loading={downloading === b.id} onClick={() => downloadPdf(b)}>PDF</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400 dark:text-slate-500 text-sm">{t('bulletin.aucun')}</p>
        </div>
      )}

      {/* Modal détail */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={t('bulletin.detail')} size="md">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Élève :</span> <strong>{detail.eleve.prenom_fr} {detail.eleve.nom_fr}</strong></div>
              <div><span className="text-slate-500">Matricule :</span> <strong>{detail.eleve.matricule}</strong></div>
              <div><span className="text-slate-500">Filière :</span> {filiereBadge(detail.filiere)}</div>
              <div><span className="text-slate-500">Période :</span> {periodeBadge(detail.periode)}</div>
              <div><span className="text-slate-500">Moyenne :</span> <strong className={detail.moyenne && detail.moyenne >= 10 ? 'text-emerald-600' : 'text-red-500'}>{detail.moyenne !== null ? `${Number(detail.moyenne).toFixed(2)}/20` : 'N/A'}</strong></div>
              <div><span className="text-slate-500">Rang :</span> <strong>{detail.rang ?? '—'}</strong></div>
            </div>
            {detail.appreciation && (
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm italic text-slate-600 dark:text-slate-300">
                {detail.appreciation}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={() => downloadPdf(detail)} loading={downloading === detail.id}>
                Télécharger PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
