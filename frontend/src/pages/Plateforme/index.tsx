import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
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

interface Etablissement {
  [k: string]: unknown;
  id: string; nom_fr: string; code: string; actif: boolean;
  adresse: string | null; telephone: string | null; nb_eleves: number; nb_utilisateurs: number;
}
interface Creation { etablissement: { nom_fr: string; code: string }; admin: { identifiant: string; mot_de_passe_temporaire: string } }

const FILIERES = ['FR', 'AR', 'EN'] as const;
const vide = {
  nom_fr: '', code: '', adresse: '', telephone: '', email: '',
  filieres: ['FR', 'AR'] as string[], referentiel_matieres: false,
  annee_libelle: '', date_debut: '', date_fin: '',
  admin_identifiant: 'admin', admin_nom: '', admin_prenom: '',
};

// Administration de la plateforme multi-établissement (super-admins uniquement).
export function PlateformePage() {
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

  const charger = useCallback(async () => {
    setLoading(true);
    try { setListe(await api.get<Etablissement[]>('/api/v1/plateforme/etablissements')); }
    catch (err) { toast.error((err as Error).message || t('plateforme.err')); }
    finally { setLoading(false); }
    // `api` volontairement hors dépendances (référence instable → boucle de requêtes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (superAdmin) void charger(); }, [superAdmin, charger]);

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

  const copier = async (texte: string) => {
    try { await navigator.clipboard.writeText(texte); toast.success(t('plateforme.copie')); } catch { /* presse-papiers indisponible */ }
  };

  const colonnes: Column<Etablissement>[] = [
    { key: 'nom_fr', header: t('plateforme.nom'), render: e => <strong>{e.nom_fr}</strong> },
    { key: 'code', header: t('plateforme.code'), render: e => <code>{e.code}</code> },
    { key: 'nb_eleves', header: t('plateforme.eleves') },
    { key: 'nb_utilisateurs', header: t('plateforme.comptes') },
    { key: 'actif', header: t('plateforme.statut'), render: e =>
      <Badge variant={e.actif ? 'success' : 'warning'} label={e.actif ? t('plateforme.actif') : t('plateforme.suspendu')} /> },
    { key: 'actions', header: '', render: e => e.id === monEtab ? null : e.actif
      ? <Button size="sm" variant="secondary" onClick={() => setASuspendre(e)}>{t('plateforme.suspendre')}</Button>
      : <Button size="sm" variant="secondary" onClick={() => basculer(e, true)}>{t('plateforme.reactiver')}</Button> },
  ];

  return (
    <>
      <PageHeader eyebrow={t('plateforme.eyebrow')} title={t('plateforme.titre')} />
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => setOuvert(true)}>+ {t('plateforme.nouvelle')}</Button>
      </div>
      <div className="card">
        <Table columns={colonnes} data={liste} loading={loading} emptyMessage={t('plateforme.vide')} />
      </div>

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
