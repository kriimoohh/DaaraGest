import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/ui/SearchInput';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

interface Livre {
  id: string; titre: string; auteur?: string; isbn?: string;
  editeur?: string; categorie?: string; annee_edition?: number;
  quantite_totale: number; quantite_dispo: number; actif: boolean;
}

interface Emprunt {
  id: string; statut: string;
  date_emprunt: string; date_retour_prevue: string; date_retour_effective?: string;
  livre: { id: string; titre: string; auteur?: string };
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string };
}

interface Eleve { id: string; matricule: string; nom_fr: string; prenom_fr: string; }

type Tab = 'livres' | 'emprunts' | 'retards';

export function BibliothequeePage() {
  const api  = useApi();
  const role = useAuthStore(s => s.user?.role ?? '');
  const canEdit   = ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'].includes(role);
  const canDelete = ['admin', 'directeur'].includes(role);

  const [tab, setTab]             = useState<Tab>('livres');
  const [livres, setLivres]       = useState<Livre[]>([]);
  const [emprunts, setEmprunts]   = useState<Emprunt[]>([]);
  const [retards, setRetards]     = useState<Emprunt[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [_total, setTotal]        = useState(0);
  const [page, setPage]           = useState(1);

  // Filtres emprunts
  const [statutFilter, setStatutFilter] = useState('en_cours');

  // Modal livre
  const [livreModal, setLivreModal] = useState(false);
  const [editLivre, setEditLivre]   = useState<Livre | null>(null);
  const [livreForm, setLivreForm]   = useState({ titre: '', auteur: '', isbn: '', editeur: '', categorie: '', annee_edition: '', quantite_totale: '1' });
  const [saving, setSaving]         = useState(false);

  // Modal emprunt
  const [empruntModal, setEmpruntModal]   = useState(false);
  const [livreSelId, setLivreSelId]       = useState('');
  const [eleveSearch, setEleveSearch]     = useState('');
  const [elevesFound, setElevesFound]     = useState<Eleve[]>([]);
  const [eleveSelId, setEleveSelId]       = useState('');
  const [eleveSelNom, setEleveSelNom]     = useState('');
  const [dateRetour, setDateRetour]       = useState('');
  const [savingEmp, setSavingEmp]         = useState(false);

  const chargerLivres = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (search) q.set('search', search);
      const res = await api.get<{ total: number; data: Livre[] }>(`/api/v1/bibliotheque/livres?${q}`);
      setLivres(res.data);
      setTotal(res.total);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const chargerEmprunts = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ statut: statutFilter, page: String(page) });
      const res = await api.get<{ total: number; data: Emprunt[] }>(`/api/v1/bibliotheque/emprunts?${q}`);
      setEmprunts(res.data);
      setTotal(res.total);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statutFilter]);

  const chargerRetards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Emprunt[]>('/api/v1/bibliotheque/emprunts/en-retard');
      setRetards(res);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'livres')    chargerLivres();
    if (tab === 'emprunts')  chargerEmprunts();
    if (tab === 'retards')   chargerRetards();
  }, [tab, chargerLivres, chargerEmprunts, chargerRetards]);

  // Recherche élèves (debounce)
  useEffect(() => {
    if (eleveSearch.length < 2) { setElevesFound([]); return; }
    const t = setTimeout(async () => {
      const res = await api.get<{ data: Eleve[] }>(`/api/v1/eleves?search=${encodeURIComponent(eleveSearch)}&limit=8`).catch(() => null);
      if (res) setElevesFound(res.data);
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveSearch]);

  function openNewLivre() {
    setEditLivre(null);
    setLivreForm({ titre: '', auteur: '', isbn: '', editeur: '', categorie: '', annee_edition: '', quantite_totale: '1' });
    setLivreModal(true);
  }

  function openEditLivre(l: Livre) {
    setEditLivre(l);
    setLivreForm({ titre: l.titre, auteur: l.auteur ?? '', isbn: l.isbn ?? '', editeur: l.editeur ?? '', categorie: l.categorie ?? '', annee_edition: String(l.annee_edition ?? ''), quantite_totale: String(l.quantite_totale) });
    setLivreModal(true);
  }

  async function saveLivre() {
    if (!livreForm.titre.trim()) { toast.error('Le titre est requis'); return; }
    setSaving(true);
    try {
      const body = {
        titre:           livreForm.titre.trim(),
        auteur:          livreForm.auteur   || undefined,
        isbn:            livreForm.isbn     || undefined,
        editeur:         livreForm.editeur  || undefined,
        categorie:       livreForm.categorie || undefined,
        annee_edition:   livreForm.annee_edition ? Number(livreForm.annee_edition) : undefined,
        quantite_totale: Number(livreForm.quantite_totale) || 1,
      };
      if (editLivre) {
        await api.put(`/api/v1/bibliotheque/livres/${editLivre.id}`, body);
        toast.success('Livre modifié');
      } else {
        await api.post('/api/v1/bibliotheque/livres', body);
        toast.success('Livre ajouté');
      }
      setLivreModal(false);
      chargerLivres();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  }

  async function supprimerLivre(id: string) {
    if (!confirm('Supprimer ce livre ?')) return;
    try {
      await api.delete(`/api/v1/bibliotheque/livres/${id}`);
      toast.success('Livre supprimé');
      chargerLivres();
    } catch (err) { toast.error((err as Error).message); }
  }

  function openEmprunt(livreId = '') {
    setLivreSelId(livreId);
    setEleveSearch(''); setElevesFound([]); setEleveSelId(''); setEleveSelNom('');
    const j = new Date(); j.setDate(j.getDate() + 14);
    setDateRetour(j.toISOString().substring(0, 10));
    setEmpruntModal(true);
  }

  async function creerEmprunt() {
    if (!livreSelId) { toast.error('Sélectionnez un livre'); return; }
    if (!eleveSelId) { toast.error('Sélectionnez un élève'); return; }
    if (!dateRetour) { toast.error('Date de retour requise'); return; }
    setSavingEmp(true);
    try {
      await api.post('/api/v1/bibliotheque/emprunts', { livre_id: livreSelId, eleve_id: eleveSelId, date_retour_prevue: dateRetour });
      toast.success('Emprunt enregistré');
      setEmpruntModal(false);
      chargerLivres();
      if (tab === 'emprunts') chargerEmprunts();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingEmp(false); }
  }

  async function enregistrerRetour(id: string) {
    if (!confirm('Enregistrer le retour de ce livre ?')) return;
    try {
      await api.put(`/api/v1/bibliotheque/emprunts/${id}/retour`, { statut: 'rendu' });
      toast.success('Retour enregistré');
      chargerEmprunts();
      chargerRetards();
      chargerLivres();
    } catch (err) { toast.error((err as Error).message); }
  }

  function isEnRetard(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Administration</div>
          <h1 className="page-title">Bibliothèque</h1>
          <p className="page-sub">Gestion des livres, emprunts et retours</p>
        </div>
        {canEdit && tab === 'livres' && (
          <Button onClick={openNewLivre}>+ Ajouter un livre</Button>
        )}
        {canEdit && tab === 'emprunts' && (
          <Button onClick={() => openEmprunt()}>+ Nouvel emprunt</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs mb-4" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'livres', label: 'Livres' },
          { key: 'emprunts', label: 'Emprunts' },
          { key: 'retards', label: `Retards${retards.length > 0 ? ` (${retards.length})` : ''}` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as Tab); setPage(1); }}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--terra)' : '2px solid transparent',
              color: tab === t.key ? 'var(--terra)' : 'var(--ink-3)',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all .15s',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Livres ──────────────────────────────────────────────────────────── */}
      {tab === 'livres' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Rechercher titre, auteur, ISBN..." />
          </div>
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Titre</th><th>Auteur</th><th>ISBN</th><th>Catégorie</th>
                    <th style={{ textAlign: 'center' }}>Stock</th>
                    <th style={{ textAlign: 'center' }}>Dispo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} className="empty">Chargement…</td></tr>}
                  {!loading && livres.length === 0 && <tr><td colSpan={7} className="empty">Aucun livre</td></tr>}
                  {livres.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 500 }}>{l.titre}</td>
                      <td className="muted">{l.auteur ?? '—'}</td>
                      <td className="mono">{l.isbn ?? '—'}</td>
                      <td>{l.categorie ? <Badge label={l.categorie} variant="outline" /> : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{l.quantite_totale}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge label={String(l.quantite_dispo)} variant={l.quantite_dispo > 0 ? 'success' : 'danger'} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {canEdit && l.quantite_dispo > 0 && (
                            <Button size="sm" variant="secondary" onClick={() => openEmprunt(l.id)}>Emprunter</Button>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => openEditLivre(l)}>Modifier</Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" onClick={() => supprimerLivre(l.id)}>Suppr.</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Emprunts ─────────────────────────────────────────────────────────── */}
      {tab === 'emprunts' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Select
              value={statutFilter}
              onChange={e => { setStatutFilter(e.target.value); setPage(1); }}
              options={[
                { value: 'en_cours', label: 'En cours' },
                { value: 'rendu',    label: 'Rendus' },
                { value: 'perdu',    label: 'Perdus' },
              ]}
            />
          </div>
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Livre</th><th>Élève</th><th>Matricule</th>
                    <th>Emprunté le</th><th>Retour prévu</th><th>Statut</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} className="empty">Chargement…</td></tr>}
                  {!loading && emprunts.length === 0 && <tr><td colSpan={7} className="empty">Aucun emprunt</td></tr>}
                  {emprunts.map(e => {
                    const enRetard = e.statut === 'en_cours' && isEnRetard(e.date_retour_prevue);
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.livre.titre}</td>
                        <td>{e.eleve.nom_fr} {e.eleve.prenom_fr}</td>
                        <td className="mono">{e.eleve.matricule}</td>
                        <td>{fmtDate(e.date_emprunt)}</td>
                        <td style={{ color: enRetard ? 'var(--danger)' : undefined, fontWeight: enRetard ? 600 : 400 }}>
                          {fmtDate(e.date_retour_prevue)}
                          {enRetard && <span style={{ marginInlineStart: 6, fontSize: 10, background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 4, padding: '1px 5px' }}>Retard</span>}
                        </td>
                        <td>
                          <Badge
                            label={e.statut === 'en_cours' ? 'En cours' : e.statut === 'rendu' ? 'Rendu' : 'Perdu'}
                            variant={e.statut === 'rendu' ? 'success' : e.statut === 'perdu' ? 'danger' : 'neutral'}
                          />
                        </td>
                        <td>
                          {canEdit && e.statut === 'en_cours' && (
                            <Button size="sm" variant="secondary" onClick={() => enregistrerRetour(e.id)}>Retour</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Retards ──────────────────────────────────────────────────────────── */}
      {tab === 'retards' && (
        <div className="card">
          {retards.length === 0 ? (
            <div className="empty" style={{ padding: 32 }}>
              <svg width={32} height={32} viewBox="0 0 24 24" fill="var(--ink-4)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>Aucun emprunt en retard</div>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Livre</th><th>Élève</th><th>Matricule</th><th>Retour prévu</th><th>Jours de retard</th><th></th></tr>
                </thead>
                <tbody>
                  {retards.map(e => {
                    const joursRetard = Math.floor((Date.now() - new Date(e.date_retour_prevue).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.livre.titre}</td>
                        <td>{e.eleve.nom_fr} {e.eleve.prenom_fr}</td>
                        <td className="mono">{e.eleve.matricule}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmtDate(e.date_retour_prevue)}</td>
                        <td><Badge label={`+${joursRetard} j`} variant="danger" /></td>
                        <td>
                          {canEdit && (
                            <Button size="sm" variant="secondary" onClick={() => enregistrerRetour(e.id)}>Retour</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal livre */}
      {livreModal && (
        <Modal
          isOpen={livreModal}
          title={editLivre ? 'Modifier le livre' : 'Ajouter un livre'}
          onClose={() => setLivreModal(false)}
          footer={<><Button variant="ghost" onClick={() => setLivreModal(false)}>Annuler</Button><Button onClick={saveLivre} loading={saving}>Enregistrer</Button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Titre *" value={livreForm.titre} onChange={e => setLivreForm(f => ({ ...f, titre: e.target.value }))} />
            <Input label="Auteur" value={livreForm.auteur} onChange={e => setLivreForm(f => ({ ...f, auteur: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="ISBN" value={livreForm.isbn} onChange={e => setLivreForm(f => ({ ...f, isbn: e.target.value }))} />
              <Input label="Catégorie" value={livreForm.categorie} onChange={e => setLivreForm(f => ({ ...f, categorie: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Éditeur" value={livreForm.editeur} onChange={e => setLivreForm(f => ({ ...f, editeur: e.target.value }))} />
              <Input label="Année d'édition" type="number" value={livreForm.annee_edition} onChange={e => setLivreForm(f => ({ ...f, annee_edition: e.target.value }))} />
            </div>
            <Input label="Nombre d'exemplaires" type="number" min={1} value={livreForm.quantite_totale} onChange={e => setLivreForm(f => ({ ...f, quantite_totale: e.target.value }))} />
          </div>
        </Modal>
      )}

      {/* Modal emprunt */}
      {empruntModal && (
        <Modal
          isOpen={empruntModal}
          title="Nouvel emprunt"
          onClose={() => setEmpruntModal(false)}
          footer={<><Button variant="ghost" onClick={() => setEmpruntModal(false)}>Annuler</Button><Button onClick={creerEmprunt} loading={savingEmp}>Enregistrer</Button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!livreSelId && (
              <Select
                label="Livre *"
                value={livreSelId}
                onChange={e => setLivreSelId(e.target.value)}
                options={[
                  { value: '', label: '— Choisir un livre —' },
                  ...livres.filter(l => l.quantite_dispo > 0).map(l => ({ value: l.id, label: `${l.titre}${l.auteur ? ` (${l.auteur})` : ''} — ${l.quantite_dispo} dispo` })),
                ]}
              />
            )}
            {livreSelId && (
              <div style={{ padding: '8px 12px', background: 'var(--terra-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--terra-ink)' }}>
                {livres.find(l => l.id === livreSelId)?.titre ?? livreSelId}
                <button onClick={() => setLivreSelId('')} style={{ marginInlineStart: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--terra)' }}>✕</button>
              </div>
            )}
            <div>
              <Input
                label="Rechercher un élève"
                value={eleveSearch}
                onChange={e => setEleveSearch(e.target.value)}
                placeholder="Nom ou matricule..."
              />
              {elevesFound.length > 0 && !eleveSelId && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginTop: 4, overflow: 'hidden' }}>
                  {elevesFound.map(e => (
                    <button
                      key={e.id}
                      onClick={() => { setEleveSelId(e.id); setEleveSelNom(`${e.nom_fr} ${e.prenom_fr} (${e.matricule})`); setElevesFound([]); setEleveSearch(''); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'start', cursor: 'pointer', fontSize: 13 }}
                    >
                      {e.nom_fr} {e.prenom_fr} — <span className="mono">{e.matricule}</span>
                    </button>
                  ))}
                </div>
              )}
              {eleveSelId && (
                <div style={{ padding: '8px 12px', background: 'var(--success-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--success-text)', marginTop: 4 }}>
                  {eleveSelNom}
                  <button onClick={() => { setEleveSelId(''); setEleveSelNom(''); }} style={{ marginInlineStart: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              )}
            </div>
            <Input label="Date de retour prévue *" type="date" value={dateRetour} onChange={e => setDateRetour(e.target.value)} />
          </div>
        </Modal>
      )}
    </>
  );
}
