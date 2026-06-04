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
}

interface Matiere {
  id: string;
  nom_fr: string;
  nom_ar: string | null;
  filiere: 'FR' | 'AR';
  coeff_defaut: number;
  note_max: number;
  note_min: number;
  ordre_bulletin: number;
  active: boolean;
  domaine_id: string | null;
  domaine: Domaine | null;
  type_note: 'SIMPLE' | 'RESSOURCE' | 'COMPETENCE';
  code_court: string | null;
}

const TYPE_NOTES = ['SIMPLE', 'RESSOURCE', 'COMPETENCE'] as const;

const EMPTY = {
  nom_fr: '',
  nom_ar: '',
  filiere: 'FR',
  coeff_defaut: '1',
  note_max: '20',
  note_min: '0',
  ordre_bulletin: '0',
  domaine_id: '',
  type_note: 'SIMPLE',
  code_court: '',
};

export function MatieresPage() {
  const { t } = useTranslation();
  const api = useApi();
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [filiere, setFiliere] = useState('');
  const [filtreDomaine, setFiltreDomaine] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Matiere | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Matiere | null>(null);
  const [deleting, setDeleting] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const url = filiere ? `/api/v1/matieres?filiere=${filiere}` : '/api/v1/matieres';
      const data = await api.get<Matiere[]>(url);
      setMatieres(data);
    } catch {
      toast.error(t('matiere.err_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const chargerDomaines = async () => {
    try {
      const data = await api.get<Domaine[]>('/api/v1/domaines');
      setDomaines(data);
    } catch {
      // Pas bloquant : on continue sans liste de domaines.
    }
  };

  useEffect(() => { charger(); }, [filiere]);
  useEffect(() => { chargerDomaines(); }, []);

  const openAdd = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (m: Matiere) => {
    setEdit(m);
    setForm({
      nom_fr: m.nom_fr,
      nom_ar: m.nom_ar ?? '',
      filiere: m.filiere,
      coeff_defaut: String(m.coeff_defaut),
      note_max: String(m.note_max),
      note_min: String(m.note_min),
      ordre_bulletin: String(m.ordre_bulletin),
      domaine_id: m.domaine_id ?? '',
      type_note: m.type_note ?? 'SIMPLE',
      code_court: m.code_court ?? '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.nom_fr || !form.filiere) {
      toast.error(t('matiere.err_nom_filiere'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom_fr: form.nom_fr,
        nom_ar: form.nom_ar,
        filiere: form.filiere,
        coeff_defaut: parseFloat(form.coeff_defaut) || 1,
        note_max: parseFloat(form.note_max) || 20,
        note_min: parseFloat(form.note_min) || 0,
        ordre_bulletin: parseInt(form.ordre_bulletin) || 0,
        domaine_id: form.domaine_id || null,
        type_note: form.type_note,
        code_court: form.code_court || null,
      };
      if (edit) {
        await api.put(`/api/v1/matieres/${edit.id}`, payload);
        toast.success(t('matiere.ok_modifiee'));
      } else {
        await api.post('/api/v1/matieres', payload);
        toast.success(t('matiere.ok_creee'));
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
      await api.delete(`/api/v1/matieres/${confirm.id}`);
      toast.success(t('matiere.ok_desactivee'));
      setConfirm(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  // Filtre client : le backend ne filtre que sur la filière, le domaine est appliqué ici.
  const matieresAffichees = filtreDomaine
    ? matieres.filter(m => (filtreDomaine === '__none__' ? !m.domaine_id : m.domaine_id === filtreDomaine))
    : matieres;

  const domaineOptions = [
    { value: '', label: t('matiere.domaine_aucun') },
    ...domaines.map(d => ({ value: d.id, label: d.nom_fr })),
  ];

  const filtreDomaineOptions = [
    { value: '', label: t('matiere.filtre_domaine_tous') },
    { value: '__none__', label: t('matiere.filtre_domaine_sans') },
    ...domaines.map(d => ({ value: d.id, label: d.nom_fr })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={t('matiere.pedagogie')}
        title={t('matiere.titre')}
        subtitle={t('matiere.subtitle')}
        action={<Button onClick={openAdd}>{t('matiere.ajouter_btn')}</Button>}
      />

      {/* Bandeau guide filière — couleurs lisibles dark mode */}
      <div style={{ padding: 16, background: 'var(--info-soft)', border: '1px solid var(--info-border)', borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--info-text)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 16, flexShrink: 0, color: 'var(--info-text)' }}>ℹ️</span>
        <div>
          <strong style={{ color: 'var(--info-text)' }}>{t('matiere.banner_titre')}</strong>{' '}
          <span dangerouslySetInnerHTML={{ __html: t('matiere.banner_desc') }} />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filiere === '' ? ' active' : ''}`} onClick={() => setFiliere('')}>
          {t('matiere.tab_toutes')} <span className="count">{matieres.length}</span>
        </button>
        <button className={`tab${filiere === 'FR' ? ' active' : ''}`} onClick={() => setFiliere('FR')}>
          {t('matiere.tab_francaise')} <span className="count">{matieres.filter(m => m.filiere === 'FR').length}</span>
        </button>
        <button className={`tab${filiere === 'AR' ? ' active' : ''}`} onClick={() => setFiliere('AR')}>
          {t('matiere.tab_arabe')} <span className="count">{matieres.filter(m => m.filiere === 'AR').length}</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, maxWidth: 320 }}>
        <Select
          label={t('matiere.filtre_domaine')}
          value={filtreDomaine}
          onChange={(e) => setFiltreDomaine(e.target.value)}
          options={filtreDomaineOptions}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">{t('common.chargement')}</div>
        ) : matieresAffichees.length === 0 ? (
          <div className="empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 36 }}>📚</span>
            <p>{t('matiere.aucune_trouvee')}</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('matiere.nom_fr')}</th>
                  <th>{t('matiere.nom_ar')}</th>
                  <th>{t('matiere.col_filiere')}</th>
                  <th>{t('matiere.col_domaine')}</th>
                  <th>{t('note.coefficient')}</th>
                  <th>{t('parametre.note_max')}</th>
                  <th>{t('parametre.note_min')}</th>
                  <th>{t('matiere.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {matieresAffichees.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nom_fr}</td>
                    <td dir="rtl">{m.nom_ar}</td>
                    <td>
                      <Badge label={m.filiere} variant={m.filiere === 'FR' ? 'info' : 'warning'} />
                    </td>
                    <td>
                      {m.domaine ? (
                        <Badge label={m.domaine.nom_fr} variant="neutral" />
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>{m.coeff_defaut}</td>
                    <td>{m.note_max}</td>
                    <td>{m.note_min}</td>
                    <td>
                      <div className="row">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>{t('actions.modifier')}</Button>
                        {isAdmin && <Button size="sm" variant="danger" onClick={() => setConfirm(m)}>{t('actions.supprimer')}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? t('matiere.modifier_titre') : t('matiere.nouvelle_titre')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <Input
              label={t('common.nom_fr')}
              value={form.nom_fr}
              onChange={(e) => setForm((f) => ({ ...f, nom_fr: e.target.value }))}
              placeholder={t('matiere.placeholder_fr')}
            />
            <Input
              label={t('common.nom_ar')}
              value={form.nom_ar}
              onChange={(e) => setForm((f) => ({ ...f, nom_ar: e.target.value }))}
              placeholder={t('matiere.placeholder_ar')}
              dir="rtl"
            />
          </div>
          <div className="grid-2">
            <Select
              label={t('matiere.col_domaine')}
              value={form.domaine_id}
              onChange={(e) => setForm((f) => ({ ...f, domaine_id: e.target.value }))}
              options={domaineOptions}
            />
            <Select
              label={t('matiere.type_note')}
              value={form.type_note}
              onChange={(e) => setForm((f) => ({ ...f, type_note: e.target.value }))}
              options={TYPE_NOTES.map(tn => ({ value: tn, label: t(`matiere.type_note_${tn}`) }))}
            />
          </div>
          <div className="grid-4">
            <Select
              label={t('classe.filiere')}
              value={form.filiere}
              onChange={(e) => setForm((f) => ({ ...f, filiere: e.target.value }))}
              options={[{ value: 'FR', label: t('classe.filiere_fr') }, { value: 'AR', label: t('classe.filiere_ar') }]}
            />
            <Input
              label={t('note.coefficient')}
              type="number"
              step="0.25"
              min="0.25"
              value={form.coeff_defaut}
              onChange={(e) => setForm((f) => ({ ...f, coeff_defaut: e.target.value }))}
            />
            <Input
              label={t('parametre.note_max')}
              type="number"
              step="1"
              min="1"
              max="100"
              value={form.note_max}
              onChange={(e) => setForm((f) => ({ ...f, note_max: e.target.value }))}
            />
            <Input
              label={t('parametre.note_min')}
              type="number"
              step="1"
              min="0"
              value={form.note_min}
              onChange={(e) => setForm((f) => ({ ...f, note_min: e.target.value }))}
            />
            <Input
              label={t('matiere.ordre_bulletin')}
              type="number"
              min="0"
              value={form.ordre_bulletin}
              onChange={(e) => setForm((f) => ({ ...f, ordre_bulletin: e.target.value }))}
            />
            <Input
              label={t('matiere.code_court')}
              maxLength={16}
              value={form.code_court}
              onChange={(e) => setForm((f) => ({ ...f, code_court: e.target.value }))}
              placeholder="Lect"
            />
          </div>
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
        message={t('matiere.confirm_desactiver', { nom: confirm?.nom_fr })}
      />
    </>
  );
}
