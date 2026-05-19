import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

interface AnneeScolaire { id: string; libelle: string; active: boolean; }
interface Classe { id: string; nom_fr: string; filiere: string; }
interface Progression {
  id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  decision: string;
  decision_auto: string | null;
  note_directeur: string | null;
  validee: boolean;
  validee_le: string | null;
  eleve: { id: string; matricule: string; nom_fr: string; prenom_fr: string };
  annee_scolaire: { libelle: string };
}

const DECISION_LABELS: Record<string, string> = {
  admis: 'Admis', redoublant: 'Redoublant', transfere: 'Transféré', exclu: 'Exclu',
};
const DECISION_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  admis: 'success', redoublant: 'danger', transfere: 'warning', exclu: 'neutral',
};

export function ProgressionPage() {
  const api = useApi();

  const [annees,       setAnnees]       = useState<AnneeScolaire[]>([]);
  const [anneeId,      setAnneeId]      = useState('');
  const [classes,      setClasses]      = useState<Classe[]>([]);
  const [classeId,     setClasseId]     = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [generating,   setGenerating]   = useState(false);

  // Modal validation
  const [editTarget,     setEditTarget]     = useState<Progression | null>(null);
  const [formDecision,   setFormDecision]   = useState('admis');
  const [formNote,       setFormNote]       = useState('');
  const [saving,         setSaving]         = useState(false);

  // Stats
  const total     = progressions.length;
  const validees  = progressions.filter(p => p.validee).length;
  const admis     = progressions.filter(p => p.decision === 'admis').length;
  const redoublants = progressions.filter(p => p.decision === 'redoublant').length;

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then(data => { setAnnees(data); const a = data.find(x => x.active); if (a) setAnneeId(a.id); })
      .catch(err => toast.error((err as Error).message));
  }, []);

  useEffect(() => {
    setClasseId('');
    if (!anneeId) { setClasses([]); return; }
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`)
      .then(setClasses)
      .catch(err => toast.error((err as Error).message));
  }, [anneeId]);

  useEffect(() => { setClasseId(''); }, [filiereFilter]);

  const classesFiltrees = classes.filter(c => !filiereFilter || c.filiere === filiereFilter);

  const loadProgressions = useCallback(() => {
    if (!anneeId) return;
    setLoading(true);
    const params = new URLSearchParams({ annee_scolaire_id: anneeId });
    if (classeId) params.set('classe_id', classeId);
    else if (filiereFilter) params.set('filiere', filiereFilter);
    api.get<Progression[]>(`/api/v1/progression?${params}`)
      .then(setProgressions)
      .catch(err => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, [anneeId, classeId, filiereFilter]);

  useEffect(() => { loadProgressions(); }, [loadProgressions]);

  const handleGenerer = async () => {
    if (!anneeId) return;
    setGenerating(true);
    try {
      const res = await api.post<{ genere: number; total: number }>(
        '/api/v1/progression/generer', { annee_scolaire_id: anneeId }
      );
      toast.success(`${res.genere} proposition(s) générée(s) sur ${res.total} élèves`);
      loadProgressions();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setGenerating(false); }
  };

  const openValidation = (p: Progression) => {
    setEditTarget(p);
    setFormDecision(p.decision);
    setFormNote(p.note_directeur ?? '');
  };

  const handleValider = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/progression/${editTarget.id}/valider`, {
        decision: formDecision,
        note_directeur: formNote || undefined,
      });
      toast.success('Décision enregistrée');
      setEditTarget(null);
      loadProgressions();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  };

  const pendantes = progressions.filter(p => !p.validee);
  const valideesList = progressions.filter(p => p.validee);

  return (
    <>
      <PageHeader
        title="Progression de fin d'année"
        subtitle="Décisions de passage, redoublement et transfert"
        action={
          <div className="row" style={{ gap: 8 }}>
            <Select
              label=""
              value={anneeId}
              onChange={e => setAnneeId(e.target.value)}
              options={[{ value: '', label: 'Année scolaire...' }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]}
            />
            <Button onClick={handleGenerer} loading={generating} disabled={!anneeId} variant="secondary">
              Générer propositions
            </Button>
          </div>
        }
      />

      {/* Filtres */}
      {anneeId && (
        <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            label=""
            value={filiereFilter}
            onChange={e => setFiliereFilter(e.target.value)}
            options={[
              { value: '', label: 'Toutes les filières' },
              { value: 'FR', label: 'Filière Française' },
              { value: 'AR', label: 'Filière Arabe' },
            ]}
          />
          <Select
            label=""
            value={classeId}
            onChange={e => setClasseId(e.target.value)}
            options={[
              { value: '', label: 'Toutes les classes' },
              ...classesFiltrees.map(c => ({ value: c.id, label: `${c.nom_fr} (${c.filiere})` })),
            ]}
          />
          {(classeId || filiereFilter) && (
            <button
              className="tb-btn"
              onClick={() => { setClasseId(''); setFiliereFilter(''); }}
              title="Effacer les filtres"
              style={{ fontSize: 12, color: 'var(--ink-3)', padding: '0 10px' }}
            >
              ✕ Effacer filtres
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {total > 0 && (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[
            { label: 'Total élèves', value: total, color: 'var(--ink)' },
            { label: 'Décisions validées', value: `${validees}/${total}`, color: validees === total ? 'var(--success)' : 'var(--warning)' },
            { label: 'Admis', value: admis, color: 'var(--success)' },
            { label: 'Redoublants', value: redoublants, color: 'var(--danger)' },
          ].map(stat => (
            <div key={stat.label} className="card-pad" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-display)' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {!anneeId ? (
        <div className="empty">Sélectionnez une année scolaire</div>
      ) : loading ? (
        <div className="empty">Chargement...</div>
      ) : progressions.length === 0 ? (
        <div className="empty">
          Aucune progression générée.
          <br />
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            Cliquez sur "Générer propositions" pour créer des propositions automatiques basées sur les moyennes annuelles.
          </span>
        </div>
      ) : (
        <>
          {/* Décisions en attente */}
          {pendantes.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                En attente de validation ({pendantes.length})
              </h3>
              <div className="card">
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Matricule</th>
                        <th style={{ width: 130 }}>Proposition auto</th>
                        <th style={{ width: 130 }}>Décision en cours</th>
                        <th style={{ width: 100 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {pendantes.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.eleve.prenom_fr} {p.eleve.nom_fr}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{p.eleve.matricule}</td>
                          <td>
                            {p.decision_auto && (
                              <Badge
                                label={DECISION_LABELS[p.decision_auto] ?? p.decision_auto}
                                variant={DECISION_VARIANTS[p.decision_auto] ?? 'neutral'}
                                dot
                              />
                            )}
                          </td>
                          <td>
                            <Badge
                              label={DECISION_LABELS[p.decision] ?? p.decision}
                              variant={DECISION_VARIANTS[p.decision] ?? 'neutral'}
                            />
                          </td>
                          <td>
                            <Button size="sm" onClick={() => openValidation(p)}>Valider</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Décisions validées */}
          {valideesList.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Validées ({valideesList.length})
              </h3>
              <div className="card">
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Matricule</th>
                        <th style={{ width: 130 }}>Décision</th>
                        <th>Note directeur</th>
                        <th style={{ width: 120 }}>Validée le</th>
                        <th style={{ width: 80 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {valideesList.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.eleve.prenom_fr} {p.eleve.nom_fr}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{p.eleve.matricule}</td>
                          <td>
                            <Badge
                              label={DECISION_LABELS[p.decision] ?? p.decision}
                              variant={DECISION_VARIANTS[p.decision] ?? 'neutral'}
                            />
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: p.note_directeur ? 'normal' : 'italic' }}>
                            {p.note_directeur ?? '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                            {p.validee_le ? new Date(p.validee_le).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td>
                            <button className="tb-btn" onClick={() => openValidation(p)} title="Modifier la décision">
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal validation */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Décision — ${editTarget.eleve.prenom_fr} ${editTarget.eleve.nom_fr}` : ''}
        size="sm"
        footer={
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button onClick={handleValider} loading={saving}>Valider la décision</Button>
          </div>
        }
      >
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editTarget.decision_auto && (
              <div style={{ padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 'var(--r-md)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-3)' }}>Proposition automatique : </span>
                <strong style={{ color: 'var(--ink)' }}>{DECISION_LABELS[editTarget.decision_auto] ?? editTarget.decision_auto}</strong>
              </div>
            )}
            <Select
              label="Décision *"
              value={formDecision}
              onChange={e => setFormDecision(e.target.value)}
              options={[
                { value: 'admis',      label: 'Admis (passage en classe supérieure)' },
                { value: 'redoublant', label: 'Redoublant (maintien en classe)' },
                { value: 'transfere',  label: 'Transféré (vers un autre établissement)' },
                { value: 'exclu',      label: 'Exclu' },
              ]}
            />
            <div className="field">
              <label className="field-label">Note du directeur (optionnel)</label>
              <textarea
                className="input"
                rows={3}
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="Commentaire ou observation..."
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
