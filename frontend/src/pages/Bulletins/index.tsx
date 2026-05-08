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
  observation_fr: string | null;
  observation_ar: string | null;
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

function moyenneVariant(m: number | null): 'success' | 'error' | 'warning' | 'neutral' {
  if (m === null) return 'neutral';
  if (m >= 14) return 'success';
  if (m >= 10) return 'warning';
  return 'error';
}

function moyenneColor(m: number | null): string {
  if (m === null) return 'var(--text-4)';
  if (m >= 14) return 'var(--success)';
  if (m >= 10) return 'var(--warning)';
  return 'var(--danger)';
}

function filiereChip(f: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    FR:      { bg: '#dbeafe', color: '#1d4ed8', label: 'FR' },
    AR:      { bg: '#fef3c7', color: '#b45309', label: 'AR' },
    COMBINE: { bg: '#d1fae5', color: '#065f46', label: 'FR+AR' },
  };
  const s = map[f] ?? { bg: 'var(--bg-2)', color: 'var(--text-3)', label: f };
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function RangMedal({ rang }: { rang: number | null }) {
  if (rang === null) return <span style={{ color: 'var(--text-4)' }}>—</span>;
  if (rang === 1) return <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 15 }}>🥇 1er</span>;
  if (rang === 2) return <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>🥈 2ème</span>;
  if (rang === 3) return <span style={{ color: '#b45309', fontWeight: 700 }}>🥉 3ème</span>;
  return <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{rang}ème</span>;
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
    <div className="grid-4" style={{ marginBottom: 16 }}>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: moyenneColor(moyClasse) }}>
          {moyClasse.toFixed(2)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Moyenne classe</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{bulletins.length}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Élèves</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
          {avecMoy.length > 0 ? Math.round((reussite / avecMoy.length) * 100) : 0}%
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Taux de réussite</div>
      </div>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meilleur ? `${meilleur.eleve.prenom_fr} ${meilleur.eleve.nom_fr}` : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>1er de classe</div>
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
    <>
      <PageHeader title={t('bulletin.titre')} />

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
          <Button onClick={generer} loading={generating} disabled={!classeId}>
            {t('actions.generer')}
          </Button>
          {bulletins.length > 0 && (
            <Button variant="secondary" onClick={downloadAll} loading={downloadingClasse} disabled={!classeId}>
              ⬇ {t('bulletin.telecharger_tous')} ({bulletins.length})
            </Button>
          )}

          {bulletins.length > 0 && (
            <div style={{ marginInlineStart: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <button
                onClick={() => setView('cards')}
                style={{
                  padding: '4px 12px', fontSize: 13,
                  background: view === 'cards' ? 'var(--text)' : 'transparent',
                  color: view === 'cards' ? 'var(--bg)' : 'var(--text-3)',
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
                  background: view === 'table' ? 'var(--text)' : 'transparent',
                  color: view === 'table' ? 'var(--bg)' : 'var(--text-3)',
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
      {bulletins.length > 0 && <ClasseStats bulletins={bulletins} />}

      {/* Vue cartes */}
      {bulletins.length > 0 && view === 'cards' && (
        <div className="grid-4">
          {sortedBulletins.map(b => {
            const moy = b.moyenne !== null ? Number(b.moyenne) : null;
            const barColor = moy === null ? 'var(--border)' : moy >= 14 ? 'var(--success)' : moy >= 10 ? 'var(--warning)' : 'var(--danger)';
            return (
              <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Barre de couleur selon la moyenne */}
                <div style={{ height: 6, background: barColor }} />

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* En-tête élève */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, lineHeight: 1.3 }}>
                        {b.eleve.prenom_fr} {b.eleve.nom_fr}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-4)', marginTop: 2 }}>{b.eleve.matricule}</div>
                    </div>
                    <RangMedal rang={b.rang} />
                  </div>

                  {/* Badges filière + période */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {filiereChip(b.filiere)}
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      {b.periode === 0 ? 'Annuel' : `Trimestre ${b.periode}`}
                    </span>
                  </div>

                  {/* Moyenne */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: moyenneColor(moy) }}>
                        {moy !== null ? moy.toFixed(2) : 'N/A'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>/20</div>
                    </div>
                    {b.appreciation && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'end', maxWidth: 120, lineHeight: 1.4, fontStyle: 'italic' }}>
                        {b.appreciation}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => openDetail(b)}
                      style={{ flex: 1, fontSize: 12, textAlign: 'center', padding: '6px 0', borderRadius: 'var(--r-md)', color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Détail
                    </button>
                    <button
                      onClick={() => downloadPdf(b)}
                      disabled={downloading === b.id}
                      style={{ flex: 1, fontSize: 12, textAlign: 'center', padding: '6px 0', borderRadius: 'var(--r-md)', background: 'var(--text)', color: 'var(--bg)', border: 'none', cursor: 'pointer', fontWeight: 500, opacity: downloading === b.id ? 0.5 : 1 }}
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
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{b.eleve.prenom_fr} {b.eleve.nom_fr}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{b.eleve.matricule}</td>
                    <td>{filiereChip(b.filiere)}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      {b.periode === 0 ? 'Annuel' : `T${b.periode}`}
                    </td>
                    <td>
                      <Badge
                        label={moy !== null ? `${moy.toFixed(2)}/20` : 'N/A'}
                        variant={moyenneVariant(moy)}
                      />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          <p style={{ color: 'var(--text-3)' }}>{t('bulletin.aucun')}</p>
          <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
            Sélectionnez une année scolaire et cliquez sur Charger
          </p>
        </div>
      )}

      {/* Modal détail */}
      <Modal isOpen={!!detail || loadingDetail} onClose={() => setDetail(null)} title={t('bulletin.detail')} size="lg">
        {loadingDetail && (
          <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>Chargement…</div>
        )}
        {detail && !loadingDetail && <BulletinDetailContent detail={detail} downloading={downloading} onDownload={downloadPdf} onClose={() => setDetail(null)} api={api} />}
      </Modal>
    </>
  );
}

// ─── Contenu modal détail ─────────────────────────────────────────────────────

function noteColor(valeur: number | string | null, noteMax: number | string): string {
  if (valeur === null) return 'var(--text-4)';
  const ratio = Number(valeur) / Number(noteMax);
  if (ratio >= 0.7) return 'var(--success)';
  if (ratio >= 0.5) return 'var(--warning)';
  return 'var(--danger)';
}

function NotesTable({ notes, filiere, isAnnuel }: { notes: NoteDetail[]; filiere: string; isAnnuel: boolean }) {
  if (notes.length === 0) return null;

  if (!isAnnuel) {
    return (
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'start' }}>Matière ({filiere})</th>
            <th style={{ textAlign: 'center', width: 56 }}>Coeff</th>
            <th style={{ textAlign: 'center', width: 96 }}>Note / Max</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text-2)' }}>{n.matiere.nom_fr}</td>
              <td style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>{n.matiere.coeff_defaut}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ color: noteColor(n.valeur, n.matiere.note_max), fontWeight: n.valeur !== null ? 600 : 400 }}>
                  {n.valeur !== null ? Number(n.valeur).toFixed(1) : '—'}
                </span>
                <span style={{ color: 'var(--text-4)', fontSize: 12 }}>/{Number(n.matiere.note_max)}</span>
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
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ textAlign: 'start' }}>Matière ({filiere})</th>
          <th style={{ textAlign: 'center', width: 40 }}>Coeff</th>
          {['T1', 'T2', 'T3'].map(t => (
            <th key={t} style={{ textAlign: 'center', width: 56 }}>{t}</th>
          ))}
          <th style={{ textAlign: 'center', width: 64 }}>Moy.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ color: 'var(--text-2)' }}>{r.nom_fr}</td>
            <td style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>{r.coeff}</td>
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
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [obsFr, setObsFr] = useState(detail.observation_fr ?? '');
  const [obsAr, setObsAr] = useState(detail.observation_ar ?? '');
  const [obsProf, setObsProf] = useState(detail.observation_prof ?? '');
  const [savingObs, setSavingObs] = useState(false);
  const canEditObs = ['admin', 'directeur', 'professeur'].includes(user?.role ?? '');

  const saveObservations = async () => {
    setSavingObs(true);
    try {
      await api.patch(`/api/v1/bulletins/${detail.id}/observation`, {
        observation_fr: obsFr || undefined,
        observation_ar: obsAr || undefined,
        observation_prof: obsProf || undefined,
      });
      toast.success('Observations enregistrées');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSavingObs(false); }
  };

  const moy = detail.moyenne !== null ? Number(detail.moyenne) : null;
  const isAnnuel = detail.periode === 0;
  const filieres: ('FR' | 'AR')[] = detail.filiere === 'COMBINE' ? ['FR', 'AR'] : [detail.filiere as 'FR' | 'AR'];
  const insc = detail.eleve.inscriptions?.[0];
  const classeNom = insc?.classe_fr?.nom_fr ?? insc?.classe_ar?.nom_fr ?? '—';

  const bandeauBg = moy === null ? 'var(--bg-2)' : moy >= 14 ? '#d1fae5' : moy >= 10 ? '#fef3c7' : '#fee2e2';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bandeau moyenne + rang */}
      <div style={{ borderRadius: 'var(--r-lg)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: bandeauBg }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 700, color: moyenneColor(moy) }}>
            {moy !== null ? moy.toFixed(2) : 'N/A'}
            <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-4)', marginInlineStart: 4 }}>/20</span>
          </div>
          {detail.appreciation && (
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-2)', marginTop: 4 }}>{detail.appreciation}</div>
          )}
        </div>
        <div style={{ textAlign: 'end' }}>
          <RangMedal rang={detail.rang} />
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
            {isAnnuel ? 'Bulletin Annuel' : `Trimestre ${detail.periode}`}
          </div>
        </div>
      </div>

      {/* Infos élève */}
      <div className="grid-3" style={{ fontSize: 13 }}>
        <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Élève</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{detail.eleve.prenom_fr} {detail.eleve.nom_fr}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-4)' }}>{detail.eleve.matricule}</div>
        </div>
        <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Classe</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{classeNom}</div>
          <div style={{ marginTop: 4 }}>{filiereChip(detail.filiere)}</div>
        </div>
        <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Année scolaire</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{detail.annee_scolaire.libelle}</div>
          {detail.generated_at && (
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
              Généré le {new Date(detail.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Tables de notes par filière */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filieres.map(f => {
          const notes = detail.notesByFiliere[f] ?? [];
          const hdBg = f === 'FR' ? '#eff6ff' : '#fffbeb';
          const hdColor = f === 'FR' ? '#1d4ed8' : '#b45309';
          return (
            <div key={f} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)', background: hdBg, color: hdColor }}>
                {f === 'FR' ? t('classe.filiere_fr') : t('classe.filiere_ar')} — {notes.length} {t('matiere.titre').toLowerCase()}
              </div>
              <div style={{ padding: '0 16px 12px' }}>
                {notes.length === 0
                  ? <p style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-4)', textAlign: 'center' }}>{t('common.aucune_note')}</p>
                  : <NotesTable notes={notes} filiere={f} isAnnuel={isAnnuel} />
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Observations */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Observations
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>Observation du directeur (Français)</label>
            <textarea
              value={obsFr}
              onChange={e => setObsFr(e.target.value)}
              readOnly={!canEditObs}
              rows={2}
              maxLength={500}
              placeholder={canEditObs ? "Saisir une observation…" : "Aucune observation"}
              className="input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>ملاحظة المدير (العربية)</label>
            <textarea
              value={obsAr}
              onChange={e => setObsAr(e.target.value)}
              readOnly={!canEditObs}
              rows={2}
              maxLength={500}
              dir="rtl"
              placeholder={canEditObs ? "أدخل ملاحظة…" : "لا توجد ملاحظة"}
              className="input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>Observation du professeur</label>
            <textarea
              value={obsProf}
              onChange={e => setObsProf(e.target.value)}
              readOnly={!canEditObs}
              rows={2}
              maxLength={500}
              placeholder={canEditObs ? "Saisir une observation du professeur…" : "Aucune observation"}
              className="input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
          {canEditObs && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" onClick={saveObservations} loading={savingObs}>
                Enregistrer les observations
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
        <Button onClick={() => onDownload(detail)} loading={downloading === detail.id}>
          ⬇ Télécharger PDF
        </Button>
      </div>
    </div>
  );
}
