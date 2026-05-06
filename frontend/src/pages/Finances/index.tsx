import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

interface Stats { total_encaisse_eleves: number; nb_paiements_eleves: number; total_paye_professeurs: number; }
interface PaiementEleve {
  id: string; type: string; montant: number; mois?: number; annee?: number;
  recu_numero?: string; created_at: string; statut: string;
  eleve: { nom_fr: string; prenom_fr: string; matricule: string; };
}
interface Eleve { id: string; nom_fr: string; prenom_fr: string; matricule: string; }

const TYPES = ['mensualite', 'inscription', 'blouse', 'autre'];
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];


interface ProfesseurSimple { id: string; utilisateur: { nom_fr: string; prenom_fr: string; }; }
interface PaiementProf {
  id: string; mois: number; annee: number; montant_brut: number;
  net_a_payer: number; statut: string; created_at: string;
  professeur: { utilisateur: { nom_fr: string; prenom_fr: string; }; };
}
interface ProfTabProps { api: ReturnType<typeof useApi>; formatMontant: (v: number) => string; }

function ProfsTab({ api, formatMontant }: ProfTabProps) {
  const now = new Date();
  const [paiements, setPaiements] = useState<PaiementProf[]>([]);
  const [profs, setProfs] = useState<ProfesseurSimple[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moisF, setMoisF] = useState(String(now.getMonth() + 1));
  const [anneeF, setAnneeF] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    professeur_id: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()),
    montant_brut: '', retenues: '0', net_a_payer: '',
  });

  useEffect(() => {
    api.get<{ data: ProfesseurSimple[] }>('/api/v1/professeurs?limit=200')
      .then((r) => setProfs(r.data ?? [])).catch(() => {});
  }, []);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), mois: moisF, annee: anneeF });
      const res = await api.get<{ data: PaiementProf[]; total: number }>(
        `/api/v1/finances/paiements-professeurs?${params}`
      );
      setPaiements(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { /**/ } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [page, moisF, anneeF]);

  const handleSave = async () => {
    if (!form.professeur_id || !form.montant_brut) { toast.error('Professeur et montant requis'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/finances/paiements-professeurs', {
        professeur_id: form.professeur_id,
        mois: parseInt(form.mois), annee: parseInt(form.annee),
        montant_brut: parseFloat(form.montant_brut),
        retenues: parseFloat(form.retenues) || 0,
        net_a_payer: parseFloat(form.net_a_payer) || parseFloat(form.montant_brut),
      });
      toast.success('Paiement enregistré');
      setModal(false);
      charger();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setSaving(false); }
  };

  const MOIS2 = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={moisF} onChange={(e) => setMoisF(e.target.value)}
          options={MOIS2.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Input type="number" value={anneeF} onChange={(e) => setAnneeF(e.target.value)} label="" style={{ width: 100 }} />
        <Button onClick={() => setModal(true)}>+ Ajouter paiement</Button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : paiements.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucun paiement pour cette période</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Professeur', 'Mois', 'Brut', 'Net à payer', 'Statut'].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paiements.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-sm text-slate-900 dark:text-white">
                    {p.professeur.utilisateur.prenom_fr} {p.professeur.utilisateur.nom_fr}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{MOIS2[p.mois - 1]} {p.annee}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatMontant(Number(p.montant_brut))}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{formatMontant(Number(p.net_a_payer))}</td>
                  <td className="px-4 py-3"><Badge label={p.statut} variant={p.statut === 'paye' ? 'success' : 'warning'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Nouveau paiement professeur" size="md">
        <div className="space-y-4">
          <Select label="Professeur" value={form.professeur_id}
            onChange={(e) => setForm(f => ({ ...f, professeur_id: e.target.value }))}
            options={[{ value: '', label: 'Sélectionner...' }, ...profs.map(p => ({ value: p.id, label: `${p.utilisateur.prenom_fr} ${p.utilisateur.nom_fr}` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Mois" value={form.mois} onChange={(e) => setForm(f => ({ ...f, mois: e.target.value }))}
              options={MOIS2.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <Input label="Année" type="number" value={form.annee} onChange={(e) => setForm(f => ({ ...f, annee: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Montant brut (FCFA)" type="number" value={form.montant_brut}
              onChange={(e) => { const v = e.target.value; setForm(f => ({ ...f, montant_brut: v, net_a_payer: v })); }} />
            <Input label="Retenues" type="number" value={form.retenues}
              onChange={(e) => setForm(f => ({ ...f, retenues: e.target.value }))} />
            <Input label="Net à payer" type="number" value={form.net_a_payer}
              onChange={(e) => setForm(f => ({ ...f, net_a_payer: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function FinancesPage() {
  const { t } = useTranslation();
  const api = useApi();
  const now = new Date();

  const [tab, setTab] = useState<'eleves' | 'profs'>('eleves');
  const [stats, setStats] = useState<Stats | null>(null);
  const [paiements, setPaiements] = useState<PaiementEleve[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    eleve_id: '', type: 'mensualite', montant: '',
    mois: String(now.getMonth() + 1), annee: String(now.getFullYear()), recu_numero: '',
  });

  useEffect(() => {
    api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => null);
    api.get<{ data: Eleve[] }>('/api/v1/eleves?limit=200').then((r) => setEleves(r.data ?? [])).catch(() => null);
  }, []);

  useEffect(() => {
    charger();
  }, [page, search]);

  const charger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get<{ data: PaiementEleve[]; total: number }>(
        `/api/v1/finances/paiements-eleves?${params}`
      );
      setPaiements(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.eleve_id || !form.montant) return;
    setSaving(true);
    try {
      await api.post('/api/v1/finances/paiements-eleves', {
        eleve_id: form.eleve_id,
        type: form.type,
        montant: parseFloat(form.montant),
        mois: parseInt(form.mois),
        annee: parseInt(form.annee),
        recu_numero: form.recu_numero || undefined,
      });
      setModal(false);
      setForm({ eleve_id: '', type: 'mensualite', montant: '', mois: String(now.getMonth() + 1), annee: String(now.getFullYear()), recu_numero: '' });
      await charger();
      api.get<Stats>('/api/v1/finances/stats').then(setStats).catch(() => null);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const formatMontant = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.titre')}
        action={<Button onClick={() => setModal(true)}>Ajouter un paiement</Button>}
      />

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-xl">💰</div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{formatMontant(Number(stats.total_encaisse_eleves))}</p>
              <p className="text-sm text-slate-500">{t('finance.total_mois')}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-xl">📄</div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.nb_paiements_eleves}</p>
              <p className="text-sm text-slate-500">Paiements ce mois</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['eleves', 'profs'] as const).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t2
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            {t2 === 'eleves' ? t('finance.paiements_eleves') : t('finance.paiements_profs')}
          </button>
        ))}
      </div>

      {tab === 'eleves' && (
        <div className="space-y-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par élève..." />
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Chargement...</div>
            ) : paiements.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Aucun paiement trouvé</div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    {['Élève', 'Type', 'Montant', 'Mois', 'N° Reçu', 'Date'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paiements.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{p.eleve.prenom_fr} {p.eleve.nom_fr}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.eleve.matricule}</div>
                      </td>
                      <td className="px-4 py-3"><Badge label={p.type} variant="info" /></td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{formatMontant(p.montant)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {p.mois ? `${MOIS[p.mois - 1]} ${p.annee}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500">{p.recu_numero ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      )}

      {tab === 'profs' && (
        <ProfsTab api={api} formatMontant={formatMontant} />
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Nouveau paiement" size="md">
        <div className="space-y-4">
          <Select
            label="Élève"
            value={form.eleve_id}
            onChange={(e) => setForm((f) => ({ ...f, eleve_id: e.target.value }))}
            options={[{ value: '', label: 'Sélectionner un élève...' }, ...eleves.map((e) => ({ value: e.id, label: `${e.prenom_fr} ${e.nom_fr} (${e.matricule})` }))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('finance.type')}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              options={TYPES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
            />
            <Input
              label={`${t('finance.montant')} (FCFA)`}
              type="number"
              value={form.montant}
              onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Mois"
              value={form.mois}
              onChange={(e) => setForm((f) => ({ ...f, mois: e.target.value }))}
              options={MOIS.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
            <Input
              label="Année"
              type="number"
              value={form.annee}
              onChange={(e) => setForm((f) => ({ ...f, annee: e.target.value }))}
            />
          </div>
          <Input
            label={t('finance.recu')}
            value={form.recu_numero}
            onChange={(e) => setForm((f) => ({ ...f, recu_numero: e.target.value }))}
            placeholder="REÇ-001"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={handleSave} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
