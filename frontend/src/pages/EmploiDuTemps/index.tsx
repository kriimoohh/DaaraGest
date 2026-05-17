import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnneeScolaire { id: string; libelle: string; active: boolean }
interface Classe { id: string; nom_fr: string; filiere: string }
interface Matiere { id: string; nom_fr: string; nom_ar: string; filiere: string }
interface Professeur { id: string; utilisateur: { nom_fr: string; prenom_fr: string } }
interface Creneau {
  id: string;
  jour: string;
  heure_debut: string;
  heure_fin: string;
  salle: string | null;
  classe: { id: string; nom_fr: string; filiere: string };
  matiere: { id: string; nom_fr: string; nom_ar: string };
  professeur: { id: string; utilisateur: { nom_fr: string; prenom_fr: string } };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TOUS_LES_JOURS = [
  { value: 'lundi',    label: 'Lundi' },
  { value: 'mardi',    label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi',    label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi',   label: 'Samedi' },
];

const ROLES_EDIT = ['admin', 'directeur', 'gestionnaire'];

function getCreneauColor(filiere: string) {
  if (filiere === 'FR') return { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
  if (filiere === 'AR') return { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' };
  return { bg: 'var(--paper-2)', border: 'var(--rule)', text: 'var(--ink)' };
}

// ── Composant créneau card ─────────────────────────────────────────────────────

function CreneauCard({
  creneau,
  canEdit,
  onDelete,
}: {
  creneau: Creneau;
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = getCreneauColor(creneau.classe.filiere);
  const profName = `${creneau.professeur.utilisateur.prenom_fr} ${creneau.professeur.utilisateur.nom_fr}`;

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: '8px 10px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        position: 'relative',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 2 }}>
        {creneau.matiere.nom_fr}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        {creneau.heure_debut.slice(0, 5)} – {creneau.heure_fin.slice(0, 5)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{profName}</div>
      {creneau.salle && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Salle : {creneau.salle}</div>
      )}
      {expanded && canEdit && (
        <div
          onClick={e => { e.stopPropagation(); onDelete(creneau.id); }}
          style={{ marginTop: 8 }}
        >
          <button
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--danger)',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function EmploiDuTempsPage() {
  const api = useApi();
  const { user } = useAuthStore();
  const canEdit = ROLES_EDIT.includes(user?.role ?? '');

  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [joursActifs, setJoursActifs] = useState<string[]>(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);
  const [anneeId, setAnneeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jour: '',
    heure_debut: '',
    heure_fin: '',
    classe_id: '',
    matiere_id: '',
    professeur_id: '',
    salle: '',
  });

  // Load années scolaires + jours actifs depuis les paramètres
  useEffect(() => {
    api.get<AnneeScolaire[]>('/api/v1/annees-scolaires').then(r => {
      const list = r ?? [];
      setAnnees(list);
      const active = list.find(a => a.active);
      if (active) setAnneeId(active.id);
    }).catch(() => {});

    api.get<{ config_notes?: { jours_cours?: string[] } }>('/api/v1/parametres').then(r => {
      const jours = r?.config_notes?.jours_cours;
      if (Array.isArray(jours) && jours.length > 0) setJoursActifs(jours);
    }).catch(() => {});
  }, []);

  // Load classes when annee changes
  useEffect(() => {
    if (!anneeId) return;
    setClasseId('');
    api.get<Classe[]>(`/api/v1/classes?annee_scolaire_id=${anneeId}&limit=100`)
      .then(r => setClasses(r ?? []))
      .catch(() => {});
  }, [anneeId]);

  // Load matieres & professeurs for modal
  useEffect(() => {
    if (!canEdit) return;
    api.get<Matiere[]>('/api/v1/matieres?limit=200').then(r => setMatieres(r ?? [])).catch(() => {});
    api.get<Professeur[]>('/api/v1/professeurs?limit=200').then(r => setProfesseurs(r ?? [])).catch(() => {});
  }, [canEdit]);

  // Load emploi du temps
  const chargerEmploi = async () => {
    if (!anneeId || !classeId) return;
    setLoading(true);
    try {
      const data = await api.get<Creneau[]>(`/api/v1/emploi-du-temps?annee_scolaire_id=${anneeId}&classe_id=${classeId}`);
      setCreneaux(data ?? []);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerEmploi();
  }, [anneeId, classeId]);

  // Delete créneau
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce créneau ?')) return;
    try {
      await api.delete(`/api/v1/emploi-du-temps/${id}`);
      toast.success('Créneau supprimé');
      setCreneaux(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    }
  };

  // Add créneau
  const handleAdd = async () => {
    if (!form.jour || !form.heure_debut || !form.heure_fin || !form.classe_id || !form.matiere_id || !form.professeur_id) {
      toast.error('Tous les champs obligatoires doivent être remplis');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        jour: form.jour,
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id,
        professeur_id: form.professeur_id,
        salle: form.salle || undefined,
        annee_scolaire_id: anneeId,
      };
      await api.post('/api/v1/emploi-du-temps', payload);
      toast.success('Créneau ajouté');
      setModalOpen(false);
      setForm({ jour: '', heure_debut: '', heure_fin: '', classe_id: classeId, matiere_id: '', professeur_id: '', salle: '' });
      chargerEmploi();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    setForm({ jour: '', heure_debut: '', heure_fin: '', classe_id: classeId, matiere_id: '', professeur_id: '', salle: '' });
    setModalOpen(true);
  };

  // Filtered matieres by selected classe filiere
  const selectedClasse = classes.find(c => c.id === form.classe_id) ?? classes.find(c => c.id === classeId);
  const filteredMatieres = selectedClasse
    ? matieres.filter(m => m.filiere === selectedClasse.filiere)
    : matieres;

  // Jours visibles (filtrés selon la config établissement)
  const JOURS = TOUS_LES_JOURS.filter(j => joursActifs.includes(j.value));

  // Group creneaux by jour
  const byJour: Record<string, Creneau[]> = {};
  for (const jour of joursActifs) byJour[jour] = [];
  for (const c of creneaux) {
    if (byJour[c.jour]) {
      byJour[c.jour].push(c);
      byJour[c.jour].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    }
  }

  return (
    <>
      <PageHeader
        title="Emploi du temps"
        action={
          canEdit ? (
            <Button onClick={openModal} disabled={!classeId}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Ajouter un créneau
            </Button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="filter-row" style={{ marginBottom: 20 }}>
        <Select
          value={anneeId}
          onChange={e => setAnneeId(e.target.value)}
          options={annees.map(a => ({ value: a.id, label: a.libelle }))}
          placeholder="Année scolaire..."
        />
        <Select
          value={classeId}
          onChange={e => setClasseId(e.target.value)}
          options={classes.map(c => ({ value: c.id, label: c.nom_fr }))}
          placeholder="Classe..."
        />
        {/* Filière legend */}
        <div style={{ display: 'flex', gap: 12, marginInlineStart: 'auto', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#BFDBFE' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Filière FR</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#BBF7D0' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Filière AR</span>
          </div>
        </div>
      </div>

      {/* Grille hebdomadaire */}
      {!classeId ? (
        <div className="card empty" style={{ flexDirection: 'column', gap: 8, padding: 48 }}>
          <svg width={48} height={48} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-4)' }}>
            <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
          </svg>
          <p style={{ color: 'var(--ink-3)' }}>Sélectionnez une classe pour afficher l'emploi du temps</p>
        </div>
      ) : loading ? (
        <div className="card empty">Chargement...</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${JOURS.length}, 1fr)`,
            gap: 12,
          }}
        >
          {JOURS.map(jour => (
            <div key={jour.value}>
              {/* Jour header */}
              <div
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 13,
                  padding: '8px 4px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px 8px 0 0',
                  color: 'var(--ink-2)',
                  marginBottom: 8,
                }}
              >
                {jour.label}
              </div>
              {/* Créneaux */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                {byJour[jour.value].length === 0 ? (
                  <div
                    style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--ink-4)',
                      border: '1px dashed var(--rule)',
                      borderRadius: 8,
                    }}
                  >
                    —
                  </div>
                ) : (
                  byJour[jour.value].map(c => (
                    <CreneauCard
                      key={c.id}
                      creneau={c}
                      canEdit={canEdit}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ajout créneau */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajouter un créneau"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} loading={saving}>Ajouter</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select
            label="Jour"
            value={form.jour}
            onChange={e => setForm(f => ({ ...f, jour: e.target.value }))}
            options={JOURS}
            placeholder="Sélectionner un jour..."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Heure de début"
              type="time"
              value={form.heure_debut}
              onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))}
            />
            <Input
              label="Heure de fin"
              type="time"
              value={form.heure_fin}
              onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))}
            />
          </div>
          <Select
            label="Classe"
            value={form.classe_id}
            onChange={e => setForm(f => ({ ...f, classe_id: e.target.value, matiere_id: '' }))}
            options={classes.map(c => ({ value: c.id, label: c.nom_fr }))}
            placeholder="Sélectionner une classe..."
          />
          <Select
            label="Matière"
            value={form.matiere_id}
            onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))}
            options={filteredMatieres.map(m => ({ value: m.id, label: m.nom_fr }))}
            placeholder="Sélectionner une matière..."
          />
          <Select
            label="Professeur"
            value={form.professeur_id}
            onChange={e => setForm(f => ({ ...f, professeur_id: e.target.value }))}
            options={professeurs.map(p => ({
              value: p.id,
              label: `${p.utilisateur.prenom_fr} ${p.utilisateur.nom_fr}`,
            }))}
            placeholder="Sélectionner un professeur..."
          />
          <Input
            label="Salle (optionnel)"
            value={form.salle}
            onChange={e => setForm(f => ({ ...f, salle: e.target.value }))}
            placeholder="Ex: Salle A1"
          />
        </div>
      </Modal>
    </>
  );
}
