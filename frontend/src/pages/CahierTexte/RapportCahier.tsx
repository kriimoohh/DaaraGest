import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { nomClasse } from '../../lib/noms';

interface ClasseRef { id: string; nom_fr: string; nom_ar?: string | null; }
interface Rapport {
  periode: 'jour' | 'semaine'; du: string; au: string;
  totaux: { prevus: number; renseignes: number; manquantes: number; taux: number | null };
  classes: {
    classe: { id: string; nom_fr: string; nom_ar: string | null };
    prevus: number; renseignes: number; taux: number | null; hors_edt: number;
    jours: {
      date: string;
      seances: { matiere: string; enseignant: string; contenu: string; objectif: string | null; hors_edt: boolean }[];
      devoirs: { matiere: string; type: string; consigne: string; pour_le: string }[];
      manquantes: { matiere: string; enseignant: string; debut: string; fin: string }[];
    }[];
  }[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function RapportCahier({ anneeId, classes }: { anneeId: string; classes: ClasseRef[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SN' : i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const api = useApi();
  const [periode, setPeriode] = useState<'jour' | 'semaine'>('jour');
  const [date, setDate] = useState(todayISO());
  const [classeId, setClasseId] = useState('');
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'dl' | 'print' | null>(null);

  const params = `annee_scolaire_id=${anneeId}&periode=${periode}&date=${date}${classeId ? `&classe_id=${classeId}` : ''}`;

  const charger = useCallback(async () => {
    if (!anneeId || !date) return;
    setLoading(true);
    try {
      setRapport(await api.get<Rapport>(`/api/v1/cahier/rapport?${params}`));
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_rapport'));
    } finally {
      setLoading(false);
    }
    // `api` volontairement hors dépendances (référence instable → boucle de requêtes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => { void charger(); }, [charger]);

  const recupererPdf = async () => {
    const resp = await fetch(`${API}/api/v1/cahier/rapport-pdf?${params}`, { credentials: 'include' });
    if (!resp.ok) throw new Error(t('cahier.err_rapport'));
    return resp.blob();
  };

  const telecharger = async () => {
    setBusy('dl');
    try {
      const url = URL.createObjectURL(await recupererPdf());
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-cahier-${periode}-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_rapport'));
    } finally { setBusy(null); }
  };

  // Impression : le PDF est chargé dans un cadre masqué puis imprimé (mise en page A4 identique au téléchargement).
  const imprimer = async () => {
    setBusy('print');
    try {
      const url = URL.createObjectURL(await recupererPdf());
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
      };
      document.body.appendChild(frame);
    } catch (err) {
      toast.error((err as Error).message || t('cahier.err_rapport'));
    } finally { setBusy(null); }
  };

  const fmtDate = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
  const couleurTaux = (tx: number | null) => tx === null ? 'var(--ink-3)' : tx >= 80 ? 'var(--success-text)' : tx >= 50 ? 'var(--warning-text)' : 'var(--danger-text)';

  return (
    <>
      <div className="card-pad" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Select label={t('cahier.rapport_periode')} value={periode} onChange={e => setPeriode(e.target.value as 'jour' | 'semaine')}
          options={[{ value: 'jour', label: t('cahier.rapport_jour') }, { value: 'semaine', label: t('cahier.rapport_semaine') }]} />
        <Input label={t('cahier.rapport_date')} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Select label={t('nav.classes')} value={classeId} onChange={e => setClasseId(e.target.value)}
          options={[{ value: '', label: t('cahier.rapport_toutes_classes') }, ...classes.map(c => ({ value: c.id, label: nomClasse(c) }))]} />
        <Button variant="secondary" onClick={telecharger} loading={busy === 'dl'} disabled={loading || !rapport}>⬇ {t('cahier.rapport_telecharger')}</Button>
        <Button variant="secondary" onClick={imprimer} loading={busy === 'print'} disabled={loading || !rapport}>🖨 {t('cahier.rapport_imprimer')}</Button>
      </div>

      {rapport && (
        <>
          {rapport.periode === 'semaine' && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
              {t('cahier.rapport_semaine_du', { du: fmtDate(rapport.du), au: fmtDate(rapport.au) })}
            </div>
          )}
          <div className="card-pad" style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              [rapport.totaux.prevus, t('cahier.rapport_prevues')],
              [rapport.totaux.renseignes, t('cahier.rapport_renseignees')],
              [rapport.totaux.manquantes, t('cahier.rapport_manquantes')],
              [rapport.totaux.taux === null ? '—' : `${rapport.totaux.taux}%`, t('cahier.completude')],
            ].map(([v, l], i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontWeight: 700, color: i === 3 ? couleurTaux(rapport.totaux.taux) : 'var(--ink)' }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</div>
              </div>
            ))}
          </div>

          {rapport.classes.length === 0 && <div className="card-pad" style={{ color: 'var(--ink-3)' }}>{t('cahier.rapport_vide')}</div>}

          {rapport.classes.map(c => (
            <div key={c.classe.id} className="card-pad" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
                <strong style={{ fontSize: 15 }}>{nomClasse(c.classe)}</strong>
                <span style={{ fontSize: 13, color: couleurTaux(c.taux) }}>
                  {t('cahier.seances_renseignees', { renseignes: c.renseignes, prevus: c.prevus })}{c.taux !== null && ` (${c.taux}%)`}
                </span>
                {c.hors_edt > 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {c.hors_edt} {t('cahier.rapport_hors_edt')}</span>}
              </div>
              {c.jours.map(j => (
                <div key={j.date} style={{ borderTop: '1px solid var(--rule)', padding: '8px 0' }}>
                  {rapport.periode === 'semaine' && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>{fmtDate(j.date)}</div>}
                  {j.seances.map((s, i) => (
                    <div key={i} style={{ padding: '3px 0', fontSize: 13 }}>
                      <strong>{s.matiere}</strong> <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>· {s.enseignant}{s.hors_edt ? ` · ${t('cahier.rapport_hors_edt')}` : ''}</span>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{s.contenu}</div>
                      {s.objectif && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{t('cahier.rapport_objectif')} : {s.objectif}</div>}
                    </div>
                  ))}
                  {j.devoirs.map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5, padding: '2px 0' }}>
                      ✎ <strong>{d.matiere}</strong> ({t(`cahier.type_${d.type.toLowerCase()}`, d.type)}) : {d.consigne} — {t('cahier.rapport_pour_le')} {fmtDate(d.pour_le)}
                    </div>
                  ))}
                  {j.manquantes.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {j.manquantes.map((m, i) => (
                        <Badge key={i} variant="warning" label={`${t('cahier.rapport_non_renseignee')} : ${m.matiere} ${m.debut}–${m.fin} (${m.enseignant})`} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </>
  );
}
