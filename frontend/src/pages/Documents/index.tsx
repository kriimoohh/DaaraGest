import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { API_BASE } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type TypeDocument =
  | 'CERTIFICAT_SCOLARITE' | 'ATTESTATION_INSCRIPTION' | 'CONVOCATION_EXAMEN'
  | 'FICHE_TRANSFERT' | 'EMPLOI_DU_TEMPS_ELEVE' | 'RELEVE_NOTES'
  | 'CERTIFICAT_BONNE_CONDUITE' | 'FICHE_RENSEIGNEMENTS' | 'ATTESTATION_RESULTATS'
  | 'LISTE_CLASSE' | 'ATTESTATION_TRAVAIL' | 'ORDRE_MISSION' | 'FICHE_PAIE' | 'PLANNING_COURS'
  | 'CARTE_ELEVE' | 'CARTE_PROFESSEUR';

const CARD_TYPES = new Set<TypeDocument>(['CARTE_ELEVE', 'CARTE_PROFESSEUR']);

type DestType = 'eleve' | 'professeur' | 'classe';

interface TemplateInfo { type: TypeDocument; nom: string; has_custom: boolean }
interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string }
interface Professeur { id: string; nom_fr: string; prenom_fr?: string; identifiant: string }
interface Classe { id: string; nom_fr: string; filiere: string }
interface AnneeScolaire { id: string; libelle: string; active: boolean }
interface HistoriqueItem {
  id: string; type: TypeDocument; destinataire_type: string; destinataire_id: string;
  genere_le: string; parametres: Record<string, string> | null;
  utilisateur: { nom: string; prenom: string } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LABELS: Record<TypeDocument, string> = {
  CERTIFICAT_SCOLARITE:     'Certificat de scolarité',
  ATTESTATION_INSCRIPTION:  "Attestation d'inscription",
  CONVOCATION_EXAMEN:       'Convocation aux examens',
  FICHE_TRANSFERT:          'Fiche de transfert',
  EMPLOI_DU_TEMPS_ELEVE:    "Emploi du temps (élève)",
  RELEVE_NOTES:             'Relevé de notes',
  CERTIFICAT_BONNE_CONDUITE:'Certificat de bonne conduite',
  FICHE_RENSEIGNEMENTS:     'Fiche de renseignements',
  ATTESTATION_RESULTATS:    'Attestation de résultats',
  LISTE_CLASSE:             'Liste de classe',
  ATTESTATION_TRAVAIL:      'Attestation de travail',
  ORDRE_MISSION:            'Ordre de mission',
  FICHE_PAIE:               'Fiche de paie',
  PLANNING_COURS:           'Planning de cours',
  CARTE_ELEVE:              "Carte scolaire élève (CR80)",
  CARTE_PROFESSEUR:         'Carte professeur (CR80)',
};

const DEST_TYPE: Record<TypeDocument, DestType> = {
  CERTIFICAT_SCOLARITE:     'eleve',
  ATTESTATION_INSCRIPTION:  'eleve',
  CONVOCATION_EXAMEN:       'eleve',
  FICHE_TRANSFERT:          'eleve',
  EMPLOI_DU_TEMPS_ELEVE:    'eleve',
  RELEVE_NOTES:             'eleve',
  CERTIFICAT_BONNE_CONDUITE:'eleve',
  FICHE_RENSEIGNEMENTS:     'eleve',
  ATTESTATION_RESULTATS:    'eleve',
  LISTE_CLASSE:             'classe',
  ATTESTATION_TRAVAIL:      'professeur',
  ORDRE_MISSION:            'professeur',
  FICHE_PAIE:               'professeur',
  PLANNING_COURS:           'professeur',
  CARTE_ELEVE:              'eleve',
  CARTE_PROFESSEUR:         'professeur',
};

const GROUPS: { label: string; icon: string; types: TypeDocument[] }[] = [
  {
    label: 'Documents élèves',
    icon: 'M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    types: ['CERTIFICAT_SCOLARITE','ATTESTATION_INSCRIPTION','CONVOCATION_EXAMEN','FICHE_TRANSFERT','EMPLOI_DU_TEMPS_ELEVE','RELEVE_NOTES','CERTIFICAT_BONNE_CONDUITE','FICHE_RENSEIGNEMENTS','ATTESTATION_RESULTATS'],
  },
  {
    label: 'Documents de classe',
    icon: 'M12 3L1 9l4 2.18V15c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.82L21 9 12 3z',
    types: ['LISTE_CLASSE'],
  },
  {
    label: 'Documents professeurs',
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    types: ['ATTESTATION_TRAVAIL','ORDRE_MISSION','FICHE_PAIE','PLANNING_COURS'],
  },
  {
    label: "Cartes d'identité (CR80)",
    icon: 'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
    types: ['CARTE_ELEVE','CARTE_PROFESSEUR'],
  },
];

const EXTRA_PARAMS: Record<TypeDocument, { key: string; label: string; type: 'text' | 'date' | 'number' | 'textarea' }[]> = {
  CONVOCATION_EXAMEN:     [{ key: 'DATE_EXAMEN', label: "Date de l'examen", type: 'date' }, { key: 'HEURE_CONVOCATION', label: 'Heure de convocation', type: 'text' }, { key: 'SALLE', label: 'Salle', type: 'text' }],
  FICHE_TRANSFERT:        [{ key: 'ETABLISSEMENT_DESTINATION', label: 'Établissement de destination', type: 'text' }, { key: 'MOTIF', label: 'Motif du transfert', type: 'text' }],
  ORDRE_MISSION:          [{ key: 'DESTINATION', label: 'Destination', type: 'text' }, { key: 'DATE_DEBUT_MISSION', label: 'Date de début', type: 'date' }, { key: 'DATE_FIN_MISSION', label: 'Date de fin', type: 'date' }, { key: 'OBJET_MISSION', label: 'Objet de la mission', type: 'textarea' }],
  FICHE_PAIE:             [{ key: 'MOIS_ANNEE', label: 'Mois / Année (ex: Mai 2026)', type: 'text' }, { key: 'SALAIRE_BRUT', label: 'Salaire brut (FCFA)', type: 'number' }, { key: 'RETENUES', label: 'Retenues (FCFA)', type: 'number' }, { key: 'NET_A_PAYER', label: 'Net à payer (FCFA)', type: 'number' }],
  ATTESTATION_RESULTATS:  [{ key: 'MOYENNE_ANNUELLE', label: 'Moyenne annuelle /20', type: 'number' }],
  CERTIFICAT_SCOLARITE: [], ATTESTATION_INSCRIPTION: [], EMPLOI_DU_TEMPS_ELEVE: [],
  RELEVE_NOTES: [], CERTIFICAT_BONNE_CONDUITE: [], FICHE_RENSEIGNEMENTS: [],
  LISTE_CLASSE: [], ATTESTATION_TRAVAIL: [], PLANNING_COURS: [],
  CARTE_ELEVE: [], CARTE_PROFESSEUR: [],
};

// ── Variables disponibles pour l'éditeur ──────────────────────────────────────

const VAR_GROUPS: { label: string; vars: { key: string; desc: string }[] }[] = [
  {
    label: 'Établissement',
    vars: [
      { key: 'NOM_ETABLISSEMENT',   desc: "Nom de l'établissement" },
      { key: 'ADRESSE_ETABLISSEMENT', desc: 'Adresse' },
      { key: 'TEL_ETABLISSEMENT',   desc: 'Téléphone' },
      { key: 'ANNEE_SCOLAIRE',      desc: 'Année scolaire active' },
      { key: 'DATE_AUJOURD_HUI',    desc: "Date du jour" },
      { key: 'REF_DOCUMENT',        desc: 'Référence auto-générée' },
      { key: 'LOGO',                desc: 'Logo (balise img)' },
      { key: 'SIGNATURE',           desc: 'Signature directeur (img)' },
      { key: 'CACHET',              desc: 'Cachet établissement (img)' },
    ],
  },
  {
    label: 'Élève',
    vars: [
      { key: 'NOM_PRENOM_ELEVE',  desc: 'Prénom + Nom' },
      { key: 'NOM_ELEVE',         desc: 'Nom' },
      { key: 'PRENOM_ELEVE',      desc: 'Prénom' },
      { key: 'MATRICULE',         desc: 'Matricule' },
      { key: 'DATE_NAISSANCE',    desc: 'Date de naissance' },
      { key: 'SEXE',              desc: 'Masculin / Féminin' },
      { key: 'CLASSE_FR',         desc: 'Classe filière française' },
      { key: 'CLASSE_AR',         desc: 'Classe filière arabe' },
      { key: 'FILIERE',           desc: 'Filière' },
    ],
  },
  {
    label: 'Professeur',
    vars: [
      { key: 'NOM_PRENOM_PROF',  desc: 'Prénom + Nom' },
      { key: 'NOM_PROF',         desc: 'Nom' },
      { key: 'PRENOM_PROF',      desc: 'Prénom' },
      { key: 'SPECIALITE',       desc: 'Spécialité' },
      { key: 'TYPE_CONTRAT',     desc: 'Type de contrat' },
      { key: 'DATE_EMBAUCHE',    desc: "Date d'embauche" },
    ],
  },
  {
    label: 'Paramètres additionnels',
    vars: [
      { key: 'DATE_EXAMEN',               desc: "Date de l'examen" },
      { key: 'HEURE_CONVOCATION',         desc: 'Heure de convocation' },
      { key: 'SALLE',                     desc: 'Salle' },
      { key: 'ETABLISSEMENT_DESTINATION', desc: 'Établissement de destination' },
      { key: 'MOTIF',                     desc: 'Motif' },
      { key: 'DESTINATION',               desc: 'Destination mission' },
      { key: 'DATE_DEBUT_MISSION',        desc: 'Début de mission' },
      { key: 'DATE_FIN_MISSION',          desc: 'Fin de mission' },
      { key: 'OBJET_MISSION',             desc: 'Objet de la mission' },
      { key: 'MOIS_ANNEE',                desc: 'Mois et année (paie)' },
      { key: 'SALAIRE_BRUT',              desc: 'Salaire brut' },
      { key: 'RETENUES',                  desc: 'Retenues' },
      { key: 'NET_A_PAYER',               desc: 'Net à payer' },
      { key: 'MOYENNE_ANNUELLE',          desc: 'Moyenne annuelle' },
    ],
  },
  {
    label: 'Tableaux (auto-générés)',
    vars: [
      { key: 'TABLEAU_NOTES',            desc: 'Relevé de notes par période' },
      { key: 'TABLEAU_ELEVES',           desc: 'Liste numérotée des élèves' },
      { key: 'TABLEAU_EMPLOI_DU_TEMPS',  desc: "Grille horaire de l'élève" },
      { key: 'TABLEAU_PLANNING',         desc: 'Planning hebdo du professeur' },
    ],
  },
  {
    label: "Cartes d'identité (auto-générés)",
    vars: [
      { key: 'PHOTO_ELEVE',   desc: "Photo de l'élève (balise img, obligatoire)" },
      { key: 'QR_CODE_ELEVE', desc: "QR code d'identification élève (img)" },
      { key: 'PHOTO_PROF',    desc: "Photo du professeur (balise img, obligatoire)" },
      { key: 'QR_CODE_PROF',  desc: 'QR code professeur (img, verso carte)' },
    ],
  },
];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── TypeList sidebar (shared between tabs) ────────────────────────────────────

function TypeList({ selected, onSelect, templates, activeColor = false }: {
  selected: TypeDocument | null;
  onSelect: (t: TypeDocument) => void;
  templates: TemplateInfo[];
  activeColor?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ padding: '10px 14px', background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="var(--ink-3)"><path d={group.icon} /></svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</span>
          </div>
          {group.types.map(type => {
            const tpl = templates.find(t => t.type === type);
            const active = selected === type;
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--rule)',
                  background: active ? (activeColor ? '#eff6ff' : 'var(--terra-soft)') : 'transparent',
                  cursor: 'pointer', textAlign: 'start',
                }}
              >
                <span style={{ fontSize: 13, color: active ? (activeColor ? '#1d4ed8' : 'var(--terra-ink)') : 'var(--ink)', fontWeight: active ? 600 : 400 }}>
                  {LABELS[type]}
                </span>
                {tpl?.has_custom && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d1fae5', color: '#065f46', flexShrink: 0 }}>✓ perso</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Template editor ───────────────────────────────────────────────────────────

function TemplateEditor({ type, templates, onSaved }: {
  type: TypeDocument;
  templates: TemplateInfo[];
  onSaved: () => void;
}) {
  const api = useApi();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [html, setHtml]         = useState('');
  const [dirty, setDirty]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const hasCustom = templates.find(t => t.type === type)?.has_custom ?? false;

  useEffect(() => {
    setLoading(true);
    setDirty(false);
    api.get<{ contenu_html: string }>(`/api/v1/documents/${type}`)
      .then(d => setHtml(d.contenu_html))
      .catch(() => toast.error('Impossible de charger le template'))
      .finally(() => setLoading(false));
  }, [type]);

  const insertVar = (varKey: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const inserted = `{{${varKey}}}`;
    const newVal = html.substring(0, start) + inserted + html.substring(end);
    setHtml(newVal);
    setDirty(true);
    setTimeout(() => {
      ta.focus();
      const pos = start + inserted.length;
      ta.selectionStart = pos;
      ta.selectionEnd   = pos;
    }, 0);
  };

  const handlePreview = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/documents/${type}`, { nom: LABELS[type], contenu_html: html });
      toast.success('Template sauvegardé');
      setDirty(false);
      onSaved();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm('Supprimer le template personnalisé et revenir au modèle par défaut ?')) return;
    setResetting(true);
    try {
      await api.delete(`/api/v1/documents/${type}/reset`);
      toast.success('Template réinitialisé');
      setDirty(false);
      onSaved();
      // Reload default
      const d = await api.get<{ contenu_html: string }>(`/api/v1/documents/${type}`);
      setHtml(d.contenu_html);
    } catch (err) { toast.error((err as Error).message); }
    finally { setResetting(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Chargement du template…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--rule)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{LABELS[type]}</span>
          {dirty && <span style={{ fontSize: 11, marginLeft: 8, color: '#d97706' }}>● Non sauvegardé</span>}
          {hasCustom && !dirty && <span style={{ fontSize: 11, marginLeft: 8, padding: '1px 7px', borderRadius: 4, background: '#d1fae5', color: '#065f46' }}>✓ Template personnalisé</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handlePreview} title="Aperçu dans un nouvel onglet">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5 }}>
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          </svg>
          Aperçu
        </button>
        {hasCustom && (
          <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={resetting} style={{ color: '#dc2626' }}>
            Réinitialiser
          </button>
        )}
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          Sauvegarder
        </Button>
      </div>

      {/* Editor body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', flex: 1, minHeight: 0 }}>
        {/* HTML textarea */}
        <div style={{ borderRight: '1px solid var(--rule)', position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={html}
            onChange={e => { setHtml(e.target.value); setDirty(true); }}
            spellCheck={false}
            style={{
              width: '100%', height: '100%', minHeight: 500,
              padding: '14px 16px', border: 'none', outline: 'none', resize: 'none',
              fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
              fontSize: 12, lineHeight: 1.6,
              background: 'var(--paper)', color: 'var(--ink)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Variables panel */}
        <div style={{ overflowY: 'auto', maxHeight: 560 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--rule)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Variables disponibles
          </div>
          {VAR_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
                {group.label}
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.vars.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVar(v.key)}
                    title={v.desc}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '5px 8px', border: '1px solid var(--rule)',
                      borderRadius: 6, background: 'var(--paper-2)', cursor: 'pointer',
                      textAlign: 'start', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                  >
                    <code style={{ fontSize: 10, color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
                      {`{{${v.key}}}`}
                    </code>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.4 }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const api = useApi();
  const [tab, setTab] = useState<'generer' | 'historique' | 'modeles'>('generer');

  // Template list (shared across tabs)
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);

  // ── Générer tab state ──────────────────────────────────────────────────────
  const [selectedType, setSelectedType]   = useState<TypeDocument | null>(null);
  const [eleveSearch, setEleveSearch]     = useState('');
  const [elevesFound, setElevesFound]     = useState<Eleve[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null);
  const [professeurs, setProfesseurs]     = useState<Professeur[]>([]);
  const [selectedProfId, setSelectedProfId] = useState('');
  const [classes, setClasses]             = useState<Classe[]>([]);
  const [annees, setAnnees]               = useState<AnneeScolaire[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [extraParams, setExtraParams]     = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);
  const [printing,    setPrinting]    = useState(false);

  // ── Historique tab state ───────────────────────────────────────────────────
  const [historique, setHistorique]   = useState<HistoriqueItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // ── Modèles tab state ──────────────────────────────────────────────────────
  const [editType, setEditType] = useState<TypeDocument | null>(null);

  // ── Load shared data ───────────────────────────────────────────────────────

  const loadTemplates = useCallback(() => {
    api.get<TemplateInfo[]>('/api/v1/documents').then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    loadTemplates();
    api.get<Classe[]>('/api/v1/classes?limit=200')
      .then(d => setClasses(Array.isArray(d) ? d : (d as { data: Classe[] }).data ?? []))
      .catch(() => {});
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then(d => { setAnnees(d); const a = d.find(x => x.active); if (a) setExtraParams(p => ({ ...p, annee_scolaire_id: a.id })); })
      .catch(() => {});
    api.get<{ data: Professeur[] }>('/api/v1/professeurs?limit=200')
      .then(d => setProfesseurs(d.data ?? []))
      .catch(() => {});
  }, []);

  const loadHistorique = useCallback(() => {
    setHistLoading(true);
    api.get<{ items: HistoriqueItem[] }>('/api/v1/documents/historique')
      .then(d => setHistorique(d.items ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  useEffect(() => { if (tab === 'historique') loadHistorique(); }, [tab, loadHistorique]);

  // Eleve search debounce
  useEffect(() => {
    if (eleveSearch.length < 2) { setElevesFound([]); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      api.get<{ data: Eleve[] }>(`/api/v1/eleves?search=${encodeURIComponent(eleveSearch)}&limit=8`)
        .then(r => setElevesFound(r.data ?? []))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [eleveSearch]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const selectType = (type: TypeDocument) => {
    setSelectedType(type);
    setSelectedEleve(null); setSelectedProfId(''); setSelectedClasseId('');
    setEleveSearch(''); setElevesFound([]);
    const a = annees.find(x => x.active);
    setExtraParams(a ? { annee_scolaire_id: a.id } : {});
  };

  const destType = selectedType ? DEST_TYPE[selectedType] : null;
  const destinataireId = destType === 'eleve' ? selectedEleve?.id : destType === 'professeur' ? selectedProfId : selectedClasseId;
  const canGenerate = !!selectedType && !!destinataireId;

  const fetchPdfBlob = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!selectedType || !destinataireId) return null;
    const res = await fetch(`${API_BASE}/api/v1/documents/generer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ type: selectedType, destinataire_type: DEST_TYPE[selectedType], destinataire_id: destinataireId, parametres: Object.keys(extraParams).length ? extraParams : undefined }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error); }
    return { blob: await res.blob(), filename: `${LABELS[selectedType].toLowerCase().replace(/\s+/g, '_')}.pdf` };
  };

  const handleTelecharger = async () => {
    if (!canGenerate) return;
    setDownloading(true);
    try {
      const result = await fetchPdfBlob();
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success('Document téléchargé');
    } catch (err) { toast.error((err as Error).message); }
    finally { setDownloading(false); }
  };

  const handleImprimer = async () => {
    if (!canGenerate) return;
    setPrinting(true);
    try {
      const result = await fetchPdfBlob();
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const win = window.open(url, '_blank');
      if (!win) { toast.error('Autorisez les popups pour imprimer'); URL.revokeObjectURL(url); return; }
      win.addEventListener('load', () => {
        win.focus();
        win.print();
      });
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      toast.success('Document ouvert — utilisez Ctrl+P pour imprimer');
    } catch (err) { toast.error((err as Error).message); }
    finally { setPrinting(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title="Documents administratifs" />

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${tab === 'generer' ? ' active' : ''}`} onClick={() => setTab('generer')}>Générer</button>
        <button className={`tab${tab === 'historique' ? ' active' : ''}`} onClick={() => setTab('historique')}>Historique</button>
        <button className={`tab${tab === 'modeles' ? ' active' : ''}`} onClick={() => setTab('modeles')}>Modèles</button>
      </div>

      {/* ── Onglet Générer ── */}
      {tab === 'generer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <TypeList selected={selectedType} onSelect={selectType} templates={templates} />
          <div className="card card-pad">
            {!selectedType ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
                <svg width={48} height={48} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }}>
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
                <p style={{ fontSize: 14 }}>Sélectionnez un type de document</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{LABELS[selectedType]}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)' }}>
                    Destinataire : {destType === 'eleve' ? 'Élève' : destType === 'professeur' ? 'Professeur' : 'Classe'}
                  </p>
                </div>

                {CARD_TYPES.has(selectedType) && (
                  <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>🪪</span>
                    <div>
                      <strong>Carte CR80 — format Evolis Primacy</strong><br />
                      La photo est <strong>obligatoire</strong> pour générer cette carte. Pour imprimer plusieurs cartes d'un coup, utilisez le bouton "Générer en lot" depuis la page <strong>Élèves</strong> ou <strong>Professeurs</strong>.
                    </div>
                  </div>
                )}

                {destType === 'eleve' && (
                  <div>
                    <div className="field-label" style={{ marginBottom: 6 }}>Élève</div>
                    {selectedEleve ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedEleve.prenom_fr} {selectedEleve.nom_fr}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{selectedEleve.matricule}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedEleve(null); setEleveSearch(''); }}>Changer</button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <Input placeholder="Rechercher par nom ou matricule..." value={eleveSearch} onChange={e => setEleveSearch(e.target.value)} />
                        {(elevesFound.length > 0 || searchLoading) && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4 }}>
                            {searchLoading && <div style={{ padding: 10, fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>Recherche…</div>}
                            {elevesFound.map(e => (
                              <button key={e.id} onClick={() => { setSelectedEleve(e); setEleveSearch(''); setElevesFound([]); }} style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', borderBottom: '1px solid var(--rule)', color: 'var(--ink)' }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{e.prenom_fr} {e.nom_fr}</span>
                                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.matricule}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {destType === 'professeur' && (
                  <div className="field">
                    <label className="field-label">Professeur</label>
                    <select className="input" value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)}>
                      <option value="">Sélectionner un professeur…</option>
                      {professeurs.map(p => <option key={p.id} value={p.id}>{[p.prenom_fr, p.nom_fr].filter(Boolean).join(' ')}</option>)}
                    </select>
                  </div>
                )}

                {destType === 'classe' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="field">
                      <label className="field-label">Classe</label>
                      <select className="input" value={selectedClasseId} onChange={e => setSelectedClasseId(e.target.value)}>
                        <option value="">Sélectionner une classe…</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.nom_fr} ({c.filiere})</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Année scolaire</label>
                      <select className="input" value={extraParams.annee_scolaire_id ?? ''} onChange={e => setExtraParams(p => ({ ...p, annee_scolaire_id: e.target.value }))}>
                        <option value="">Sélectionner…</option>
                        {annees.map(a => <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' (active)' : ''}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {EXTRA_PARAMS[selectedType]?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paramètres du document</div>
                    <div className="grid-2" style={{ gap: 10 }}>
                      {EXTRA_PARAMS[selectedType].map(p => (
                        <div key={p.key} className={p.type === 'textarea' ? 'grid-span-2' : ''}>
                          {p.type === 'textarea' ? (
                            <div className="field">
                              <label className="field-label">{p.label}</label>
                              <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={extraParams[p.key] ?? ''} onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))} />
                            </div>
                          ) : (
                            <Input label={p.label} type={p.type} value={extraParams[p.key] ?? ''} onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ paddingTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button onClick={handleTelecharger} loading={downloading} disabled={!canGenerate || printing}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Télécharger
                  </Button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleImprimer}
                    disabled={!canGenerate || downloading || printing}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (!canGenerate || downloading || printing) ? 0.5 : 1 }}
                  >
                    {printing ? (
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    ) : (
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                      </svg>
                    )}
                    Imprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Historique ── */}
      {tab === 'historique' && (
        <div className="card" style={{ padding: 0 }}>
          {histLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Chargement…</div>
          ) : historique.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Aucun document généré</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--paper-2)', borderBottom: '2px solid var(--rule)' }}>
                  {['Type de document', 'Destinataire', 'Généré par', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'start', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historique.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--ink)' }}>{LABELS[item.type] ?? item.type}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>{item.destinataire_type}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{item.utilisateur ? `${item.utilisateur.prenom} ${item.utilisateur.nom}` : '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(item.genere_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Onglet Modèles ── */}
      {tab === 'modeles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <TypeList selected={editType} onSelect={setEditType} templates={templates} activeColor />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {!editType ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
                <svg width={48} height={48} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }}>
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
                <p style={{ fontSize: 14 }}>Sélectionnez un type pour éditer son modèle</p>
                <p style={{ fontSize: 12, color: 'var(--ink-4)', maxWidth: 300, margin: '4px auto 0' }}>
                  Les modèles utilisent des variables <code style={{ fontSize: 11 }}>{'{{VARIABLE}}'}</code> remplacées automatiquement à la génération.
                </p>
              </div>
            ) : (
              <TemplateEditor key={editType} type={editType} templates={templates} onSaved={loadTemplates} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
