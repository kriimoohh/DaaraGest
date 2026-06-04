import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface Domaine {
  id: string;
  nom_fr: string;
  code: string;
  ordre: number;
  actif: boolean;
  _count?: { matieres: number };
}

// Doit rester aligné avec DOMAINE_CODES côté backend (domaines.schema.ts).
const DOMAINE_CODES = [
  'LANGUE_COMMUNICATION',
  'MATHEMATIQUES',
  'ESVS',
  'EPSA',
  'RELIGION',
  'EVEIL',
  'AUTRE',
] as const;

const EMPTY = { nom_fr: '', code: 'LANGUE_COMMUNICATION', ordre: '0', actif: true };

export function DomainesPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Domaine | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Domaine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await api.get<Domaine[]>('/api/v1/domaines?inclureInactifs=1');
      setDomaines(data);
    } catch {
      toast.error(t('domaine.err_chargement'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const openAdd = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (d: Domaine) => {
    setEdit(d);
    setForm({ nom_fr: d.nom_fr, code: d.code, ordre: String(d.ordre), actif: d.actif });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.nom_fr.trim() || !form.code) {
      toast.error(t('domaine.err_nom_code'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom_fr: form.nom_fr.trim(),
        code: form.code,
        ordre: parseInt(form.ordre) || 0,
        actif: form.actif,
      };
      if (edit) {
        await api.put(`/api/v1/domaines/${edit.id}`, payload);
        toast.success(t('domaine.ok_modifie'));
      } else {
        await api.post('/api/v1/domaines', payload);
        toast.success(t('domaine.ok_cree'));
      }
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/domaines/${confirm.id}`);
      toast.success(t('domaine.ok_supprime'));
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const codeOptions = DOMAINE_CODES.map(c => ({ value: c, label: t(`domaine.code_${c}`) }));

  return (
    <>
      <PageHeader
        eyebrow={t('matiere.pedagogie')}
        title={t('domaine.titre')}
        subtitle={t('domaine.subtitle')}
        action={<Button onClick={openAdd}>{t('domaine.ajouter_btn')}</Button>}
      />

      <div style={{ padding: 16, background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--info-text)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 16, flexShrink: 0, color: 'var(--info-text)' }}>ℹ️</span>
        <div>
          <strong style={{ color: 'var(--info-text)' }}>{t('domaine.banner_titre')}</strong>{' '}
          <span>{t('domaine.banner_desc')}</span>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">{t('common.chargement')}</div>
        ) : domaines.length === 0 ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 36 }}>📂</span>
            <p>{t('domaine.aucun_trouve')}</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('domaine.col_ordre')}</th>
                  <th>{t('domaine.col_nom')}</th>
                  <th>{t('domaine.col_code')}</th>
                  <th>{t('domaine.col_nb_matieres')}</th>
                  <th>{t('domaine.col_statut')}</th>
                  <th>{t('matiere.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {domaines.map((d) => (
                  <tr key={d.id} style={d.actif ? undefined : { opacity: 0.55 }}>
                    <td>{d.ordre}</td>
                    <td>{d.nom_fr}</td>
                    <td><code style={{ fontSize: 12 }}>{d.code}</code></td>
                    <td>{d._count?.matieres ?? 0}</td>
                    <td>
                      <Badge
                        label={d.actif ? t('domaine.statut_actif') : t('domaine.statut_inactif')}
                        variant={d.actif ? 'success' : 'neutral'}
                      />
                    </td>
                    <td>
                      <div className="row">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>{t('actions.modifier')}</Button>
                        {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirm(d)}>{t('actions.supprimer')}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? t('domaine.modifier_titre') : t('domaine.nouveau_titre')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('common.nom_fr')}
            value={form.nom_fr}
            onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))}
            placeholder={t('domaine.placeholder_nom')}
          />
          <div className="grid-2">
            <Select
              label={t('domaine.col_code')}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              options={codeOptions}
            />
            <Input
              label={t('domaine.col_ordre')}
              type="number"
              min="0"
              value={form.ordre}
              onChange={(e) => setForm((f) => ({ ...f, ordre: e.target.value }))}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
            />
            {t('domaine.statut_actif')}
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('actions.annuler')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.enregistrer')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={t('domaine.confirm_supprimer', { nom: confirm?.nom_fr })}
      />
    </>
  );
}
