import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAnneeScolaire } from '../../store/anneeStore';

interface AnneeScolaire { id: string; libelle: string; active: boolean; }
interface Classe        { id: string; nom_fr: string; filiere: string; }
interface Matiere       { id: string; nom_fr: string; nom_ar: string; note_max: number; }
interface ClasseMatiere { matiere_id: string; matiere: Matiere; }
interface Eleve         { id: string; nom_fr: string; prenom_fr: string; matricule: string; }
interface Evaluation {
  id: string; titre: string; type: string; date: string;
  coefficient: number; note_max: number; periode: number;
  classe: { nom_fr: string }; matiere: { nom_fr: string; nom_ar: string };
  _count: { notes_eleves: number };
}
interface NoteEval {
  id: string; eleve_id: string; valeur: number | null; absent: boolean; commentaire?: string;
  eleve: { id: string; matricule: string; nom_fr: string; prenom_fr: string };
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  DS: 'evaluation.type_court_ds',
  INTERRO: 'evaluation.type_court_interro',
  DM: 'evaluation.type_court_dm',
  EXAMEN: 'evaluation.type_court_examen',
};
const TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'neutral' | 'accent'> = {
  DS: 'info', INTERRO: 'warning', DM: 'neutral', EXAMEN: 'accent',
};

const EMPTY_FORM = { titre: '', type: 'DS', date: '', coefficient: '1', note_max: '20', periode: '1' };

export function EvaluationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';
  const api    = useApi();
  const role   = useAuthStore(s => s.user?.role ?? '');
  const canEdit = ['admin', 'directeur', 'gestionnaire', 'professeur'].includes(role);
  const canDelete = ['admin', 'directeur'].includes(role);

  // Filtres
  const [annees,   setAnnees]   = useState<AnneeScolaire[]>([]);
  const [classes,  setClasses]  = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [anneeId,  setAnneeId]  = useAnneeScolaire();
  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [periode,  setPeriode]  = useState('');

  // Données
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading]         = useState(false);

  // Vue notes
  const [activeEval, setActiveEval]   = useState<Evaluation | null>(null);
  const [eleves,     setEleves]       = useState<Eleve[]>([]);
  const [notesMap,   setNotesMap]     = useState<Record<string, string>>({});
  const [absentsMap, setAbsentsMap]   = useState<Record<string, boolean>>({});
  const [saving,     setSaving]       = useState(false);

  // Modal création/édition
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState<Evaluation | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  // Chargement des années au montage
  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then(data => { setAnnees(data); }) /* année courante gérée par le store global */
      .catch(err => toast.error((err as Error).message));
  }, []);

  useEffect(() => {
    if (!anneeId) return;
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`)
      .then(setClasses).catch(err => toast.error((err as Error).message));
    setClasseId(''); setMatiereId(''); setPeriode('');
  }, [anneeId]);

  useEffect(() => {
    if (!classeId) return;
    api.get<ClasseMatiere[]>(`/api/v1/classes/${classeId}/matieres`)
      .then(rows => setMatieres(rows.map(r => r.matiere)))
      .catch(err => toast.error((err as Error).message));
    setMatiereId('');
  }, [classeId]);

  const loadEvaluations = useCallback(() => {
    if (!classeId) return;
    const params = new URLSearchParams({ classe_id: classeId });
    if (matiereId) params.set('matiere_id', matiereId);
    if (periode)   params.set('periode', periode);
    if (anneeId)   params.set('annee_scolaire_id', anneeId);
    setLoading(true);
    api.get<Evaluation[]>(`/api/v1/evaluations?${params}`)
      .then(setEvaluations)
      .catch(err => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, [classeId, matiereId, periode, anneeId]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // Charger notes d'une évaluation
  const openNotes = async (ev: Evaluation) => {
    setActiveEval(ev);
    const [notesData, elevesData] = await Promise.all([
      api.get<NoteEval[]>(`/api/v1/evaluations/${ev.id}/notes`),
      api.get<{ data: Eleve[] }>(`/api/v1/eleves?classe_id=${classeId}&limit=100`),
    ]).catch(err => { toast.error((err as Error).message); return [[], { data: [] }]; }) as [NoteEval[], { data: Eleve[] }];

    setEleves([...(elevesData.data ?? [])].sort((a, b) =>
      `${a.nom_fr} ${a.prenom_fr}`.localeCompare(`${b.nom_fr} ${b.prenom_fr}`, 'fr')
    ));
    const nm: Record<string, string>  = {};
    const am: Record<string, boolean> = {};
    notesData.forEach(n => {
      nm[n.eleve_id] = n.valeur !== null ? String(n.valeur) : '';
      am[n.eleve_id] = n.absent;
    });
    setNotesMap(nm); setAbsentsMap(am);
  };

  const saveNotes = async () => {
    if (!activeEval) return;
    setSaving(true);
    try {
      const notes = eleves.map(e => ({
        eleve_id: e.id,
        absent:   absentsMap[e.id] ?? false,
        valeur:   !absentsMap[e.id] && notesMap[e.id] !== '' ? parseFloat(notesMap[e.id]) : null,
      }));
      await api.post(`/api/v1/evaluations/${activeEval.id}/notes/bulk`, { notes });
      toast.success(t('evaluation.ok_notes'));
      loadEvaluations();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  };

  // Formulaire modal
  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, periode: periode || '1', note_max: matieres.find(m => m.id === matiereId)?.note_max?.toString() ?? '20' });
    setModalOpen(true);
  };

  const openEdit = (ev: Evaluation) => {
    setEditTarget(ev);
    setForm({
      titre: ev.titre, type: ev.type,
      date: ev.date.slice(0, 10),
      coefficient: String(ev.coefficient),
      note_max: String(ev.note_max),
      periode: String(ev.periode),
    });
    setModalOpen(true);
  };

  const submitForm = async () => {
    if (!form.titre || !form.date || !classeId || !matiereId || !anneeId) {
      toast.error(t('evaluation.err_champs_obligatoires')); return;
    }
    setSubmitting(true);
    try {
      const body = {
        titre: form.titre, type: form.type,
        date: form.date, classe_id: classeId, matiere_id: matiereId,
        annee_scolaire_id: anneeId, periode: parseInt(form.periode),
        coefficient: parseFloat(form.coefficient), note_max: parseFloat(form.note_max),
      };
      if (editTarget) {
        await api.put(`/api/v1/evaluations/${editTarget.id}`, body);
        toast.success(t('evaluation.ok_modifiee'));
      } else {
        await api.post('/api/v1/evaluations', body);
        toast.success(t('evaluation.ok_creee'));
      }
      setModalOpen(false); loadEvaluations();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSubmitting(false); }
  };

  const deleteEval = async (ev: Evaluation) => {
    if (!confirm(t('evaluation.confirm_suppression', { titre: ev.titre }))) return;
    try {
      await api.delete(`/api/v1/evaluations/${ev.id}`);
      toast.success(t('evaluation.ok_supprimee')); loadEvaluations();
    } catch (err) { toast.error((err as Error).message); }
  };

  const nbPeriodes = 3;
  const periodeOptions = [
    { value: '', label: t('evaluation.periode_toutes') },
    ...Array.from({ length: nbPeriodes }, (_, i) => ({ value: String(i + 1), label: t('evaluation.periode_n', { n: i + 1 }) })),
  ];

  // ── Vue saisie des notes ────────────────────────────────────────────────────
  if (activeEval) {
    return (
      <>
        <PageHeader
          title={t('evaluation.saisie_titre', { titre: activeEval.titre })}
          action={
            <div className="row" style={{ gap: 8 }}>
              <Button variant="secondary" onClick={() => setActiveEval(null)}>{t('evaluation.retour')}</Button>
              {canEdit && <Button onClick={saveNotes} loading={saving}>{t('actions.enregistrer')}</Button>}
            </div>
          }
        />

        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap', fontSize: 13, color: 'var(--ink-2)' }}>
            <span><strong>{t('evaluation.info_matiere')} :</strong> {activeEval.matiere.nom_fr}</span>
            <span><strong>{t('evaluation.info_classe')} :</strong> {activeEval.classe.nom_fr}</span>
            <span><strong>{t('evaluation.info_type')} :</strong> <Badge label={TYPE_LABEL_KEYS[activeEval.type] ? t(TYPE_LABEL_KEYS[activeEval.type]) : activeEval.type} variant={TYPE_VARIANTS[activeEval.type] ?? 'neutral'} /></span>
            <span><strong>{t('evaluation.info_coeff')} :</strong> {activeEval.coefficient}</span>
            <span><strong>{t('evaluation.info_bareme')} :</strong> /{activeEval.note_max}</span>
            <span><strong>{t('evaluation.info_date')} :</strong> {new Date(activeEval.date).toLocaleDateString(locale)}</span>
          </div>
        </div>

        <div className="card">
          {eleves.length === 0 ? (
            <div className="empty">{t('evaluation.aucun_eleve')}</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('note.col_matricule')}</th>
                    <th>{t('note.col_eleve')}</th>
                    <th style={{ width: 100 }}>{t('evaluation.col_absent')}</th>
                    <th style={{ width: 140 }}>{t('evaluation.col_note')} /{activeEval.note_max}</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map(eleve => {
                    const absent = absentsMap[eleve.id] ?? false;
                    return (
                      <tr key={eleve.id} style={{ opacity: absent ? 0.5 : 1 }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{eleve.matricule}</td>
                        <td>{eleve.prenom_fr} {eleve.nom_fr}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={absent}
                            disabled={!canEdit}
                            onChange={e => setAbsentsMap(prev => ({ ...prev, [eleve.id]: e.target.checked }))}
                            style={{ cursor: canEdit ? 'pointer' : 'default' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={0} max={activeEval.note_max} step="0.25"
                            value={absent ? '' : (notesMap[eleve.id] ?? '')}
                            disabled={absent || !canEdit}
                            onChange={e => setNotesMap(prev => ({ ...prev, [eleve.id]: e.target.value }))}
                            className="input"
                            style={{ width: 90, padding: '4px 10px', opacity: absent ? 0 : 1 }}
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Vue liste des évaluations ───────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title={t('evaluation.titre')}
        action={canEdit && classeId && matiereId ? (
          <Button onClick={openCreate}>{t('evaluation.creer_btn')}</Button>
        ) : undefined}
      />

      {/* Filtres */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="grid-4">
          <Select
            label={t('classe.annee_scolaire')}
            value={anneeId}
            onChange={e => setAnneeId(e.target.value)}
            options={[{ value: '', label: t('common.selectionner') }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]}
          />
          <Select
            label={t('nav.classes')}
            value={classeId}
            onChange={e => { setClasseId(e.target.value); setMatiereId(''); }}
            options={[{ value: '', label: t('common.selectionner') }, ...classes.map(c => ({ value: c.id, label: c.nom_fr }))]}
            disabled={!anneeId}
          />
          <Select
            label={t('nav.matieres')}
            value={matiereId}
            onChange={e => setMatiereId(e.target.value)}
            options={[{ value: '', label: t('evaluation.matiere_toutes') }, ...matieres.map(m => ({ value: m.id, label: m.nom_fr }))]}
            disabled={!classeId}
          />
          <Select
            label={t('note.periode')}
            value={periode}
            onChange={e => setPeriode(e.target.value)}
            options={periodeOptions}
            disabled={!classeId}
          />
        </div>
      </div>

      {!classeId ? (
        <div className="empty">{t('evaluation.empty_classe_requise')}</div>
      ) : loading ? (
        <div className="empty">{t('common.chargement')}</div>
      ) : evaluations.length === 0 ? (
        <div className="empty">{t('evaluation.empty_aucune')}</div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('evaluation.col_titre')}</th>
                  <th>{t('evaluation.col_type')}</th>
                  <th>{t('evaluation.col_matiere')}</th>
                  <th>{t('evaluation.col_periode')}</th>
                  <th>{t('evaluation.col_date')}</th>
                  <th style={{ width: 70, textAlign: 'center' }}>{t('evaluation.col_coeff')}</th>
                  <th style={{ width: 80, textAlign: 'center' }}>{t('evaluation.col_notes')}</th>
                  <th style={{ width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {evaluations.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 500 }}>{ev.titre}</td>
                    <td><Badge label={TYPE_LABEL_KEYS[ev.type] ? t(TYPE_LABEL_KEYS[ev.type]) : ev.type} variant={TYPE_VARIANTS[ev.type] ?? 'neutral'} /></td>
                    <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{ev.matiere.nom_fr}</td>
                    <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{t('evaluation.periode_p_court', { n: ev.periode })}</td>
                    <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>{new Date(ev.date).toLocaleDateString(locale)}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{ev.coefficient}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
                        background: ev._count.notes_eleves > 0 ? 'var(--success-soft)' : 'var(--surface-2)',
                        border: `1px solid ${ev._count.notes_eleves > 0 ? 'var(--success-border)' : 'var(--border)'}`,
                        padding: '2px 8px', borderRadius: 'var(--r-md)',
                      }}>
                        {ev._count.notes_eleves}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <button className="tb-btn" onClick={() => openNotes(ev)} title={t('evaluation.tt_saisir_notes')}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                        )}
                        {canEdit && (
                          <button className="tb-btn" onClick={() => openEdit(ev)} title={t('evaluation.tt_modifier')}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button className="tb-btn tb-btn-danger" onClick={() => deleteEval(ev)} title={t('evaluation.tt_supprimer')}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal création / édition */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? t('evaluation.modifier_titre') : t('evaluation.creer_titre')}
        size="md"
        footer={
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.annuler')}</Button>
            <Button onClick={submitForm} loading={submitting}>
              {editTarget ? t('actions.enregistrer') : t('evaluation.creer_btn_label')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('evaluation.titre_label')}
            value={form.titre}
            onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
            placeholder={t('evaluation.titre_placeholder')}
          />
          <div className="grid-2">
            <Select
              label={t('evaluation.type_label')}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              options={[
                { value: 'DS',     label: t('evaluation.type_ds') },
                { value: 'INTERRO',label: t('evaluation.type_interro') },
                { value: 'DM',     label: t('evaluation.type_dm') },
                { value: 'EXAMEN', label: t('evaluation.type_examen') },
              ]}
            />
            <Select
              label={t('evaluation.periode_label')}
              value={form.periode}
              onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
              options={Array.from({ length: nbPeriodes }, (_, i) => ({ value: String(i + 1), label: t('evaluation.periode_n', { n: i + 1 }) }))}
            />
          </div>
          <Input
            label={t('evaluation.date_label')} type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <div className="grid-2">
            <Input
              label={t('evaluation.coefficient_label')}
              type="number" min="0.5" max="10" step="0.5"
              value={form.coefficient}
              onChange={e => setForm(f => ({ ...f, coefficient: e.target.value }))}
            />
            <Input
              label={t('evaluation.bareme_label')}
              type="number" min="1" max="100" step="1"
              value={form.note_max}
              onChange={e => setForm(f => ({ ...f, note_max: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
