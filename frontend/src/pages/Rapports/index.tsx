import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { API_BASE } from '../../lib/api';

interface Classe { id: string; nom_fr: string; }
interface AnneeScolaire { id: string; libelle: string; active: boolean; }

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

type TypeRapport =
  | 'presences-eleves'
  | 'presences-professeurs'
  | 'resultats-classe'
  | 'bilan-financier'
  | 'grille-ief'
  | 'grille-performance'
  | 'performance-domaine'
  | 'releve-notes'
  | 'propositions-fin';

type FormatRapport = 'pdf' | 'csv';

interface RapportDef {
  type: TypeRapport;
  label: string;
  desc: string;
  icon: string;
  pdfOnly?: boolean;
  groupe?: string;
}

const RAPPORTS: RapportDef[] = [
  // ── Rapports de présence ──────────────────────────────────────────────────
  {
    type: 'presences-eleves',
    label: 'Présences élèves',
    desc: 'Absences et retards par classe et période',
    icon: 'M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    groupe: 'Présences',
  },
  {
    type: 'presences-professeurs',
    label: 'Présences professeurs',
    desc: 'Présences et heures travaillées par professeur',
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    groupe: 'Présences',
  },
  // ── Résultats académiques ─────────────────────────────────────────────────
  {
    type: 'resultats-classe',
    label: 'Résultats par classe',
    desc: 'Tableau récapitulatif des résultats et classement',
    icon: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
    groupe: 'Académique',
  },
  {
    type: 'performance-domaine',
    label: 'Performance par domaine',
    desc: 'Scores par domaine pédagogique (LC · Maths · ESVS · EPSA) — paysage',
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
    pdfOnly: true,
    groupe: 'Académique',
  },
  {
    type: 'releve-notes',
    label: 'Relevé de notes',
    desc: 'Tableau détaillé matière par matière avec statistiques — paysage',
    icon: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    groupe: 'Académique',
  },
  // ── Grilles IEF ───────────────────────────────────────────────────────────
  {
    type: 'grille-ief',
    label: 'Grille IEF',
    desc: 'Format inspection officielle — résultats globaux + par domaine + propositions',
    icon: 'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.05 15.96 0 13.5 0c-1.31 0-2.46.54-3.32 1.39L9 3.5 7.82 2.39C6.96.54 5.81 0 4.5 0 2.04 0 0 2.05 0 4.64c0 .48.11.92.18 1.36H0v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-7.5 0h-3V3.5l1.5-1.5 1.5 1.5V6z',
    pdfOnly: true,
    groupe: 'Grilles IEF',
  },
  {
    type: 'grille-performance',
    label: 'Grille de performance',
    desc: 'CI-CP / CE1-CE2 / CM1-CM2 — seuils de maîtrise par domaine, ventilation G/F/T',
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z',
    pdfOnly: true,
    groupe: 'Grilles IEF',
  },
  // ── Fin d'année ───────────────────────────────────────────────────────────
  {
    type: 'propositions-fin',
    label: 'Conseil de classe (fin d\'année)',
    desc: 'Comparatif T1/T2/T3 et moyennes annuelles pour décision de passage — paysage',
    icon: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
    pdfOnly: true,
    groupe: 'Fin d\'année',
  },
  // ── Finance ───────────────────────────────────────────────────────────────
  {
    type: 'bilan-financier',
    label: 'Bilan financier',
    desc: 'Encaissements, versements et solde mensuel',
    icon: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    groupe: 'Finance',
  },
];

const GROUPES = ['Présences', 'Académique', 'Grilles IEF', 'Fin d\'année', 'Finance'];

export function RapportsPage() {
  const api = useApi();
  const [selected, setSelected] = useState<TypeRapport>('presences-eleves');
  const [format, setFormat]     = useState<FormatRapport>('pdf');
  const [loading, setLoading]   = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml]       = useState<string | null>(null);

  const [classes, setClasses]   = useState<Classe[]>([]);
  const [annees, setAnnees]     = useState<AnneeScolaire[]>([]);
  const [classeId, setClasseId] = useState('');
  const [anneeId, setAnneeId]   = useState('');
  const [mois, setMois]         = useState(String(new Date().getMonth() + 1));
  const [anneeNum, setAnneeNum] = useState(String(new Date().getFullYear()));
  const [periode, setPeriode]   = useState('');

  useEffect(() => {
    Promise.allSettled([
      api.get<Classe[]>('/api/v1/classes'),
      api.get<AnneeScolaire[]>('/api/v1/annees-scolaires'),
    ]).then(([cls, annees]) => {
      if (cls.status === 'fulfilled')    setClasses(cls.value as Classe[]);
      if (annees.status === 'fulfilled') {
        const a = annees.value as AnneeScolaire[];
        setAnnees(a);
        const active = a.find(x => x.active);
        if (active) setAnneeId(active.id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = RAPPORTS.find(r => r.type === selected)!;

  const needsClasse  = ['presences-eleves','resultats-classe','grille-ief','grille-performance','performance-domaine','releve-notes','propositions-fin'].includes(selected);
  const needsAnnee   = ['presences-eleves','resultats-classe','grille-ief','grille-performance','performance-domaine','releve-notes','propositions-fin'].includes(selected);
  const needsMois    = ['presences-eleves','presences-professeurs','bilan-financier'].includes(selected);
  const needsPeriode = ['resultats-classe','grille-ief','grille-performance','performance-domaine','releve-notes'].includes(selected);
  const annuelOnly   = selected === 'propositions-fin';

  // Si PDF uniquement, forcer le format
  useEffect(() => {
    if (info?.pdfOnly) setFormat('pdf');
  }, [selected, info]);

  function buildQuery(includeFormat: boolean): URLSearchParams {
    const q = new URLSearchParams();
    if (includeFormat) q.set('format', format);
    if (needsClasse && classeId) q.set('classe_id', classeId);
    if (needsAnnee  && anneeId)  q.set('annee_scolaire_id', anneeId);
    if (needsMois) {
      if (mois)     q.set('mois', mois);
      if (anneeNum) q.set('annee', anneeNum);
    }
    if (needsPeriode && periode) q.set('periode', periode);
    return q;
  }

  function validateRequired(): boolean {
    if (needsClasse && !classeId) {
      toast.error('Veuillez sélectionner une classe');
      return false;
    }
    return true;
  }

  async function telecharger() {
    if (!validateRequired()) return;
    setLoading(true);
    try {
      const url = `${API_BASE}/api/v1/rapports/${selected}?${buildQuery(true).toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error ?? 'Erreur');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `rapport.${format}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename; a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('Rapport téléchargé');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apercu() {
    if (!validateRequired()) return;
    setPreviewLoading(true);
    try {
      const url = `${API_BASE}/api/v1/rapports/apercu/${selected}?${buildQuery(false).toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error ?? 'Erreur');
      }
      const data = await res.json() as { html: string };
      setPreviewHtml(data.html);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Administration</div>
          <h1 className="page-title">Rapports</h1>
          <p className="page-sub">Exporter les données en PDF ou CSV pour vos réunions et inspections</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
        {/* Liste des rapports groupés */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GROUPES.map(groupe => {
            const groupeRapports = RAPPORTS.filter(r => r.groupe === groupe);
            if (!groupeRapports.length) return null;
            return (
              <div key={groupe}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                  {groupe}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groupeRapports.map(r => (
                    <button
                      key={r.type}
                      onClick={() => setSelected(r.type)}
                      style={{
                        background: selected === r.type ? 'var(--terra-soft)' : 'var(--card)',
                        border: `1px solid ${selected === r.type ? 'var(--terra)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-md)',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        textAlign: 'start',
                        transition: 'all .15s',
                      }}
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill={selected === r.type ? 'var(--terra)' : 'var(--ink-3)'} style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d={r.icon} />
                      </svg>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: selected === r.type ? 'var(--terra-ink)' : 'var(--ink-1)' }}>
                          {r.label}
                          {r.pdfOnly && <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--ink-5)', color: 'var(--ink-2)', borderRadius: 3, padding: '1px 4px' }}>PDF</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3 }}>{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Panneau de filtres et export */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{info.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {needsClasse && (
              <Select
                label="Classe"
                value={classeId}
                onChange={e => setClasseId(e.target.value)}
                options={[
                  { value: '', label: 'Toutes les classes' },
                  ...classes.map(c => ({ value: c.id, label: c.nom_fr })),
                ]}
              />
            )}

            {needsAnnee && (
              <Select
                label="Année scolaire"
                value={anneeId}
                onChange={e => setAnneeId(e.target.value)}
                options={[
                  { value: '', label: 'Toutes' },
                  ...annees.map(a => ({ value: a.id, label: a.libelle + (a.active ? ' (active)' : '') })),
                ]}
              />
            )}

            {needsMois && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Select
                  label="Mois"
                  value={mois}
                  onChange={e => setMois(e.target.value)}
                  options={MOIS_LABELS.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
                <Select
                  label="Année"
                  value={anneeNum}
                  onChange={e => setAnneeNum(e.target.value)}
                  options={Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return { value: String(y), label: String(y) };
                  })}
                />
              </div>
            )}

            {needsPeriode && (
              <Select
                label="Période"
                value={periode}
                onChange={e => setPeriode(e.target.value)}
                options={[
                  { value: '', label: annuelOnly ? 'Annuel (obligatoire)' : 'Annuel (toutes périodes)' },
                  { value: '1', label: '1er Trimestre' },
                  { value: '2', label: '2ème Trimestre' },
                  { value: '3', label: '3ème Trimestre' },
                ]}
              />
            )}

            {annuelOnly && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--card-alt)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                Ce rapport agrège les 3 trimestres pour le conseil de classe de fin d'année.
              </div>
            )}

            {/* Format (masqué si PDF uniquement) */}
            {!info.pdfOnly && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>Format</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['pdf', 'csv'] as FormatRapport[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--r-sm)',
                        border: `1px solid ${format === f ? 'var(--terra)' : 'var(--border)'}`,
                        background: format === f ? 'var(--terra)' : 'transparent',
                        color: format === f ? '#fff' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button
                variant="secondary"
                onClick={apercu}
                loading={previewLoading}
                disabled={loading}
                style={{ flex: 1 }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
                Aperçu
              </Button>
              <Button onClick={telecharger} loading={loading} disabled={previewLoading} style={{ flex: 1 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                Télécharger
              </Button>
            </div>
          </div>
        </div>
      </div>

      {previewHtml && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPreviewHtml(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 'min(1100px, 100%)', height: 'min(90vh, 1200px)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                Aperçu — {info.label}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setPreviewHtml(null); telecharger(); }}
                  style={{ background: 'var(--terra)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600 }}
                >
                  Télécharger ({(info.pdfOnly ? 'pdf' : format).toUpperCase()})
                </button>
                <button
                  onClick={() => setPreviewHtml(null)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}
                >
                  ✕ Fermer
                </button>
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="Aperçu rapport"
              sandbox="allow-same-origin"
              style={{ flex: 1, width: '100%', border: 'none', borderRadius: 8, background: 'var(--card)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
            />
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0, textAlign: 'center' }}>
              Aperçu HTML — rendu très proche du PDF final.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
