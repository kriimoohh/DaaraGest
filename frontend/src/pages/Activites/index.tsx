import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../lib/dates';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useNoteMax } from '../../store/noteScaleStore';
import { useAuthStore } from '../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Activite {
  id: string; nom_fr: string; description?: string;
  capacite_max?: number; actif: boolean;
  responsable?: { id: string; nom_fr: string; prenom_fr: string } | null;
  _count: { inscriptions: number; seances: number };
}
interface Eleve { id: string; matricule: string; nom_fr: string; prenom_fr: string; }
interface AnneeScolaire { id: string; libelle: string; active: boolean; }
interface Inscription {
  id: string; date_inscription: string;
  eleve: Eleve;
  annee_scolaire: { libelle: string };
  evaluations: EvaluationActivite[];
}
interface Seance {
  id: string; date: string; duree_min?: number; notes?: string;
  _count: { presences: number };
}
interface Presence { id: string; eleve_id: string; statut: string; eleve: Eleve; }
interface EvaluationActivite {
  id: string; periode?: number; appreciation?: string; note?: number;
}

type Tab = 'inscriptions' | 'seances' | 'evaluations';

// ── Composant principal ────────────────────────────────────────────────────────

export function ActivitesPage() {
  const { t } = useTranslation();
  const api  = useApi();
  const role = useAuthStore(s => s.user?.role ?? '');
  const canEdit   = ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'].includes(role);
  const canDelete = ['admin', 'directeur'].includes(role);
  const noteMax   = useNoteMax(); // échelle de l'établissement (ex: 10)

  // Liste activités
  const [activites, setActivites]   = useState<Activite[]>([]);
  const [loading, setLoading]       = useState(false);

  // Vue détail
  const [activeAct, setActiveAct]   = useState<Activite | null>(null);
  const [activeTab, setActiveTab]   = useState<Tab>('inscriptions');

  // Inscriptions
  const [annees,   setAnnees]       = useState<AnneeScolaire[]>([]);
  const [anneeId,  setAnneeId]      = useState('');
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [eleveSearch, setEleveSearch]   = useState('');
  const [elevesFound, setElevesFound]   = useState<Eleve[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Séances
  const [seances, setSeances]           = useState<Seance[]>([]);
  const [activeSeance, setActiveSeance] = useState<Seance | null>(null);
  const [presencesMap, setPresencesMap] = useState<Record<string, string>>({});
  const [savingPresences, setSavingPresences] = useState(false);

  // Modals activité
  const [actModal,  setActModal]  = useState(false);
  const [editAct,   setEditAct]   = useState<Activite | null>(null);
  const [actForm,   setActForm]   = useState({ nom_fr: '', description: '', capacite_max: '' });
  const [submitting, setSubmitting] = useState(false);

  // Modal séance
  const [seanceModal, setSeanceModal] = useState(false);
  const [seanceForm,  setSeanceForm]  = useState({ date: '', duree_min: '', notes: '' });
  const [savingSeance, setSavingSeance] = useState(false);

  // Modal évaluation
  const [evalModal, setEvalModal]     = useState<Inscription | null>(null);
  const [evalForm,  setEvalForm]      = useState({ periode: '', appreciation: '', note: '' });
  const [savingEval, setSavingEval]   = useState(false);

  // ── Chargement ───────────────────────────────────────────────────────────────

  const loadActivites = useCallback(() => {
    setLoading(true);
    api.get<Activite[]>('/api/v1/activites')
      .then(setActivites)
      .catch(err => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadActivites(); }, [loadActivites]);

  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires')
      .then(data => { setAnnees(data); const a = data.find(x => x.active); if (a) setAnneeId(a.id); })
      .catch(() => {});
  }, []);

  const loadInscriptions = useCallback(() => {
    if (!activeAct) return;
    const params = anneeId ? `?annee_scolaire_id=${anneeId}` : '';
    api.get<Inscription[]>(`/api/v1/activites/${activeAct.id}/inscriptions${params}`)
      .then(setInscriptions).catch(err => toast.error((err as Error).message));
  }, [activeAct, anneeId]);

  const loadSeances = useCallback(() => {
    if (!activeAct) return;
    api.get<Seance[]>(`/api/v1/activites/${activeAct.id}/seances`)
      .then(setSeances).catch(err => toast.error((err as Error).message));
  }, [activeAct]);

  useEffect(() => {
    if (!activeAct) return;
    if (activeTab === 'inscriptions') loadInscriptions();
    if (activeTab === 'seances')      loadSeances();
    if (activeTab === 'evaluations')  loadInscriptions();
  }, [activeAct, activeTab, loadInscriptions, loadSeances]);

  // Recherche élève pour inscription
  useEffect(() => {
    if (eleveSearch.length < 2) { setElevesFound([]); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      api.get<{ data: Eleve[] }>(`/api/v1/eleves?search=${encodeURIComponent(eleveSearch)}&limit=10`)
        .then(r => setElevesFound(r.data ?? []))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [eleveSearch]);

  // ── Actions activités ────────────────────────────────────────────────────────

  const openCreate = () => { setEditAct(null); setActForm({ nom_fr: '', description: '', capacite_max: '' }); setActModal(true); };
  const openEdit   = (a: Activite) => {
    setEditAct(a);
    setActForm({ nom_fr: a.nom_fr, description: a.description ?? '', capacite_max: a.capacite_max ? String(a.capacite_max) : '' });
    setActModal(true);
  };

  const submitAct = async () => {
    if (!actForm.nom_fr) { toast.error(t('activite.err_nom')); return; }
    setSubmitting(true);
    try {
      const body = { nom_fr: actForm.nom_fr, description: actForm.description || undefined, capacite_max: actForm.capacite_max ? parseInt(actForm.capacite_max) : undefined };
      if (editAct) {
        await api.put(`/api/v1/activites/${editAct.id}`, body);
        toast.success(t('activite.ok_modifiee'));
      } else {
        await api.post('/api/v1/activites', body);
        toast.success(t('activite.ok_creee'));
      }
      setActModal(false); loadActivites();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  };

  const deleteAct = async (a: Activite) => {
    if (!confirm(`Supprimer "${a.nom_fr}" et toutes ses données ?`)) return;
    try { await api.delete(`/api/v1/activites/${a.id}`); toast.success(t('activite.ok_supprimee')); loadActivites(); }
    catch (err) { toast.error((err as Error).message); }
  };

  // ── Actions inscriptions ──────────────────────────────────────────────────────

  const inscrireEleve = async (eleve: Eleve) => {
    if (!activeAct || !anneeId) { toast.error(t('activite.err_annee')); return; }
    try {
      await api.post(`/api/v1/activites/${activeAct.id}/inscriptions`, { eleve_id: eleve.id, annee_scolaire_id: anneeId });
      toast.success(`${eleve.prenom_fr} ${eleve.nom_fr} inscrit(e)`);
      setEleveSearch(''); setElevesFound([]); loadInscriptions(); loadActivites();
    } catch (err) { toast.error((err as Error).message); }
  };

  const desinscrireEleve = async (insc: Inscription) => {
    if (!activeAct || !anneeId) return;
    if (!confirm(`Désinscrire ${insc.eleve.prenom_fr} ${insc.eleve.nom_fr} ?`)) return;
    try {
      await api.delete(`/api/v1/activites/${activeAct.id}/inscriptions/${insc.eleve.id}?annee_scolaire_id=${anneeId}`);
      toast.success(t('activite.ok_desinscription')); loadInscriptions(); loadActivites();
    } catch (err) { toast.error((err as Error).message); }
  };

  // ── Actions séances ───────────────────────────────────────────────────────────

  const creerSeance = async () => {
    if (!activeAct || !seanceForm.date) { toast.error(t('activite.date_obligatoire')); return; }
    setSavingSeance(true);
    try {
      await api.post(`/api/v1/activites/${activeAct.id}/seances`, {
        date: seanceForm.date,
        duree_min: seanceForm.duree_min ? parseInt(seanceForm.duree_min) : undefined,
        notes: seanceForm.notes || undefined,
      });
      toast.success(t('activite.ok_seance_creee')); setSeanceModal(false); setSeanceForm({ date: '', duree_min: '', notes: '' }); loadSeances();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingSeance(false); }
  };

  const supprimerSeance = async (s: Seance) => {
    if (!activeAct) return;
    if (!confirm(t('activite.confirm_suppr_seance'))) return;
    try {
      await api.delete(`/api/v1/activites/${activeAct.id}/seances/${s.id}`);
      toast.success(t('activite.ok_seance_supprimee'));
      if (activeSeance?.id === s.id) { setActiveSeance(null); setPresencesMap({}); }
      loadSeances();
    } catch (err) { toast.error((err as Error).message); }
  };

  const openPresences = async (s: Seance) => {
    if (!activeAct) return;
    setActiveSeance(s);
    const data = await api.get<Presence[]>(`/api/v1/activites/${activeAct.id}/seances/${s.id}/presences`).catch(() => []) as Presence[];
    const map: Record<string, string> = {};
    data.forEach(p => { map[p.eleve_id] = p.statut; });
    // Pré-remplir avec les inscrits non encore pointés
    inscriptions.forEach(i => { if (!map[i.eleve.id]) map[i.eleve.id] = 'present'; });
    setPresencesMap(map);
  };

  const savePresences = async () => {
    if (!activeAct || !activeSeance) return;
    setSavingPresences(true);
    try {
      const presencesList = inscriptions.map(i => ({ eleve_id: i.eleve.id, statut: presencesMap[i.eleve.id] ?? 'present' }));
      await api.post(`/api/v1/activites/${activeAct.id}/seances/${activeSeance.id}/presences/bulk`, { presences: presencesList });
      toast.success(t('activite.ok_presences')); setActiveSeance(null); loadSeances();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingPresences(false); }
  };

  // ── Actions évaluations ───────────────────────────────────────────────────────

  const openEval = (insc: Inscription) => {
    const existing = insc.evaluations[0];
    setEvalForm({ periode: existing?.periode ? String(existing.periode) : '', appreciation: existing?.appreciation ?? '', note: existing?.note !== undefined ? String(existing.note) : '' });
    setEvalModal(insc);
  };

  const saveEval = async () => {
    if (!evalModal) return;
    setSavingEval(true);
    try {
      await api.post(`/api/v1/activites/inscriptions/${evalModal.id}/evaluation`, {
        periode: evalForm.periode ? parseInt(evalForm.periode) : undefined,
        appreciation: evalForm.appreciation || undefined,
        note: evalForm.note ? parseFloat(evalForm.note) : undefined,
      });
      toast.success(t('activite.ok_evaluation')); setEvalModal(null); loadInscriptions();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingEval(false); }
  };

  // ── Rendu vue détail ──────────────────────────────────────────────────────────

  if (activeAct) {
    return (
      <>
        <PageHeader
          title={activeAct.nom_fr}
          subtitle={activeAct.description}
          action={
            <div className="row" style={{ gap: 8 }}>
              <Button variant="secondary" onClick={() => { setActiveAct(null); setActiveSeance(null); loadActivites(); }}>← Retour</Button>
              {canEdit && activeTab === 'seances' && (
                <Button onClick={() => { setSeanceForm({ date: '', duree_min: '', notes: '' }); setSeanceModal(true); }}>+ Séance</Button>
              )}
            </div>
          }
        />

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--rule)', paddingBottom: 0 }}>
          {([['inscriptions', t('activite.tab_inscriptions')], ['seances', t('activite.tab_seances')], ['evaluations', t('activite.tab_evaluations')]] as [Tab, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setActiveSeance(null); }}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? 'var(--ink)' : 'var(--ink-3)', borderBottom: activeTab === tab ? '2px solid var(--terra)' : '2px solid transparent', background: 'none', cursor: 'pointer', marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ─ Inscriptions ─ */}
        {activeTab === 'inscriptions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {canEdit && (
              <div className="card-pad">
                <div className="grid-2" style={{ gap: 12 }}>
                  <Select label={t('activite.annee_scolaire')} value={anneeId} onChange={e => setAnneeId(e.target.value)}
                    options={[{ value: '', label: t('common.selectionner') }, ...annees.map(a => ({ value: a.id, label: a.libelle }))]} />
                  <div className="field">
                    <label className="field-label">{t('activite.rechercher_eleve')}</label>
                    <input className="input" value={eleveSearch} onChange={e => setEleveSearch(e.target.value)} placeholder={t('activite.rechercher_eleve_placeholder')} />
                  </div>
                </div>
                {searchLoading && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>{t('activite.recherche_en_cours')}</div>}
                {elevesFound.length > 0 && (
                  <div style={{ marginTop: 8, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                    {elevesFound.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                        <span>{e.prenom_fr} {e.nom_fr} <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.matricule}</span></span>
                        <Button size="sm" onClick={() => inscrireEleve(e)}>{t('activite.inscrire')}</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="card">
              {inscriptions.length === 0 ? <div className="empty">{t('activite.aucun_inscrit')}</div> : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>{t('activite.col_eleve')}</th><th>{t('activite.col_matricule')}</th><th>{t('activite.col_inscrit_le')}</th><th style={{ width: 80 }} /></tr></thead>
                    <tbody>
                      {inscriptions.map(insc => (
                        <tr key={insc.id}>
                          <td style={{ fontWeight: 500 }}>{insc.eleve.prenom_fr} {insc.eleve.nom_fr}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{insc.eleve.matricule}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(insc.date_inscription)}</td>
                          <td>{canEdit && <button className="tb-btn tb-btn-danger" onClick={() => desinscrireEleve(insc)} title={t('activite.desinscrire')} aria-label={t('activite.desinscrire')}>✕</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─ Séances & présences ─ */}
        {activeTab === 'seances' && (
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Liste séances */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div className="card">
                {seances.length === 0 ? <div className="empty" style={{ padding: 16 }}>{t('activite.aucune_seance')}</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {seances.map(s => (
                      <div key={s.id} onClick={() => openPresences(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--rule)', background: activeSeance?.id === s.id ? 'var(--paper-2)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(s.date)}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.duree_min ? `${s.duree_min} min` : ''} · {s._count.presences} présences</div>
                        </div>
                        {canEdit && (
                          <button className="tb-btn tb-btn-danger" onClick={ev => { ev.stopPropagation(); supprimerSeance(s); }} title={t('actions.supprimer')} aria-label={t('actions.supprimer')}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Présences */}
            <div style={{ flex: 1 }}>
              {!activeSeance ? (
                <div className="empty">{t('activite.seance_select')}</div>
              ) : (
                <div className="card">
                  <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t('activite.presences_titre')} {fmtDate(activeSeance.date)}</span>
                    {canEdit && <Button onClick={savePresences} loading={savingPresences} size="sm">{t('actions.enregistrer')}</Button>}
                  </div>
                  {inscriptions.length === 0 ? <div className="empty">{t('activite.aucun_inscrit_activite')}</div> : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead><tr><th>{t('activite.col_eleve')}</th><th style={{ width: 160 }}>{t('activite.col_statut')}</th></tr></thead>
                        <tbody>
                          {inscriptions.map(insc => (
                            <tr key={insc.id}>
                              <td style={{ fontWeight: 500 }}>{insc.eleve.prenom_fr} {insc.eleve.nom_fr}</td>
                              <td>
                                <Select label="" value={presencesMap[insc.eleve.id] ?? 'present'}
                                  onChange={e => setPresencesMap(prev => ({ ...prev, [insc.eleve.id]: e.target.value }))}
                                  options={[{ value: 'present', label: t('activite.present') }, { value: 'absent', label: t('activite.absent') }, { value: 'retard', label: t('activite.retard') }]}
                                  disabled={!canEdit}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─ Évaluations ─ */}
        {activeTab === 'evaluations' && (
          <div className="card">
            {inscriptions.length === 0 ? <div className="empty">{t('activite.aucun_inscrit')}</div> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>{t('activite.col_eleve')}</th><th>{t('activite.col_periode')}</th><th>{t('activite.col_note20')}</th><th>{t('activite.appreciation_label')}</th><th style={{ width: 80 }} /></tr></thead>
                  <tbody>
                    {inscriptions.map(insc => {
                      const ev = insc.evaluations[0];
                      return (
                        <tr key={insc.id}>
                          <td style={{ fontWeight: 500 }}>{insc.eleve.prenom_fr} {insc.eleve.nom_fr}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ev?.periode ? `P${ev.periode}` : '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{ev?.note !== undefined ? `${ev.note}/${noteMax}` : '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-2)', fontStyle: ev?.appreciation ? 'normal' : 'italic' }}>{ev?.appreciation ?? '—'}</td>
                          <td>{canEdit && <button className="tb-btn" onClick={() => openEval(insc)} title="Évaluer" aria-label="Évaluer"><svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg></button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal séance */}
        <Modal isOpen={seanceModal} onClose={() => setSeanceModal(false)} title={t('activite.nouvelle_seance')} size="sm"
          footer={<div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => setSeanceModal(false)}>{t('actions.annuler')}</Button><Button onClick={creerSeance} loading={savingSeance}>{t('activite.creer')}</Button></div>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label={t('activite.date_label')} type="date" value={seanceForm.date} onChange={e => setSeanceForm(f => ({ ...f, date: e.target.value }))} />
            <Input label={t('activite.duree_label')} type="number" min="1" value={seanceForm.duree_min} onChange={e => setSeanceForm(f => ({ ...f, duree_min: e.target.value }))} placeholder={t('activite.duree_ph')} />
            <div className="field"><label className="field-label">{t('activite.notes_label')}</label><textarea className="input" rows={2} value={seanceForm.notes} onChange={e => setSeanceForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          </div>
        </Modal>

        {/* Modal évaluation */}
        <Modal isOpen={!!evalModal} onClose={() => setEvalModal(null)} title={evalModal ? `Évaluer — ${evalModal.eleve.prenom_fr} ${evalModal.eleve.nom_fr}` : ''} size="sm"
          footer={<div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => setEvalModal(null)}>{t('actions.annuler')}</Button><Button onClick={saveEval} loading={savingEval}>{t('actions.enregistrer')}</Button></div>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select label={t('activite.periode_opt_label')} value={evalForm.periode} onChange={e => setEvalForm(f => ({ ...f, periode: e.target.value }))}
              options={[{ value: '', label: '—' }, ...Array.from({ length: 3 }, (_, i) => ({ value: String(i + 1), label: `Période ${i + 1}` }))]} />
            <Input label={`Note /${noteMax}`} type="number" min="0" max={noteMax} step="0.5" value={evalForm.note} onChange={e => setEvalForm(f => ({ ...f, note: e.target.value }))} placeholder="—" />
            <div className="field"><label className="field-label">{t('activite.appreciation_label')}</label><textarea className="input" rows={3} value={evalForm.appreciation} onChange={e => setEvalForm(f => ({ ...f, appreciation: e.target.value }))} placeholder={t('activite.appreciation_ph')} style={{ resize: 'vertical' }} /></div>
          </div>
        </Modal>
      </>
    );
  }

  // ── Vue liste activités ───────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={t('activite.titre')}
        subtitle={t('activite.subtitle')}
        action={canEdit && <Button onClick={openCreate}>+ Créer une activité</Button>}
      />

      {loading ? <div className="empty">{t('common.chargement')}</div>
        : activites.length === 0 ? <div className="empty">{t('activite.aucune_creee')}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {activites.map(a => (
              <div key={a.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onClick={() => { setActiveAct(a); setActiveTab('inscriptions'); setActiveSeance(null); }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{a.nom_fr}</h3>
                    </div>
                    <Badge label={a.actif ? t('activite.actif') : t('activite.inactif')} variant={a.actif ? 'success' : 'neutral'} />
                  </div>
                  {a.description && <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.5 }}>{a.description}</p>}
                  <div className="row" style={{ gap: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                    <span>👥 {a._count.inscriptions} élève{a._count.inscriptions > 1 ? 's' : ''}{a.capacite_max ? `/${a.capacite_max}` : ''}</span>
                    <span>📅 {a._count.seances} séance{a._count.seances > 1 ? 's' : ''}</span>
                  </div>
                  {canEdit && (
                    <div className="row" style={{ gap: 6, marginTop: 12, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <button className="tb-btn" onClick={() => openEdit(a)} title="Modifier" aria-label="Modifier"><svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg></button>
                      {canDelete && <button className="tb-btn tb-btn-danger" onClick={() => deleteAct(a)} title="Supprimer"><svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* Modal activité */}
      <Modal isOpen={actModal} onClose={() => setActModal(false)} title={editAct ? t('activite.modifier_titre') : t('activite.nouvelle')} size="md"
        footer={<div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => setActModal(false)}>Annuler</Button><Button onClick={submitAct} loading={submitting}>{editAct ? 'Enregistrer' : 'Créer'}</Button></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label={t('activite.nom_label')} value={actForm.nom_fr} onChange={e => setActForm(f => ({ ...f, nom_fr: e.target.value }))} placeholder={t('activite.nom_ph')} />
          <div className="field"><label className="field-label">{t('activite.description_label')}</label><textarea className="input" rows={2} value={actForm.description} onChange={e => setActForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          <Input label={t('activite.capacite_label')} type="number" min="1" value={actForm.capacite_max} onChange={e => setActForm(f => ({ ...f, capacite_max: e.target.value }))} placeholder={t('activite.capacite_ph')} />
        </div>
      </Modal>
    </>
  );
}
