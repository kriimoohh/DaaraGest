import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type Tab = 'etablissement' | 'pedagogie' | 'compte';

interface Etablissement {
  id: string;
  nom_fr: string;
  adresse?: string;
  telephone?: string;
  logo_url?: string;
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
}

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
          left: checked ? 22 : 3, borderRadius: 9, background: '#fff',
          transition: 'left 0.18s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
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

export function ParametresPage() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { user, updatePreferences } = useAuthStore();

  const [tab, setTab] = useState<Tab>('etablissement');
  const [etab, setEtab] = useState<Etablissement | null>(null);
  const [config, setConfig] = useState<ConfigNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [langue, setLangue] = useState(user?.langue ?? 'fr');
  const [themeVal, setThemeVal] = useState<'light' | 'dark'>((user?.theme as 'light' | 'dark') ?? 'light');
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmMdp, setConfirmMdp] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Etablissement>('/api/v1/parametres'),
      api.get<Record<string, unknown>>('/api/v1/parametres/notes'),
    ])
      .then(([etabData, rawNotes]) => {
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
          });
        }
      })
      .catch(err => toast.error((err as Error).message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

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
        logo_url: etab.logo_url || undefined,
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
      toast.success('Mot de passe modifié');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  return (
    <>
      <PageHeader title={t('parametre.titre')} />

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'etablissement' ? ' active' : ''}`} onClick={() => setTab('etablissement')}>
          {t('parametre.etablissement')}
        </button>
        <button className={`tab${tab === 'pedagogie' ? ' active' : ''}`} onClick={() => setTab('pedagogie')}>
          {t('parametre.pedagogie')}
        </button>
        <button className={`tab${tab === 'compte' ? ' active' : ''}`} onClick={() => setTab('compte')}>
          {t('parametre.mon_compte')}
        </button>
      </div>

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
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <div className="grid-2">
              <Input
                label={t('common.devise')}
                value={etab.devise}
                onChange={e => setEtab(p => p ? { ...p, devise: e.target.value } : p)}
              />
              <Input
                label={t('parametre.logo_url')}
                value={etab.logo_url ?? ''}
                placeholder="https://..."
                onChange={e => setEtab(p => p ? { ...p, logo_url: e.target.value } : p)}
              />
            </div>
            {etab.logo_url && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', background: 'var(--paper-2)',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
              }}>
                <img
                  src={etab.logo_url}
                  alt="Logo"
                  style={{ height: 52, maxWidth: 140, objectFit: 'contain', borderRadius: 'var(--r-sm)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="sub">{t('parametre.apercu_logo')}</span>
              </div>
            )}
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

          {/* Mot de passe */}
          <div className="card">
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.mdp')}</h3>
                  <span className="sub">{t('parametre.mdp_desc')}</span>
                </div>
              </div>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input
                label={t('parametre.mdp_actuel')}
                type="password"
                value={ancienMdp}
                onChange={e => setAncienMdp(e.target.value)}
              />
              <div className="grid-2">
                <Input
                  label={t('parametre.mdp_nouveau')}
                  type="password"
                  value={nouveauMdp}
                  onChange={e => setNouveauMdp(e.target.value)}
                  placeholder="Minimum 8 caractères"
                />
                <Input
                  label={t('parametre.mdp_confirmer')}
                  type="password"
                  value={confirmMdp}
                  onChange={e => setConfirmMdp(e.target.value)}
                />
              </div>
              {nouveauMdp.length > 0 && nouveauMdp.length < 8 && (
                <div style={{ fontSize: 13, color: 'var(--warning-text)' }}>Minimum 8 caractères requis</div>
              )}
              {confirmMdp.length > 0 && nouveauMdp !== confirmMdp && (
                <div style={{ fontSize: 13, color: 'var(--danger-text)' }}>Les mots de passe ne correspondent pas</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button
                  onClick={savePassword}
                  loading={saving === 'mdp'}
                  disabled={!ancienMdp || !nouveauMdp || !confirmMdp}
                >
                  {t('parametre.mdp_modifier')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
