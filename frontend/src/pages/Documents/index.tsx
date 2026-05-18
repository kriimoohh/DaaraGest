import { useState, useEffect, useCallback } from 'react';
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
  | 'LISTE_CLASSE' | 'ATTESTATION_TRAVAIL' | 'ORDRE_MISSION' | 'FICHE_PAIE' | 'PLANNING_COURS';

type DestType = 'eleve' | 'professeur' | 'classe';

interface TemplateInfo { type: TypeDocument; nom: string; has_custom: boolean }
interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string }
interface Professeur { id: string; nom: string; prenom: string; identifiant: string }
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
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const api = useApi();
  const [tab, setTab] = useState<'generer' | 'historique'>('generer');

  // Template list
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedType, setSelectedType] = useState<TypeDocument | null>(null);

  // Destinataire
  const [eleveSearch, setEleveSearch]   = useState('');
  const [elevesFound, setElevesFound]   = useState<Eleve[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEleve, setSelectedEleve]     = useState<Eleve | null>(null);
  const [professeurs, setProfesseurs]   = useState<Professeur[]>([]);
  const [selectedProfId, setSelectedProfId]   = useState('');
  const [classes, setClasses]           = useState<Classe[]>([]);
  const [annees, setAnnees]             = useState<AnneeScolaire[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState('');

  // Extra params
  const [extraParams, setExtraParams] = useState<Record<string, string>>({});

  // Generation
  const [generating, setGenerating] = useState(false);

  // Historique
  const [historique, setHistorique]   = useState<HistoriqueItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    api.get<TemplateInfo[]>('/api/v1/documents')
      .then(setTemplates)
      .catch(() => {});
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
    setSelectedEleve(null);
    setSelectedProfId('');
    setSelectedClasseId('');
    setEleveSearch('');
    setElevesFound([]);
    const a = annees.find(x => x.active);
    setExtraParams(a ? { annee_scolaire_id: a.id } : {});
  };

  const destType = selectedType ? DEST_TYPE[selectedType] : null;
  const destinataireId = destType === 'eleve' ? selectedEleve?.id : destType === 'professeur' ? selectedProfId : selectedClasseId;
  const canGenerate = !!selectedType && !!destinataireId;

  const handleGenerer = async () => {
    if (!selectedType || !destinataireId) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/generer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: selectedType,
          destinataire_type: DEST_TYPE[selectedType],
          destinataire_id: destinataireId,
          parametres: Object.keys(extraParams).length ? extraParams : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur de génération' }));
        throw new Error(err.error ?? 'Erreur de génération');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${LABELS[selectedType].toLowerCase().replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Document généré et téléchargé');
      if (tab === 'historique') loadHistorique();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title="Documents administratifs" />

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${tab === 'generer' ? ' active' : ''}`} onClick={() => setTab('generer')}>
          Générer un document
        </button>
        <button className={`tab${tab === 'historique' ? ' active' : ''}`} onClick={() => setTab('historique')}>
          Historique
        </button>
      </div>

      {/* ── Onglet Générer ── */}
      {tab === 'generer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Type selector */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {GROUPS.map(group => (
              <div key={group.label}>
                <div style={{ padding: '10px 14px', background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="var(--ink-3)">
                    <path d={group.icon} />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {group.label}
                  </span>
                </div>
                {group.types.map(type => {
                  const tpl = templates.find(t => t.type === type);
                  const active = selectedType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => selectType(type)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--rule)',
                        background: active ? 'var(--terra-soft)' : 'transparent',
                        cursor: 'pointer', textAlign: 'start',
                      }}
                    >
                      <span style={{ fontSize: 13, color: active ? 'var(--terra-ink)' : 'var(--ink)', fontWeight: active ? 600 : 400 }}>
                        {LABELS[type]}
                      </span>
                      {tpl?.has_custom && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d1fae5', color: '#065f46', flexShrink: 0 }}>
                          ✓ perso
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Generation form */}
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

                {/* Destinataire selector */}
                {destType === 'eleve' && (
                  <div>
                    <div className="field-label" style={{ marginBottom: 6 }}>Élève</div>
                    {selectedEleve ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedEleve.prenom_fr} {selectedEleve.nom_fr}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{selectedEleve.matricule}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedEleve(null); setEleveSearch(''); }}>
                          Changer
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <Input
                          placeholder="Rechercher par nom ou matricule..."
                          value={eleveSearch}
                          onChange={e => setEleveSearch(e.target.value)}
                        />
                        {(elevesFound.length > 0 || searchLoading) && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4 }}>
                            {searchLoading && <div style={{ padding: 10, fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>Recherche…</div>}
                            {elevesFound.map(e => (
                              <button
                                key={e.id}
                                onClick={() => { setSelectedEleve(e); setEleveSearch(''); setElevesFound([]); }}
                                style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', borderBottom: '1px solid var(--rule)' }}
                              >
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
                      {professeurs.map(p => (
                        <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                      ))}
                    </select>
                  </div>
                )}

                {destType === 'classe' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="field">
                      <label className="field-label">Classe</label>
                      <select className="input" value={selectedClasseId} onChange={e => setSelectedClasseId(e.target.value)}>
                        <option value="">Sélectionner une classe…</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.nom_fr} ({c.filiere})</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Année scolaire</label>
                      <select className="input" value={extraParams.annee_scolaire_id ?? ''} onChange={e => setExtraParams(p => ({ ...p, annee_scolaire_id: e.target.value }))}>
                        <option value="">Sélectionner…</option>
                        {annees.map(a => (
                          <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' (active)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Extra params */}
                {EXTRA_PARAMS[selectedType]?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Paramètres du document
                    </div>
                    <div className="grid-2" style={{ gap: 10 }}>
                      {EXTRA_PARAMS[selectedType].map(p => (
                        <div key={p.key} className={p.type === 'textarea' ? 'grid-span-2' : ''}>
                          {p.type === 'textarea' ? (
                            <div className="field">
                              <label className="field-label">{p.label}</label>
                              <textarea
                                className="input"
                                rows={2}
                                style={{ resize: 'vertical' }}
                                value={extraParams[p.key] ?? ''}
                                onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                              />
                            </div>
                          ) : (
                            <Input
                              label={p.label}
                              type={p.type}
                              value={extraParams[p.key] ?? ''}
                              onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generate button */}
                <div style={{ paddingTop: 4 }}>
                  <Button onClick={handleGenerer} loading={generating} disabled={!canGenerate}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 9v-2H7v-2h3v-2l4 3-4 3z" />
                    </svg>
                    Générer le PDF
                  </Button>
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
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--ink)' }}>
                      {LABELS[item.type] ?? item.type}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-2)' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                        {item.destinataire_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>
                      {item.utilisateur ? `${item.utilisateur.prenom} ${item.utilisateur.nom}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(item.genere_le)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
