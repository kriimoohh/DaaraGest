import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { useNoteMax } from '../../store/noteScaleStore';
import { useAnneeScolaire } from '../../store/anneeStore';
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
  evaluee?: boolean;
  matiere: { nom_fr: string; nom_ar: string; coeff_defaut: number; note_max: number; };
}

interface PreflightResult {
  classe_id: string; periode: number; filiere: string;
  total_eleves: number;
  matieres_evaluees: { id: string; nom_fr: string; nom_ar: string | null; coeff: number; note_max: number; filiere: 'FR' | 'AR'; eleves_avec_notes: number }[];
  matieres_non_evaluees: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR'; source: 'periode' | 'classe' }[];
  matieres_sans_notes: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR' }[];
  eleves_sans_aucune_note: { id: string; nom_fr: string; prenom_fr: string; matricule: string }[];
  warnings: { code: string; message: string }[];
}

interface DetailBulletin extends Bulletin {
  observation_fr: string | null;
  observation_prof: string | null;
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

// Seuils relatifs à l'échelle de l'établissement (base, ex: 10) : 0.7 = "bien"
// (14/20), 0.5 = "moyenne" (10/20). Évite les seuils /20 codés en dur.
function moyenneVariant(m: number | null, base = 20): 'success' | 'error' | 'warning' | 'neutral' {
  if (m === null) return 'neutral';
  if (m >= base * 0.7) return 'success';
  if (m >= base * 0.5) return 'warning';
  return 'error';
}

function moyenneColor(m: number | null, base = 20): string {
  if (m === null) return 'var(--ink-4)';
  if (m >= base * 0.7) return 'var(--success)';
  if (m >= base * 0.5) return 'var(--warning)';
  return 'var(--danger)';
}

function filiereChip(f: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    FR:      { bg: 'var(--indigo-soft)', color: 'var(--indigo-ink)', label: 'FR' },
    AR:      { bg: 'var(--sahel-soft)', color: 'var(--sahel-ink)', label: 'AR' },
    COMBINE: { bg: 'var(--success-soft)', color: 'var(--success-text)', label: 'FR+AR' },
  };
  const s = map[f] ?? { bg: 'var(--paper-2)', color: 'var(--ink-3)', label: f };
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function RangMedal({ rang }: { rang: number | null }) {
  if (rang === null) return <span style={{ color: 'var(--ink-4)' }}>—</span>;
  if (rang === 1) return <span style={{ color: 'var(--sahel)', fontWeight: 700, fontSize: 15 }}>🥇 1er</span>;
  if (rang === 2) return <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>🥈 2ème</span>;
  if (rang === 3) return <span style={{ color: 'var(--sahel-ink)', fontWeight: 700 }}>🥉 3ème</span>;
  return <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{rang}ème</span>;
}

function ClasseStats({ bulletins, t, noteMax }: { bulletins: Bulletin[]; t: (k: string) => string; noteMax: number }) {
  if (bulletins.length === 0) return null;
  const avecMoy = bulletins.filter(b => b.moyenne !== null);
  if (avecMoy.length === 0) return null;
  const moyennes = avecMoy.map(b => Number(b.moyenne!));
  const moyClasse = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
  const meilleur = bulletins.reduce((best, b) => (b.rang === 1 ? b : best), null as Bulletin | null);
  const reussite = avecMoy.filter(b => Number(b.moyenne!) >= noteMax * 0.5).length;

  return (
    <div className="grid-4" style={{ marginBottom: 16 }}>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: moyenneColor(moyClasse, noteMax) }}>
          {moyClasse.toFixed(2)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t('bulletin.stats_moyenne_classe')}</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{bulletins.length}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t('bulletin.stats_eleves')}</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
          {avecMoy.length > 0 ? Math.round((reussite / avecMoy.length) * 100) : 0}%
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t('bulletin.stats_taux_reussite')}</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meilleur ? `${meilleur.eleve.prenom_fr} ${meilleur.eleve.nom_fr}` : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t('bulletin.stats_premier')}</div>
      </div>
    </div>
  );
}

export function BulletinsPage() {
  const { t } = useTranslation();
  const api = useApi();
  const noteMax = useNoteMax();
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);

  const [anneeId, setAnneeId] = useAnneeScolaire();
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
  // Pré-vol : modale de vérification avant génération
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [inclureNonEvaluees, setInclureNonEvaluees] = useState(false);
  const [manquantesCommeZero, setManquantesCommeZero] = useState(false);

  const isAnnuel = type.startsWith('ANNUEL');
  const filiere = isAnnuel ? type.replace('ANNUEL_', '') : type;

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(setAnnees).catch(() => toast.error(t('bulletin.err_chargement')));
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
      if (classeId) params.set('classe_id', classeId);
      const data = await api.get<Bulletin[]>(`/api/v1/bulletins?${params}`);
      setBulletins(data);
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.err_chargement'));
    } finally {
      setLoading(false);
    }
  };

  // Ouvre la modale de pré-vol au lieu de générer direct. Les flags
  // inclure_non_evaluees / traiter_manquantes_comme_zero sont définis dans la modale.
  const generer = async () => {
    if (!classeId || !anneeId) { toast.error(t('bulletin.err_classe_requise')); return; }
    setPreflightLoading(true);
    setInclureNonEvaluees(false);
    setManquantesCommeZero(false);
    try {
      const periodeFetch = isAnnuel ? 0 : parseInt(periode);
      const filiereFetch = isAnnuel ? filiere : type;
      const pf = await api.post<PreflightResult>('/api/v1/bulletins/preflight', {
        classe_id: classeId, annee_scolaire_id: anneeId, periode: periodeFetch, filiere: filiereFetch,
      });
      setPreflight(pf);
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.err_generation'));
    } finally {
      setPreflightLoading(false);
    }
  };

  const confirmerGeneration = async () => {
    if (!preflight || !classeId || !anneeId) return;
    setGenerating(true);
    try {
      const body = {
        classe_id: classeId, annee_scolaire_id: anneeId,
        filiere: isAnnuel ? filiere : type,
        inclure_non_evaluees: inclureNonEvaluees,
        traiter_manquantes_comme_zero: manquantesCommeZero,
      };
      if (isAnnuel) {
        await api.post('/api/v1/bulletins/generer-annuel', body);
      } else {
        await api.post('/api/v1/bulletins/generer', { ...body, periode: parseInt(periode) });
      }
      toast.success(t('bulletin.ok_generes'));
      setPreflight(null);
      await charger();
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.err_generation'));
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async (b: Bulletin) => {
    setDownloading(b.id);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/bulletins/${b.id}/pdf`,
        { credentials: 'include' }
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
      toast.success(t('bulletin.ok_pdf_eleve'));
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.err_pdf'));
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
        { credentials: 'include' }
      );
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Erreur'); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletins-classe-${isAnnuel ? 'Annuel' : `T${periode}`}-${filiereFetch}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('bulletin.ok_pdf_classe', { count: bulletins.length }));
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.err_pdf_classe'));
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
      toast.error(t('bulletin.err_detail'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const sortedBulletins = [...bulletins].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));

  return (
    <>
      <PageHeader eyebrow={t('bulletin.eyebrow')} title={t('bulletin.titre')} />

      {/* Filtres */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ marginBottom: 12 }}>
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

        <div className="filter-row">
          <Button variant="secondary" onClick={charger} loading={loading} disabled={!anneeId}>
            {t('bulletin.charger')}
          </Button>
          <Button onClick={generer} loading={preflightLoading || generating} disabled={!classeId}>
            {t('actions.generer')}
          </Button>
          {bulletins.length > 0 && (
            <Button variant="secondary" onClick={downloadAll} loading={downloadingClasse} disabled={!classeId}>
              ⬇ {t('bulletin.telecharger_tous')} ({bulletins.length})
            </Button>
          )}

          {bulletins.length > 0 && (
            <div style={{ marginInlineStart: 'auto', display: 'flex', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <button
                onClick={() => setView('cards')}
                style={{
                  padding: '4px 12px', fontSize: 13,
                  background: view === 'cards' ? 'var(--ink)' : 'transparent',
                  color: view === 'cards' ? 'var(--paper)' : 'var(--ink-3)',
                  fontWeight: view === 'cards' ? 600 : 400,
                  border: 'none', cursor: 'pointer',
                }}
              >
                ▦ Cartes
              </button>
              <button
                onClick={() => setView('table')}
                style={{
                  padding: '4px 12px', fontSize: 13,
                  background: view === 'table' ? 'var(--ink)' : 'transparent',
                  color: view === 'table' ? 'var(--paper)' : 'var(--ink-3)',
                  fontWeight: view === 'table' ? 600 : 400,
                  border: 'none', cursor: 'pointer',
                }}
              >
                ☰ Tableau
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats de classe */}
      {bulletins.length > 0 && <ClasseStats bulletins={bulletins} t={t} noteMax={noteMax} />}

      {/* Vue cartes */}
      {bulletins.length > 0 && view === 'cards' && (
        <div className="grid-4">
          {sortedBulletins.map(b => {
            const moy = b.moyenne !== null ? Number(b.moyenne) : null;
            const barColor = moy === null ? 'var(--rule)' : moyenneColor(moy, noteMax);
            return (
              <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Barre de couleur selon la moyenne */}
                <div style={{ height: 6, background: barColor }} />

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* En-tête élève */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13, lineHeight: 1.3 }}>
                        {b.eleve.prenom_fr} {b.eleve.nom_fr}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 2 }}>{b.eleve.matricule}</div>
                    </div>
                    <RangMedal rang={b.rang} />
                  </div>

                  {/* Badges filière + période */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {filiereChip(b.filiere)}
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                      {b.periode === 0 ? 'Annuel' : `Trimestre ${b.periode}`}
                    </span>
                  </div>

                  {/* Moyenne */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: moyenneColor(moy, noteMax) }}>
                        {moy !== null ? moy.toFixed(2) : 'N/A'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>/{noteMax}</div>
                    </div>
                    {b.appreciation && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'end', maxWidth: 120, lineHeight: 1.4, fontStyle: 'italic' }}>
                        {b.appreciation}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--rule)' }}>
                    <button
                      onClick={() => openDetail(b)}
                      style={{ flex: 1, fontSize: 12, textAlign: 'center', padding: '6px 0', borderRadius: 'var(--r-md)', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Détail
                    </button>
                    <button
                      onClick={() => downloadPdf(b)}
                      disabled={downloading === b.id}
                      style={{ flex: 1, fontSize: 12, textAlign: 'center', padding: '6px 0', borderRadius: 'var(--r-md)', background: 'var(--ink)', color: 'var(--paper)', border: 'none', cursor: 'pointer', fontWeight: 500, opacity: downloading === b.id ? 0.5 : 1 }}
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
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {['Rang', 'Élève', 'Matricule', 'Filière', 'Période', 'Moyenne', 'Appréciation', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBulletins.map(b => {
                const moy = b.moyenne !== null ? Number(b.moyenne) : null;
                return (
                  <tr key={b.id}>
                    <td><RangMedal rang={b.rang} /></td>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{b.eleve.prenom_fr} {b.eleve.nom_fr}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{b.eleve.matricule}</td>
                    <td>{filiereChip(b.filiere)}</td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {b.periode === 0 ? 'Annuel' : `T${b.periode}`}
                    </td>
                    <td>
                      <Badge
                        label={moy !== null ? `${moy.toFixed(2)}/${noteMax}` : 'N/A'}
                        variant={moyenneVariant(moy, noteMax)}
                      />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.appreciation ?? '—'}
                    </td>
                    <td>
                      <div className="row">
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
        <div className="card empty" style={{ padding: 64 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ color: 'var(--ink-3)' }}>{t('bulletin.aucun')}</p>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
            Sélectionnez une année scolaire et cliquez sur Charger
          </p>
        </div>
      )}

      {/* Modal détail */}
      <Modal isOpen={!!detail || loadingDetail} onClose={() => setDetail(null)} title={t('bulletin.detail')} size="lg">
        {loadingDetail && (
          <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Chargement…</div>
        )}
        {detail && !loadingDetail && <BulletinDetailContent detail={detail} downloading={downloading} onDownload={downloadPdf} onClose={() => setDetail(null)} api={api} />}
      </Modal>

      {/* Modale de pré-vol avant génération */}
      <Modal isOpen={!!preflight} onClose={() => setPreflight(null)} title="Vérification avant génération" size="lg">
        {preflight && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Synthèse */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--success-soft)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success-text)' }}>{preflight.matieres_evaluees.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Matières évaluées</div>
              </div>
              <div style={{ padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-2)' }}>{preflight.matieres_non_evaluees.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Non évaluées</div>
              </div>
              <div style={{ padding: 12, background: preflight.matieres_sans_notes.length > 0 ? 'var(--warning-soft)' : 'var(--paper-2)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: preflight.matieres_sans_notes.length > 0 ? 'var(--warning-text)' : 'var(--ink-2)' }}>{preflight.matieres_sans_notes.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Sans note saisie</div>
              </div>
              <div style={{ padding: 12, background: preflight.eleves_sans_aucune_note.length > 0 ? 'var(--warning-soft)' : 'var(--paper-2)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: preflight.eleves_sans_aucune_note.length > 0 ? 'var(--warning-text)' : 'var(--ink-2)' }}>{preflight.eleves_sans_aucune_note.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Élèves sans note</div>
              </div>
            </div>

            {/* Détails matières non évaluées */}
            {preflight.matieres_non_evaluees.length > 0 && (
              <div style={{ padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Matières non évaluées (hors moyenne)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preflight.matieres_non_evaluees.map(m => (
                    <span key={m.id} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--paper)', borderRadius: 999, border: '1px solid var(--rule)' }}>
                      {m.nom_fr} <span style={{ color: 'var(--ink-4)' }}>· {m.filiere}{m.source === 'periode' ? ' · T' : ''}</span>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }}>
                  Affichées sur le bulletin avec mention "Non évaluée".
                </div>
              </div>
            )}

            {/* Matières sans notes */}
            {preflight.matieres_sans_notes.length > 0 && (
              <div style={{ padding: 12, background: 'var(--warning-soft)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning-text)', marginBottom: 6 }}>
                  ⚠️ Matières du programme sans aucune note saisie
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {preflight.matieres_sans_notes.map(m => (
                    <span key={m.id} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--paper)', borderRadius: 999, border: '1px solid var(--warning)', color: 'var(--warning-text)' }}>
                      {m.nom_fr} <span style={{ color: 'var(--ink-4)' }}>· {m.filiere}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Élèves sans note */}
            {preflight.eleves_sans_aucune_note.length > 0 && (
              <div style={{ padding: 12, background: 'var(--warning-soft)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning-text)', marginBottom: 6 }}>
                  ⚠️ Élèves sans aucune note ({preflight.eleves_sans_aucune_note.length})
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {preflight.eleves_sans_aucune_note.slice(0, 8).map(e => `${e.prenom_fr} ${e.nom_fr}`).join(' · ')}
                  {preflight.eleves_sans_aucune_note.length > 8 && ` … et ${preflight.eleves_sans_aucune_note.length - 8} autre(s)`}
                </div>
              </div>
            )}

            {/* Options */}
            <div style={{ padding: 12, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Options de calcul</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={inclureNonEvaluees} onChange={e => setInclureNonEvaluees(e.target.checked)} />
                Inclure quand même les matières non évaluées dans la moyenne
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={manquantesCommeZero} onChange={e => setManquantesCommeZero(e.target.checked)} />
                Compter les notes manquantes comme 0 (pénalise les élèves sans note)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button variant="secondary" onClick={() => setPreflight(null)} disabled={generating}>
                Annuler
              </Button>
              <Button onClick={confirmerGeneration} loading={generating}>
                Générer {preflight.total_eleves} bulletin(s)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Contenu modal détail ─────────────────────────────────────────────────────

function noteColor(valeur: number | string | null, noteMax: number | string): string {
  if (valeur === null) return 'var(--ink-4)';
  const ratio = Number(valeur) / Number(noteMax);
  if (ratio >= 0.7) return 'var(--success)';
  if (ratio >= 0.5) return 'var(--warning)';
  return 'var(--danger)';
}

function NotesTable({ notes, filiere, isAnnuel }: { notes: NoteDetail[]; filiere: string; isAnnuel: boolean }) {
  const { t } = useTranslation();
  if (notes.length === 0) return null;

  if (!isAnnuel) {
    return (
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'start' }}>Matière ({filiere})</th>
            <th style={{ textAlign: 'center', width: 56 }}>{t('bulletin.col_coeff')}</th>
            <th style={{ textAlign: 'center', width: 96 }}>Note / Max</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n, i) => {
            const nonEvaluee = n.evaluee === false;
            return (
            <tr key={i} style={nonEvaluee ? { opacity: 0.6 } : undefined}>
              <td style={{ color: 'var(--ink-2)' }}>
                {n.matiere.nom_fr}
                {nonEvaluee && (
                  <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--ink-4)', marginInlineStart: 6 }}>
                    · Non évaluée
                  </span>
                )}
              </td>
              <td style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>{n.matiere.coeff_defaut}</td>
              <td style={{ textAlign: 'center' }}>
                {nonEvaluee ? (
                  <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>
                ) : (
                  <>
                    <span style={{ color: noteColor(n.valeur, n.matiere.note_max), fontWeight: n.valeur !== null ? 600 : 400 }}>
                      {n.valeur !== null ? Number(n.valeur).toFixed(1) : '—'}
                    </span>
                    <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>/{Number(n.matiere.note_max)}</span>
                  </>
                )}
              </td>
            </tr>
            );
          })}
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
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ textAlign: 'start' }}>Matière ({filiere})</th>
          <th style={{ textAlign: 'center', width: 40 }}>{t('bulletin.col_coeff')}</th>
          {['T1', 'T2', 'T3'].map(t => (
            <th key={t} style={{ textAlign: 'center', width: 56 }}>{t}</th>
          ))}
          <th style={{ textAlign: 'center', width: 64 }}>Moy.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ color: 'var(--ink-2)' }}>{r.nom_fr}</td>
            <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>{r.coeff}</td>
            {r.vs.map((v, j) => (
              <td key={j} style={{ textAlign: 'center', fontSize: 12, color: noteColor(v, r.noteMax), fontWeight: v !== null ? 600 : 400 }}>
                {v !== null ? v.toFixed(1) : '—'}
              </td>
            ))}
            <td style={{ textAlign: 'center', fontSize: 12, color: noteColor(r.moy, r.noteMax), fontWeight: r.moy !== null ? 600 : 400 }}>
              {r.moy !== null ? r.moy.toFixed(2) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulletinDetailContent({
  detail, downloading, onDownload, onClose, api,
}: {
  detail: DetailBulletin;
  downloading: string | null;
  onDownload: (b: DetailBulletin) => void;
  onClose: () => void;
  api: ReturnType<typeof useApi>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';
  const noteMax = useNoteMax();
  const { user } = useAuthStore();
  const [obsFr, setObsFr] = useState(detail.observation_fr ?? '');
  const [obsProf, setObsProf] = useState(detail.observation_prof ?? '');
  const [savingObs, setSavingObs] = useState(false);
  const canEditObs = ['admin', 'directeur', 'professeur'].includes(user?.role ?? '');

  const saveObservations = async () => {
    setSavingObs(true);
    try {
      await api.patch(`/api/v1/bulletins/${detail.id}/observation`, {
        observation_fr: obsFr || undefined,
        observation_prof: obsProf || undefined,
      });
      toast.success(t('bulletin.obs_enregistrees'));
    } catch (err) {
      toast.error((err as Error).message || t('bulletin.obs_erreur'));
    } finally { setSavingObs(false); }
  };

  const moy = detail.moyenne !== null ? Number(detail.moyenne) : null;
  const isAnnuel = detail.periode === 0;
  const filieres: ('FR' | 'AR')[] = detail.filiere === 'COMBINE' ? ['FR', 'AR'] : [detail.filiere as 'FR' | 'AR'];
  const insc = detail.eleve.inscriptions?.[0];
  const classeNom = insc?.classe_fr?.nom_fr ?? insc?.classe_ar?.nom_fr ?? '—';

  const bandeauBg = moy === null ? 'var(--paper-2)' : moy >= noteMax * 0.7 ? 'var(--success-soft)' : moy >= noteMax * 0.5 ? 'var(--warning-soft)' : 'var(--danger-soft)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bandeau moyenne + rang */}
      <div style={{ borderRadius: 'var(--r-lg)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: bandeauBg }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 700, color: moyenneColor(moy, noteMax) }}>
            {moy !== null ? moy.toFixed(2) : 'N/A'}
            <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--ink-4)', marginInlineStart: 4 }}>/{noteMax}</span>
          </div>
          {detail.appreciation && (
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-2)', marginTop: 4 }}>{detail.appreciation}</div>
          )}
        </div>
        <div style={{ textAlign: 'end' }}>
          <RangMedal rang={detail.rang} />
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
            {isAnnuel ? t('bulletin.bulletin_annuel') : t('bulletin.trimestre_n', { n: detail.periode })}
          </div>
        </div>
      </div>

      {/* Infos élève */}
      <div className="grid-3" style={{ fontSize: 13 }}>
        <div style={{ padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 2 }}>{t('bulletin.col_eleve')}</div>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{detail.eleve.prenom_fr} {detail.eleve.nom_fr}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>{detail.eleve.matricule}</div>
        </div>
        <div style={{ padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 2 }}>{t('classe.titre')}</div>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{classeNom}</div>
          <div style={{ marginTop: 4 }}>{filiereChip(detail.filiere)}</div>
        </div>
        <div style={{ padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 2 }}>{t('classe.annee_scolaire')}</div>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{detail.annee_scolaire.libelle}</div>
          {detail.generated_at && (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
              {t('bulletin.genere_le', 'Généré le {{date}}', { date: new Date(detail.generated_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) })}
            </div>
          )}
        </div>
      </div>

      {/* Tables de notes par filière */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filieres.map(f => {
          const notes = detail.notesByFiliere[f] ?? [];
          const hdBg = f === 'FR' ? 'var(--indigo-soft)' : 'var(--sahel-soft)';
          const hdColor = f === 'FR' ? 'var(--indigo-ink)' : 'var(--sahel-ink)';
          return (
            <div key={f} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--rule)', background: hdBg, color: hdColor }}>
                {f === 'FR' ? t('classe.filiere_fr') : t('classe.filiere_ar')} — {notes.length} {t('matiere.titre').toLowerCase()}
              </div>
              <div style={{ padding: '0 16px 12px' }}>
                {notes.length === 0
                  ? <p style={{ padding: '16px 0', fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>{t('common.aucune_note')}</p>
                  : <NotesTable notes={notes} filiere={f} isAnnuel={isAnnuel} />
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Observations */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('bulletin.observations', 'Observations')}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>{t('bulletin.obs_directeur_fr', 'Observation du directeur')}</label>
            <textarea
              value={obsFr}
              onChange={e => setObsFr(e.target.value)}
              readOnly={!canEditObs}
              rows={2}
              maxLength={500}
              placeholder={canEditObs ? t('bulletin.obs_placeholder_fr') : t('bulletin.obs_aucune_fr')}
              className="input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>{t('bulletin.obs_professeur')}</label>
            <textarea
              value={obsProf}
              onChange={e => setObsProf(e.target.value)}
              readOnly={!canEditObs}
              rows={2}
              maxLength={500}
              placeholder={canEditObs ? t('bulletin.obs_placeholder_prof') : t('bulletin.obs_aucune_fr')}
              className="input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
          {canEditObs && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" onClick={saveObservations} loading={savingObs}>
                {t('bulletin.obs_enregistrer')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose}>{t('bulletin.fermer')}</Button>
        <Button onClick={() => onDownload(detail)} loading={downloading === detail.id}>
          {t('bulletin.telecharger_pdf')}
        </Button>
      </div>
    </div>
  );
}
