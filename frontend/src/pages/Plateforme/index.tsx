import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Table, Column } from '../../components/ui/Table';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { ActionMenu } from '../../components/ui/ActionMenu';

interface Etablissement {
  [k: string]: unknown;
  id: string; nom_fr: string; code: string; actif: boolean; email: string | null;
  adresse: string | null; telephone: string | null; nb_eleves: number; nb_utilisateurs: number;
  nb_classes: number; derniere_connexion: string | null; admins_bloques: number;
}
interface Admin { id: string; identifiant: string; nom_fr: string; prenom_fr: string | null; actif: boolean; last_login: string | null; verrouille_jusqu: string | null }
interface LigneJournal { id: string; action: string; entite: string; details: Record<string, unknown> | null; created_at: string; acteur: string }
interface Reinit { identifiant: string; code: string; mot_de_passe_temporaire: string }
interface Creation { etablissement: { nom_fr: string; code: string }; admin: { identifiant: string; mot_de_passe_temporaire: string } }

const FILIERES = ['FR', 'AR', 'EN'] as const;
const vide = {
  nom_fr: '', code: '', adresse: '', telephone: '', email: '',
  filieres: ['FR', 'AR'] as string[], referentiel_matieres: false,
  annee_libelle: '', date_debut: '', date_fin: '',
  admin_identifiant: 'admin', admin_nom: '', admin_prenom: '',
};

// Administration de la plateforme multi-établissement (super-admins uniquement).
type Section = 'accueil' | 'ecoles' | 'journal';

export function PlateformePage() {
  // La vue (vue d'ensemble / écoles / journal) suit l'adresse, choisie depuis le menu de gauche.
  const { pathname } = useLocation();
  const section: Section = pathname.endsWith('/ecoles') ? 'ecoles' : pathname.endsWith('/journal') ? 'journal' : 'accueil';
  const { t } = useTranslation();
  const api = useApi();
  const superAdmin = useAuthStore(s => !!s.user?.super_admin);
  const monEtab = useAuthStore(s => s.user?.etablissement_id);
  const [liste, setListe] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(vide);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<Creation | null>(null);
  const [aSuspendre, setASuspendre] = useState<Etablissement | null>(null);
  const [journal, setJournal] = useState<LigneJournal[]>([]);
  const [edition, setEdition] = useState<Etablissement | null>(null);
  const [formEdit, setFormEdit] = useState({ nom_fr: '', code: '', adresse: '', telephone: '', email: '' });
  const [adminsDe, setAdminsDe] = useState<Etablissement | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [aReinit, setAReinit] = useState<Admin | null>(null);
  const [reinit, setReinit] = useState<Reinit | null>(null);
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : t('plateforme.jamais');

  // Écoles + journal, rechargés ensemble après chaque action (création, modification, suspension,
  // réinitialisation) pour que « Dernières actions » reste à jour.
  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [ecoles, lignes] = await Promise.all([
        api.get<Etablissement[]>('/api/v1/plateforme/etablissements'),
        api.get<LigneJournal[]>('/api/v1/plateforme/journal'),
      ]);
      setListe(ecoles); setJournal(lignes);
    }
    catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
    finally { setLoading(false); }
    // `api` volontairement hors dépendances (référence instable → boucle de requêtes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (superAdmin) void charger(); }, [superAdmin, charger, section]);

  if (!superAdmin) return <Navigate to="/dashboard" replace />;

  const champ = (k: keyof typeof vide) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value })),
  });

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const r = await api.post<Creation>('/api/v1/plateforme/etablissements', {
        nom_fr: form.nom_fr, code: form.code, adresse: form.adresse || null, telephone: form.telephone || null,
        email: form.email || null, filieres: form.filieres, referentiel_matieres: form.referentiel_matieres,
        annee: form.annee_libelle && form.date_debut && form.date_fin
          ? { libelle: form.annee_libelle, date_debut: form.date_debut, date_fin: form.date_fin } : null,
        admin: { identifiant: form.admin_identifiant || 'admin', nom_fr: form.admin_nom, prenom_fr: form.admin_prenom || null },
      });
      setOuvert(false); setForm(vide); setCree(r);
      await charger();
    } catch (err) {
      toast.error((err as Error).message || t('plateforme.err'));
    } finally { setEnvoi(false); }
  };

  const basculer = async (e: Etablissement, actif: boolean) => {
    try {
      await api.patch(`/api/v1/plateforme/etablissements/${e.id}`, { actif });
      setASuspendre(null);
      await charger();
    } catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
  };

  const ouvrirEdition = (e: Etablissement) => {
    setEdition(e);
    setFormEdit({ nom_fr: e.nom_fr, code: e.code, adresse: e.adresse ?? '', telephone: e.telephone ?? '', email: e.email ?? '' });
  };
  const enregistrerEdition = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!edition) return;
    setEnvoi(true);
    try {
      await api.patch(`/api/v1/plateforme/etablissements/${edition.id}`, {
        nom_fr: formEdit.nom_fr, code: formEdit.code, adresse: formEdit.adresse, telephone: formEdit.telephone, email: formEdit.email,
      });
      toast.success(t('plateforme.enregistre'));
      setEdition(null);
      await charger();
    } catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
    finally { setEnvoi(false); }
  };
  const ouvrirAdmins = async (e: Etablissement) => {
    setAdminsDe(e); setAdmins([]);
    try { setAdmins(await api.get<Admin[]>(`/api/v1/plateforme/etablissements/${e.id}/admins`)); }
    catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
  };
  const reinitialiser = async () => {
    if (!adminsDe || !aReinit) return;
    try {
      const r = await api.post<Reinit>(`/api/v1/plateforme/etablissements/${adminsDe.id}/admins/${aReinit.id}/reinitialiser`, {});
      setAReinit(null); setAdminsDe(null); setReinit(r);
      void charger();
    } catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
  };
  const decrireAction = (l: LigneJournal) => {
    const d = l.details ?? {};
    const ecole = String(d.etablissement ?? d.nom ?? '');
    const code = d.code ? ` (${String(d.code)})` : '';
    if (l.action === 'PASSWORD_RESET') return `${t('plateforme.act_PASSWORD_RESET')} ${String(d.identifiant ?? '')} — ${ecole}${code}`;
    const statut = d.actif === false ? ` — ${t('plateforme.suspendu_le')}` : d.actif === true ? ` — ${t('plateforme.reactive_le')}` : '';
    return `${t(`plateforme.act_${l.action}`, l.action)} ${ecole}${code}${statut}`;
  };

  const prenom = useAuthStore.getState().user?.prenom_fr || useAuthStore.getState().user?.nom_fr || '';
  const somme = (k: 'nb_eleves' | 'nb_classes' | 'nb_utilisateurs' | 'admins_bloques') => liste.reduce((n, e) => n + (e[k] as number ?? 0), 0);
  const suspendues = liste.filter(e => !e.actif).length;
  const indicateurs = [
    { label: t('plateforme.total_ecoles'), valeur: liste.length, pied: suspendues ? t('plateforme.total_suspendues', { n: suspendues }) : t('plateforme.total_actives', { n: liste.length - suspendues }) },
    { label: t('plateforme.total_eleves'), valeur: somme('nb_eleves'), pied: t('plateforme.classes') + ' : ' + somme('nb_classes') },
    { label: t('plateforme.total_comptes'), valeur: somme('nb_utilisateurs'), pied: '' },
    { label: t('plateforme.admins_bloques'), valeur: somme('admins_bloques'), pied: '' },
  ];
  // Écoles à surveiller : suspendue, admin bloqué, aucune connexion depuis 14 jours, aucun élève.
  const JOURS = 14;
  const jours = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;
  const alertes: { cle: string; ecole: Etablissement; texte: string; niveau: 'warning' | 'danger' | 'neutral'; bouton: string; action: () => void }[] = [];
  for (const e of liste) {
    if (!e.actif) { alertes.push({ cle: `${e.id}-s`, ecole: e, texte: t('plateforme.alerte_suspendue'), niveau: 'danger', bouton: t('plateforme.reactiver'), action: () => basculer(e, true) }); continue; }
    if ((e.admins_bloques as number) > 0) alertes.push({ cle: `${e.id}-b`, ecole: e, texte: t('plateforme.alerte_bloques', { n: e.admins_bloques }), niveau: 'warning', bouton: t('plateforme.admins'), action: () => ouvrirAdmins(e) });
    const j = jours(e.derniere_connexion);
    if (j === null) alertes.push({ cle: `${e.id}-j`, ecole: e, texte: t('plateforme.alerte_jamais'), niveau: 'neutral', bouton: t('plateforme.admins'), action: () => ouvrirAdmins(e) });
    else if (j >= JOURS) alertes.push({ cle: `${e.id}-i`, ecole: e, texte: t('plateforme.alerte_inactive', { n: j }), niveau: 'warning', bouton: t('plateforme.admins'), action: () => ouvrirAdmins(e) });
    if (e.nb_eleves === 0) alertes.push({ cle: `${e.id}-v`, ecole: e, texte: t('plateforme.alerte_vide'), niveau: 'neutral', bouton: t('plateforme.modifier'), action: () => ouvrirEdition(e) });
  }

  const copier = async (texte: string) => {
    try { await navigator.clipboard.writeText(texte); toast.success(t('plateforme.copie')); } catch { /* presse-papiers indisponible */ }
  };

  const colonnes: Column<Etablissement>[] = [
    { key: 'nom_fr', header: t('plateforme.nom'), render: e => <strong>{e.nom_fr}</strong> },
    { key: 'code', header: t('plateforme.code'), render: e => <code>{e.code}</code> },
    { key: 'nb_eleves', header: t('plateforme.eleves') },
    { key: 'nb_classes', header: t('plateforme.classes') },
    { key: 'nb_utilisateurs', header: t('plateforme.comptes') },
    { key: 'derniere_connexion', header: t('plateforme.derniere_connexion'), render: e => <span style={{ fontSize: 12.5 }}>{fmt(e.derniere_connexion)}</span> },
    { key: 'actif', header: t('plateforme.statut'), render: e =>
      <Badge variant={e.actif ? 'success' : 'warning'} label={e.actif ? t('plateforme.actif') : t('plateforme.suspendu')} /> },
    { key: 'actions', header: '', width: '48px', render: e => (
      <ActionMenu items={[
        { label: t('plateforme.modifier'), onClick: () => ouvrirEdition(e) },
        { label: t('plateforme.admins'), onClick: () => ouvrirAdmins(e) },
        ...(e.id === monEtab ? [] : e.actif
          ? [{ label: t('plateforme.suspendre'), onClick: () => setASuspendre(e), variant: 'danger' as const }]
          : [{ label: t('plateforme.reactiver'), onClick: () => basculer(e, true) }]),
      ]} />) },
  ];

  return (
    <>
      {section === 'accueil' && (
        <PageHeader eyebrow={t('plateforme.vue_eyebrow')} title={t('plateforme.bienvenue', { nom: prenom })} />
      )}
      {section === 'ecoles' && <PageHeader eyebrow={t('plateforme.eyebrow')} title={t('plateforme.ecoles_titre')} />}
      {section === 'journal' && <PageHeader eyebrow={t('plateforme.eyebrow')} title={t('plateforme.journal_titre')} />}

      {section !== 'journal' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {section === 'accueil' && <p style={{ margin: 0, color: 'var(--ink-3)' }}>{t('plateforme.bienvenue_sous')}</p>}
          <div style={{ flex: 1 }} />
          <Button onClick={() => setOuvert(true)}>+ {t('plateforme.nouvelle')}</Button>
        </div>
      )}

      {section !== 'journal' && (
        <div className="grid-4 mb-4">
          {indicateurs.map(k => (
            <div key={k.label} className="card stat">
              <div className="stat-label">{k.label}</div>
              <div className="stat-value font-display">{k.valeur}</div>
              <div className="stat-foot"><span className="muted">{k.pied}</span></div>
            </div>
          ))}
        </div>
      )}

      {section === 'accueil' && (
        <div className="grid-2 mb-4" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-hd"><h3>{t('plateforme.a_surveiller')}</h3></div>
            {alertes.length === 0
              ? <div className="card-pad" style={{ color: 'var(--ink-3)' }}>{t('plateforme.rien_a_signaler')}</div>
              : [...new Set(alertes.map(a => a.ecole.id))].map(id => {
                // Une ligne par école : ses alertes en badges, et l'action de la plus importante.
                const siennes = alertes.filter(a => a.ecole.id === id);
                return (
                  <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, flex: '1 1 160px' }}>{siennes[0].ecole.nom_fr}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {siennes.map(a => <Badge key={a.cle} variant={a.niveau} label={a.texte} />)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => siennes[0].action()}>{siennes[0].bouton}</Button>
                  </div>
                );
              })}
          </div>
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{t('plateforme.dernieres_actions')}</h3>
              <Link to="/plateforme/journal" style={{ fontSize: 13, color: 'var(--terra)' }}>{t('plateforme.voir_tout')}</Link>
            </div>
            {journal.length === 0
              ? <div className="card-pad" style={{ color: 'var(--ink-3)' }}>{t('plateforme.journal_vide')}</div>
              : journal.slice(0, 6).map(l => (
                <div key={l.id} style={{ padding: '10px 16px', borderTop: '1px solid var(--rule)', fontSize: 13 }}>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{fmt(l.created_at)}</div>
                  <div><strong>{l.acteur}</strong> {decrireAction(l)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {section !== 'journal' && (
        <div className="card">
          {section === 'accueil' && (
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{t('plateforme.ecoles_titre')}</h3>
              <Link to="/plateforme/ecoles" style={{ fontSize: 13, color: 'var(--terra)' }}>{t('plateforme.voir_tout')}</Link>
            </div>
          )}
          <Table columns={colonnes} data={liste} loading={loading} emptyMessage={t('plateforme.vide')} />
        </div>
      )}

      {section === 'journal' && (
        <div className="card">
          {journal.length === 0
            ? <div className="card-pad" style={{ color: 'var(--ink-3)' }}>{t('plateforme.journal_vide')}</div>
            : journal.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--rule)', fontSize: 13.5, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--ink-3)', minWidth: 120 }}>{fmt(l.created_at)}</span>
                <span><strong>{l.acteur}</strong> {decrireAction(l)}</span>
              </div>
            ))}
        </div>
      )}

      <Modal isOpen={!!edition} onClose={() => setEdition(null)} title={edition ? t('plateforme.modifier_titre', { nom: edition.nom_fr }) : ''} size="lg">
        <form onSubmit={enregistrerEdition} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label={t('plateforme.nom')} required value={formEdit.nom_fr} onChange={e => setFormEdit(f => ({ ...f, nom_fr: e.target.value }))} />
          <div>
            <Input label={t('plateforme.code')} required maxLength={8} value={formEdit.code} onChange={e => setFormEdit(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            {edition && formEdit.code !== edition.code && (
              <div style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 4 }}>{t('plateforme.code_change_aide')}</div>
            )}
          </div>
          <div className="grid-2">
            <Input label={t('plateforme.adresse')} value={formEdit.adresse} onChange={e => setFormEdit(f => ({ ...f, adresse: e.target.value }))} />
            <Input label={t('plateforme.telephone')} value={formEdit.telephone} onChange={e => setFormEdit(f => ({ ...f, telephone: e.target.value }))} />
          </div>
          <Input label={t('plateforme.email')} type="email" value={formEdit.email} onChange={e => setFormEdit(f => ({ ...f, email: e.target.value }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" loading={envoi}>{t('plateforme.enregistrer')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!adminsDe} onClose={() => setAdminsDe(null)} title={adminsDe ? t('plateforme.admins_titre', { nom: adminsDe.nom_fr }) : ''} size="lg">
        {admins.length === 0
          ? <p style={{ color: 'var(--ink-3)' }}>{t('plateforme.admins_vide')}</p>
          : admins.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--rule)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{`${a.prenom_fr ?? ''} ${a.nom_fr}`.trim()} <code style={{ fontWeight: 400, color: 'var(--ink-3)' }}>{a.identifiant}</code></div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('plateforme.derniere_connexion')} : {fmt(a.last_login)}</div>
              </div>
              {!a.actif && <Badge variant="neutral" label={t('plateforme.inactif')} />}
              {a.verrouille_jusqu && new Date(a.verrouille_jusqu) > new Date() && <Badge variant="warning" label={t('plateforme.verrouille')} />}
              {a.actif && <Button size="sm" variant="secondary" onClick={() => setAReinit(a)}>{t('plateforme.reinitialiser')}</Button>}
            </div>
          ))}
      </Modal>

      <ConfirmModal
        isOpen={!!aReinit}
        onClose={() => setAReinit(null)}
        onConfirm={reinitialiser}
        title={t('plateforme.reinitialiser')}
        confirmLabel={t('plateforme.reinitialiser')}
        message={aReinit ? t('plateforme.confirm_reinit', { identifiant: aReinit.identifiant }) : ''}
      />

      <Modal isOpen={!!reinit} onClose={() => setReinit(null)} title={t('plateforme.reinit_titre')} size="md"
        footer={<Button onClick={() => setReinit(null)}>{t('plateforme.fermer')}</Button>}>
        {reinit && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t('plateforme.reinit_texte')}</p>
            {[[t('plateforme.code'), reinit.code], [t('plateforme.admin_identifiant'), reinit.identifiant], [t('plateforme.mdp'), reinit.mot_de_passe_temporaire]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ fontSize: 14 }}>{v}</code>
                  <Button size="sm" variant="ghost" onClick={() => copier(v)}>{t('plateforme.copier')}</Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={ouvert} onClose={() => setOuvert(false)} title={t('plateforme.nouvelle')} size="xl">
        <form onSubmit={creer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label={t('plateforme.nom')} required {...champ('nom_fr')} />
          <div>
            <Input label={t('plateforme.code')} required maxLength={8} placeholder="ABC"
              value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{t('plateforme.code_aide')}</div>
          </div>
          <div className="grid-2">
            <Input label={t('plateforme.adresse')} {...champ('adresse')} />
            <Input label={t('plateforme.telephone')} {...champ('telephone')} />
          </div>
          <Input label={t('plateforme.email')} type="email" {...champ('email')} />
          <div>
            <div className="field-label">{t('plateforme.filieres')}</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {FILIERES.map(f => (
                <label key={f} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={form.filieres.includes(f)}
                    onChange={e => setForm(s => ({ ...s, filieres: e.target.checked ? [...s.filieres, f] : s.filieres.filter(x => x !== f) }))} />
                  {f}
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.referentiel_matieres}
              onChange={e => setForm(s => ({ ...s, referentiel_matieres: e.target.checked }))} />
            {t('plateforme.referentiel')}
          </label>
          <div className="field-label" style={{ marginTop: 4 }}>{t('plateforme.annee')}</div>
          <div className="grid-3">
            <Input label={t('plateforme.annee_libelle')} placeholder="2026-2027" {...champ('annee_libelle')} />
            <Input label={t('plateforme.debut')} type="date" {...champ('date_debut')} />
            <Input label={t('plateforme.fin')} type="date" {...champ('date_fin')} />
          </div>
          <div className="field-label" style={{ marginTop: 4 }}>{t('plateforme.admin')}</div>
          <div className="grid-3">
            <Input label={t('plateforme.admin_nom')} required {...champ('admin_nom')} />
            <Input label={t('plateforme.admin_prenom')} {...champ('admin_prenom')} />
            <Input label={t('plateforme.admin_identifiant')} required {...champ('admin_identifiant')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" loading={envoi} disabled={form.filieres.length === 0}>{t('plateforme.creer')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!cree} onClose={() => setCree(null)} title={t('plateforme.cree_titre')} size="md"
        footer={<Button onClick={() => setCree(null)}>{t('plateforme.fermer')}</Button>}>
        {cree && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t('plateforme.cree_texte')}</p>
            {[
              [t('plateforme.nom'), cree.etablissement.nom_fr],
              [t('plateforme.code'), cree.etablissement.code],
              [t('plateforme.admin_identifiant'), cree.admin.identifiant],
              [t('plateforme.mdp'), cree.admin.mot_de_passe_temporaire],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'var(--paper-2)', borderRadius: 'var(--r-md)' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ fontSize: 14 }}>{v}</code>
                  <Button size="sm" variant="ghost" onClick={() => copier(v)}>{t('plateforme.copier')}</Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!aSuspendre}
        onClose={() => setASuspendre(null)}
        onConfirm={() => aSuspendre && basculer(aSuspendre, false)}
        title={t('plateforme.suspendre')}
        confirmLabel={t('plateforme.suspendre')}
        message={aSuspendre ? t('plateforme.confirm_suspendre', { nom: aSuspendre.nom_fr }) : ''}
      />
    </>
  );
}
