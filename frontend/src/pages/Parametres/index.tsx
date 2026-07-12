import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type Tab = 'etablissement' | 'pedagogie' | 'filieres' | 'niveaux' | 'fonctions' | 'compte' | 'bulletins' | 'tarifs' | 'notifications' | 'securite';

interface Niveau {
  id: string;
  libelle: string;
  ordre: number;
  note_max: number | string | null;
}

type FiliereCode = 'FR' | 'AR' | 'EN';

interface Filiere {
  id: string;
  code: FiliereCode;
  nom_fr: string;
  nom_ar: string | null;
  langue: string;
  sens_ecriture: 'LTR' | 'RTL';
  couleur: string;
  ordre: number;
  actif: boolean;
  nb_classes: number;
  nb_matieres: number;
}

interface Fonction {
  id: string;
  code: string;
  libelle_fr: string;
  ordre: number;
  supprimable: boolean;
  effectif: number;
}

type Periodicite = 'ponctuel' | 'mensuel' | 'annuel';

interface Tarif {
  id: string;
  code: string;
  libelle_fr: string;
  description?: string | null;
  montant_defaut: number | string;
  periodicite: Periodicite;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
}

interface Etablissement {
  id: string;
  nom_fr: string;
  code: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  numero_autorisation?: string;
  entete_bulletin_fr?: string;
  entete_bulletin_ar?: string;
  nom_directeur?: string;
  civilite_directeur?: 'M' | 'Mme' | null;
  logo_url?: string;
  signature_url?: string;
  cachet_url?: string;
  devise: string;
}

interface NomsPeriodes {
  fr: string[];
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
  seuil_tres_bien: number;
  seuil_bien: number;
  seuil_assez_bien: number;
  seuil_passable: number;
  autoriser_toutes_matieres: boolean;
  autoriser_toutes_classes: boolean;
  // Rendu des bulletins PDF (onglet Bulletins).
  bulletin_afficher_rang: boolean;
  bulletin_afficher_absences: boolean;
  bulletin_logo_echelle: number;
  bulletin_police_echelle: number;
}

type CouleurMention = 'success' | 'info' | 'warning' | 'error';

interface Mention {
  id: string;
  libelle_fr: string;
  libelle_ar?: string | null;
  seuil_min: number;
  couleur: CouleurMention;
  ordre: number;
  is_system: boolean;
}

const COULEUR_MENTION_OPTIONS: { value: CouleurMention; label: string }[] = [
  { value: 'success', label: 'Vert' }, { value: 'info', label: 'Bleu' },
  { value: 'warning', label: 'Jaune' }, { value: 'error', label: 'Rouge' },
];

// Mentions spécifiques à un niveau (override des mentions par défaut de l'établissement).
function NiveauMentionsModal({ niveau, noteMax, defaults, api, onClose }: {
  niveau: { id: string; libelle: string };
  noteMax: number;
  defaults: Mention[];
  api: ReturnType<typeof useApi>;
  onClose: () => void;
}) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ libelle_fr: '', libelle_ar: '', seuil_min: '', couleur: 'info' as CouleurMention });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api.get<Mention[]>(`/api/v1/mentions?niveau_id=${niveau.id}`)
      .then(r => setMentions(r.map(m => ({ ...m, seuil_min: Number(m.seuil_min) }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [niveau.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);

  const reset = () => { setEditId(null); setForm({ libelle_fr: '', libelle_ar: '', seuil_min: '', couleur: 'info' }); };

  const save = async () => {
    const seuil = parseFloat(form.seuil_min);
    if (!form.libelle_fr.trim()) { toast.error('Libellé requis'); return; }
    if (isNaN(seuil) || seuil < 0) { toast.error('Seuil invalide (≥ 0)'); return; }
    if (seuil >= noteMax) { toast.error(`Le seuil doit être inférieur à ${noteMax}`); return; }
    setSaving(true);
    try {
      const body = { libelle_fr: form.libelle_fr, libelle_ar: form.libelle_ar.trim() || null, seuil_min: seuil, couleur: form.couleur };
      if (editId) await api.patch(`/api/v1/mentions/${editId}`, body);
      else await api.post('/api/v1/mentions', { ...body, niveau_id: niveau.id });
      toast.success('Enregistré');
      reset(); reload();
    } catch (e) { toast.error((e as Error).message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/api/v1/mentions/${id}`); reload(); }
    catch (e) { toast.error((e as Error).message || 'Erreur'); }
  };

  const sorted = [...mentions].sort((a, b) => b.seuil_min - a.seuil_min);

  return (
    <Modal isOpen onClose={onClose} title={`Mentions — ${niveau.libelle}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Mentions spécifiques à ce niveau. Si aucune n'est définie, le niveau hérite des mentions par défaut de l'établissement (section « Barème des mentions » ci-dessous).
        </p>
        {loading ? <div className="muted" style={{ fontSize: 13 }}>Chargement…</div> : (
          <>
            {mentions.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 12px', background: 'var(--paper-2)', borderRadius: 6, border: '1px solid var(--rule)' }}>
                Hérite des mentions par défaut : {defaults.map(d => d.libelle_fr).join(', ') || '—'}
              </div>
            )}
            {sorted.map(m => (
              <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 6 }}>
                <span style={{ fontSize: 13 }}>
                  <span className={`badge badge-${m.couleur}`}>{m.libelle_fr}</span>
                  {m.libelle_ar && <span dir="rtl" style={{ marginInlineStart: 8, color: 'var(--ink-3)' }}>{m.libelle_ar}</span>}
                  <span className="muted" style={{ marginInlineStart: 8, fontFamily: 'var(--font-mono)' }}>≥ {m.seuil_min}</span>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(m.id); setForm({ libelle_fr: m.libelle_fr, libelle_ar: m.libelle_ar ?? '', seuil_min: String(m.seuil_min), couleur: m.couleur }); }} title="Modifier">✎</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)} title="Supprimer">✕</button>
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 120px' }}>
                <Input label="Libellé (FR)" value={form.libelle_fr} onChange={e => setForm(f => ({ ...f, libelle_fr: e.target.value }))} placeholder="Très bien" />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <Input label="Libellé (AR)" value={form.libelle_ar} onChange={e => setForm(f => ({ ...f, libelle_ar: e.target.value }))} placeholder="ممتاز" style={{ direction: 'rtl' }} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <Input label={`Seuil (/${noteMax})`} type="number" value={form.seuil_min} onChange={e => setForm(f => ({ ...f, seuil_min: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 100px' }}>
                <Select label="Couleur" value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value as CouleurMention }))} options={COULEUR_MENTION_OPTIONS} />
              </div>
              <Button size="sm" onClick={save} loading={saving} disabled={!form.libelle_fr.trim()}>{editId ? 'Modifier' : 'Ajouter'}</Button>
              {editId && <Button size="sm" variant="ghost" onClick={reset}>Annuler</Button>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
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

// Nom par défaut d'une période selon le découpage : 2 = semestres, 6 = bimestres,
// sinon trimestres. Le bulletin utilise la même logique (bulletin.template.ts).
const ORDINAL_FR = ['1er', '2ème', '3ème', '4ème', '5ème', '6ème'];
const motPeriode = (n: number) => (n === 2 ? 'Semestre' : n === 6 ? 'Bimestre' : 'Trimestre');
const defautPeriodeFr = (i: number, n: number) => `${ORDINAL_FR[i] ?? `${i + 1}ème`} ${motPeriode(n)}`;

function buildPeriodes(n: number, existing?: NomsPeriodes): NomsPeriodes {
  return {
    fr: Array.from({ length: n }, (_, i) => existing?.fr?.[i] ?? defautPeriodeFr(i, n)),
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

// Éditeur HTML du modèle de bulletin. Le corps est du HTML complet éditable ;
// le moteur remplit les lignes/valeurs calculées. Les libellés à insérer (token +
// description) viennent du backend. Aperçu rendu côté serveur (données d'exemple).
function BulletinTemplateEditor() {
  const api = useApi();
  const canEdit = useAuthStore(s => ['admin', 'directeur'].includes(s.user?.role ?? ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [html, setHtml] = useState('');
  const [placeholders, setPlaceholders] = useState<{ token: string; desc: string }[]>([]);
  const [types, setTypes] = useState<{ type: string; label: string; is_custom: boolean }[]>([]);
  const [type, setType] = useState<'FR' | 'AR' | 'EN' | 'COMBINE' | 'ANNUEL'>('FR');
  const [isCustom, setIsCustom] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // `useApi()` renvoie un nouvel objet à chaque render : ne PAS le mettre en dépendance
  // (sinon l'effet reboucle → flot de requêtes / 429). On dépend uniquement de `type`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setLoading(true);
    api.get<{ contenu_html: string; is_custom: boolean; placeholders: { token: string; desc: string }[]; types: { type: string; label: string; is_custom: boolean }[] }>(`/api/v1/bulletins/template/${type}`)
      .then(d => { setHtml(d.contenu_html); setIsCustom(d.is_custom); setPlaceholders(d.placeholders); setTypes(d.types); setDirty(false); })
      .catch(() => toast.error('Impossible de charger le modèle'))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const changeType = (t: 'FR' | 'AR' | 'EN' | 'COMBINE' | 'ANNUEL') => {
    if (t === type) return;
    if (dirty && !confirm('Des changements ne sont pas enregistrés. Changer de type et les perdre ?')) return;
    setType(t);
  };

  const insertBloc = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setHtml(h => h + token); setDirty(true); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = html.substring(0, start) + token + html.substring(end);
    setHtml(next); setDirty(true);
    setTimeout(() => { ta.focus(); const pos = start + token.length; ta.selectionStart = ta.selectionEnd = pos; }, 0);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await api.post<{ html: string }>(`/api/v1/bulletins/template/${type}/apercu`, { contenu_html: html });
      const url = URL.createObjectURL(new Blob([res.html], { type: 'text/html' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) { toast.error((err as Error).message || 'Aperçu impossible'); }
    finally { setPreviewing(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/bulletins/template/${type}`, { contenu_html: html });
      toast.success('Modèle enregistré'); setDirty(false); setIsCustom(true);
      setTypes(ts => ts.map(x => x.type === type ? { ...x, is_custom: true } : x));
    } catch (err) { toast.error((err as Error).message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm('Supprimer le modèle personnalisé de ce type et revenir au modèle par défaut ?')) return;
    setResetting(true);
    try {
      await api.delete(`/api/v1/bulletins/template/${type}/reset`);
      toast.success('Modèle réinitialisé');
      setTypes(ts => ts.map(x => x.type === type ? { ...x, is_custom: false } : x));
      load();
    } catch (err) { toast.error((err as Error).message || 'Erreur'); }
    finally { setResetting(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hd">
        <div>
          <h3 style={{ margin: 0 }}>
            Modèle avancé (HTML)
            {isCustom && <span style={{ fontSize: 11, marginInlineStart: 8, padding: '1px 7px', borderRadius: 4, background: 'var(--success-soft)', color: 'var(--success-text)' }}>✓ personnalisé</span>}
            {dirty && <span style={{ fontSize: 11, marginInlineStart: 8, color: 'var(--warning)' }}>● non enregistré</span>}
          </h3>
          <span className="sub">Un modèle <strong>distinct par type de bulletin</strong> (sélecteur ci-dessous). Modifiez directement le HTML : en-têtes de colonnes, titres, libellés, traductions FR/AR… Les {'{{{lignes}}}'} et valeurs sont calculées. Réinitialisez à tout moment.</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={handlePreview} loading={previewing}>Aperçu</Button>
          {canEdit && isCustom && <Button variant="ghost" onClick={handleReset} loading={resetting} style={{ color: '#dc2626' }}>Réinitialiser</Button>}
          {canEdit && <Button onClick={handleSave} loading={saving} disabled={!dirty}>Enregistrer</Button>}
        </div>
      </div>
      <div className="card-pad">
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button
              key={t.type}
              type="button"
              onClick={() => changeType(t.type as 'FR' | 'AR' | 'EN' | 'COMBINE' | 'ANNUEL')}
              style={{
                padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: 13, cursor: 'pointer',
                border: `1px solid ${t.type === type ? 'var(--terra)' : 'var(--rule)'}`,
                background: t.type === type ? 'var(--terra)' : 'var(--paper-2)',
                color: t.type === type ? '#fff' : 'var(--ink)',
                fontWeight: t.type === type ? 600 : 400,
              }}
            >
              {t.label}{t.is_custom && <span style={{ marginInlineStart: 6, fontSize: 11 }} title="Personnalisé">✓</span>}
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Chargement du modèle…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: 12, alignItems: 'start' }}>
            <textarea
              ref={textareaRef}
              value={html}
              onChange={e => { setHtml(e.target.value); setDirty(true); }}
              spellCheck={false}
              disabled={!canEdit}
              style={{
                width: '100%', minHeight: 380, padding: '12px 14px',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', resize: 'vertical',
                fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12, lineHeight: 1.6,
                background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box',
              }}
            />
            <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--paper-2)' }}>
                Blocs à insérer
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {placeholders.map(p => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertBloc(p.token)}
                    disabled={!canEdit}
                    title={`Insérer ${p.token}`}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px',
                      border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--paper-2)',
                      cursor: canEdit ? 'pointer' : 'default', textAlign: 'start',
                    }}
                  >
                    <code style={{ fontSize: 10, color: 'var(--info-text)', fontWeight: 600 }}>{p.token}</code>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.3 }}>{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
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
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error(t('parametre.format_invalide_image')); return; }
    if (file.size > 512 * 1024) { toast.error(t('parametre.fichier_trop_volumineux')); return; }
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
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error(t('parametre.format_invalide_image_simple')); return; }
    if (file.size > 512 * 1024) { toast.error(t('parametre.fichier_trop_volumineux')); return; }
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
  const { user, updatePreferences, updateProfile } = useAuthStore();
  const canManageFonctions = ['admin', 'directeur', 'gestionnaire'].includes(user?.role ?? '');

  const [tab, setTab] = useState<Tab>('etablissement');
  const [etab, setEtab] = useState<Etablissement | null>(null);
  const [config, setConfig] = useState<ConfigNotes | null>(null);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauLibelle, setNiveauLibelle] = useState('');
  const [niveauOrdre, setNiveauOrdre] = useState('');
  const [niveauNoteMax, setNiveauNoteMax] = useState('');
  const [editNiveau, setEditNiveau] = useState<Niveau | null>(null);
  const [mentionsNiveau, setMentionsNiveau] = useState<Niveau | null>(null);
  const [savingNiveau, setSavingNiveau] = useState(false);

  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [editTarif, setEditTarif] = useState<Tarif | null>(null);
  const [tarifForm, setTarifForm] = useState({
    code: '', libelle_fr: '', montant_defaut: '',
    periodicite: 'ponctuel' as Periodicite, obligatoire: true, actif: true, ordre: '',
  });
  const [savingTarif, setSavingTarif] = useState(false);
  const [confirmDeleteTarif, setConfirmDeleteTarif] = useState<Tarif | null>(null);
  const [deletingTarif, setDeletingTarif] = useState(false);

  const [fonctions, setFonctions] = useState<Fonction[]>([]);
  const [fonctionCode, setFonctionCode] = useState('');
  const [fonctionLibelle, setFonctionLibelle] = useState('');
  const [fonctionOrdre, setFonctionOrdre] = useState('');
  const [editFonction, setEditFonction] = useState<Fonction | null>(null);
  const [savingFonction, setSavingFonction] = useState(false);
  const [confirmDeleteFonction, setConfirmDeleteFonction] = useState<Fonction | null>(null);
  const [deletingFonction, setDeletingFonction] = useState(false);

  // ── Filières ───────────────────────────────────────────────────────────────
  const emptyFiliereForm = { code: 'FR' as FiliereCode, nom_fr: '', nom_ar: '', langue: 'fr', sens_ecriture: 'LTR' as 'LTR' | 'RTL', couleur: '#DDE2F1', ordre: '0' };
  const FILIERE_PRESETS: Record<FiliereCode, { nom_fr: string; langue: string; sens_ecriture: 'LTR' | 'RTL'; couleur: string; ordre: string }> = {
    FR: { nom_fr: 'Filière française', langue: 'fr', sens_ecriture: 'LTR', couleur: '#DDE2F1', ordre: '0' },
    AR: { nom_fr: 'Filière arabe',     langue: 'ar', sens_ecriture: 'RTL', couleur: '#DCEBDF', ordre: '1' },
    EN: { nom_fr: 'Filière anglaise',  langue: 'en', sens_ecriture: 'LTR', couleur: '#F1E4DD', ordre: '2' },
  };
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [filiereForm, setFiliereForm] = useState(emptyFiliereForm);
  const [editFiliere, setEditFiliere] = useState<Filiere | null>(null);
  const [savingFiliere, setSavingFiliere] = useState(false);
  const [confirmDeleteFiliere, setConfirmDeleteFiliere] = useState<Filiere | null>(null);
  const [deletingFiliere, setDeletingFiliere] = useState(false);

  const [mentions, setMentions] = useState<Mention[]>([]);
  // Portée filière des mentions par défaut ('' = toutes filières / défaut établissement).
  const [mentionFiliere, setMentionFiliere] = useState('');
  const [editMention, setEditMention] = useState<Mention | null>(null);
  const [mentionForm, setMentionForm] = useState({ libelle_fr: '', libelle_ar: '', seuil_min: '', couleur: 'info' as CouleurMention });
  const [savingMention, setSavingMention] = useState(false);
  const [confirmDeleteMention, setConfirmDeleteMention] = useState<Mention | null>(null);
  const [deletingMention, setDeletingMention] = useState(false);
  const [showMentionForm, setShowMentionForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [langue, setLangue] = useState(user?.langue ?? 'fr');
  const [themeVal, setThemeVal] = useState<'light' | 'dark'>((user?.theme as 'light' | 'dark') ?? 'light');
  const [profilNom, setProfilNom] = useState(user?.nom_fr ?? '');
  const [profilPrenom, setProfilPrenom] = useState(user?.prenom_fr ?? '');
  const [profilEmail, setProfilEmail] = useState(user?.email ?? '');
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

  const fetchFonctions = () =>
    api.get<Fonction[]>('/api/v1/fonctions').then(setFonctions).catch(() => {});

  const fetchFilieres = () =>
    api.get<Filiere[]>('/api/v1/filieres').then(setFilieres).catch(() => {});

  const fetchTarifs = () =>
    api.get<Tarif[]>('/api/v1/tarifs').then(setTarifs).catch(() => {});

  // Mentions de la portée filière choisie ('' = défaut établissement). L'id de filière
  // est résolu depuis le code (les filières sont déjà chargées).
  const fetchMentions = (filiereCode = mentionFiliere) => {
    const fid = filiereCode ? filieres.find(f => f.code === filiereCode)?.id : null;
    const q = fid ? `?filiere_id=${fid}` : '';
    return api.get<Mention[]>(`/api/v1/mentions${q}`).then(r => setMentions(r.map(m => ({ ...m, seuil_min: Number(m.seuil_min) })))).catch(() => {});
  };

  useEffect(() => {
    fetchNiveaux();
    fetchFonctions();
    fetchFilieres();
    fetchTarifs();
    fetchMentions();
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
            seuil_tres_bien:  Number(rawNotes.seuil_tres_bien  ?? 16),
            seuil_bien:       Number(rawNotes.seuil_bien       ?? 14),
            seuil_assez_bien: Number(rawNotes.seuil_assez_bien ?? 12),
            seuil_passable:   Number(rawNotes.seuil_passable   ?? 10),
            autoriser_toutes_matieres: Boolean(rawNotes.autoriser_toutes_matieres),
            autoriser_toutes_classes:  Boolean(rawNotes.autoriser_toutes_classes),
            bulletin_afficher_rang:     rawNotes.bulletin_afficher_rang     !== undefined ? Boolean(rawNotes.bulletin_afficher_rang)     : true,
            bulletin_afficher_absences: rawNotes.bulletin_afficher_absences !== undefined ? Boolean(rawNotes.bulletin_afficher_absences) : true,
            bulletin_logo_echelle:      Number(rawNotes.bulletin_logo_echelle   ?? 100),
            bulletin_police_echelle:    Number(rawNotes.bulletin_police_echelle ?? 100),
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
      const body = { libelle: niveauLibelle.trim(), ordre: Number(niveauOrdre) || 0, note_max: niveauNoteMax.trim() ? Number(niveauNoteMax) : null };
      if (editNiveau) {
        await api.put(`/api/v1/niveaux/${editNiveau.id}`, body);
        toast.success(t('parametre.niveau_modifie'));
      } else {
        await api.post('/api/v1/niveaux', body);
        toast.success(t('parametre.niveau_ajoute'));
      }
      setNiveauLibelle(''); setNiveauOrdre(''); setNiveauNoteMax(''); setEditNiveau(null);
      fetchNiveaux();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSavingNiveau(false); }
  };

  const handleDeleteNiveau = async (n: Niveau) => {
    try {
      await api.delete(`/api/v1/niveaux/${n.id}`);
      toast.success(t('parametre.niveau_supprime'));
      fetchNiveaux();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    }
  };

  const resetFonctionForm = () => {
    setEditFonction(null);
    setFonctionCode(''); setFonctionLibelle(''); setFonctionOrdre('');
  };

  const handleSaveFonction = async () => {
    if (!fonctionLibelle.trim()) return;
    setSavingFonction(true);
    try {
      const ordre = Number(fonctionOrdre) || 99;
      if (editFonction) {
        await api.patch(`/api/v1/fonctions/${editFonction.id}`, {
          libelle_fr: fonctionLibelle.trim(),
          ordre,
        });
        toast.success(t('parametre.fonction_modifiee'));
      } else {
        const code = fonctionCode.trim().toUpperCase().replace(/[^A-Z_]/g, '_');
        if (!code) { toast.error(t('parametre.code_requis_lettres')); return; }
        await api.post('/api/v1/fonctions', {
          code,
          libelle_fr: fonctionLibelle.trim(),
          ordre,
        });
        toast.success(t('parametre.fonction_ajoutee'));
      }
      resetFonctionForm();
      fetchFonctions();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSavingFonction(false); }
  };

  const performDeleteFonction = async () => {
    if (!confirmDeleteFonction) return;
    setDeletingFonction(true);
    try {
      await api.delete(`/api/v1/fonctions/${confirmDeleteFonction.id}`);
      toast.success(t('parametre.fonction_supprimee'));
      setConfirmDeleteFonction(null);
      fetchFonctions();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeletingFonction(false);
    }
  };

  // ── Filières ───────────────────────────────────────────────────────────────
  // Codes déjà configurés → retirés du menu d'ajout (liste fermée FR/AR/EN).
  const codesActifs = new Set(filieres.map(f => f.code));
  const codesDisponibles = (['FR', 'AR', 'EN'] as FiliereCode[]).filter(c => !codesActifs.has(c));

  const resetFiliereForm = () => {
    setEditFiliere(null);
    const code = codesDisponibles[0] ?? 'FR';
    const p = FILIERE_PRESETS[code];
    setFiliereForm({ ...emptyFiliereForm, code, nom_fr: p.nom_fr, langue: p.langue, sens_ecriture: p.sens_ecriture, couleur: p.couleur, ordre: p.ordre });
  };

  // Préremplit le formulaire d'ajout sur le premier code disponible dès que les
  // filières sont chargées : sinon le code par défaut ('FR') est déjà actif, le
  // menu n'affiche que 'EN' sans déclencher onChange, nom_fr reste vide et le
  // bouton « Ajouter » est grisé.
  useEffect(() => {
    if (editFiliere || codesDisponibles.length === 0) return;
    if (!codesDisponibles.includes(filiereForm.code)) resetFiliereForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filieres]);

  // Choix du code → préremplit les champs depuis le preset.
  const onFiliereCode = (code: FiliereCode) => {
    const p = FILIERE_PRESETS[code];
    setFiliereForm(f => ({ ...f, code, nom_fr: p.nom_fr, langue: p.langue, sens_ecriture: p.sens_ecriture, couleur: p.couleur, ordre: p.ordre }));
  };

  const openEditFiliere = (fi: Filiere) => {
    setEditFiliere(fi);
    setFiliereForm({
      code: fi.code, nom_fr: fi.nom_fr, nom_ar: fi.nom_ar ?? '', langue: fi.langue,
      sens_ecriture: fi.sens_ecriture,
      couleur: fi.couleur, ordre: String(fi.ordre),
    });
  };

  const handleSaveFiliere = async () => {
    if (!filiereForm.nom_fr.trim()) { toast.error('Le nom (FR) est requis'); return; }
    setSavingFiliere(true);
    try {
      const payload = {
        nom_fr: filiereForm.nom_fr.trim(),
        nom_ar: filiereForm.nom_ar.trim() || null,
        langue: filiereForm.langue,
        sens_ecriture: filiereForm.sens_ecriture,
        couleur: filiereForm.couleur,
        ordre: Number(filiereForm.ordre) || 0,
      };
      if (editFiliere) {
        await api.patch(`/api/v1/filieres/${editFiliere.id}`, payload);
        toast.success('Filière modifiée');
      } else {
        await api.post('/api/v1/filieres', { code: filiereForm.code, ...payload });
        toast.success('Filière ajoutée');
      }
      resetFiliereForm();
      fetchFilieres();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSavingFiliere(false); }
  };

  const toggleFiliereActif = async (fi: Filiere) => {
    try {
      await api.patch(`/api/v1/filieres/${fi.id}`, { actif: !fi.actif });
      fetchFilieres();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    }
  };

  const performDeleteFiliere = async () => {
    if (!confirmDeleteFiliere) return;
    setDeletingFiliere(true);
    try {
      await api.delete(`/api/v1/filieres/${confirmDeleteFiliere.id}`);
      toast.success('Filière supprimée');
      setConfirmDeleteFiliere(null);
      fetchFilieres();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeletingFiliere(false);
    }
  };

  const resetMentionForm = () => {
    setEditMention(null);
    setMentionForm({ libelle_fr: '', libelle_ar: '', seuil_min: '', couleur: 'info' });
    setShowMentionForm(false);
  };

  const handleSaveMention = async () => {
    const seuil = parseFloat(mentionForm.seuil_min);
    if (!mentionForm.libelle_fr.trim()) { toast.error('Le libellé est requis'); return; }
    if (isNaN(seuil) || seuil < 0) { toast.error('Seuil invalide (doit être ≥ 0)'); return; }
    if (config && seuil >= config.note_max) { toast.error(`Le seuil doit être inférieur à la note max (${config.note_max})`); return; }

    setSavingMention(true);
    try {
      if (editMention) {
        await api.patch(`/api/v1/mentions/${editMention.id}`, {
          libelle_fr: mentionForm.libelle_fr,
          libelle_ar: mentionForm.libelle_ar.trim() || null,
          seuil_min:  seuil,
          couleur:    mentionForm.couleur,
        });
        toast.success('Mention modifiée');
      } else {
        await api.post('/api/v1/mentions', {
          libelle_fr: mentionForm.libelle_fr,
          libelle_ar: mentionForm.libelle_ar.trim() || null,
          seuil_min:  seuil,
          couleur:    mentionForm.couleur,
          filiere_id: mentionFiliere ? (filieres.find(f => f.code === mentionFiliere)?.id ?? null) : null,
        });
        toast.success('Mention ajoutée');
      }
      resetMentionForm();
      fetchMentions();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSavingMention(false);
    }
  };

  const performDeleteMention = async () => {
    if (!confirmDeleteMention) return;
    setDeletingMention(true);
    try {
      await api.delete(`/api/v1/mentions/${confirmDeleteMention.id}`);
      toast.success('Mention supprimée');
      setConfirmDeleteMention(null);
      fetchMentions();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeletingMention(false);
    }
  };

  const resetTarifForm = () => {
    setEditTarif(null);
    setTarifForm({ code: '', libelle_fr: '', montant_defaut: '', periodicite: 'ponctuel', obligatoire: true, actif: true, ordre: '' });
  };

  const handleSaveTarif = async () => {
    if (!tarifForm.libelle_fr.trim()) { toast.error(t('parametre.libelle_requis')); return; }
    const montant = parseFloat(tarifForm.montant_defaut);
    if (isNaN(montant) || montant < 0) { toast.error(t('parametre.montant_invalide')); return; }
    setSavingTarif(true);
    try {
      const ordre = Number(tarifForm.ordre) || 0;
      if (editTarif) {
        await api.patch(`/api/v1/tarifs/${editTarif.id}`, {
          libelle_fr: tarifForm.libelle_fr.trim(),
          montant_defaut: montant,
          periodicite: tarifForm.periodicite,
          obligatoire: tarifForm.obligatoire,
          actif: tarifForm.actif,
          ordre,
        });
        toast.success(t('parametre.tarif_modifie'));
      } else {
        const code = tarifForm.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (!code) { toast.error(t('parametre.code_requis')); return; }
        await api.post('/api/v1/tarifs', {
          code, libelle_fr: tarifForm.libelle_fr.trim(),
          montant_defaut: montant, periodicite: tarifForm.periodicite,
          obligatoire: tarifForm.obligatoire, actif: tarifForm.actif, ordre,
        });
        toast.success(t('parametre.tarif_ajoute'));
      }
      resetTarifForm();
      fetchTarifs();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSavingTarif(false);
    }
  };

  const performDeleteTarif = async () => {
    if (!confirmDeleteTarif) return;
    setDeletingTarif(true);
    try {
      await api.delete(`/api/v1/tarifs/${confirmDeleteTarif.id}`);
      toast.success(t('parametre.tarif_supprime'));
      setConfirmDeleteTarif(null);
      fetchTarifs();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeletingTarif(false);
    }
  };

  const handleNbPeriodes = (n: number) => {
    if (!config) return;
    const clamped = Math.max(1, Math.min(6, n));
    const oldN = config.nb_periodes;
    // On régénère les noms par DÉFAUT pour refléter le nouveau découpage
    // (trimestre ↔ semestre), mais on conserve les noms personnalisés par l'utilisateur.
    const fr = Array.from({ length: clamped }, (_, i) => {
      const cur = config.noms_periodes?.fr?.[i];
      const etaitDefaut = !cur || cur === defautPeriodeFr(i, oldN);
      return etaitDefaut ? defautPeriodeFr(i, clamped) : cur;
    });
    setConfig({ ...config, nb_periodes: clamped, noms_periodes: { fr } });
  };

  const saveEtab = async () => {
    if (!etab) return;
    setSaving('etab');
    try {
      await api.put('/api/v1/parametres', {
        nom_fr: etab.nom_fr,
        code: etab.code.trim().toUpperCase(),
        adresse: etab.adresse,
        telephone: etab.telephone, devise: etab.devise,
        email: etab.email?.trim() || null,
        numero_autorisation: etab.numero_autorisation?.trim() || null,
        entete_bulletin_fr: etab.entete_bulletin_fr?.trim() || null,
        entete_bulletin_ar: etab.entete_bulletin_ar?.trim() || null,
        nom_directeur: etab.nom_directeur || null,
        civilite_directeur: etab.civilite_directeur || null,
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
    if (!profilNom.trim()) { toast.error(t('parametre.nom_requis')); return; }
    if (profilEmail.trim() && !/^\S+@\S+\.\S+$/.test(profilEmail.trim())) {
      toast.error(t('parametre.email_invalide')); return;
    }
    setSaving('compte');
    try {
      await api.put('/api/v1/auth/profil', {
        nom_fr: profilNom.trim(),
        prenom_fr: profilPrenom.trim() || null,
        email: profilEmail.trim() || null,
        langue,
        theme: themeVal,
      });
      updatePreferences(langue, themeVal);
      updateProfile({
        nom_fr: profilNom.trim(),
        prenom_fr: profilPrenom.trim() || undefined,
        email: profilEmail.trim() || null,
      });
      await i18n.changeLanguage(langue);
      toast.success(t('parametre.preferences_ok'));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(null); }
  };

  const savePassword = async () => {
    if (!ancienMdp || !nouveauMdp) { toast.error(t('parametre.tous_champs_requis')); return; }
    if (nouveauMdp !== confirmMdp) { toast.error(t('parametre.mdp_mismatch')); return; }
    if (nouveauMdp.length < 8) { toast.error(t('parametre.mdp_min_8')); return; }
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
            { key: 'filieres', label: 'Filières' },
            { key: 'niveaux', label: 'Niveaux' },
            { key: 'fonctions', label: 'Fonctions personnel' },
            { key: 'bulletins', label: t('parametre.bulletins_section') },
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
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: '0 0 120px' }}>
                    <Input
                      label="Code matricule"
                      value={etab.code}
                      maxLength={4}
                      placeholder="ex: FIC"
                      onChange={e => setEtab(p => p ? { ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') } : p)}
                    />
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)', paddingTop: 28, lineHeight: 1.5 }}>
                    Préfixe des matricules (2-4 maj). Modifier ce code n'affecte pas les matricules déjà générés.
                  </div>
                </div>
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
                    label="Email"
                    type="email"
                    placeholder="ex: contact@ecole.sn"
                    value={etab.email ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, email: e.target.value } : p)}
                  />
                  <Input
                    label="N° d'autorisation"
                    placeholder="Autorisation d'enseigner / d'ouverture"
                    value={etab.numero_autorisation ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, numero_autorisation: e.target.value } : p)}
                  />
                </div>
                <div className="grid-2">
                  <Select
                    label="Civilité"
                    value={etab.civilite_directeur ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, civilite_directeur: (e.target.value || null) as 'M' | 'Mme' | null } : p)}
                    options={[
                      { value: 'M',   label: 'M.' },
                      { value: 'Mme', label: 'Mme' },
                    ]}
                    placeholder="— Non précisé —"
                  />
                  <Input
                    label="Nom du/de la Directeur(trice)"
                    placeholder={t('parametre.ex_directeur')}
                    value={etab.nom_directeur ?? ''}
                    onChange={e => setEtab(p => p ? { ...p, nom_directeur: e.target.value } : p)}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 12px', background: 'var(--paper-2)', borderRadius: 6, border: '1px solid var(--rule)' }}>
                  Ces deux champs servent de <strong>repli</strong> pour la génération des documents
                  (bulletins, certificats, cartes…) lorsque l'établissement n'a pas encore de
                  Personnel de fonction <em>Directeur</em>. Dès qu'un Personnel directeur est défini
                  dans le module RH, ses informations sont utilisées en priorité.
                </div>
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

              <div className="field">
                <label className="field-label">{t('parametre.nb_periodes')}</label>
                <select
                  className="select"
                  value={config.nb_periodes}
                  onChange={e => handleNbPeriodes(parseInt(e.target.value))}
                >
                  <option value={1}>1 {t('parametre.periode')}</option>
                  <option value={2}>2 {t('parametre.periodes')} — Semestres</option>
                  <option value={3}>3 {t('parametre.periodes')} — Trimestres</option>
                  <option value={4}>4 {t('parametre.periodes')}</option>
                  <option value={6}>6 {t('parametre.periodes')} — Bimestres</option>
                </select>
              </div>

              <Toggle
                label={t('parametre.chiffres_arabes')}
                description="٠١٢٣٤٥٦٧٨٩ au lieu de 0123456789 sur les bulletins"
                checked={config.chiffres_arabes}
                onChange={v => setConfig(p => p ? { ...p, chiffres_arabes: v } : p)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                  {t('parametre.politique_saisie_notes')}
                </div>
                <Toggle
                  label={t('parametre.autoriser_toutes_matieres')}
                  description={t('parametre.autoriser_toutes_matieres_desc')}
                  checked={config.autoriser_toutes_matieres}
                  onChange={v => setConfig(p => p ? { ...p, autoriser_toutes_matieres: v } : p)}
                />
                <Toggle
                  label={t('parametre.autoriser_toutes_classes')}
                  description={t('parametre.autoriser_toutes_classes_desc')}
                  checked={config.autoriser_toutes_classes}
                  onChange={v => setConfig(p => p ? { ...p, autoriser_toutes_classes: v } : p)}
                />
                {(config.autoriser_toutes_matieres || config.autoriser_toutes_classes) && (
                  <div style={{
                    fontSize: 12, color: 'var(--warning-text)',
                    background: 'var(--warning-soft)', border: '1px solid var(--warning-border)',
                    padding: '8px 12px', borderRadius: 'var(--r-md)',
                  }}>
                    ⓘ {t('parametre.politique_saisie_notes_modif_active')}
                  </div>
                )}
              </div>

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
                <Input
                  key={i}
                  label={`${t('parametre.periode')} ${i + 1}`}
                  value={config.noms_periodes?.fr?.[i] ?? ''}
                  onChange={e => setConfig(p => {
                    if (!p) return p;
                    const fr = [...(p.noms_periodes?.fr ?? [])];
                    fr[i] = e.target.value;
                    return { ...p, noms_periodes: { fr } };
                  })}
                />
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
              placeholder={t('parametre.ex_niveau')}
            />
            <Input
              label="Ordre d'affichage"
              type="number"
              value={niveauOrdre}
              onChange={e => setNiveauOrdre(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Échelle (note max)"
              type="number"
              value={niveauNoteMax}
              onChange={e => setNiveauNoteMax(e.target.value)}
              placeholder={`établissement (${config?.note_max ?? 10})`}
              style={{ width: 150 }}
            />
            <div style={{ paddingTop: 22 }}>
              <Button onClick={handleSaveNiveau} loading={savingNiveau} disabled={!niveauLibelle.trim()}>
                {editNiveau ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
            {editNiveau && (
              <div style={{ paddingTop: 22 }}>
                <Button variant="ghost" onClick={() => { setEditNiveau(null); setNiveauLibelle(''); setNiveauOrdre(''); setNiveauNoteMax(''); }}>
                  Annuler
                </Button>
              </div>
            )}
          </div>

          <table className="table">
            <thead>
              <tr><th>Libellé</th><th>Ordre</th><th style={{ textAlign: 'center' }}>Échelle</th><th></th></tr>
            </thead>
            <tbody>
              {niveaux.map(n => (
                <tr key={n.id}>
                  <td>{n.libelle}</td>
                  <td>{n.ordre}</td>
                  <td style={{ textAlign: 'center', fontSize: 12 }}>{n.note_max == null ? `/${config?.note_max ?? 10}` : `/${Number(n.note_max)}`}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="ghost" onClick={() => setMentionsNiveau(n)}>
                        Mentions
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditNiveau(n); setNiveauLibelle(n.libelle); setNiveauOrdre(String(n.ordre)); setNiveauNoteMax(n.note_max == null ? '' : String(n.note_max)); }}>
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
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun niveau défini</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Onglet Filières ── */}
      {tab === 'filieres' && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 8 }}>Filières de l'établissement</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Les pistes académiques que votre école propose (français, arabe, anglais).
            Une filière utilisée par des classes ou matières ne peut pas être supprimée — désactivez-la à la place.
            Le barème est enregistré mais ne s'appliquera aux bulletins qu'ultérieurement.
          </p>

          {canManageFonctions && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
              {!editFiliere && (
                <div>
                  <label className="field-label">Code</label>
                  <select
                    className="input"
                    value={filiereForm.code}
                    onChange={e => onFiliereCode(e.target.value as FiliereCode)}
                    disabled={codesDisponibles.length === 0}
                    style={{ minWidth: 90 }}
                  >
                    {(codesDisponibles.length ? codesDisponibles : [filiereForm.code]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <Input label="Nom FR" value={filiereForm.nom_fr} onChange={e => setFiliereForm(f => ({ ...f, nom_fr: e.target.value }))} placeholder="Filière anglaise" />
              <Input label="Nom AR" value={filiereForm.nom_ar} onChange={e => setFiliereForm(f => ({ ...f, nom_ar: e.target.value }))} placeholder="اختياري" style={{ direction: 'rtl' }} />
              <div>
                <label className="field-label">Sens</label>
                <select className="input" value={filiereForm.sens_ecriture} onChange={e => setFiliereForm(f => ({ ...f, sens_ecriture: e.target.value as 'LTR' | 'RTL' }))}>
                  <option value="LTR">LTR</option>
                  <option value="RTL">RTL</option>
                </select>
              </div>
              <div>
                <label className="field-label">Couleur</label>
                <input type="color" value={filiereForm.couleur} onChange={e => setFiliereForm(f => ({ ...f, couleur: e.target.value }))} style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--paper)' }} />
              </div>
              <Input label="Ordre" type="number" value={filiereForm.ordre} onChange={e => setFiliereForm(f => ({ ...f, ordre: e.target.value }))} placeholder="0" style={{ width: 80 }} />
              <div style={{ paddingTop: 22 }}>
                <Button onClick={handleSaveFiliere} loading={savingFiliere} disabled={!filiereForm.nom_fr.trim() || (!editFiliere && codesDisponibles.length === 0)}>
                  {editFiliere ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
              {editFiliere && (
                <div style={{ paddingTop: 22 }}>
                  <Button variant="ghost" onClick={resetFiliereForm}>Annuler</Button>
                </div>
              )}
            </div>
          )}
          {canManageFonctions && !editFiliere && codesDisponibles.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12, marginBottom: 16 }}>
              Les trois filières (FR, AR, EN) sont déjà configurées.
            </p>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Nom</th><th>Langue</th>
                <th style={{ textAlign: 'center' }}>Classes</th><th style={{ textAlign: 'center' }}>Matières</th>
                <th style={{ textAlign: 'center' }}>Active</th>{canManageFonctions && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filieres.map(fi => {
                const usages = fi.nb_classes + fi.nb_matieres;
                return (
                  <tr key={fi.id} style={{ opacity: fi.actif ? 1 : 0.55 }}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 12 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: fi.couleur, border: '1px solid var(--border)' }} />
                        {fi.code}
                      </span>
                    </td>
                    <td>{fi.nom_fr}{fi.nom_ar ? <span style={{ color: 'var(--text-muted)', marginInlineStart: 8 }} dir="rtl">{fi.nom_ar}</span> : null}</td>
                    <td style={{ fontSize: 12 }}>{fi.langue} · {fi.sens_ecriture}</td>
                    <td style={{ textAlign: 'center' }}>{fi.nb_classes}</td>
                    <td style={{ textAlign: 'center' }}>{fi.nb_matieres}</td>
                    <td style={{ textAlign: 'center' }}>
                      {canManageFonctions ? (
                        <button
                          onClick={() => toggleFiliereActif(fi)}
                          title={fi.actif ? 'Désactiver' : 'Activer'}
                          style={{ cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 16 }}
                        >
                          {fi.actif ? '✅' : '⬜'}
                        </button>
                      ) : (fi.actif ? '✅' : '⬜')}
                    </td>
                    {canManageFonctions && (
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button size="sm" variant="ghost" onClick={() => openEditFiliere(fi)}>Modifier</Button>
                          {usages > 0 ? (
                            <span title="Filière utilisée — désactivez-la au lieu de la supprimer" style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 8px', cursor: 'help' }}>utilisée</span>
                          ) : (
                            <Button size="sm" variant="danger" onClick={() => setConfirmDeleteFiliere(fi)}>Supprimer</Button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filieres.length === 0 && (
                <tr><td colSpan={canManageFonctions ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune filière configurée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Onglet Fonctions ── */}
      {tab === 'fonctions' && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 8 }}>Fonctions du personnel</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Catalogue des fonctions disponibles pour les membres du personnel.
            Une fonction ayant des agents assignés ne peut pas être supprimée.
          </p>

          {canManageFonctions && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
              {!editFonction && (
                <Input
                  label="Code"
                  value={fonctionCode}
                  onChange={e => setFonctionCode(e.target.value.toUpperCase())}
                  placeholder="Ex: VEILLEUR_NUIT"
                />
              )}
              <Input
                label="Libellé FR"
                value={fonctionLibelle}
                onChange={e => setFonctionLibelle(e.target.value)}
                placeholder="Ex: Veilleur de nuit"
              />
              <Input
                label="Ordre"
                type="number"
                value={fonctionOrdre}
                onChange={e => setFonctionOrdre(e.target.value)}
                placeholder="99"
              />
              <div style={{ paddingTop: 22 }}>
                <Button onClick={handleSaveFonction} loading={savingFonction} disabled={!fonctionLibelle.trim()}>
                  {editFonction ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
              {editFonction && (
                <div style={{ paddingTop: 22 }}>
                  <Button variant="ghost" onClick={resetFonctionForm}>Annuler</Button>
                </div>
              )}
            </div>
          )}

          <table className="table">
            <thead>
              <tr><th>Code</th><th>Libellé FR</th><th>Ordre</th><th style={{ textAlign: 'center' }}>Effectif</th>{canManageFonctions && <th></th>}</tr>
            </thead>
            <tbody>
              {fonctions.map(f => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.code}</td>
                  <td>{f.libelle_fr}</td>
                  <td>{f.ordre}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 28, height: 22, borderRadius: 11,
                      fontSize: 12, fontWeight: 600,
                      background: f.effectif > 0 ? 'var(--info-soft)' : 'var(--paper-2)',
                      color: f.effectif > 0 ? 'var(--info-text)' : 'var(--ink-4)',
                      padding: '0 8px',
                    }}>
                      {f.effectif}
                    </span>
                  </td>
                  {canManageFonctions && (
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditFonction(f);
                          setFonctionCode(f.code);
                          setFonctionLibelle(f.libelle_fr);
                          setFonctionOrdre(String(f.ordre));
                        }}>
                          Modifier
                        </Button>
                        {f.effectif > 0 ? (
                          <span
                            title={`${f.effectif} agent(s) assigné(s) — réassignez-les avant de supprimer`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic',
                              padding: '4px 8px', cursor: 'help',
                            }}
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <circle cx={12} cy={12} r={10}/>
                              <line x1={12} y1={8} x2={12} y2={12}/>
                              <line x1={12} y1={16} x2={12.01} y2={16}/>
                            </svg>
                            En usage
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmDeleteFonction(f)}
                          >
                            Supprimer
                          </Button>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {fonctions.length === 0 && (
                <tr><td colSpan={canManageFonctions ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune fonction définie</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Onglet Mon compte ── */}
      {tab === 'compte' && (
        <>
          {/* Carte profil — éditable */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SectionIcon path="M12 3C9.79 3 8 4.79 8 7s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                <div>
                  <h3 style={{ margin: 0 }}>{t('parametre.mon_profil')}</h3>
                  <span className="sub">Vos informations personnelles. L'identifiant et le rôle ne peuvent pas être modifiés ici.</span>
                </div>
              </div>
              <Button onClick={saveCompte} loading={saving === 'compte'}>{t('actions.enregistrer')}</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 18,
                padding: '12px 16px', background: 'var(--paper-2)',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)',
              }}>
                <div className="avatar avatar-xl" style={{
                  background: 'var(--terra-soft)', color: 'var(--terra-ink)',
                  fontSize: 22, fontWeight: 700, border: 'none',
                }}>
                  {((profilPrenom || profilNom) ?? '').slice(0, 2).toUpperCase() || '?'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{user?.role}</div>
                  {user?.identifiant && (
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      @{user.identifiant}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid-2">
                <Input
                  label={t('common.prenom_fr')}
                  value={profilPrenom}
                  onChange={e => setProfilPrenom(e.target.value)}
                />
                <Input
                  label={t('common.nom_fr')}
                  value={profilNom}
                  onChange={e => setProfilNom(e.target.value)}
                />
              </div>
              <Input
                label={t('common.email')}
                type="email"
                placeholder="exemple@daara.sn"
                value={profilEmail}
                onChange={e => setProfilEmail(e.target.value)}
              />
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
                  {(['fr', 'ar', 'en'] as const).map(l => (
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
                      {l === 'fr' ? 'Français' : l === 'ar' ? 'العربية' : 'English'}
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

      {/* ── Onglet Bulletins : rendu du PDF ── */}
      {!loading && tab === 'bulletins' && config && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div>
              <h3 style={{ margin: 0 }}>{t('parametre.bulletin_rendu_titre')}</h3>
              <span className="sub">{t('parametre.bulletin_rendu_desc')}</span>
            </div>
            <Button onClick={saveConfig} loading={saving === 'notes'}>{t('actions.enregistrer')}</Button>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Toggle
              label={t('parametre.bulletin_afficher_rang')}
              description={t('parametre.bulletin_afficher_rang_desc')}
              checked={config.bulletin_afficher_rang}
              onChange={v => setConfig(c => c ? { ...c, bulletin_afficher_rang: v } : c)}
            />
            <Toggle
              label={t('parametre.bulletin_afficher_absences')}
              description={t('parametre.bulletin_afficher_absences_desc')}
              checked={config.bulletin_afficher_absences}
              onChange={v => setConfig(c => c ? { ...c, bulletin_afficher_absences: v } : c)}
            />
            <div className="grid-2">
              <div className="field">
                <label className="field-label">{t('parametre.bulletin_logo_echelle')} — {config.bulletin_logo_echelle}%</label>
                <input
                  type="range" min={50} max={200} step={5}
                  value={config.bulletin_logo_echelle}
                  onChange={e => setConfig(c => c ? { ...c, bulletin_logo_echelle: Number(e.target.value) } : c)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="field">
                <label className="field-label">{t('parametre.bulletin_police_echelle')} — {config.bulletin_police_echelle}%</label>
                <input
                  type="range" min={70} max={150} step={5}
                  value={config.bulletin_police_echelle}
                  onChange={e => setConfig(c => c ? { ...c, bulletin_police_echelle: Number(e.target.value) } : c)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Onglet Bulletins : en-tête officiel (déplacé depuis Établissement) ── */}
      {!loading && tab === 'bulletins' && etab && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div>
              <h3 style={{ margin: 0 }}>{t('parametre.bulletin_entete_titre')}</h3>
              <span className="sub">{t('parametre.bulletin_entete_desc')}</span>
            </div>
            <Button onClick={saveEtab} loading={saving === 'etab'}>{t('actions.enregistrer')}</Button>
          </div>
          <div className="card-pad">
            <div className="grid-2">
              <div className="field">
                <label className="field-label">Texte d'en-tête (FR)</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder={'République du Sénégal\nUn Peuple — Un But — Une Foi\nMinistère de l\'Éducation nationale\nIEF de …'}
                  value={etab.entete_bulletin_fr ?? ''}
                  onChange={e => setEtab(p => p ? { ...p, entete_bulletin_fr: e.target.value } : p)}
                />
              </div>
              <div className="field">
                <label className="field-label">Texte d'en-tête (AR)</label>
                <textarea
                  className="input"
                  rows={4}
                  dir="rtl"
                  placeholder={'الجمهورية السنغالية\nشعب — هدف — إيمان\nوزارة التربية الوطنية'}
                  value={etab.entete_bulletin_ar ?? ''}
                  onChange={e => setEtab(p => p ? { ...p, entete_bulletin_ar: e.target.value } : p)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Onglet Bulletins : modèle HTML avancé (Étape 2) ── */}
      {!loading && tab === 'bulletins' && <BulletinTemplateEditor />}

      {/* ── Onglet Niveaux : mentions par défaut de l'établissement (les mentions par
             niveau se configurent via le bouton « Mentions » de chaque niveau ci-dessus) ── */}
      {!loading && tab === 'niveaux' && config && (() => {
        const sorted = [...mentions].sort((a, b) => b.seuil_min - a.seuil_min);
        const COULEUR_OPTIONS: { value: CouleurMention; label: string }[] = [
          { value: 'success', label: 'Vert (Très bien)' },
          { value: 'info',    label: 'Bleu (Bien)' },
          { value: 'warning', label: 'Jaune (Passable)' },
          { value: 'error',   label: 'Rouge (Insuffisant)' },
        ];
        return (
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0 }}>{t('parametre.bareme_mentions')}</h3>
                <span className="sub">
                  Mentions appliquées aux bulletins (note max : {config.note_max}). Ajoutez, renommez ou supprimez librement.
                  La mention «&nbsp;Insuffisant&nbsp;» (seuil 0) est système et non supprimable.
                  {mentionFiliere
                    ? ` — Portée : filière ${mentionFiliere}. Vide = cette filière hérite du défaut établissement.`
                    : ' — Portée : défaut établissement (toutes filières).'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200 }}>
                  <Select
                    label="Filière"
                    value={mentionFiliere}
                    onChange={e => { setMentionFiliere(e.target.value); resetMentionForm(); fetchMentions(e.target.value); }}
                    options={[{ value: '', label: 'Défaut établissement (toutes)' }, ...filieres.map(f => ({ value: f.code, label: f.nom_fr }))]}
                  />
                </div>
                {canManageFonctions && !showMentionForm && (
                  <Button onClick={() => { resetMentionForm(); setShowMentionForm(true); }}>
                    + Ajouter une mention
                  </Button>
                )}
              </div>
            </div>

            {/* Barre de visualisation proportionnelle */}
            {mentions.length > 0 && (
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
                {sorted.map((m, i) => {
                  const next = sorted[i + 1];
                  const seuilMax = i === 0 ? config.note_max : sorted[i - 1].seuil_min;
                  const width = ((seuilMax - m.seuil_min) / config.note_max) * 100;
                  const bgMap: Record<string, string> = {
                    success: 'var(--success-text, #16a34a)',
                    info:    'var(--info-text, #2563eb)',
                    warning: 'var(--warning-text, #d97706)',
                    error:   'var(--danger-text, #dc2626)',
                  };
                  void next;
                  return (
                    <div
                      key={m.id}
                      title={`${m.libelle_fr} : ${m.seuil_min} → ${seuilMax}`}
                      style={{ width: `${width}%`, background: bgMap[m.couleur] ?? '#888', transition: 'width .3s' }}
                    />
                  );
                })}
              </div>
            )}

            {/* Formulaire d'ajout / édition inline */}
            {canManageFonctions && showMentionForm && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                padding: '14px 16px', marginBottom: 16,
                background: 'var(--paper-2)', borderRadius: 'var(--r-md)',
                border: '1px solid var(--rule)',
              }}>
                <Input
                  label="Libellé (FR)"
                  value={mentionForm.libelle_fr}
                  onChange={e => setMentionForm(f => ({ ...f, libelle_fr: e.target.value }))}
                  placeholder="Ex: Excellent"
                />
                <Input
                  label="Libellé (AR)"
                  value={mentionForm.libelle_ar}
                  onChange={e => setMentionForm(f => ({ ...f, libelle_ar: e.target.value }))}
                  placeholder="ممتاز"
                  style={{ direction: 'rtl' }}
                />
                <Input
                  label={`Seuil min (sur ${config.note_max})`}
                  type="number"
                  value={mentionForm.seuil_min}
                  onChange={e => setMentionForm(f => ({ ...f, seuil_min: e.target.value }))}
                  placeholder="Ex: 18"
                  disabled={editMention?.is_system}
                />
                <Select
                  label="Couleur"
                  value={mentionForm.couleur}
                  onChange={e => setMentionForm(f => ({ ...f, couleur: e.target.value as CouleurMention }))}
                  options={COULEUR_OPTIONS}
                />
                <div style={{ display: 'flex', gap: 8, paddingTop: 22 }}>
                  <Button onClick={handleSaveMention} loading={savingMention} disabled={!mentionForm.libelle_fr.trim()}>
                    {editMention ? 'Modifier' : 'Ajouter'}
                  </Button>
                  <Button variant="ghost" onClick={resetMentionForm}>Annuler</Button>
                </div>
              </div>
            )}

            {/* Alerte si des mentions ont un seuil_min >= note_max */}
            {sorted.some(m => !m.is_system && m.seuil_min >= config.note_max) && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--danger-soft, #fee2e2)', border: '1px solid var(--danger-border, #fca5a5)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text, #b91c1c)' }}>
                ⚠️ Certaines mentions ont un seuil supérieur ou égal à la note max ({config.note_max}). Modifiez-les pour qu'elles soient inférieures à {config.note_max}.
              </div>
            )}

            {/* Tableau des mentions */}
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Mention</th>
                    <th style={{ width: 120 }}>Seuil min (≥)</th>
                    <th style={{ width: 140 }} title="Calculé automatiquement : seuil min de la mention au-dessus">Seuil max (&lt;) *</th>
                    <th style={{ width: 100 }}>Couleur</th>
                    {canManageFonctions && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m, i) => {
                    const seuilMax = i === 0 ? config.note_max : sorted[i - 1].seuil_min;
                    const invalide = !m.is_system && m.seuil_min >= config.note_max;
                    return (
                      <tr key={m.id} style={invalide ? { background: 'var(--danger-soft, #fee2e2)' } : undefined}>
                        <td>
                          <span className={`badge badge-${m.couleur}`}>{m.libelle_fr}</span>
                          {m.libelle_ar && <span dir="rtl" style={{ marginInlineStart: 8, color: 'var(--ink-3)', fontSize: 13 }}>{m.libelle_ar}</span>}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {m.is_system ? (
                            <span style={{ color: 'var(--ink-3)' }}>0</span>
                          ) : (
                            <strong style={invalide ? { color: 'var(--danger-text, #b91c1c)' } : undefined}>{m.seuil_min}</strong>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
                          {seuilMax}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 6,
                            background: { success: '#16a34a', info: '#2563eb', warning: '#d97706', error: '#dc2626' }[m.couleur] ?? '#888',
                          }} />
                          {COULEUR_OPTIONS.find(c => c.value === m.couleur)?.label.split(' ')[0]}
                        </td>
                        {canManageFonctions && (
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setEditMention(m);
                                setMentionForm({ libelle_fr: m.libelle_fr, libelle_ar: m.libelle_ar ?? '', seuil_min: String(m.seuil_min), couleur: m.couleur });
                                setShowMentionForm(true);
                              }}>
                                Modifier
                              </Button>
                              {m.is_system ? (
                                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <rect x={3} y={11} width={18} height={11} rx={2} ry={2}/><path d="M7 11V7a5 5 0 0110 0v4"/>
                                  </svg>
                                  Système
                                </span>
                              ) : (
                                <Button size="sm" variant="danger" onClick={() => setConfirmDeleteMention(m)}>
                                  Supprimer
                                </Button>
                              )}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {mentions.length === 0 && (
                    <tr><td colSpan={canManageFonctions ? 5 : 4} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>Chargement…</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--info-text)' }}>
              * Le seuil max est calculé automatiquement : c'est le seuil min de la mention immédiatement supérieure.
              Pour ajuster le seuil max d'une mention, modifiez le seuil min de la mention au-dessus.
              Deux mentions ne peuvent pas partager le même seuil.
            </div>
          </div>
        );
      })()}

      {/* ── Tarifs ── */}
      {!loading && tab === 'tarifs' && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 8 }}>Catalogue des tarifs</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
            Définissez ici tous les frais facturés aux familles (mensualité, inscription, examen,
            uniforme, transport…). Le tarif <code>MENSUALITE</code> alimente le calcul des reliquats
            et ne peut pas être supprimé (vous pouvez le désactiver).
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            {!editTarif && (
              <Input
                label="Code"
                value={tarifForm.code}
                onChange={e => setTarifForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Ex: INSCRIPTION"
              />
            )}
            <Input
              label="Libellé"
              value={tarifForm.libelle_fr}
              onChange={e => setTarifForm(f => ({ ...f, libelle_fr: e.target.value }))}
              placeholder="Ex: Frais d'inscription"
            />
            <Input
              label="Montant"
              type="number"
              value={tarifForm.montant_defaut}
              onChange={e => setTarifForm(f => ({ ...f, montant_defaut: e.target.value }))}
              placeholder="0"
            />
            <Select
              label="Périodicité"
              value={tarifForm.periodicite}
              onChange={e => setTarifForm(f => ({ ...f, periodicite: e.target.value as Periodicite }))}
              options={[
                { value: 'ponctuel', label: 'Ponctuel' },
                { value: 'mensuel',  label: 'Mensuel' },
                { value: 'annuel',   label: 'Annuel' },
              ]}
            />
            <Input
              label="Ordre"
              type="number"
              value={tarifForm.ordre}
              onChange={e => setTarifForm(f => ({ ...f, ordre: e.target.value }))}
              placeholder="0"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={tarifForm.obligatoire}
                onChange={e => setTarifForm(f => ({ ...f, obligatoire: e.target.checked }))}
              />
              Obligatoire
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={tarifForm.actif}
                onChange={e => setTarifForm(f => ({ ...f, actif: e.target.checked }))}
              />
              Actif
            </label>
            <div style={{ paddingTop: 22 }}>
              <Button onClick={handleSaveTarif} loading={savingTarif} disabled={!tarifForm.libelle_fr.trim()}>
                {editTarif ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
            {editTarif && (
              <div style={{ paddingTop: 22 }}>
                <Button variant="ghost" onClick={resetTarifForm}>Annuler</Button>
              </div>
            )}
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Libellé</th>
                <th>Montant</th>
                <th>Périodicité</th>
                <th>Obligatoire</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tarifs.map(tarif => (
                <tr key={tarif.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tarif.code}</td>
                  <td>{tarif.libelle_fr}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {Number(tarif.montant_defaut).toLocaleString('fr-FR')} {etab?.devise ?? 'FCFA'}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{tarif.periodicite}</td>
                  <td>{tarif.obligatoire ? 'Oui' : 'Non'}</td>
                  <td>
                    <span className={`badge badge-${tarif.actif ? 'success' : 'neutral'}`}>
                      {tarif.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditTarif(tarif);
                        setTarifForm({
                          code: tarif.code,
                          libelle_fr: tarif.libelle_fr,
                          montant_defaut: String(tarif.montant_defaut),
                          periodicite: tarif.periodicite,
                          obligatoire: tarif.obligatoire,
                          actif: tarif.actif,
                          ordre: String(tarif.ordre),
                        });
                      }}>
                        Modifier
                      </Button>
                      {tarif.code !== 'MENSUALITE' ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirmDeleteTarif(tarif)}>
                          Supprimer
                        </Button>
                      ) : (
                        <span
                          title="Tarif système, non supprimable (vous pouvez le désactiver)"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 8px',
                          }}
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x={3} y={11} width={18} height={11} rx={2} ry={2}/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                          Système
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {tarifs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>Aucun tarif défini</td></tr>
              )}
            </tbody>
          </table>
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
                Ces seuils déclenchent l'envoi d'alertes (e-mail / notification) aux parents et au personnel.
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

      <ConfirmModal
        isOpen={!!confirmDeleteFonction}
        onClose={() => setConfirmDeleteFonction(null)}
        onConfirm={performDeleteFonction}
        loading={deletingFonction}
        title="Supprimer la fonction"
        message={`Supprimer la fonction "${confirmDeleteFonction?.libelle_fr ?? ''}" ? Cette action est irréversible.`}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteFiliere}
        onClose={() => setConfirmDeleteFiliere(null)}
        onConfirm={performDeleteFiliere}
        loading={deletingFiliere}
        title="Supprimer la filière"
        message={`Supprimer la filière "${confirmDeleteFiliere?.nom_fr ?? ''}" ? Cette action est irréversible.`}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteTarif}
        onClose={() => setConfirmDeleteTarif(null)}
        onConfirm={performDeleteTarif}
        loading={deletingTarif}
        title="Supprimer le tarif"
        message={`Supprimer le tarif "${confirmDeleteTarif?.libelle_fr ?? ''}" ? Les paiements déjà enregistrés ne sont pas affectés.`}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteMention}
        onClose={() => setConfirmDeleteMention(null)}
        onConfirm={performDeleteMention}
        loading={deletingMention}
        title="Supprimer la mention"
        message={`Supprimer la mention "${confirmDeleteMention?.libelle_fr ?? ''}" ? Cette action est irréversible.`}
      />

      {mentionsNiveau && (
        <NiveauMentionsModal
          niveau={mentionsNiveau}
          noteMax={Number(mentionsNiveau.note_max ?? config?.note_max ?? 20)}
          defaults={mentions}
          api={api}
          onClose={() => setMentionsNiveau(null)}
        />
      )}
    </>
  );
}
