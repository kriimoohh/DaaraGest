import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { API_BASE } from '../../lib/api';

interface Classe { id: string; nom_fr: string; }
interface AnneeScolaire { id: string; libelle: string; active: boolean; }

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

type TypeRapport = 'presences-eleves' | 'presences-professeurs' | 'resultats-classe' | 'bilan-financier';
type FormatRapport = 'pdf' | 'csv';

const RAPPORTS: { type: TypeRapport; label: string; desc: string; icon: string }[] = [
  { type: 'presences-eleves',      label: 'Présences élèves',      desc: 'Absences et retards par classe et période', icon: 'M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  { type: 'presences-professeurs', label: 'Présences professeurs', desc: 'Présences et heures travaillées par professeur', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { type: 'resultats-classe',      label: 'Résultats par classe',  desc: 'Tableau récapitulatif des résultats et classement', icon: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z' },
  { type: 'bilan-financier',       label: 'Bilan financier',       desc: 'Encaissements, versements et solde mensuel', icon: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
];

export function RapportsPage() {
  const api = useApi();
  const [selected, setSelected] = useState<TypeRapport>('presences-eleves');
  const [format, setFormat]     = useState<FormatRapport>('pdf');
  const [loading, setLoading]   = useState(false);

  const [classes, setClasses]         = useState<Classe[]>([]);
  const [annees, setAnnees]           = useState<AnneeScolaire[]>([]);
  const [classeId, setClasseId]       = useState('');
  const [anneeId, setAnneeId]         = useState('');
  const [mois, setMois]               = useState(String(new Date().getMonth() + 1));
  const [anneeNum, setAnneeNum]       = useState(String(new Date().getFullYear()));
  const [periode, setPeriode]         = useState('');

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

  function buildUrl(): string {
    const base = `${API_BASE}/api/v1/rapports/${selected}`;
    const q = new URLSearchParams({ format });
    if (selected === 'presences-eleves') {
      if (classeId) q.set('classe_id', classeId);
      if (anneeId)  q.set('annee_scolaire_id', anneeId);
      if (mois)     q.set('mois', mois);
      if (anneeNum) q.set('annee', anneeNum);
    } else if (selected === 'presences-professeurs') {
      if (mois)     q.set('mois', mois);
      if (anneeNum) q.set('annee', anneeNum);
    } else if (selected === 'resultats-classe') {
      if (classeId) q.set('classe_id', classeId);
      if (anneeId)  q.set('annee_scolaire_id', anneeId);
      if (periode)  q.set('periode', periode);
    } else if (selected === 'bilan-financier') {
      if (mois)     q.set('mois', mois);
      if (anneeNum) q.set('annee', anneeNum);
    }
    return `${base}?${q.toString()}`;
  }

  async function telecharger() {
    if (selected === 'resultats-classe' && !classeId) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildUrl(), { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error ?? 'Erreur');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `rapport.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success('Rapport téléchargé');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const info = RAPPORTS.find(r => r.type === selected)!;
  const needsClasse  = selected === 'presences-eleves' || selected === 'resultats-classe';
  const needsAnnee   = selected === 'presences-eleves' || selected === 'resultats-classe';
  const needsMois    = selected !== 'resultats-classe';
  const needsPeriode = selected === 'resultats-classe';

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
        {/* Sélection du rapport */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Type de rapport
          </div>
          {RAPPORTS.map(r => (
            <button
              key={r.type}
              onClick={() => setSelected(r.type)}
              style={{
                background: selected === r.type ? 'var(--terra-soft)' : 'var(--card)',
                border: `1px solid ${selected === r.type ? 'var(--terra)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                textAlign: 'start',
                transition: 'all .15s',
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill={selected === r.type ? 'var(--terra)' : 'var(--ink-3)'} style={{ flexShrink: 0, marginTop: 1 }}>
                <path d={r.icon} />
              </svg>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: selected === r.type ? 'var(--terra-ink)' : 'var(--ink-1)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{r.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Filtres et export */}
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
                  { value: '', label: 'Annuel' },
                  { value: '1', label: '1er Trimestre' },
                  { value: '2', label: '2ème Trimestre' },
                  { value: '3', label: '3ème Trimestre' },
                ]}
              />
            )}

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
                      color: format === f ? '#fff' : 'var(--ink-2)',
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

            <Button onClick={telecharger} loading={loading} style={{ marginTop: 4 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              Télécharger le rapport
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
