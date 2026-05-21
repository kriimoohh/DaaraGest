import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type Tab = 'etablissement' | 'pedagogie' | 'niveaux' | 'compte' | 'bareme' | 'tarifs' | 'notifications' | 'securite';

interface Niveau {
  id: string;
  libelle: string;
  ordre: number;
}

interface Etablissement {
  id: string;
  nom_fr: string;
  adresse?: string;
  telephone?: string;
  nom_directeur?: string;
  logo_url?: string;
  signature_url?: string;
  cachet_url?: string;
  devise: string;
}

interface NomsPeriodes {
  fr: string[];
  ar: string[];
}

interface ConfigNotes {
  note_max: number;
  note_min: number;
  nb_periodes: number;
  noms_periodes: NomsPeriodes;
  arrondi: number;
  chiffres_arabes: boolean;
  montant_mensualite: number;
  jours_cours: string[];
}

interface ConfigNotifications {
  notif_paiement_retard: boolean;
  notif_absences_eleves: boolean;
  notif_messages: boolean;
  notif_inscriptions: boolean;
  seuil_absences_alerte: number;
  seuil_note_insuffisante: number;
}

const TOUS_JOURS = [
  { value: 'lundi',    label: 'Lundi' },
  { value: 'mardi',    label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi',    label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi',   label: 'Samedi' },
];

const DEFAULT_FR = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre', '4ème Trimestre'];
const DEFAULT_AR = ['الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع'];

function buildPeriodes(n: number, existing?: NomsPeriodes): NomsPeriodes {
  return {
    fr: Array.from({ length: n }, (_, i) => existing?.fr?.[i] ?? DEFAULT_FR[i]),
    ar: Array.from({ length: n }, (_, i) => existing?.ar?.[i] ?? DEFAULT_AR[i]),
  };
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: 'var(--paper-2)',
      border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 0, border: 'none',
          background: checked ? 'var(--terra)' : 'var(--rule-2)',
          cursor: 'pointer', position: 'relative',
          transition: 'background 0.18s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, width: 18, height: 18,
          insetInlineStart: checked ? 22 : 3, borderRadius: 9, background: 'var(--card)',
          transition: 'inset-inline-start 0.18s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          display: 'block',
        }} />
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          style={{
            height: i === 1 ? 52 : 40, background: 'var(--paper-3)',
            borderRadius: 'var(--r-md)', opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

function SectionIcon({ path }: { path: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 'var(--r-md)',
      background: 'var(--terra-soft)', display: 'grid', placeItems: 'center', flexShrink: 0,
    }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="var(--terra-ink)">
        <path d={path} />
      </svg>
    </div>
  );
}

function LogoUploader({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Format invalide — image uniquement (PNG, JPG, SVG…)'); return; }
    if (file.size > 512 * 1024) { toast.error('Fichier trop volumineux — maximum 512 Ko'); return; }
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 10 }}>Logo de l'établissement</div>

      {value ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            width: '100%', minHeight: 120, borderRadius: 'var(--r-md)',
            border: '1px solid var(--rule)', background: 'var(--paper-2)',
            display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 12,
          }}>
            <img
              src={value}
              alt="Logo"
              style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
              Changer
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              style={{ color: 'var(--danger-text)' }}
              onClick={() => onChange(undefined)}
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragging ? 'var(--terra)' : 'var(--rule-2)'}`,
            background: dragging ? 'var(--terra-soft)' : 'var(--paper-2)',
            borderRadius: 'var(--r-md)', padding: '28px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
            userSelect: 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--r-md)',
            background: dragging ? 'var(--terra-soft)' : 'var(--paper-3)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill={dragging ? 'var(--terra)' : 'var(--ink-4)'}>
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
              {dragging ? 'Déposez ici' : 'Cliquer ou déposer une image'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
              PNG, JPG, SVG, WebP — max 512 Ko
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ImageFieldUploader({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Format invalide — image uniquement'); return; }
    if (file.size > 512 * 1024) { toast.error('Fichier trop volumineux — maximum 512 Ko'); return; }
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 6 }}>{label}</div>
      {value ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: '100%', minHeight: 64, borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', padding: 8 }}>
            <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => inputRef.current?.click()}>Changer</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(undefined)}>Supprimer</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
          Charger une image
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}

export function ParametresPage() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { user, updatePreferences } = useAuthStore();

  const [tab, setTab] = useState<Tab>('etablissement');
  const [etab, setEtab] = useState<Etablissement | null>(null);
  const [config, setConfig] = useState<ConfigNotes | null>(null);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauLibelle, setNiveauLibelle] = useState('');
  const [niveauOrdre, setNiveauOrdre] = useState('');
  const [editNiveau, setEditNiveau] = useState<Niveau | null>(null);
  const [savingNiveau, setSavingNiveau] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [langue, setLangue] = useState(user?.langue ?? 'fr');
  const [themeVal, setThemeVal] = useState<'light' | 'dark'>((user?.theme as 'light' | 'dark') ?? 'light');
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmMdp, setConfirmMdp] = useState('');

  const [notifConfig, setNotifConfig] = useState<ConfigNotifications>({
    notif_paiement_retard: true,
    notif_absences_eleves: true,
    notif_messages: true,
    notif_inscriptions: false,
    seuil_absences_alerte: 3,
    seuil_note_insuffisante: 10,
  });

  const fetchNiveaux = () =>
    api.get<Niveau[]>('/api/v1/niveaux').then(setNiveaux).catch(() => {});

  useEffect(() => {
    fetchNiveaux();
    Promise.all([
      api.get<Etablissement>('/api/v1/parametres'),
      api.get<Record<string, unknown>>('/api/v1/parametres/notes'),
      api.get<ConfigNotifications>('/api/v1/parametres/notifications'),
    ])
      .then(([etabData, rawNotes, rawNotif]) => {
        setEtab(etabData);
        if (rawNotes) {
          const nb = Number(rawNotes.nb_periodes) || 3;
          const rawPeriodes = rawNotes.noms_periodes as NomsPeriodes | undefined;
          setConfig({
            note_max: Number(rawNotes.note_max),
            note_min: Number(rawNotes.note_min),
            nb_periodes: nb,
            arrondi: Number(rawNotes.arrondi ?? 2),
            chiffres_arabes: Boolean(rawNotes.chiffres_arabes),
            montant_mensualite: Number(rawNotes.montant_mensualite),
            noms_periodes: buildPeriodes(nb, rawPeriodes),
            jours_cours: (rawNotes.jours_cours as string[]) ?? ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
          });
        }
        if (rawNotif) {
          setNotifConfig({
            notif_paiement_retard: Boolean(rawNotif.notif_paiement_retard ?? true),
            notif_absences_eleves: Boolean(rawNotif.notif_absences_eleves ?? true),
            notif_messages: Boolean(rawNotif.notif_messages ?? true),
            notif_inscriptions: Boolean(rawNotif.notif_inscriptions ?? false),
            seuil_absences_alerte: Number(rawNotif.seuil_absences_alerte ?? 3),
            seuil_note_insuffisante: Number(rawNotif.seuil_note_insuffisante ?? 10),
          });
        }
      })
      .catch(err => toast.error((err as Error).message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveNiveau = async () => {
    if (!niveauLibelle.trim()) return;
    setSavingNiveau(true);
    try {
      const body = { libelle: niveauLibelle.trim(), ordre: Number(niveauOrdre) || 0 };
      if (editNiveau) {
        await api.put(`/api/v1/niveaux/${editNiveau.id}`, body);
        toast.success('Niveau modifié');
      } else {
        await api.post('/api/v1/niveaux', body);
        toast.success('Niveau ajouté');
      }
      setNiveauLibelle(''); setNiveauOrdre(''); setEditNiveau(null);
      fetchNiveaux();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSavingNiveau(false); }
  };

  const handleDeleteNiveau = async (n: Niveau) => {
    try {
      await api.delete(`/api/v1/niveaux/${n.id}`);
      toast.success('Niveau supprimé');
      fetchNiveaux();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    }
  };

  const handleNbPeriodes = (n: number) => {
    if (!config) return;
    const clamped = Math.max(1, Math.min(4, n));
    setConfig({ ...config, nb_periodes: clamped, noms_periodes: buildPeriodes(clamped, config.noms_periodes) });
  };

  const saveEtab = async () => {
    if (!etab) return;
    setSaving('etab');
    try {
      await api.put('/api/v1/parametres', {
        nom_fr: etab.nom_fr, adresse: etab.adresse,
        telephone: etab.telephone, devise: etab.devise,
        nom_directeur: etab.nom_directeur || null,
        logo_url: etab.logo_url || undefined,
        signature_url: etab.signature_url || undefined,
        cachet_url: etab.cachet_url || undefined,
      });
      toast.success(t('parametre.sauvegarde_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving('notes');
    try {
      await api.put('/api/v1/parametres/notes', config);
      toast.success(t('parametre.sauvegarde_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const saveCompte = async () => {
    setSaving('compte');
    try {
      await api.put('/api/v1/auth/profil', { langue, theme: themeVal });
      updatePreferences(langue, themeVal);
      await i18n.changeLanguage(langue);
      toast.success(t('parametre.preferences_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const savePassword = async () => {
    if (!ancienMdp || !nouveauMdp) { toast.error('Tous les champs sont requis'); return; }
    if (nouveauMdp !== confirmMdp) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (nouveauMdp.length < 8) { toast.error('Minimum 8 caractères'); return; }
    setSaving('mdp');
    try {
      await api.put('/api/v1/auth/change-password', {
        ancien_mot_de_passe: ancienMdp,
        nouveau_mot_de_passe: nouveauMdp,
      });
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('');
      toast.success(t('parametre.securite_mdp_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const saveNotifications = async () => {
    setSaving('notif');
    try {
      await api.put('/api/v1/parametres/notifications', {
        notif_paiement_retard: notifConfig.notif_paiement_retard,
        notif_absences_eleves: notifConfig.notif_absences_eleves,
        notif_messages: notifConfig.notif_messages,
        notif_inscriptions: notifConfig.notif_inscriptions,
      });
      toast.success(t('parametre.notif_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const revoquerSessions = async () => {
    if (!confirm(t('parametre.securite_deconnecter_tout') + ' ?')) return;
    setSaving('sessions');
    try {
      await api.delete('/api/v1/auth/sessions');
      toast.success(t('parametre.securite_deconnecter_confirm'));
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  return (
    <>
      <PageHeader eyebrow="Configuration" title={t('parametre.titre')} />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar navigation */}
        <div className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([
            { key: 'etablissement', label: t('parametre.etablissement') },
            { key: 'pedagogie', label: t('parametre.pedagogie') },
            { key: 'niveaux', label: 'Niveaux' },
            { key: 'bareme', label: t('parametre.bareme_mentions') },
            { key: 'tarifs', label: t('parametre.tarifs') },
            { key: 'compte', label: t('parametre.mon_compte') },
            { key: 'notifications', label: t('parametre.notifications_section') },
            { key: 'securite', label: t('parametre.securite') },
          ] as { key: Tab; label: string }[]).map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`sb-item${tab === item.key ? ' active' : ''}`}
              style={{ borderRadius: 'var(--r-sm)' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>

      {/* ── Chargement ── */}
      {loading && (
        <div className="card card-pad"><LoadingSkeleton /></div>
      )}

      {/* ── Onglet Établissement ── */}
      {!loading && tab === 'etablissement' && etab && (
        <div className="card">
          <div className="card-hd">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SectionIcon path="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
              <div>
                <h3 style={{ margin: 0 }}>{t('parametre.etab_titre')}</h3>
                <span className="sub">{t('parametre.etab_desc')}</span>
              </div>
            </div>
            <Button onClick={saveEtab} loading={saving === 'etab'}>{t('actions.enregistrer')}</Button>
          </div>
          <div className="card-pad">
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <LogoUploader
                  value={etab.logo_url ?? undefined}
                  onChange={v => setEtab(p => p ? { ...p, logo_url: v ?? '' } : p)}
                />
                <ImageFieldUploader
                  label="Signature (directeur)"
                  value={etab.signature_url ?? undefined}
                  onChange={v => setEtab(p => p ? { ...p, signature_url: v ?? '' } : p)}
                />
                <ImageFieldUploader
                  label="Cachet de l'établissement"
                  value={etab.cachet_url ?? undefined}
                  onChange={v => setEtab(p => p ? { ...p, cachet_url: v ?? '' } : p)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Input
                  label={t('parametre.nom_etab')}
                  value={etab.nom_fr}
                  onChange={e => setEtab(p => p ? { ...p, nom_fr: e.target.value } : p)}
                />
                <div className="grid-2">
                  <Input
                    label={t('common.adresse')}
                    value={etab.adresse ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, adresse: e.target.value } : p)}
                  />
                  <Input
                    label={t('common.telephone')}
                    value={etab.telephone ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, telephone: e.target.value } : p)}
                  />
                </div>
                <Input
                  label="Nom du/de la Directeur(trice)"
                  placeholder="Ex : Adama NDIAYE"
                  value={etab.nom_directeur ?? ''}
                  onChange={e => setEtab(p => p ? { ...p, nom_directeur: e.target.value } : p)}
                />
                <Input
                  label={t('common.devise')}
                  value={etab.devise}
                  onChange={e => setEtab(p => p ? { ...p, devise: e.target.value } : p)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Onglet Pédagogie ── */}
      {!loading && tab === 'pedagogie' && config && (
        <>
          {/* Barème */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.bareme')}</h3>
                  <span className="sub">{t('parametre.bareme_desc')}</span>
                </div>
              </div>
              <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid-3">
                <div className="field">
                  <label className="field-label">{t('parametre.note_max')}</label>
                  <input
                    className="input" type="number" min={1} max={100}
                    value={config.note_max}
                    onChange={e => setConfig(p => p ? { ...p, note_max: parseFloat(e.target.value) } : p)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">{t('parametre.note_min')}</label>
                  <input
                    className="input" type="number" min={0}
                    value={config.note_min}
                    onChange={e => setConfig(p => p ? { ...p, note_min: parseFloat(e.target.value) } : p)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">{t('parametre.arrondi')}</label>
                  <select
                    className="select"
                    value={config.arrondi}
                    onChange={e => setConfig(p => p ? { ...p, arrondi: parseInt(e.target.value) } : p)}
                  >
                    <option value={0}>{t('parametre.arrondi_0')}</option>
                    <option value={1}>{t('parametre.arrondi_1')}</option>
                    <option value={2}>{t('parametre.arrondi_2')}</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="field-label">{t('parametre.nb_periodes')}</label>
                  <select
                    className="select"
                    value={config.nb_periodes}
                    onChange={e => handleNbPeriodes(parseInt(e.target.value))}
                  >
                    <option value={1}>1 {t('parametre.periode')}</option>
                    <option value={2}>2 {t('parametre.periodes')}</option>
                    <option value={3}>3 {t('parametre.periodes')} — Trimestres</option>
                    <option value={4}>4 {t('parametre.periodes')}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">{t('parametre.mensualite')}</label>
                  <input
                    className="input" type="number" min={0}
                    value={config.montant_mensualite}
                    onChange={e => setConfig(p => p ? { ...p, montant_mensualite: parseFloat(e.target.value) } : p)}
                  />
                </div>
              </div>

              <Toggle
                label={t('parametre.chiffres_arabes')}
                description="٠١٢٣٤٥٦٧٨٩ au lieu de 0123456789 sur les bulletins"
                checked={config.chiffres_arabes}
                onChange={v => setConfig(p => p ? { ...p, chiffres_arabes: v } : p)}
              />

              {/* Jours de cours */}
              <div style={{ padding: '12px 16px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 10 }}>
                  Jours de cours
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
                  Sélectionnez les jours où l'établissement est ouvert
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {TOUS_JOURS.map(jour => {
                    const actif = config.jours_cours?.includes(jour.value) ?? false;
                    return (
                      <label
                        key={jour.value}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 99,
                          border: `1px solid ${actif ? 'var(--terra)' : 'var(--rule)'}`,
                          background: actif ? 'var(--terra-soft)' : 'var(--paper)',
                          color: actif ? 'var(--terra-ink)' : 'var(--ink-3)',
                          cursor: 'pointer', fontSize: 13, fontWeight: actif ? 600 : 400,
                          transition: 'all 0.15s', userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={actif}
                          style={{ display: 'none' }}
                          onChange={() => {
                            setConfig(p => {
                              if (!p) return p;
                              const jours = p.jours_cours ?? [];
                              const updated = actif
                                ? jours.filter(j => j !== jour.value)
                                : [...jours, jour.value];
                              // Garder l'ordre canonique
                              const ordre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                              return { ...p, jours_cours: ordre.filter(j => updated.includes(j)) };
                            });
                          }}
                        />
                        {jour.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Noms des périodes */}
          <div className="card">
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.noms_periodes')}</h3>
                  <span className="sub">{t('parametre.noms_periodes_desc')}</span>
                </div>
              </div>
              <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Array.from({ length: config.nb_periodes }, (_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end' }}>
                  <Input
                    label={`${t('parametre.periode')} ${i + 1} — Français`}
                    value={config.noms_periodes?.fr?.[i] ?? ''}
                    onChange={e => setConfig(p => {
                      if (!p) return p;
                      const fr = [...(p.noms_periodes?.fr ?? [])];
                      fr[i] = e.target.value;
                      return { ...p, noms_periodes: { ...p.noms_periodes, fr } };
                    })}
                  />
                  <div style={{ direction: 'rtl', fontFamily: 'var(--font-arabic)' }}>
                    <Input
                      label={`الفصل ${i + 1} — عربي`}
                      value={config.noms_periodes?.ar?.[i] ?? ''}
                      onChange={e => setConfig(p => {
                        if (!p) return p;
                        const ar = [...(p.noms_periodes?.ar ?? [])];
                        ar[i] = e.target.value;
                        return { ...p, noms_periodes: { ...p.noms_periodes, ar } };
                      })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Onglet Niveaux ── */}
      {tab === 'niveaux' && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 16 }}>Gestion des niveaux</h3>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <Input
              label="Libellé"
              value={niveauLibelle}
              onChange={e => setNiveauLibelle(e.target.value)}
              placeholder="Ex: CM1"
            />
            <Input
              label="Ordre d'affichage"
              type="number"
              value={niveauOrdre}
              onChange={e => setNiveauOrdre(e.target.value)}
              placeholder="1"
            />
            <div style={{ paddingTop: 22 }}>
              <Button onClick={handleSaveNiveau} loading={savingNiveau} disabled={!niveauLibelle.trim()}>
                {editNiveau ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
            {editNiveau && (
              <div style={{ paddingTop: 22 }}>
                <Button variant="ghost" onClick={() => { setEditNiveau(null); setNiveauLibelle(''); setNiveauOrdre(''); }}>
                  Annuler
                </Button>
              </div>
            )}
          </div>

          <table className="table">
            <thead>
              <tr><th>Libellé</th><th>Ordre</th><th></th></tr>
            </thead>
            <tbody>
              {niveaux.map(n => (
                <tr key={n.id}>
                  <td>{n.libelle}</td>
                  <td>{n.ordre}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="ghost" onClick={() => { setEditNiveau(n); setNiveauLibelle(n.libelle); setNiveauOrdre(String(n.ordre)); }}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteNiveau(n)}>
                        Supprimer
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {niveaux.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun niveau défini</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Onglet Mon compte ── */}
      {tab === 'compte' && (
        <>
          {/* Carte profil */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                <h3 style={{ margin: 0 }}>{t('parametre.mon_profil')}</h3>
              </div>
            </div>
            <div className="card-pad">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 18,
                padding: '16px 20px', background: 'var(--paper-2)',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)',
              }}>
                <div className="avatar avatar-xl" style={{
                  background: 'var(--terra-soft)', color: 'var(--terra-ink)',
                  fontSize: 22, fontWeight: 700, border: 'none',
                }}>
                  {(user?.nom_fr ?? '').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', lineHeight: 1.2 }}>{user?.nom_fr}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', textTransform: 'capitalize', marginTop: 4 }}>{user?.role}</div>
                  {user?.identifiant && (
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 5 }}>
                      @{user.identifiant}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Langue & Thème */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.langue_theme')}</h3>
                  <span className="sub">{t('parametre.langue_theme_desc')}</span>
                </div>
              </div>
              <Button onClick={saveCompte} loading={saving === 'compte'}>{t('actions.enregistrer')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Langue */}
              <div>
                <div className="field-label" style={{ marginBottom: 10 }}>{t('parametre.langue_interface')}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['fr', 'ar'] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLangue(l)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${langue === l ? 'var(--terra)' : 'var(--rule)'}`,
                        background: langue === l ? 'var(--terra-soft)' : 'var(--card)',
                        color: langue === l ? 'var(--terra-ink)' : 'var(--ink-2)',
                        fontWeight: langue === l ? 600 : 400,
                        cursor: 'pointer', fontSize: 14,
                        fontFamily: l === 'ar' ? 'var(--font-arabic)' : 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {l === 'fr' ? 'Français' : 'العربية'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thème */}
              <div>
                <div className="field-label" style={{ marginBottom: 10 }}>{t('parametre.theme_interface')}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['light', 'dark'] as const).map(th => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setThemeVal(th)}
                      style={{
                        padding: '10px 20px', minWidth: 140,
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${themeVal === th ? 'var(--terra)' : 'var(--rule)'}`,
                        background: themeVal === th ? 'var(--terra-soft)' : 'var(--card)',
                        color: themeVal === th ? 'var(--terra-ink)' : 'var(--ink-2)',
                        fontWeight: themeVal === th ? 600 : 400,
                        cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.15s',
                      }}
                    >
                      {th === 'light' ? (
                        <>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z" />
                          </svg>
                          {t('theme.light')}
                        </>
                      ) : (
                        <>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                          </svg>
                          {t('theme.dark')}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Note sécurité */}
          <div style={{ padding: '10px 14px', background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--info-text)' }}>
            Pour changer votre mot de passe ou gérer vos sessions, rendez-vous dans l'onglet <strong>{t('parametre.securite')}</strong>.
          </div>
        </>
      )}

      {/* ── Barème des mentions ── */}
      {!loading && tab === 'bareme' && (
        <div className="card">
          <div className="card-hd">
            <h3 style={{ margin: 0 }}>{t('parametre.bareme_mentions')}</h3>
          </div>
          <div className="card-pad">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Mention</th>
                    <th>Seuil min</th>
                    <th>Seuil max</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: t('parametre.tres_bien'), min: 16, max: 20, variant: 'success' },
                    { label: t('parametre.bien'), min: 14, max: 16, variant: 'info' },
                    { label: t('parametre.assez_bien'), min: 12, max: 14, variant: 'info' },
                    { label: t('parametre.passable'), min: 10, max: 12, variant: 'warning' },
                    { label: t('parametre.insuffisant'), min: 0, max: 10, variant: 'error' },
                  ].map(m => (
                    <tr key={m.label}>
                      <td><span className={`badge badge-${m.variant}`}>{m.label}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.min}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{m.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--info-text)' }}>
              Le barème des mentions est défini dans les paramètres globaux et peut évoluer selon le règlement de l'établissement. Contactez l'administrateur pour modifier les seuils.
            </div>
          </div>
        </div>
      )}

      {/* ── Tarifs & mensualités ── */}
      {!loading && tab === 'tarifs' && config && (
        <div className="card">
          <div className="card-hd">
            <h3 style={{ margin: 0 }}>{t('parametre.tarifs')}</h3>
            <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label={t('parametre.mensualite')}
              type="number"
              value={String(config.montant_mensualite)}
              onChange={e => setConfig(c => c ? { ...c, montant_mensualite: Number(e.target.value) } : c)}
            />
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {!loading && tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.notif_titre')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>{t('parametre.notif_desc')}</p>
                </div>
              </div>
              <Button onClick={saveNotifications} loading={saving === 'notif'}>{t('actions.enregistrer')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Toggle
                checked={notifConfig.notif_paiement_retard}
                onChange={v => setNotifConfig(c => ({ ...c, notif_paiement_retard: v }))}
                label={t('parametre.notif_paiement_retard')}
                description={t('parametre.notif_paiement_retard_desc')}
              />
              <Toggle
                checked={notifConfig.notif_absences_eleves}
                onChange={v => setNotifConfig(c => ({ ...c, notif_absences_eleves: v }))}
                label={t('parametre.notif_absences_eleves')}
                description={t('parametre.notif_absences_eleves_desc')}
              />
              <Toggle
                checked={notifConfig.notif_messages}
                onChange={v => setNotifConfig(c => ({ ...c, notif_messages: v }))}
                label={t('parametre.notif_messages')}
                description={t('parametre.notif_messages_desc')}
              />
              <Toggle
                checked={notifConfig.notif_inscriptions}
                onChange={v => setNotifConfig(c => ({ ...c, notif_inscriptions: v }))}
                label={t('parametre.notif_inscriptions')}
                description={t('parametre.notif_inscriptions_desc')}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <div>
                <h3 style={{ margin: 0 }}>{t('parametre.notif_seuils_titre')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>{t('parametre.notif_seuils_desc')}</p>
              </div>
            </div>
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label={t('parametre.seuil_absences')}
                type="number"
                value={String(notifConfig.seuil_absences_alerte)}
                onChange={e => setNotifConfig(c => ({ ...c, seuil_absences_alerte: Number(e.target.value) }))}
              />
              <Input
                label={t('parametre.seuil_notes')}
                type="number"
                value={String(notifConfig.seuil_note_insuffisante)}
                onChange={e => setNotifConfig(c => ({ ...c, seuil_note_insuffisante: Number(e.target.value) }))}
              />
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ padding: '10px 14px', background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--info-text)' }}>
                Ces seuils sont également utilisés dans la configuration pédagogique. Une modification ici sera reflétée dans l'onglet Pédagogie.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sécurité ── */}
      {!loading && tab === 'securite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.securite_mdp_titre')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>{t('parametre.securite_mdp_desc')}</p>
                </div>
              </div>
              <Button onClick={savePassword} loading={saving === 'mdp'}>{t('parametre.mdp_modifier')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input
                label={t('parametre.mdp_actuel')}
                type="password"
                value={ancienMdp}
                onChange={e => setAncienMdp(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                label={t('parametre.mdp_nouveau')}
                type="password"
                value={nouveauMdp}
                onChange={e => setNouveauMdp(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label={t('parametre.mdp_confirmer')}
                type="password"
                value={confirmMdp}
                onChange={e => setConfirmMdp(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.securite_sessions_titre')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>{t('parametre.securite_sessions_desc')}</p>
                </div>
              </div>
            </div>
            <div className="card-pad">
              <button
                className="btn btn-secondary"
                onClick={revoquerSessions}
                disabled={saving === 'sessions'}
                style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
                {saving === 'sessions' ? '...' : t('parametre.securite_deconnecter_tout')}
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </>
  );
}
