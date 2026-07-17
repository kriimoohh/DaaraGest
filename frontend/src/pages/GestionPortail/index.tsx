import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface TokenLien {
  id: string;
  token: string;
  actif: boolean;
  expires_at: string | null;
  created_at: string;
  eleve: { id: string; nom_fr: string; prenom_fr: string; matricule: string };
}

type StatutLien = 'actif' | 'revoque' | 'expire';

function statutDe(l: TokenLien): StatutLien {
  if (!l.actif) return 'revoque';
  if (l.expires_at && new Date(l.expires_at) < new Date()) return 'expire';
  return 'actif';
}
const STATUT_VARIANT: Record<StatutLien, 'success' | 'danger' | 'warning'> = {
  actif: 'success', revoque: 'danger', expire: 'warning',
};

export function GestionPortailPage() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const locale = i18n.language === 'ar' ? 'ar-SN' : 'fr-FR';

  const [liens, setLiens] = useState<TokenLien[]>([]);
  const [loading, setLoading] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<TokenLien | null>(null);

  const charger = () => {
    setLoading(true);
    api.get<TokenLien[]>('/api/v1/portail-parent')
      .then(setLiens)
      .catch(() => toast.error(t('common.erreur', 'Erreur de chargement')))
      .finally(() => setLoading(false));
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtres = liens.filter(l => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return `${l.eleve.prenom_fr} ${l.eleve.nom_fr} ${l.eleve.matricule}`.toLowerCase().includes(q);
  });

  const copier = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/portail/${token}`);
    toast.success(t('gestion_portail.lien_copie', 'Lien copié'));
  };

  const regenerer = async (l: TokenLien) => {
    setBusyId(l.id);
    try {
      await api.post('/api/v1/portail-parent/regenerer', { eleve_id: l.eleve.id });
      toast.success(t('gestion_portail.regenere', 'Nouveau lien généré — l’ancien ne fonctionne plus'));
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusyId(null); }
  };

  const revoquer = async (l: TokenLien) => {
    setBusyId(l.id);
    try {
      await api.delete(`/api/v1/portail-parent/${l.token}/revoquer`);
      toast.success(t('gestion_portail.revoque', 'Lien révoqué'));
      setConfirmRevoke(null);
      charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusyId(null); }
  };

  return (
    <>
      <PageHeader
        eyebrow={t('nav.securite', 'Sécurité')}
        title={t('gestion_portail.titre', 'Liens portail parent')}
        subtitle={t('gestion_portail.sous_titre', 'Liens d’accès sans compte aux notes et bulletins. Régénérez un lien qui a fuité (l’ancien cesse aussitôt de fonctionner) ou révoquez-le.')}
      />

      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 360 }}>
        <SearchInput value={recherche} onChange={setRecherche} placeholder={t('gestion_portail.rechercher', 'Rechercher un élève…')} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('gestion_portail.eleve', 'Élève')}</th>
                <th>{t('gestion_portail.statut', 'Statut')}</th>
                <th>{t('gestion_portail.expire_le', 'Expire le')}</th>
                <th>{t('gestion_portail.cree_le', 'Créé le')}</th>
                <th style={{ textAlign: 'end' }}>{t('gestion_portail.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="empty">{t('common.chargement', 'Chargement…')}</td></tr>
              ) : filtres.length === 0 ? (
                <tr><td colSpan={5} className="empty">{t('gestion_portail.aucun', 'Aucun lien portail')}</td></tr>
              ) : filtres.map(l => {
                const statut = statutDe(l);
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.eleve.prenom_fr} {l.eleve.nom_fr}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{l.eleve.matricule}</div>
                    </td>
                    <td><Badge label={t(`gestion_portail.statuts.${statut}`, statut)} variant={STATUT_VARIANT[statut]} /></td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {l.expires_at ? new Date(l.expires_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {new Date(l.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {statut === 'actif' && (
                          <Button variant="ghost" size="sm" onClick={() => copier(l.token)}>{t('gestion_portail.copier', 'Copier')}</Button>
                        )}
                        <Button variant="secondary" size="sm" loading={busyId === l.id} onClick={() => regenerer(l)}>
                          {t('gestion_portail.regenerer', 'Régénérer')}
                        </Button>
                        {statut !== 'revoque' && (
                          <Button variant="danger" size="sm" disabled={busyId === l.id} onClick={() => setConfirmRevoke(l)}>
                            {t('gestion_portail.revoquer', 'Révoquer')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmRevoke}
        onClose={() => setConfirmRevoke(null)}
        onConfirm={() => confirmRevoke && revoquer(confirmRevoke)}
        loading={busyId === confirmRevoke?.id}
        title={t('gestion_portail.revoquer_titre', 'Révoquer le lien')}
        message={confirmRevoke
          ? t('gestion_portail.revoquer_message', {
              defaultValue: 'Le lien de {{nom}} cessera immédiatement de fonctionner. Cette action est irréversible.',
              nom: `${confirmRevoke.eleve.prenom_fr} ${confirmRevoke.eleve.nom_fr}`,
            })
          : ''}
      />
    </>
  );
}
