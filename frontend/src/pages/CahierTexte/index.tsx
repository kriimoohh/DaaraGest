import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAnneeScolaire } from '../../store/anneeStore';
import { useAuthStore } from '../../store/authStore';
import { nomClasse, nomMatiere } from '../../lib/noms';

interface Classe  { id: string; nom_fr: string; nom_ar?: string | null; filiere: string; }
interface RefMat  { id: string; nom_fr: string; nom_ar: string | null; }
interface RefCls  { id: string; nom_fr: string; nom_ar: string | null; }
interface Creneau { id: string; heure_debut: string; heure_fin: string; classe: RefCls; matiere: RefMat; classe_id: string; matiere_id: string; }
interface Seance  {
  id: string; classe_id: string; matiere_id: string; creneau_id: string | null;
  date: string; contenu: string; objectif: string | null;
  classe?: RefCls; matiere: RefMat;
  personnel?: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
}
interface Devoir {
  id: string; classe_id: string; matiere_id: string; donne_le: string; pour_le: string;
  consigne: string; type: string; classe?: RefCls; matiere: RefMat;
  personnel?: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
}
interface Journee { date: string; jour: string; personnel_id: string | null; creneaux: Creneau[]; seances: Seance[]; devoirs: Devoir[]; classes_visees: string[]; }
interface Visa {
  id: string; du: string; au: string; vise_le: string; commentaire: string | null;
  signataire: { nom_fr: string; prenom_fr: string | null };
}
interface Completude {
  total_prevus: number; total_renseignes: number; hors_edt: number; taux: number | null;
  par_jour: { date: string; jour: string; prevus: number; renseignes: number }[];
  par_matiere: { matiere: RefMat; prevus: number; renseignes: number }[];
}

const DEVOIR_TYPES = ['LECON', 'EXERCICE', 'RECITATION', 'AUTRE'] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
// Lundi de la semaine de `d` (les cours vont du lundi au vendredi/samedi).
function lundiDe(dISO: string): string {
  const d = new Date(`${dISO}T00:00:00Z`);
  const delta = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0, 10);
}
function plusJours(dISO: string, n: number): string {
  const d = new Date(`${dISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function CahierTextePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';
  const api = useApi();
  const [anneeId] = useAnneeScolaire();
  const role = useAuthStore(s2 => s2.user?.role ?? '');
  const estDirection = ['admin', 'directeur'].includes(role);

  const [onglet, setOnglet] = useState<'journee' | 'consultation'>('journee');

  // ── Ma journée ──────────────────────────────────────────────────────────────
  const [date, setDate] = useState(todayISO());
  const [journee, setJournee] = useState<Journee | null>(null);
  const [loadingJournee, setLoadingJournee] = useState(false);
  // Brouillons de saisie par créneau (contenu / objectif), initialisés depuis la séance existante.
  const [drafts, setDrafts] = useState<Record<string, { contenu: string; objectif: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  // Mini-formulaire devoir par créneau.
  const [devoirDrafts, setDevoirDrafts] = useState<Record<string, { consigne: string; pour_le: string; type: string }>>({});
  const [savingDevoir, setSavingDevoir] = useState<string | null>(null);

  const chargerJournee = useCallback(async () => {
    if (!anneeId || !date) return;
    setLoadingJournee(true);
    try {
      const j = await api.get<Journee>(`/api/v1/cahier/journee?date=${date}&annee_scolaire_id=${anneeId}`);
      setJournee(j);
      const d: Record<string, { contenu: string; objectif: string }> = {};
      for (const c of j.creneaux) {
        const s = j.seances.find(x => x.creneau_id === c.id);
        d[c.id] = { contenu: s?.contenu ?? '', objectif: s?.objectif ?? '' };
      }
      setDrafts(d);
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_chargement'));
    } finally {
      setLoadingJournee(false);
    }
    // `api` volontairement hors dépendances (référence instable → boucle de requêtes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeId, date]);

  useEffect(() => { if (onglet === 'journee') void chargerJournee(); }, [onglet, chargerJournee]);

  const enregistrerSeance = async (c: Creneau) => {
    const draft = drafts[c.id];
    if (!draft?.contenu.trim()) { toast.error(t('cahier.err_contenu_vide')); return; }
    setSaving(c.id);
    try {
      await api.post('/api/v1/cahier/seances', {
        annee_scolaire_id: anneeId, classe_id: c.classe_id, matiere_id: c.matiere_id,
        date, creneau_id: c.id, contenu: draft.contenu.trim(),
        objectif: draft.objectif.trim() || null,
      });
      toast.success(t('cahier.ok_seance'));
      await chargerJournee();
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_enregistrement'));
    } finally {
      setSaving(null);
    }
  };

  const ajouterDevoir = async (c: Creneau) => {
    const d = devoirDrafts[c.id];
    if (!d?.consigne.trim() || !d.pour_le) { toast.error(t('cahier.err_devoir_incomplet')); return; }
    setSavingDevoir(c.id);
    try {
      await api.post('/api/v1/cahier/devoirs', {
        annee_scolaire_id: anneeId, classe_id: c.classe_id, matiere_id: c.matiere_id,
        donne_le: date, pour_le: d.pour_le, consigne: d.consigne.trim(), type: d.type || 'EXERCICE',
      });
      toast.success(t('cahier.ok_devoir'));
      setDevoirDrafts(prev => ({ ...prev, [c.id]: { consigne: '', pour_le: '', type: 'EXERCICE' } }));
      await chargerJournee();
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_enregistrement'));
    } finally {
      setSavingDevoir(null);
    }
  };

  const supprimerDevoir = async (id: string) => {
    try {
      await api.delete(`/api/v1/cahier/devoirs/${id}`);
      toast.success(t('cahier.ok_supprime'));
      if (onglet === 'journee') await chargerJournee(); else await chargerConsultation();
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_enregistrement'));
    }
  };

  // ── Consultation ───────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<Classe[]>([]);
  const [classeId, setClasseId] = useState('');
  const [du, setDu] = useState(lundiDe(todayISO()));
  const [au, setAu] = useState(plusJours(lundiDe(todayISO()), 6));
  const [seances, setSeances] = useState<Seance[]>([]);
  const [devoirs, setDevoirs] = useState<Devoir[]>([]);
  const [comp, setComp] = useState<Completude | null>(null);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [commentaireVisa, setCommentaireVisa] = useState('');
  const [visaEnCours, setVisaEnCours] = useState(false);
  const [loadingConsult, setLoadingConsult] = useState(false);

  useEffect(() => {
    if (!anneeId) return;
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}`).then(setClasses).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeId]);

  const chargerConsultation = useCallback(async () => {
    if (!anneeId || !classeId || !du || !au) return;
    setLoadingConsult(true);
    try {
      const params = `classe_id=${classeId}&annee_scolaire_id=${anneeId}&du=${du}&au=${au}`;
      const [s, d, c, v] = await Promise.all([
        api.get<Seance[]>(`/api/v1/cahier/seances?${params}`),
        api.get<Devoir[]>(`/api/v1/cahier/devoirs?${params}`),
        api.get<Completude>(`/api/v1/cahier/completude?${params}`),
        api.get<Visa[]>(`/api/v1/cahier/visas?classe_id=${classeId}&annee_scolaire_id=${anneeId}`),
      ]);
      setSeances(s); setDevoirs(d); setComp(c); setVisas(v);
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_chargement'));
    } finally {
      setLoadingConsult(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneeId, classeId, du, au]);

  useEffect(() => { if (onglet === 'consultation') void chargerConsultation(); }, [onglet, chargerConsultation]);

  const viser = async () => {
    if (!classeId || !du || !au) return;
    setVisaEnCours(true);
    try {
      await api.post('/api/v1/cahier/visas', {
        annee_scolaire_id: anneeId, classe_id: classeId, du, au,
        commentaire: commentaireVisa.trim() || null,
      });
      toast.success(t('cahier.ok_visa'));
      setCommentaireVisa('');
      await chargerConsultation();
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_enregistrement'));
    } finally {
      setVisaEnCours(false);
    }
  };

  const [exportEnCours, setExportEnCours] = useState(false);
  const exporterPdf = async () => {
    if (!classeId || !du || !au) return;
    setExportEnCours(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/cahier/export-pdf?classe_id=${classeId}&annee_scolaire_id=${anneeId}&du=${du}&au=${au}`,
        { credentials: 'include' }
      );
      if (!resp.ok) throw new Error(t('cahier.err_export'));
      const url = URL.createObjectURL(await resp.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `cahier-${du}-${au}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('cahier.ok_export'));
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_export'));
    } finally {
      setExportEnCours(false);
    }
  };

  const deviser = async (id: string) => {
    try {
      await api.delete(`/api/v1/cahier/visas/${id}`);
      toast.success(t('cahier.ok_devisa'));
      await chargerConsultation();
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_enregistrement'));
    }
  };

  const fmtDate = (d: string) =>
    new Date(d.slice(0, 10)).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' });
  const nomPersonnel = (p?: { utilisateur: { nom_fr: string; prenom_fr: string | null } }) =>
    p ? `${p.utilisateur.prenom_fr ?? ''} ${p.utilisateur.nom_fr}`.trim() : '';
  const typeLabel = (ty: string) => t(`cahier.type_${ty.toLowerCase()}`, ty);

  // Séances de consultation groupées par date (desc).
  const seancesParDate = new Map<string, Seance[]>();
  for (const s of seances) {
    const k = s.date.slice(0, 10);
    if (!seancesParDate.has(k)) seancesParDate.set(k, []);
    seancesParDate.get(k)!.push(s);
  }

  const pill = (actif: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
    background: actif ? 'var(--ink)' : 'transparent',
    color: actif ? 'var(--paper)' : 'var(--ink-3)', fontWeight: actif ? 600 : 400,
  });

  return (
    <>
      <PageHeader eyebrow={t('cahier.eyebrow')} title={t('cahier.titre')} />

      <div style={{ display: 'flex', marginBottom: 16, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden', width: 'fit-content' }}>
        <button style={pill(onglet === 'journee')} onClick={() => setOnglet('journee')}>{t('cahier.ma_journee')}</button>
        <button style={pill(onglet === 'consultation')} onClick={() => setOnglet('consultation')}>{t('cahier.consultation')}</button>
      </div>

      {/* ── Ma journée ── */}
      {onglet === 'journee' && (
        <>
          <div className="card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Input label={t('cahier.date')} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Button variant="secondary" onClick={chargerJournee} loading={loadingJournee}>{t('cahier.charger')}</Button>
          </div>

          {journee && journee.personnel_id === null && (
            <div className="card-pad" style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              {t('cahier.sans_fiche_personnel')}
            </div>
          )}

          {journee && journee.personnel_id !== null && journee.creneaux.length === 0 && !loadingJournee && (
            <div className="card-pad" style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('cahier.aucun_creneau')}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {journee?.creneaux.map(c => {
              const seance = journee.seances.find(s => s.creneau_id === c.id);
              const draft = drafts[c.id] ?? { contenu: '', objectif: '' };
              const devoirDraft = devoirDrafts[c.id] ?? { consigne: '', pour_le: '', type: 'EXERCICE' };
              const devoirsDuCreneau = journee.devoirs.filter(d => d.classe_id === c.classe_id && d.matiere_id === c.matiere_id);
              const verrouille = journee.classes_visees.includes(c.classe_id);
              return (
                <div key={c.id} className="card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span className="font-num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.heure_debut}–{c.heure_fin}</span>
                    <strong style={{ fontSize: 14 }}>{nomClasse(c.classe)}</strong>
                    <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{nomMatiere(c.matiere)}</span>
                    {seance
                      ? <Badge variant="success" dot label={t('cahier.renseignee')} />
                      : <Badge variant="neutral" dot label={t('cahier.a_renseigner')} />}
                    {verrouille && <Badge variant="warning" dot label={t('cahier.verrouillee')} />}
                  </div>

                  <textarea
                    className="input"
                    rows={2}
                    disabled={verrouille}
                    placeholder={t('cahier.contenu_placeholder')}
                    value={draft.contenu}
                    onChange={e => setDrafts(prev => ({ ...prev, [c.id]: { ...draft, contenu: e.target.value } }))}
                    style={{ width: '100%', resize: 'vertical', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      disabled={verrouille}
                      placeholder={t('cahier.objectif_placeholder')}
                      value={draft.objectif}
                      onChange={e => setDrafts(prev => ({ ...prev, [c.id]: { ...draft, objectif: e.target.value } }))}
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <Button size="sm" onClick={() => enregistrerSeance(c)} loading={saving === c.id} disabled={verrouille}>
                      {t('cahier.enregistrer')}
                    </Button>
                  </div>

                  {/* Devoirs donnés ce jour pour cette classe × matière */}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--rule)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{t('cahier.devoirs')}</div>
                    {devoirsDuCreneau.map(d => (
                      <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                        <Badge variant="info" label={typeLabel(d.type)} />
                        <span style={{ flex: 1 }}>{d.consigne}</span>
                        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{t('cahier.pour_le')} {fmtDate(d.pour_le)}</span>
                        <button onClick={() => supprimerDevoir(d.id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger-text)', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                      <input
                        className="input"
                        placeholder={t('cahier.consigne_placeholder')}
                        value={devoirDraft.consigne}
                        onChange={e => setDevoirDrafts(prev => ({ ...prev, [c.id]: { ...devoirDraft, consigne: e.target.value } }))}
                        style={{ flex: 2, minWidth: 180 }}
                      />
                      <input
                        className="input" type="date" value={devoirDraft.pour_le} min={date}
                        onChange={e => setDevoirDrafts(prev => ({ ...prev, [c.id]: { ...devoirDraft, pour_le: e.target.value } }))}
                      />
                      <select
                        className="input" value={devoirDraft.type}
                        onChange={e => setDevoirDrafts(prev => ({ ...prev, [c.id]: { ...devoirDraft, type: e.target.value } }))}
                      >
                        {DEVOIR_TYPES.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
                      </select>
                      <Button size="sm" variant="secondary" onClick={() => ajouterDevoir(c)} loading={savingDevoir === c.id} disabled={verrouille}>
                        + {t('cahier.ajouter_devoir')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Consultation ── */}
      {onglet === 'consultation' && (
        <>
          <div className="card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Select label={t('nav.classes')}
              value={classeId} onChange={e => setClasseId(e.target.value)}
              options={[{ value: '', label: t('common.selectionner') }, ...classes.map(c => ({ value: c.id, label: nomClasse(c) }))]}
            />
            <Input label={t('cahier.du')} type="date" value={du} onChange={e => setDu(e.target.value)} />
            <Input label={t('cahier.au')} type="date" value={au} onChange={e => setAu(e.target.value)} />
            <Button variant="secondary" onClick={chargerConsultation} loading={loadingConsult} disabled={!classeId}>
              {t('cahier.charger')}
            </Button>
            <Button variant="secondary" onClick={exporterPdf} loading={exportEnCours} disabled={!classeId}>
              ⬇ {t('cahier.exporter_pdf')}
            </Button>
          </div>

          {classeId && comp && (
            <div className="card-pad" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: comp.taux === null ? 'var(--ink-3)' : comp.taux >= 80 ? 'var(--success-text)' : comp.taux >= 50 ? 'var(--warning-text)' : 'var(--danger-text)' }}>
                    {comp.taux === null ? '—' : `${comp.taux}%`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{t('cahier.completude')}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  {t('cahier.seances_renseignees', { renseignes: comp.total_renseignes, prevus: comp.total_prevus })}
                  {comp.hors_edt > 0 && <span style={{ color: 'var(--ink-3)' }}> · {t('cahier.hors_edt', { n: comp.hors_edt })}</span>}
                </div>
                {estDirection && (
                  <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      placeholder={t('cahier.commentaire_visa_placeholder')}
                      value={commentaireVisa}
                      onChange={e => setCommentaireVisa(e.target.value)}
                      style={{ minWidth: 180 }}
                    />
                    <Button size="sm" onClick={viser} loading={visaEnCours}>{t('cahier.viser')}</Button>
                  </div>
                )}
              </div>
              {comp.par_jour.some(j => j.renseignes < j.prevus) && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {comp.par_jour.filter(j => j.renseignes < j.prevus).map(j => (
                    <Badge key={j.date} variant="warning" label={`${fmtDate(j.date)} : ${j.renseignes}/${j.prevus}`} />
                  ))}
                </div>
              )}
              {visas.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--rule)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {visas.map(v => (
                    <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
                      <Badge variant="accent" dot label={t('cahier.visa')} />
                      <span>{fmtDate(v.du)} → {fmtDate(v.au)}</span>
                      <span style={{ color: 'var(--ink-3)' }}>
                        {t('cahier.vise_par', { nom: `${v.signataire.prenom_fr ?? ''} ${v.signataire.nom_fr}`.trim() })}
                      </span>
                      {v.commentaire && <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>« {v.commentaire} »</span>}
                      {estDirection && (
                        <button onClick={() => deviser(v.id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger-text)', cursor: 'pointer', fontSize: 12 }}>
                          {t('cahier.deviser')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {classeId && !loadingConsult && seances.length === 0 && devoirs.length === 0 && (
            <div className="card-pad" style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('cahier.aucune_seance')}</div>
          )}

          {[...seancesParDate.entries()].map(([jour, list]) => (
            <div key={jour} className="card-pad" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, textTransform: 'capitalize' }}>{fmtDate(jour)}</div>
              {list.map(s => (
                <div key={s.id} style={{ padding: '8px 0', borderTop: '1px solid var(--rule)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>{nomMatiere(s.matiere)}</strong>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{nomPersonnel(s.personnel)}</span>
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{s.contenu}</div>
                  {s.objectif && (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 2 }}>
                      {t('cahier.objectif')} : {s.objectif}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {devoirs.length > 0 && (
            <div className="card-pad">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('cahier.devoirs_a_faire')}</div>
              {devoirs.map(d => (
                <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--ink-3)', fontSize: 12, textTransform: 'capitalize', minWidth: 130 }}>{fmtDate(d.pour_le)}</span>
                  <Badge variant="info" label={typeLabel(d.type)} />
                  <strong style={{ fontSize: 12 }}>{nomMatiere(d.matiere)}</strong>
                  <span style={{ flex: 1 }}>{d.consigne}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{nomPersonnel(d.personnel)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
