import prisma from '../../config/database';
import { escapeHtml } from '../../utils/escapeHtml';
import { renderPdfHtml } from '../../utils/browserPool';
import { Portee } from '../../utils/portee';
import { jourDeLaDate } from './cahier.service';
import { RapportQuery } from './cahier.schema';

// Rapport du cahier de texte : une JOURNÉE ou une SEMAINE (lundi → dimanche), pour toutes les
// classes visibles ou une seule. Pour chaque classe : ce qui a été enseigné, les devoirs donnés
// et les séances prévues à l'emploi du temps mais NON renseignées.

const dateDb = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusJours = (dISO: string, n: number) => iso(new Date(dateDb(dISO).getTime() + n * 86_400_000));

/** Jour → [date, date] ; semaine → lundi..dimanche de la semaine contenant `date`. */
export function calculerPeriode(periode: 'jour' | 'semaine', date: string): { du: string; au: string } {
  if (periode === 'jour') return { du: date, au: date };
  const delta = (dateDb(date).getUTCDay() + 6) % 7; // 0 = lundi
  const du = plusJours(date, -delta);
  return { du, au: plusJours(du, 6) };
}

export type RapportData = {
  etablissement: { nom_fr: string };
  annee: string;
  periode: 'jour' | 'semaine';
  du: string;
  au: string;
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
};

const nomPers = (u: { nom_fr: string; prenom_fr: string | null }) => `${u.prenom_fr ?? ''} ${u.nom_fr}`.trim();
const taux = (renseignes: number, prevus: number) => (prevus > 0 ? Math.round((renseignes / prevus) * 100) : null);

export async function construireRapport(etablissement_id: string, q: RapportQuery, portee: Portee): Promise<RapportData> {
  const { du, au } = calculerPeriode(q.periode, q.date);

  const annee = await prisma.anneeScolaire.findFirst({
    where: { id: q.annee_scolaire_id, etablissement_id }, select: { libelle: true },
  });
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } });

  // Périmètre des classes : une classe demandée hors périmètre → liste vide (jamais d'erreur révélatrice).
  const ids = portee ? portee.classe_ids : null;
  const classes = await prisma.classe.findMany({
    where: {
      etablissement_id, annee_scolaire_id: q.annee_scolaire_id, active: true,
      ...(q.classe_id ? { id: q.classe_id } : {}),
      ...(ids ? { id: q.classe_id ? (ids.includes(q.classe_id) ? q.classe_id : { in: [] }) : { in: ids } } : {}),
    },
    select: { id: true, nom_fr: true, nom_ar: true },
    orderBy: { nom_fr: 'asc' },
  });
  const classeIds = classes.map(c => c.id);

  const [creneaux, seances, devoirs] = await Promise.all([
    prisma.creneau.findMany({
      where: { etablissement_id, annee_scolaire_id: q.annee_scolaire_id, classe_id: { in: classeIds } },
      include: {
        matiere: { select: { nom_fr: true } },
        personnel: { select: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
      },
      orderBy: { heure_debut: 'asc' },
    }),
    prisma.cahierSeance.findMany({
      where: {
        etablissement_id, annee_scolaire_id: q.annee_scolaire_id, classe_id: { in: classeIds },
        date: { gte: dateDb(du), lte: dateDb(au) },
      },
      include: {
        matiere: { select: { nom_fr: true } },
        personnel: { select: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.devoir.findMany({
      where: {
        etablissement_id, annee_scolaire_id: q.annee_scolaire_id, classe_id: { in: classeIds },
        donne_le: { gte: dateDb(du), lte: dateDb(au) },
      },
      include: { matiere: { select: { nom_fr: true } } },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  const nbJours = q.periode === 'jour' ? 1 : 7;
  const dates = Array.from({ length: nbJours }, (_, i) => plusJours(du, i));

  const rapportClasses: RapportData['classes'] = [];
  for (const classe of classes) {
    const creneauxClasse = creneaux.filter(c => c.classe_id === classe.id);
    const seancesClasse = seances.filter(s => s.classe_id === classe.id);
    const devoirsClasse = devoirs.filter(d => d.classe_id === classe.id);
    const faits = new Set(seancesClasse.filter(s => s.creneau_id).map(s => `${s.creneau_id}|${iso(s.date)}`));

    let prevus = 0, renseignes = 0;
    const jours: RapportData['classes'][number]['jours'] = [];
    for (const date of dates) {
      const prevusDuJour = creneauxClasse.filter(c => c.jour === jourDeLaDate(date));
      const manquantes = prevusDuJour.filter(c => !faits.has(`${c.id}|${date}`));
      const seancesDuJour = seancesClasse.filter(s => iso(s.date) === date);
      const devoirsDuJour = devoirsClasse.filter(d => iso(d.donne_le) === date);
      prevus += prevusDuJour.length;
      renseignes += prevusDuJour.length - manquantes.length;
      if (prevusDuJour.length === 0 && seancesDuJour.length === 0 && devoirsDuJour.length === 0) continue;
      jours.push({
        date,
        seances: seancesDuJour.map(s => ({
          matiere: s.matiere.nom_fr, enseignant: nomPers(s.personnel.utilisateur),
          contenu: s.contenu, objectif: s.objectif, hors_edt: !s.creneau_id,
        })),
        devoirs: devoirsDuJour.map(d => ({ matiere: d.matiere.nom_fr, type: d.type, consigne: d.consigne, pour_le: iso(d.pour_le) })),
        manquantes: manquantes.map(c => ({
          matiere: c.matiere.nom_fr, enseignant: nomPers(c.personnel.utilisateur), debut: c.heure_debut, fin: c.heure_fin,
        })),
      });
    }
    // Les classes sans aucun emploi du temps ni activité sur la période ne sont pas listées.
    if (jours.length === 0) continue;
    rapportClasses.push({
      classe, prevus, renseignes, taux: taux(renseignes, prevus),
      hors_edt: seancesClasse.filter(s => !s.creneau_id).length, jours,
    });
  }

  const prevusTot = rapportClasses.reduce((n, c) => n + c.prevus, 0);
  const renseignesTot = rapportClasses.reduce((n, c) => n + c.renseignes, 0);
  return {
    etablissement: { nom_fr: etab?.nom_fr ?? '' },
    annee: annee?.libelle ?? '',
    periode: q.periode, du, au,
    totaux: { prevus: prevusTot, renseignes: renseignesTot, manquantes: prevusTot - renseignesTot, taux: taux(renseignesTot, prevusTot) },
    classes: rapportClasses,
  };
}

// ─── HTML / PDF ──────────────────────────────────────────────────────────────

const JOURS_LONGS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
  vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};
const fmtFr = (dISO: string) => {
  const [y, m, d] = dISO.split('-');
  return `${JOURS_LONGS[jourDeLaDate(dISO)]} ${d}/${m}/${y}`;
};
const TYPES: Record<string, string> = { LECON: 'leçon', EXERCICE: 'exercice', RECITATION: 'récitation', AUTRE: 'autre' };

/** HTML imprimable du rapport — pur (testé unitairement), tout contenu échappé. */
export function construireHtmlRapport(data: RapportData): string {
  const titre = data.periode === 'jour' ? `Rapport journalier — ${fmtFr(data.du)}` : `Rapport hebdomadaire — du ${fmtFr(data.du)} au ${fmtFr(data.au)}`;
  const tauxTxt = (t: number | null) => (t === null ? '—' : `${t} %`);

  const classes = data.classes.map(c => `
    <section class="classe">
      <h2>${escapeHtml(c.classe.nom_fr)}${c.classe.nom_ar ? ` <span class="ar">${escapeHtml(c.classe.nom_ar)}</span>` : ''}
        <span class="taux">${c.renseignes}/${c.prevus} séances renseignées (${tauxTxt(c.taux)})${c.hors_edt > 0 ? ` · ${c.hors_edt} hors emploi du temps` : ''}</span></h2>
      ${c.jours.map(j => `
        <div class="jour">
          ${data.periode === 'semaine' ? `<h3>${escapeHtml(fmtFr(j.date))}</h3>` : ''}
          ${j.seances.map(s => `
            <div class="seance">
              <div class="ligne"><strong>${escapeHtml(s.matiere)}</strong><span class="prof">${escapeHtml(s.enseignant)}${s.hors_edt ? ' · hors emploi du temps' : ''}</span></div>
              <div class="contenu">${escapeHtml(s.contenu)}</div>
              ${s.objectif ? `<div class="objectif">Objectif : ${escapeHtml(s.objectif)}</div>` : ''}
            </div>`).join('')}
          ${j.devoirs.map(d => `<div class="devoir">✎ <strong>${escapeHtml(d.matiere)}</strong> (${escapeHtml(TYPES[d.type] ?? d.type.toLowerCase())}) : ${escapeHtml(d.consigne)} — pour le ${escapeHtml(fmtFr(d.pour_le))}</div>`).join('')}
          ${j.manquantes.map(m => `<div class="manquante">⚠ Non renseignée : ${escapeHtml(m.matiere)} (${escapeHtml(m.debut)}–${escapeHtml(m.fin)}) — ${escapeHtml(m.enseignant)}</div>`).join('')}
        </div>`).join('')}
    </section>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: baseline; }
    header h1 { font-size: 16px; }
    header .meta { text-align: right; }
    .synthese { display: flex; gap: 10px; margin-bottom: 14px; }
    .synthese div { flex: 1; border: 1px solid #ccc; padding: 6px 10px; text-align: center; }
    .synthese b { display: block; font-size: 16px; }
    .classe { margin-bottom: 14px; }
    .classe h2 { font-size: 12.5px; background: #f0f0f0; padding: 5px 8px; border-inline-start: 3px solid #555; display: flex; justify-content: space-between; gap: 8px; }
    .classe h2 .taux { font-weight: 400; font-size: 10.5px; color: #444; }
    .ar { font-weight: 400; color: #666; }
    .jour { padding: 4px 0; page-break-inside: avoid; }
    .jour h3 { font-size: 11px; padding: 3px 8px; color: #333; border-bottom: 1px solid #ddd; margin-top: 4px; }
    .seance { padding: 4px 8px 5px; border-bottom: 1px dotted #ccc; }
    .ligne { display: flex; justify-content: space-between; }
    .prof { color: #666; font-size: 10px; }
    .contenu { margin-top: 2px; white-space: pre-wrap; }
    .objectif { color: #555; font-style: italic; font-size: 10px; margin-top: 2px; }
    .devoir { font-size: 10.5px; padding: 2px 8px; background: #fafafa; }
    .manquante { font-size: 10.5px; padding: 2px 8px; color: #9a3412; background: #fff7ed; }
    .vide { color: #888; font-style: italic; padding: 8px; }
    footer { margin-top: 18px; font-size: 9.5px; color: #777; border-top: 1px solid #ddd; padding-top: 6px; }
  </style></head><body>
    <header>
      <div><h1>${escapeHtml(data.etablissement.nom_fr)}</h1><div>Cahier de texte — ${escapeHtml(titre)}</div></div>
      <div class="meta">Année ${escapeHtml(data.annee)}</div>
    </header>
    <div class="synthese">
      <div><b>${data.totaux.prevus}</b>séances prévues</div>
      <div><b>${data.totaux.renseignes}</b>renseignées</div>
      <div><b>${data.totaux.manquantes}</b>non renseignées</div>
      <div><b>${tauxTxt(data.totaux.taux)}</b>complétude</div>
    </div>
    ${classes || '<div class="vide">Aucune séance prévue ni renseignée sur cette période.</div>'}
    <footer>Les jours fériés et vacances ne sont pas déduits des séances prévues.</footer>
  </body></html>`;
}

export async function exporterRapportPdf(etablissement_id: string, q: RapportQuery, portee: Portee): Promise<Buffer> {
  const html = construireHtmlRapport(await construireRapport(etablissement_id, q, portee));
  return renderPdfHtml(html, {
    format: 'A4', printBackground: true,
    margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
  });
}
