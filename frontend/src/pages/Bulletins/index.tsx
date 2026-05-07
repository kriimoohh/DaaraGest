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

interface NoteDetail {
  valeur: number | null;
  periode: number;
  matiere: { nom_fr: string; nom_ar: string; coeff_defaut: number; note_max: number; };
}

interface DetailBulletin extends Bulletin {
  eleve: Bulletin['eleve'] & {
    inscriptions: { classe_fr: { nom_fr: string } | null; classe_ar: { nom_fr: string } | null; }[];
  };
  notesByFiliere: { FR?: NoteDetail[]; AR?: NoteDetail[]; };
}

type BulletinType = 'FR' | 'AR' | 'COMBINE' | 'ANNUEL_FR' | 'ANNUEL_AR' | 'ANNUEL_COMBINE';

const TYPE_OPTIONS = [
  { value: 'FR',             label: '📘 Trimestre — Filière Française' },
  { value: 'AR',             label: '📗 Trimestre — Filière Arabe' },
  { value: 'COMBINE',        label: '📕 Trimestre — Combiné FR+AR' },
  { value: 'ANNUEL_FR',      label: '🗓 Annuel — Filière Française' },
  { value: 'ANNUEL_AR',      label: '🗓 Annuel — Filière Arabe' },
  { value: 'ANNUEL_COMBINE', label: '🗓 Annuel — Combiné FR+AR' },
];

const PERIODES = [
  { value: '1', label: '1er Trimestre' },
  { value: '2', label: '2ème Trimestre' },
  { value: '3', label: '3ème Trimestre' },
];

function moyenneVariant(m: number | null): 'success' | 'error' | 'warning' | 'neutral' {
  if (m === null) return 'neutral';
  if (m >= 14) return 'success';
  if (m >= 10) return 'warning';
  return 'error';
}

function moyenneClass(m: number | null) {
  if (m === null) return 'text-slate-400 dark:text-slate-500';
  if (m >= 14) return 'text-emerald-600 dark:text-emerald-400';
  if (m >= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function filiereChip(f: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    FR:      { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300',    label: 'FR' },
    AR:      { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  label: 'AR' },
    COMBINE: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'FR+AR' },
  };
  const s = map[f] ?? { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', label: f };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function RangMedal({ rang }: { rang: number | null }) {
  if (rang === null) return <span className="text-slate-400 dark:text-slate-500">—</span>;
  if (rang === 1) return <span className="text-amber-500 font-bold text-base">🥇 1er</span>;
  if (rang === 2) return <span className="text-slate-500 font-bold">🥈 2ème</span>;
  if (rang === 3) return <span className="text-amber-700 font-bold">🥉 3ème</span>;
  return <span className="font-semibold text-slate-700 dark:text-slate-300">{rang}ème</span>;
}

function ClasseStats({ bulletins }: { bulletins: Bulletin[] }) {
  if (bulletins.length === 0) return null;
  const avecMoy = bulletins.filter(b => b.moyenne !== null);
  if (avecMoy.length === 0) return null;
  const moyennes = avecMoy.map(b => Number(b.moyenne!));
  const moyClasse = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
  const meilleur = bulletins.reduce((best, b) => (b.rang === 1 ? b : best), null as Bulletin | null);
  const reussite = avecMoy.filter(b => Number(b.moyenne!) >= 10).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
        <div className={`text-2xl font-bold ${moyenneClass(moyClasse)}`}>
          {moyClasse.toFixed(2)}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Moyenne classe</div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
        <div className="text-2xl font-bold text-slate-800 dark:text-white">{bulletins.length}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Élèves</div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {avecMoy.length > 0 ? Math.round((reussite / avecMoy.length) * 100) : 0}%
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Taux de réussite</div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
        <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">
          {meilleur ? `${meilleur.eleve.prenom_fr} ${meilleur.eleve.nom_fr}` : '—'}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">1er de classe</div>
      </div>
    </div>
  );
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
  const [detail, setDetail] = useState<DetailBulletin | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [view, setView] = useState<'cards' | 'table'>('cards');

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

  const openDetail = async (b: Bulletin) => {
    setLoadingDetail(true);
    try {
      const data = await api.get<DetailBulletin>(`/api/v1/bulletins/${b.id}`);
      setDetail(data);
    } catch {
      toast.error('Impossible de charger le détail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const sortedBulletins = [...bulletins].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));

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
            options={[{ value: '', label: t('common.tous') }, ...classes.map(c => ({ value: c.id, label: c.nom_fr }))]}
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

        <div className="flex flex-wrap items-center gap-3">
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

          {bulletins.length > 0 && (
            <div className="ms-auto flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setView('cards')}
                className={`px-3 py-1.5 text-sm transition-colors ${view === 'cards' ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                ▦ Cartes
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1.5 text-sm transition-colors ${view === 'table' ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                ☰ Tableau
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats de classe */}
      {bulletins.length > 0 && <ClasseStats bulletins={bulletins} />}

      {/* Vue cartes */}
      {bulletins.length > 0 && view === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedBulletins.map(b => {
            const moy = b.moyenne !== null ? Number(b.moyenne) : null;
            return (
              <div key={b.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Barre de couleur selon la moyenne */}
                <div className={`h-1.5 w-full ${moy === null ? 'bg-slate-300 dark:bg-slate-600' : moy >= 14 ? 'bg-emerald-500' : moy >= 10 ? 'bg-amber-500' : 'bg-red-500'}`} />

                <div className="p-4 space-y-3">
                  {/* En-tête élève */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                        {b.eleve.prenom_fr} {b.eleve.nom_fr}
                      </div>
                      <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{b.eleve.matricule}</div>
                    </div>
                    <RangMedal rang={b.rang} />
                  </div>

                  {/* Badges filière + période */}
                  <div className="flex items-center gap-2">
                    {filiereChip(b.filiere)}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {b.periode === 0 ? 'Annuel' : `Trimestre ${b.periode}`}
                    </span>
                  </div>

                  {/* Moyenne */}
                  <div className="flex items-end justify-between">
                    <div>
                      <div className={`text-3xl font-bold ${moyenneClass(moy)}`}>
                        {moy !== null ? moy.toFixed(2) : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">/20</div>
                    </div>
                    {b.appreciation && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-end max-w-[120px] leading-snug italic">
                        {b.appreciation}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => openDetail(b)}
                      className="flex-1 text-xs text-center py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Détail
                    </button>
                    <button
                      onClick={() => downloadPdf(b)}
                      disabled={downloading === b.id}
                      className="flex-1 text-xs text-center py-1.5 rounded-lg bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition-colors disabled:opacity-50 font-medium"
                    >
                      {downloading === b.id ? '…' : '⬇ PDF'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue tableau */}
      {bulletins.length > 0 && view === 'table' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                {['Rang', 'Élève', 'Matricule', 'Filière', 'Période', 'Moyenne', 'Appréciation', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBulletins.map(b => {
                const moy = b.moyenne !== null ? Number(b.moyenne) : null;
                return (
                  <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3"><RangMedal rang={b.rang} /></td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{b.eleve.prenom_fr} {b.eleve.nom_fr}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{b.eleve.matricule}</td>
                    <td className="px-4 py-3">{filiereChip(b.filiere)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {b.periode === 0 ? 'Annuel' : `T${b.periode}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={moy !== null ? `${moy.toFixed(2)}/20` : 'N/A'}
                        variant={moyenneVariant(moy)}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 italic max-w-[180px] truncate">
                      {b.appreciation ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(b)}>{t('actions.voir')}</Button>
                        <Button variant="secondary" size="sm" loading={downloading === b.id} onClick={() => downloadPdf(b)}>PDF</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vide */}
      {bulletins.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-slate-500 dark:text-slate-400">{t('bulletin.aucun')}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Sélectionnez une année scolaire et cliquez sur Charger
          </p>
        </div>
      )}

      {/* Modal détail */}
      <Modal isOpen={!!detail || loadingDetail} onClose={() => setDetail(null)} title={t('bulletin.detail')} size="lg">
        {loadingDetail && (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Chargement…</div>
        )}
        {detail && !loadingDetail && <BulletinDetailContent detail={detail} downloading={downloading} onDownload={downloadPdf} onClose={() => setDetail(null)} />}
      </Modal>
    </div>
  );
}

// ─── Contenu modal détail ─────────────────────────────────────────────────────

function noteColor(valeur: number | string | null, noteMax: number | string): string {
  if (valeur === null) return 'text-slate-400 dark:text-slate-500';
  const ratio = Number(valeur) / Number(noteMax);
  if (ratio >= 0.7) return 'text-emerald-600 dark:text-emerald-400 font-semibold';
  if (ratio >= 0.5) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-red-600 dark:text-red-400 font-semibold';
}

function NotesTable({ notes, filiere, isAnnuel }: { notes: NoteDetail[]; filiere: string; isAnnuel: boolean }) {
  if (notes.length === 0) return null;

  if (!isAnnuel) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Matière ({filiere})</th>
            <th className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-14">Coeff</th>
            <th className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-24">Note / Max</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="py-2 text-slate-800 dark:text-slate-200">{n.matiere.nom_fr}</td>
              <td className="py-2 text-center text-slate-500 dark:text-slate-400 text-xs">{n.matiere.coeff_defaut}</td>
              <td className="py-2 text-center">
                <span className={noteColor(n.valeur, n.matiere.note_max)}>
                  {n.valeur !== null ? Number(n.valeur).toFixed(1) : '—'}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-xs">/{Number(n.matiere.note_max)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Annuel: group by matiere, columns T1 | T2 | T3 | Moy.
  const matMap = new Map<string, { nom_fr: string; coeff: number; noteMax: number; vals: Record<number, number | null> }>();
  for (const n of notes) {
    if (!matMap.has(n.matiere.nom_fr)) {
      matMap.set(n.matiere.nom_fr, { nom_fr: n.matiere.nom_fr, coeff: Number(n.matiere.coeff_defaut), noteMax: Number(n.matiere.note_max), vals: {} });
    }
    matMap.get(n.matiere.nom_fr)!.vals[n.periode] = n.valeur !== null ? Number(n.valeur) : null;
  }
  const rows = Array.from(matMap.values()).map(m => {
    const vs = [1, 2, 3].map(p => m.vals[p] ?? null);
    const nums = vs.filter((v): v is number => v !== null);
    const moy = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : null;
    return { ...m, vs, moy };
  });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className="py-2 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Matière ({filiere})</th>
          <th className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-10">Coeff</th>
          {['T1', 'T2', 'T3'].map(t => (
            <th key={t} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-14">{t}</th>
          ))}
          <th className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-16">Moy.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <td className="py-2 text-slate-800 dark:text-slate-200">{r.nom_fr}</td>
            <td className="py-2 text-center text-slate-400 dark:text-slate-500 text-xs">{r.coeff}</td>
            {r.vs.map((v, j) => (
              <td key={j} className={`py-2 text-center text-xs ${noteColor(v, r.noteMax)}`}>
                {v !== null ? v.toFixed(1) : '—'}
              </td>
            ))}
            <td className={`py-2 text-center text-xs ${noteColor(r.moy, r.noteMax)}`}>
              {r.moy !== null ? r.moy.toFixed(2) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulletinDetailContent({
  detail, downloading, onDownload, onClose,
}: {
  detail: DetailBulletin;
  downloading: string | null;
  onDownload: (b: DetailBulletin) => void;
  onClose: () => void;
}) {
  const moy = detail.moyenne !== null ? Number(detail.moyenne) : null;
  const isAnnuel = detail.periode === 0;
  const filieres: ('FR' | 'AR')[] = detail.filiere === 'COMBINE' ? ['FR', 'AR'] : [detail.filiere as 'FR' | 'AR'];
  const insc = detail.eleve.inscriptions?.[0];
  const classeNom = insc?.classe_fr?.nom_fr ?? insc?.classe_ar?.nom_fr ?? '—';

  return (
    <div className="space-y-5">
      {/* Bandeau moyenne + rang */}
      <div className={`rounded-xl p-5 flex items-center justify-between gap-4 ${moy === null ? 'bg-slate-50 dark:bg-slate-700' : moy >= 14 ? 'bg-emerald-50 dark:bg-emerald-900/20' : moy >= 10 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        <div>
          <div className={`text-4xl font-bold ${moyenneClass(moy)}`}>
            {moy !== null ? moy.toFixed(2) : 'N/A'}
            <span className="text-base font-normal text-slate-400 dark:text-slate-500 ms-1">/20</span>
          </div>
          {detail.appreciation && (
            <div className="text-sm italic text-slate-600 dark:text-slate-300 mt-1">{detail.appreciation}</div>
          )}
        </div>
        <div className="text-end">
          <RangMedal rang={detail.rang} />
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {isAnnuel ? 'Bulletin Annuel' : `Trimestre ${detail.periode}`}
          </div>
        </div>
      </div>

      {/* Infos élève */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Élève</div>
          <div className="font-semibold text-slate-900 dark:text-white">{detail.eleve.prenom_fr} {detail.eleve.nom_fr}</div>
          <div className="font-mono text-xs text-slate-400 dark:text-slate-500">{detail.eleve.matricule}</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Classe</div>
          <div className="font-semibold text-slate-900 dark:text-white">{classeNom}</div>
          <div className="mt-1">{filiereChip(detail.filiere)}</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Année scolaire</div>
          <div className="font-semibold text-slate-900 dark:text-white">{detail.annee_scolaire.libelle}</div>
          {detail.generated_at && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Généré le {new Date(detail.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Tables de notes par filière */}
      <div className="space-y-4">
        {filieres.map(f => {
          const notes = detail.notesByFiliere[f] ?? [];
          return (
            <div key={f} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className={`px-4 py-2 text-xs font-semibold border-b border-slate-200 dark:border-slate-700 ${f === 'FR' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>
                Filière {f === 'FR' ? 'Française' : 'Arabe'} — {notes.length} matière(s)
              </div>
              <div className="px-4 pb-3">
                {notes.length === 0
                  ? <p className="py-4 text-xs text-slate-400 dark:text-slate-500 text-center">Aucune note enregistrée</p>
                  : <NotesTable notes={notes} filiere={f} isAnnuel={isAnnuel} />
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
        <Button onClick={() => onDownload(detail)} loading={downloading === detail.id}>
          ⬇ Télécharger PDF
        </Button>
      </div>
    </div>
  );
}
