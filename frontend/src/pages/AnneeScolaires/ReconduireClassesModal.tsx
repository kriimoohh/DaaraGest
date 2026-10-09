import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';

interface AnneeLite { id: string; libelle: string; date_debut: string }
interface Ligne {
  classe_source_id: string; nom_fr: string; filiere: string; niveau: string | null;
  nb_matieres: number; statut: 'a_creer' | 'creee' | 'existe';
}
interface Resultat { apercu: boolean; lignes: Ligne[]; resume: { creees: number; ignorees: number; total: number } }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cible: AnneeLite | null;
  annees: AnneeLite[];
}

// Assistant de rentrée : reconduit les classes d'une année source vers l'année `cible`
// (toutes ou une sélection), avec ou sans le programme de matières. Les affectations
// d'enseignants, élèves et emplois du temps ne sont jamais repris.
export function ReconduireClassesModal({ isOpen, onClose, cible, annees }: Props) {
  const { t } = useTranslation();
  const api = useApi();
  const [sourceId, setSourceId] = useState('');
  const [matieres, setMatieres] = useState<'copier' | 'aucune'>('copier');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sources = useMemo(
    () => annees.filter(a => a.id !== cible?.id).sort((a, b) => b.date_debut.localeCompare(a.date_debut)),
    [annees, cible],
  );

  // Source par défaut : l'année la plus récente qui précède la cible (sinon la plus récente).
  useEffect(() => {
    if (!isOpen || !cible) return;
    const precedente = sources.find(a => a.date_debut < cible.date_debut) ?? sources[0];
    setSourceId(precedente?.id ?? '');
    setMatieres('copier');
  }, [isOpen, cible, sources]);

  // Aperçu (aucune écriture) à chaque changement de source.
  useEffect(() => {
    if (!isOpen || !cible || !sourceId) { setLignes([]); return; }
    let annule = false;
    setLoading(true);
    api.post<Resultat>('/api/v1/classes/reconduire', { annee_source_id: sourceId, annee_cible_id: cible.id, apercu: true })
      .then(r => {
        if (annule) return;
        setLignes(r.lignes);
        setChoix(new Set(r.lignes.filter(l => l.statut === 'a_creer').map(l => l.classe_source_id)));
      })
      .catch(err => { if (!annule) { setLignes([]); toast.error((err as Error).message); } })
      .finally(() => { if (!annule) setLoading(false); });
    return () => { annule = true; };
    // `api` change de référence à chaque render : jamais en dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cible, sourceId]);

  const reconductibles = lignes.filter(l => l.statut === 'a_creer');
  const toutCoche = reconductibles.length > 0 && reconductibles.every(l => choix.has(l.classe_source_id));
  const basculer = (id: string) => setChoix(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const confirmer = async () => {
    if (!cible || choix.size === 0) return;
    setSaving(true);
    try {
      const r = await api.post<Resultat>('/api/v1/classes/reconduire', {
        annee_source_id: sourceId, annee_cible_id: cible.id, classe_ids: [...choix], matieres,
      });
      toast.success(t('annee_scolaire.reconduire_ok', { count: r.resume.creees }));
      onClose();
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('annee_scolaire.reconduire_titre', { libelle: cible?.libelle ?? '' })}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted" style={{ fontSize: 13 }}>{t('annee_scolaire.reconduire_intro')}</p>

        {sources.length === 0 ? (
          <div className="empty">{t('annee_scolaire.reconduire_aucune_source')}</div>
        ) : (
          <>
            <Select
              label={t('annee_scolaire.reconduire_source')}
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              options={sources.map(a => ({ value: a.id, label: a.libelle }))}
            />

            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>{t('annee_scolaire.reconduire_contenu')}</div>
              <div className="seg seg-accent">
                <button type="button" className={`seg-pill${matieres === 'copier' ? ' active' : ''}`} onClick={() => setMatieres('copier')}>
                  {t('annee_scolaire.reconduire_avec_matieres')}
                </button>
                <button type="button" className={`seg-pill${matieres === 'aucune' ? ' active' : ''}`} onClick={() => setMatieres('aucune')}>
                  {t('annee_scolaire.reconduire_structure_seule')}
                </button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {matieres === 'copier' ? t('annee_scolaire.reconduire_hint_matieres') : t('annee_scolaire.reconduire_hint_structure')}
              </p>
            </div>

            <div className="card" style={{ maxHeight: 320, overflow: 'auto' }}>
              {loading ? (
                <div className="empty">{t('common.chargement')}</div>
              ) : lignes.length === 0 ? (
                <div className="empty">{t('annee_scolaire.reconduire_aucune_classe')}</div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          aria-label={t('annee_scolaire.reconduire_tout')}
                          checked={toutCoche}
                          disabled={reconductibles.length === 0}
                          onChange={() => setChoix(toutCoche ? new Set() : new Set(reconductibles.map(l => l.classe_source_id)))}
                        />
                      </th>
                      <th>{t('annee_scolaire.reconduire_col_classe')}</th>
                      <th>{t('annee_scolaire.reconduire_col_filiere')}</th>
                      <th>{t('annee_scolaire.reconduire_col_matieres')}</th>
                      <th>{t('annee_scolaire.col_statut')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map(l => {
                      const existe = l.statut === 'existe';
                      return (
                        <tr key={l.classe_source_id} style={existe ? { opacity: 0.55 } : undefined}>
                          <td>
                            <input type="checkbox" checked={choix.has(l.classe_source_id)} disabled={existe} onChange={() => basculer(l.classe_source_id)} />
                          </td>
                          <td>{l.nom_fr}{l.niveau && <span className="muted"> · {l.niveau}</span>}</td>
                          <td>{l.filiere}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{matieres === 'copier' ? l.nb_matieres : '—'}</td>
                          <td>
                            <Badge
                              label={existe ? t('annee_scolaire.reconduire_existe') : t('annee_scolaire.reconduire_a_creer')}
                              variant={existe ? 'neutral' : 'info'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button variant="secondary" onClick={onClose}>{t('actions.annuler')}</Button>
          <Button onClick={confirmer} loading={saving} disabled={choix.size === 0}>
            {t('annee_scolaire.reconduire_confirmer', { count: choix.size })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
