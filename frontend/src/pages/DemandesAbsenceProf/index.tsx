import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type TypeAbsence = 'CONGE_ANNUEL' | 'MALADIE' | 'PERMISSION' | 'AUTRE';
type StatutDemande = 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE';

interface Demande {
  id: string;
  professeur_id: string;
  date_debut: string;
  date_fin: string;
  motif: string;
  type_absence: TypeAbsence;
  statut: StatutDemande;
  commentaire: string | null;
  traite_le: string | null;
  created_at: string;
  professeur: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
  traiteur: { nom_fr: string; prenom_fr: string | null } | null;
}

interface Professeur { id: string; utilisateur: { nom_fr: string; prenom_fr: string | null } }

const TYPE_LABELS: Record<TypeAbsence, string> = {
  CONGE_ANNUEL: 'Congé annuel',
  MALADIE:      'Maladie',
  PERMISSION:   'Permission',
  AUTRE:        'Autre',
};

const STATUT_COLORS: Record<StatutDemande, React.CSSProperties> = {
  EN_ATTENTE: { background: '#fff3cd', color: '#856404' },
  APPROUVE:   { background: '#d1e7dd', color: '#0f5132' },
  REFUSE:     { background: '#f8d7da', color: '#842029' },
};

const STATUT_LABELS: Record<StatutDemande, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVE:   'Approuvé',
  REFUSE:     'Refusé',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DemandesAbsenceProfPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const isDirection = ['admin', 'directeur', 'gestionnaire'].includes(role);

  const api = useApi();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);

  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showTraiterModal, setShowTraiterModal] = useState<{ id: string; action: 'APPROUVE' | 'REFUSE' } | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    professeur_id: '',
    date_debut: '',
    date_fin: '',
    type_absence: 'CONGE_ANNUEL' as TypeAbsence,
    motif: '',
  });

  const refresh = () => {
    setLoading(true);
    api.get<Demande[]>('/api/v1/demandes-absence-prof')
      .then(d => { setDemandes(d); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  // Initial load
  useState(() => {
    refresh();
    api.get<{ data: Professeur[] }>('/api/v1/professeurs?limit=200')
      .then(d => setProfesseurs(d.data ?? []))
      .catch(() => {});
  });

  const filtered = demandes.filter(d => !filtreStatut || d.statut === filtreStatut);

  async function handleSubmit() {
    if (!form.professeur_id || !form.date_debut || !form.date_fin || !form.motif) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/demandes-absence-prof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Erreur');
      toast.success('Demande enregistrée');
      setShowModal(false);
      setForm({ professeur_id: '', date_debut: '', date_fin: '', type_absence: 'CONGE_ANNUEL', motif: '' });
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally { setSaving(false); }
  }

  async function handleTraiter() {
    if (!showTraiterModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/demandes-absence-prof/${showTraiterModal.id}/traiter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statut: showTraiterModal.action, commentaire }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Erreur');
      toast.success(showTraiterModal.action === 'APPROUVE' ? 'Demande approuvée' : 'Demande refusée');
      setShowTraiterModal(null);
      setCommentaire('');
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette demande ?')) return;
    await fetch(`/api/v1/demandes-absence-prof/${id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <PageHeader
        title="Demandes d'absence (Professeurs)"
        subtitle="Gérer les demandes d'absence du personnel enseignant"
        action={
          <Button onClick={() => setShowModal(true)}>+ Nouvelle demande</Button>
        }
      />

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {(['', 'EN_ATTENTE', 'APPROUVE', 'REFUSE'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltreStatut(s)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
              cursor: 'pointer', fontSize: 13, fontWeight: filtreStatut === s ? 600 : 400,
              borderColor: filtreStatut === s ? '#1a5276' : '#ccc',
              background: filtreStatut === s ? '#1a5276' : '#fff',
              color: filtreStatut === s ? '#fff' : '#333',
            }}
          >
            {s === '' ? 'Toutes' : STATUT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? <p>Chargement…</p> : error ? <p style={{ color: 'red' }}>Erreur de chargement</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1a5276', color: '#fff' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Professeur</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Période</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Motif</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Statut</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Traité par</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#777' }}>Aucune demande</td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    {d.professeur.utilisateur.nom_fr} {d.professeur.utilisateur.prenom_fr ?? ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{TYPE_LABELS[d.type_absence]}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {fmtDate(d.date_debut)} → {fmtDate(d.date_fin)}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.motif}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ ...STATUT_COLORS[d.statut], padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                      {STATUT_LABELS[d.statut]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#555' }}>
                    {d.traiteur ? `${d.traiteur.nom_fr} ${d.traiteur.prenom_fr ?? ''}` : '—'}
                    {d.traite_le ? <><br /><span style={{ color: '#aaa' }}>{fmtDate(d.traite_le)}</span></> : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isDirection && d.statut === 'EN_ATTENTE' && (
                        <>
                          <button
                            onClick={() => setShowTraiterModal({ id: d.id, action: 'APPROUVE' })}
                            style={{ padding: '4px 10px', background: '#0f5132', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                          >Approuver</button>
                          <button
                            onClick={() => setShowTraiterModal({ id: d.id, action: 'REFUSE' })}
                            style={{ padding: '4px 10px', background: '#842029', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                          >Refuser</button>
                        </>
                      )}
                      {d.statut === 'EN_ATTENTE' && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          style={{ padding: '4px 10px', background: '#eee', color: '#333', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >Supprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Nouvelle demande */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Nouvelle demande d'absence</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Professeur *</label>
              <select
                value={form.professeur_id}
                onChange={e => setForm(f => ({ ...f, professeur_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}
              >
                <option value="">— Sélectionner —</option>
                {professeurs.map((p: Professeur) => (
                  <option key={p.id} value={p.id}>
                    {p.utilisateur.nom_fr} {p.utilisateur.prenom_fr ?? ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date de début *</label>
                <Input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date de fin *</label>
                <Input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type d'absence *</label>
              <select
                value={form.type_absence}
                onChange={e => setForm(f => ({ ...f, type_absence: e.target.value as TypeAbsence }))}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13 }}
              >
                <option value="CONGE_ANNUEL">Congé annuel</option>
                <option value="MALADIE">Maladie</option>
                <option value="PERMISSION">Permission</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motif *</label>
              <textarea
                value={form.motif}
                onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="Décrivez le motif de l'absence..."
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Traiter */}
      {showTraiterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>
              {showTraiterModal.action === 'APPROUVE' ? 'Approuver la demande' : 'Refuser la demande'}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Commentaire (optionnel)</label>
              <textarea
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setShowTraiterModal(null); setCommentaire(''); }}>Annuler</Button>
              <Button
                onClick={handleTraiter}
                disabled={saving}
                style={{ background: showTraiterModal.action === 'APPROUVE' ? '#0f5132' : '#842029' }}
              >
                {saving ? '…' : showTraiterModal.action === 'APPROUVE' ? "Confirmer l'approbation" : 'Confirmer le refus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
