import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';

interface QRData {
  dataUrl: string;
  token: string;
  nom: string;
}

function QRCodeModal({ professeurId, nom, onClose, api }: {
  professeurId: string; nom: string; onClose: () => void;
  api: ReturnType<typeof useApi>;
}) {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<QRData>(`/api/v1/pointage/qr/${professeurId}`);
      setQrData(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [professeurId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger(); }, [charger]);

  const handleRegenerer = async () => {
    if (!confirm(`Régénérer le QR code de ${nom} ? L'ancien QR code ne fonctionnera plus.`)) return;
    setRegenerating(true);
    try {
      const data = await api.post<QRData>(`/api/v1/pointage/qr/${professeurId}/regenerer`, {});
      setQrData(data);
      toast.success('QR code régénéré');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleTelecharger = () => {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData.dataUrl;
    a.download = `qr-${nom.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  const handleImprimer = () => {
    if (!qrData) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code — ${qrData.nom}</title>
      <style>
        body { font-family: system-ui; text-align: center; padding: 40px; }
        img { width: 280px; height: 280px; }
        h2 { margin-top: 20px; font-size: 22px; }
        p { color: #666; font-size: 14px; }
      </style>
      </head><body>
        <p style="font-size:13px;color:#999;letter-spacing:2px;text-transform:uppercase">DaaraGest — Pointage</p>
        <img src="${qrData.dataUrl}" alt="QR Code" />
        <h2>${qrData.nom}</h2>
        <p>Scannez ce code pour enregistrer votre présence</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Modal isOpen onClose={onClose} title={`QR Code — ${nom}`} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--ink-3)' }}>Génération en cours…</div>
        ) : qrData ? (
          <>
            <div style={{
              background: '#fff', borderRadius: 12, padding: 16,
              border: '1px solid var(--rule)', display: 'inline-block',
            }}>
              <img src={qrData.dataUrl} alt="QR Code" style={{ width: 240, height: 240, display: 'block' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>
              Ce code est unique à {nom}.<br />À scanner sur la tablette de pointage.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size="sm" variant="secondary" onClick={handleTelecharger}>
                Télécharger PNG
              </Button>
              <Button size="sm" variant="secondary" onClick={handleImprimer}>
                Imprimer
              </Button>
              <Button size="sm" variant="danger" onClick={handleRegenerer} loading={regenerating}>
                Régénérer
              </Button>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--danger)', padding: 20 }}>Erreur de chargement</div>
        )}
      </div>
    </Modal>
  );
}

interface Professeur {
  id: string;
  nom_fr: string;
  prenom_fr?: string;
  nom_ar: string;
  identifiant: string;
  specialite_fr: string;
  telephone: string;
  type_contrat: 'permanent' | 'vacataire';
  statut: 'actif' | 'inactif';
  photo_url?: string;
  professeur?: { photo_url?: string };
}

interface ProfesseursResponse {
  data: Professeur[];
  total: number;
  page: number;
}

interface ProfesseurFormData {
  nom_fr: string;
  nom_ar: string;
  identifiant: string;
  mot_de_passe: string;
  specialite_fr: string;
  telephone: string;
  type_contrat: string;
  photo_url?: string;
}

type FormErrors = Partial<Record<keyof ProfesseurFormData, string>>;

const EMPTY_FORM: ProfesseurFormData = {
  nom_fr: '', nom_ar: '',
  identifiant: '', mot_de_passe: '', specialite_fr: '', telephone: '', type_contrat: '',
};

// Labels définis dans le composant via t() pour la traduction

const LIMIT = 20;

function validate(form: ProfesseurFormData, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.nom_fr.trim()) errors.nom_fr = 'Le nom est requis';
  if (!form.identifiant.trim()) errors.identifiant = "L'identifiant est requis";
  if (!isEdit && !form.mot_de_passe.trim()) errors.mot_de_passe = 'Le mot de passe est requis';
  if (!form.type_contrat) errors.type_contrat = 'Le type de contrat est requis';
  return errors;
}

export function ProfesseursPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');

  const [profs, setProfs] = useState<Professeur[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Professeur | null>(null);
  const [form, setForm] = useState<ProfesseurFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Professeur | null>(null);
  const [deleting, setDeleting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [qrTarget, setQrTarget] = useState<Professeur | null>(null);
  const [carteUniqueLoading, setCarteUniqueLoading] = useState<string | null>(null);
  const [carteLotModal, setCarteLotModal] = useState(false);
  const [carteLotGenerating, setCarteLotGenerating] = useState(false);
  const [carteLotErreurs, setCarteLotErreurs] = useState<{ id: string; message: string }[]>([]);

  const fetchProfs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      const res = await api.get<ProfesseursResponse>(`/api/v1/professeurs?${params}`);
      setProfs(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProfs(); }, [fetchProfs]);
  useEffect(() => { setPage(1); }, [search]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(prof: Professeur) {
    setEditTarget(prof);
    setForm({
      nom_fr: prof.nom_fr,
      nom_ar: prof.nom_ar,
      identifiant: prof.identifiant, mot_de_passe: '',
      specialite_fr: prof.specialite_fr, telephone: prof.telephone,
      type_contrat: prof.type_contrat,
      photo_url: prof.professeur?.photo_url ?? prof.photo_url,
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function handlePhotoSelect(file: File) {
    const reader = new FileReader();
    setPhotoLoading(true);
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setForm((f) => ({ ...f, photo_url: base64 }));
      setPhotoLoading(false);
    };
    reader.onerror = () => setPhotoLoading(false);
    reader.readAsDataURL(file);
  }

  function setField<K extends keyof ProfesseurFormData>(key: K, value: ProfesseurFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit() {
    const errors = validate(form, !!editTarget);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nom_fr: form.nom_fr,
        nom_ar: form.nom_ar,
        identifiant: form.identifiant, specialite_fr: form.specialite_fr,
        telephone: form.telephone, type_contrat: form.type_contrat,
        photo_url: form.photo_url,
      };
      if (!editTarget && form.mot_de_passe) payload.mot_de_passe = form.mot_de_passe;
      if (editTarget) {
        await api.put(`/api/v1/professeurs/${editTarget.id}`, payload);
      } else {
        await api.post('/api/v1/professeurs', payload);
      }
      toast.success(editTarget ? 'Professeur modifié' : 'Professeur créé');
      setModalOpen(false);
      fetchProfs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/professeurs/${confirmDelete.id}`);
      toast.success('Professeur désactivé');
      setConfirmDelete(null);
      fetchProfs();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'nom_fr',
      header: 'Nom',
      render: (row) => {
        const p = row as unknown as Professeur;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--primary-soft)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: 'var(--primary)',
            }}>
              {(p.professeur?.photo_url ?? p.photo_url)
                ? <img src={p.professeur?.photo_url ?? p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (p.nom_fr?.[0] ?? '?').toUpperCase()
              }
            </div>
            <span>{p.nom_fr}</span>
          </div>
        );
      },
    },
    { key: 'identifiant', header: 'Identifiant' },
    { key: 'specialite_fr', header: 'Spécialité' },
    {
      key: 'type_contrat',
      header: 'Contrat',
      render: (row) => {
        const p = row as unknown as Professeur;
        return <Badge label={p.type_contrat === 'permanent' ? t('professeur.permanent') : t('professeur.vacataire')} variant={p.type_contrat === 'permanent' ? 'info' : 'warning'} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '160px',
      render: (row) => {
        const p = row as unknown as Professeur;
        return (
          <>
            <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>{t('actions.modifier')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setQrTarget(p)} title="QR Code pointage">QR</Button>
            <Button size="sm" variant="ghost" loading={carteUniqueLoading === p.id} onClick={() => handleCarteUnique(p.id)} title="Carte ID CR80">🪪</Button>
            {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p)}>{t('actions.supprimer')}</Button>}
          </>
        );
      },
    },
  ];

  async function handleCarteUnique(profId: string) {
    setCarteUniqueLoading(profId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/generer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_PROFESSEUR', destinataire_type: 'professeur', destinataire_id: profId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'carte_professeur.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Carte générée');
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteUniqueLoading(null); }
  }

  async function handleCarteLot() {
    setCarteLotGenerating(true);
    setCarteLotErreurs([]);
    try {
      const allProfs = await api.get<{ data: Professeur[] }>('/api/v1/professeurs?limit=500');
      const ids = (allProfs.data ?? []).map(p => p.id);
      if (!ids.length) { toast.error('Aucun professeur trouvé'); return; }
      const res = await fetch(`${API_BASE}/api/v1/documents/generer-lot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'CARTE_PROFESSEUR', ids }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Erreur' })); throw new Error(e.error ?? 'Erreur'); }
      const errsHeader = res.headers.get('X-Cartes-Erreurs');
      if (errsHeader) setCarteLotErreurs(JSON.parse(errsHeader));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cartes_professeurs_lot.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF généré — ${ids.length} carte(s)`);
    } catch (err) { toast.error((err as Error).message); }
    finally { setCarteLotGenerating(false); }
  }

  return (
    <>
      <PageHeader
          eyebrow="Personnel enseignant"
          title="Professeurs"
          subtitle="Gestion du corps enseignant"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => { setCarteLotErreurs([]); setCarteLotModal(true); }}>
                🪪 Cartes en lot
              </Button>
              <Button onClick={openAdd} icon={<span>+</span>}>
                Ajouter un professeur
              </Button>
            </div>
          }
        />

        {error && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="filter-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom ou identifiant..." />
          <div className="row" style={{ marginInlineStart: 'auto', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 6, padding: 2 }}>
            <button className={`btn btn-sm ${view === 'grid' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setView('grid')}>{t('professeur.vue_cartes')}</button>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setView('table')}>{t('professeur.vue_liste')}</button>
          </div>
        </div>

        {loading && <div className="empty">{t('common.chargement')}</div>}

        {!loading && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {profs.map(p => (
              <div key={p.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row gap-3">
                  <div className="avatar avatar-lg" style={{ background: 'var(--indigo-soft)', color: 'var(--indigo-ink)', overflow: 'hidden' }}>
                    {(p.professeur?.photo_url ?? p.photo_url)
                      ? <img src={p.professeur?.photo_url ?? p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : `${p.prenom_fr?.[0] ?? ''}${p.nom_fr?.[0] ?? ''}`}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.prenom_fr} {p.nom_fr}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{p.specialite_fr}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>{t('actions.modifier')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setQrTarget(p)} title="QR Code pointage">QR</button>
                    <button className="btn btn-ghost btn-sm" loading={carteUniqueLoading === p.id ? 'true' : undefined} onClick={() => handleCarteUnique(p.id)} title="Carte ID CR80">🪪</button>
                    {isAdmin && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(p)}>✕</button>}
                  </div>
                </div>
                <div className="divider" style={{ margin: '4px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><div className="muted">Contrat</div><div style={{ fontWeight: 500 }}>{p.type_contrat}</div></div>
                  <div>
                    <div className="muted">Statut</div>
                    <Badge label={p.statut === 'actif' ? t('common.actif') : t('common.inactif')} variant={p.statut === 'actif' ? 'success' : 'neutral'} />
                  </div>
                </div>
              </div>
            ))}
            {profs.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}>Aucun professeur trouvé</div>}
          </div>
        )}

        {!loading && view === 'table' && (
          <Table
            columns={columns}
            data={profs as unknown as Record<string, unknown>[]}
            loading={false}
            emptyMessage="Aucun professeur trouvé"
          />
        )}

        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editTarget ? 'Modifier le professeur' : 'Ajouter un professeur'}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) handlePhotoSelect(e.target.files[0]); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoLoading}
                style={{
                  position: 'relative', width: 88, height: 88, borderRadius: '50%',
                  border: '2px dashed var(--border)', background: 'var(--surface-2)',
                  cursor: 'pointer', overflow: 'hidden', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
                }}
              >
                {form.photo_url
                  ? <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28 }}>👤</span>
                }
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.5)', padding: '4px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: 11 }}>{photoLoading ? '…' : '📷'}</span>
                </div>
              </button>
            </div>

            <Input label={t('common.nom_fr')} value={form.nom_fr} onChange={(e) => setField('nom_fr', e.target.value)} error={formErrors.nom_fr} />

            <div className="grid-2">
              <Input label={t('auth.identifiant')} value={form.identifiant} onChange={(e) => setField('identifiant', e.target.value)} error={formErrors.identifiant} />
              {!editTarget && (
                <Input label={t('auth.password')} type="password" value={form.mot_de_passe} onChange={(e) => setField('mot_de_passe', e.target.value)} error={formErrors.mot_de_passe} />
              )}
            </div>
            <div className="grid-2">
              <Input label={t('professeur.specialite')} value={form.specialite_fr} onChange={(e) => setField('specialite_fr', e.target.value)} />
              <Input label={t('common.telephone')} type="tel" value={form.telephone} onChange={(e) => setField('telephone', e.target.value)} />
            </div>
            <Select
              label={t('professeur.type_contrat')}
              value={form.type_contrat}
              onChange={(e) => setField('type_contrat', e.target.value)}
              error={formErrors.type_contrat}
              options={[
                { value: '', label: t('common.selectionner') },
                { value: 'permanent', label: t('professeur.permanent') },
                { value: 'vacataire', label: t('professeur.vacataire') },
              ]}
              placeholder="Choisir..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.annuler')}</Button>
              <Button onClick={handleSubmit} loading={submitting}>
                {editTarget ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Désactiver le professeur "${confirmDelete?.nom_fr ?? ''}" ?`}
      />

      {qrTarget && (
        <QRCodeModal
          professeurId={qrTarget.id}
          nom={`${qrTarget.prenom_fr ?? ''} ${qrTarget.nom_fr}`.trim()}
          onClose={() => setQrTarget(null)}
          api={api}
        />
      )}

      {/* ── Modal cartes professeurs en lot ──────────────────────────────────── */}
      <Modal isOpen={carteLotModal} onClose={() => setCarteLotModal(false)} title="Générer toutes les cartes professeurs (CR80)" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
            🪪 Génère un PDF recto-verso au format <strong>Evolis Primacy CR80</strong> pour tous les professeurs. La photo est obligatoire — les profs sans photo sont ignorés et listés.
          </div>
          {carteLotErreurs.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              <strong style={{ color: '#92400e' }}>⚠ {carteLotErreurs.length} professeur(s) ignoré(s) :</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: '#78350f' }}>
                {carteLotErreurs.map(e => <li key={e.id}>{e.message}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setCarteLotModal(false)}>Annuler</Button>
            <Button onClick={handleCarteLot} loading={carteLotGenerating}>
              Générer PDF
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
