import { AsyncLocalStorage } from 'node:async_hooks';
import type { PDFOptions } from 'puppeteer';
import prisma from '../../config/database';
import { renderPdfHtml as _renderPdfHtmlReal } from '../../utils/browserPool';
import { calculerMoyennesClasse, getMentionsEtab, getBaremesClasseCohorte, filieresActivesCodes } from '../bulletins/bulletins.service';
import { DEFAULT_NOTE_MAX, mentionPour } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

// Mode aperçu : on intercepte renderPdfHtml pour capturer le HTML sans
// passer par Puppeteer. AsyncLocalStorage isole les appels concurrents.
const previewStore = new AsyncLocalStorage<{ html?: string }>();
const PREVIEW_SIGNAL = Symbol('rapports-preview');

async function renderPdfHtml(html: string, pdfOptions: PDFOptions): Promise<Buffer> {
  const store = previewStore.getStore();
  if (store) { store.html = html; throw PREVIEW_SIGNAL; }
  return _renderPdfHtmlReal(html, pdfOptions);
}

async function capturePreviewHtml(fn: () => Promise<unknown>): Promise<string> {
  const store: { html?: string } = {};
  try {
    await previewStore.run(store, fn);
  } catch (err) {
    if (err !== PREVIEW_SIGNAL) throw err;
  }
  if (!store.html) throw new Error('Aperçu indisponible pour ce rapport');
  return store.html;
}

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function esc(v: string | null | undefined): string {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(c => {
    const s = String(c ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',');
}

// ─── Rapport présences élèves ────────────────────────────────────────────────

export async function rapportPresencesEleves(
  etablissement_id: string,
  params: { classe_id?: string; annee_scolaire_id?: string; mois?: number; annee?: number; format: string },
) {
  const { classe_id, mois, annee, format } = params;

  const annee_scolaire_id = params.annee_scolaire_id ?? (await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { id: true },
  }))?.id;

  const where: Record<string, unknown> = { etablissement_id };
  if (classe_id) where.classe_id = classe_id;
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (mois && annee) {
    where.date = { gte: new Date(annee, mois - 1, 1), lte: new Date(annee, mois, 0, 23, 59, 59) };
  }

  const absences = await prisma.absenceEleve.findMany({
    where,
    include: {
      eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } },
      classe: { select: { nom_fr: true } },
    },
    orderBy: [{ date: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });

  if (format === 'csv') {
    const lines = [
      csvRow(['Date','Matricule','Nom','Prénom','Classe','Statut','Justifiée','Motif']),
      ...absences.map(a => csvRow([
        new Date(a.date).toLocaleDateString('fr-FR'),
        a.eleve.matricule,
        a.eleve.nom_fr,
        a.eleve.prenom_fr,
        a.classe.nom_fr,
        a.statut,
        a.justifiee ? 'Oui' : 'Non',
        a.motif ?? '',
      ])),
    ];
    return { buffer: Buffer.from(lines.join('\n'), 'utf-8'), mime: 'text/csv', filename: 'presences-eleves.csv' };
  }

  const titre = `Rapport de présences élèves${mois && annee ? ` — ${MOIS_LABELS[mois-1]} ${annee}` : ''}`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:18px;margin-bottom:4px;}
  .sub{color:#666;font-size:11px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f3f3;text-align:left;padding:6px 8px;font-size:11px;border-bottom:2px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;}
  .absent{color:#c0392b;font-weight:600;} .retard{color:#e67e22;}
  .present{color:#27ae60;}
</style></head><body>
<h1>${esc(titre)}</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} — ${absences.length} enregistrement(s)</div>
<table>
<thead><tr><th>Date</th><th>Matricule</th><th>Nom</th><th>Classe</th><th>Statut</th><th>Justifiée</th></tr></thead>
<tbody>
${absences.map(a => `<tr>
  <td>${new Date(a.date).toLocaleDateString('fr-FR')}</td>
  <td>${esc(a.eleve.matricule)}</td>
  <td>${esc(a.eleve.nom_fr)} ${esc(a.eleve.prenom_fr)}</td>
  <td>${esc(a.classe.nom_fr)}</td>
  <td class="${a.statut}">${esc(a.statut)}</td>
  <td>${a.justifiee ? 'Oui' : 'Non'}</td>
</tr>`).join('')}
</tbody></table></body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: 'presences-eleves.pdf' };
}

// ─── Rapport présences personnel ────────────────────────────────────────────

export async function rapportPresencesPersonnel(
  etablissement_id: string,
  params: { mois?: number; annee?: number; format: string },
) {
  const { mois, annee, format } = params;

  const where: Record<string, unknown> = { personnel: { utilisateur: { etablissement_id } } };
  if (mois && annee) {
    where.date = { gte: new Date(annee, mois - 1, 1), lte: new Date(annee, mois, 0) };
  }

  const presences = await prisma.presencePersonnel.findMany({
    where,
    include: {
      personnel: {
        include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } },
      },
    },
    orderBy: [{ date: 'asc' }],
  });

  if (format === 'csv') {
    const lines = [
      csvRow(['Date','Nom','Prénom','Statut','Arrivée','Départ','Heures prévues','Heures réelles','Motif']),
      ...presences.map(p => csvRow([
        new Date(p.date).toLocaleDateString('fr-FR'),
        p.personnel.utilisateur.nom_fr,
        p.personnel.utilisateur.prenom_fr ?? '',
        p.statut,
        p.heure_arrivee ?? '',
        p.heure_depart ?? '',
        p.heures_prevues !== null ? String(p.heures_prevues) : '',
        p.heures_reelles !== null ? String(p.heures_reelles) : '',
        p.motif ?? '',
      ])),
    ];
    return { buffer: Buffer.from(lines.join('\n'), 'utf-8'), mime: 'text/csv', filename: 'presences-personnel.csv' };
  }

  const titre = `Rapport de présences personnel${mois && annee ? ` — ${MOIS_LABELS[mois-1]} ${annee}` : ''}`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:18px;margin-bottom:4px;}
  .sub{color:#666;font-size:11px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f3f3;text-align:left;padding:6px 8px;font-size:11px;border-bottom:2px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;}
  .absent{color:#c0392b;font-weight:600;} .retard{color:#e67e22;}
  .present{color:#27ae60;}
</style></head><body>
<h1>${esc(titre)}</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} — ${presences.length} enregistrement(s)</div>
<table>
<thead><tr><th>Date</th><th>Personnel</th><th>Statut</th><th>Arrivée</th><th>Départ</th><th>H. réelles</th></tr></thead>
<tbody>
${presences.map(p => `<tr>
  <td>${new Date(p.date).toLocaleDateString('fr-FR')}</td>
  <td>${esc(p.personnel.utilisateur.nom_fr)} ${esc(p.personnel.utilisateur.prenom_fr ?? '')}</td>
  <td class="${p.statut}">${esc(p.statut)}</td>
  <td>${esc(p.heure_arrivee ?? '—')}</td>
  <td>${esc(p.heure_depart ?? '—')}</td>
  <td>${p.heures_reelles !== null ? String(p.heures_reelles) + 'h' : '—'}</td>
</tr>`).join('')}
</tbody></table></body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: 'presences-personnel.pdf' };
}

// ─── Rapport résultats classe ────────────────────────────────────────────────

export async function rapportResultatsClasse(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number; format: string },
) {
  const { classe_id, annee_scolaire_id, periode, format } = params;

  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const nbPeriodes = config?.nb_periodes ?? 3;
  const mentions = await getMentionsEtab(etablissement_id);
  const periodes = periode !== undefined && periode > 0 ? [periode] : Array.from({ length: nbPeriodes }, (_, i) => i + 1);

  const inscriptions = await prisma.inscription.findMany({
    where: {
      annee_scolaire_id,
      statut: 'actif',
      classes: { some: { classe_id } },
    },
    include: { eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } } },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });

  // Moyenne pondérée/normalisée — même calcul que le bulletin (cohérence garantie).
  const moyennes = await calculerMoyennesClasse(etablissement_id, classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id));
  const nbCnt = await prisma.note.groupBy({
    by: ['eleve_id'],
    where: { eleve_id: { in: inscriptions.map(i => i.eleve_id) }, annee_scolaire_id, ...(periode && periode > 0 ? { periode } : {}) },
    _count: { id: true },
  });
  const nbNotes = new Map(nbCnt.map(c => [c.eleve_id, c._count.id]));

  const rows = inscriptions.map(i => ({
    matricule: i.eleve.matricule,
    nom: `${i.eleve.nom_fr} ${i.eleve.prenom_fr}`,
    moyenne: moyennes.get(i.eleve_id) ?? null,
    nb: nbNotes.get(i.eleve_id) ?? 0,
  })).sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));

  if (format === 'csv') {
    const lines = [
      csvRow(['Matricule','Nom','Moyenne','Nb notes']),
      ...rows.map(r => csvRow([r.matricule, r.nom, r.moyenne ?? 'N/A', r.nb])),
    ];
    return { buffer: Buffer.from(lines.join('\n'), 'utf-8'), mime: 'text/csv', filename: `resultats-${classe.nom_fr}.csv` };
  }

  const titre = `Résultats — ${classe.nom_fr}${periode ? ` · T${periode}` : ' · Annuel'}`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:18px;margin-bottom:4px;} .sub{color:#666;font-size:11px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f3f3;text-align:left;padding:6px 8px;font-size:11px;border-bottom:2px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;}
  .rang{color:#666;} .ok{color:#27ae60;font-weight:600;} .nok{color:#c0392b;font-weight:600;}
</style></head><body>
<h1>${esc(titre)}</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} — ${rows.length} élèves</div>
<table>
<thead><tr><th>#</th><th>Matricule</th><th>Nom</th><th>Moyenne</th><th>Appréciation</th></tr></thead>
<tbody>
${rows.map((r, i) => {
  const m = r.moyenne;
  const cls = m === null ? '' : m >= baseNote / 2 ? 'ok' : 'nok';
  const app = m === null ? '—' : mentionPour(m, mentions);
  return `<tr>
  <td class="rang">${i + 1}</td>
  <td>${esc(r.matricule)}</td>
  <td>${esc(r.nom)}</td>
  <td class="${cls}">${m !== null ? m : '—'}</td>
  <td>${app}</td>
</tr>`;
}).join('')}
</tbody></table></body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: `resultats-${classe.nom_fr}.pdf` };
}

// ─── Rapport bilan financier ─────────────────────────────────────────────────

export async function rapportBilanFinancier(
  etablissement_id: string,
  params: { mois?: number; annee?: number; format: string },
) {
  const now   = new Date();
  const mois  = params.mois  ?? now.getMonth() + 1;
  const annee = params.annee ?? now.getFullYear();

  const [paiementsEleves, paiementsProfs, config] = await Promise.all([
    prisma.paiementEleve.findMany({
      where: { eleve: { etablissement_id }, mois, annee },
      include: { eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.paiementPersonnel.findMany({
      where: { personnel: { utilisateur: { etablissement_id } }, mois, annee },
      include: { personnel: { include: { utilisateur: { select: { nom_fr: true } } } } },
    }),
    prisma.configNotes.findUnique({ where: { etablissement_id } }),
  ]);

  const totalEncaisse  = paiementsEleves.reduce((s, p) => s + Number(p.montant), 0);
  const totalVersé     = paiementsProfs.reduce((s, p)  => s + Number(p.net_a_payer), 0);
  const solde          = totalEncaisse - totalVersé;
  const devise         = config ? 'FCFA' : 'FCFA';

  if (params.format === 'csv') {
    const lines = [
      ['BILAN FINANCIER', `${MOIS_LABELS[mois-1]} ${annee}`],
      [],
      ['TYPE','MONTANT','DEVISE'],
      ['Total encaissé (élèves)', totalEncaisse, devise],
      ['Total versé (personnel)', totalVersé, devise],
      ['Solde', solde, devise],
      [],
      ['DÉTAIL PAIEMENTS ÉLÈVES'],
      ['Date','Matricule','Nom','Type','Montant'],
      ...paiementsEleves.map(p => [
        new Date(p.created_at).toLocaleDateString('fr-FR'),
        p.eleve.matricule, `${p.eleve.nom_fr} ${p.eleve.prenom_fr}`,
        p.type, Number(p.montant),
      ]),
    ];
    return {
      buffer: Buffer.from(lines.map(r => csvRow(r)).join('\n'), 'utf-8'),
      mime: 'text/csv',
      filename: `bilan-financier-${mois}-${annee}.csv`,
    };
  }

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:18px;margin-bottom:4px;} .sub{color:#666;font-size:11px;margin-bottom:20px;}
  .kpis{display:flex;gap:16px;margin-bottom:24px;}
  .kpi{flex:1;background:#f8f8f8;border-radius:8px;padding:14px 16px;}
  .kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;}
  .kpi-val{font-size:22px;font-weight:700;margin-top:4px;}
  .green{color:#27ae60;} .red{color:#c0392b;} .blue{color:#2980b9;}
  table{width:100%;border-collapse:collapse;margin-top:16px;}
  th{background:#f3f3f3;text-align:left;padding:6px 8px;font-size:11px;border-bottom:2px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;}
  h2{font-size:14px;margin:24px 0 8px;}
</style></head><body>
<h1>Bilan financier — ${MOIS_LABELS[mois-1]} ${annee}</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Encaissé</div><div class="kpi-val green">${totalEncaisse.toLocaleString('fr-FR')} ${devise}</div></div>
  <div class="kpi"><div class="kpi-label">Versé personnel</div><div class="kpi-val red">${totalVersé.toLocaleString('fr-FR')} ${devise}</div></div>
  <div class="kpi"><div class="kpi-label">Solde</div><div class="kpi-val ${solde >= 0 ? 'green' : 'red'}">${solde.toLocaleString('fr-FR')} ${devise}</div></div>
</div>
<h2>Paiements élèves (${paiementsEleves.length})</h2>
<table>
<thead><tr><th>Date</th><th>Matricule</th><th>Nom</th><th>Type</th><th style="text-align:right">Montant</th></tr></thead>
<tbody>
${paiementsEleves.map(p => `<tr>
  <td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
  <td>${esc(p.eleve.matricule)}</td>
  <td>${esc(p.eleve.nom_fr)} ${esc(p.eleve.prenom_fr)}</td>
  <td>${esc(p.type)}</td>
  <td style="text-align:right;font-family:monospace">${Number(p.montant).toLocaleString('fr-FR')}</td>
</tr>`).join('')}
</tbody></table>
<h2>Versements personnel (${paiementsProfs.length})</h2>
<table>
<thead><tr><th>Personnel</th><th style="text-align:right">Brut</th><th style="text-align:right">Retenues</th><th style="text-align:right">Net</th></tr></thead>
<tbody>
${paiementsProfs.map(p => `<tr>
  <td>${esc(p.personnel.utilisateur.nom_fr)}</td>
  <td style="text-align:right;font-family:monospace">${Number(p.montant_brut).toLocaleString('fr-FR')}</td>
  <td style="text-align:right;font-family:monospace">${Number(p.retenues).toLocaleString('fr-FR')}</td>
  <td style="text-align:right;font-family:monospace;font-weight:600">${Number(p.net_a_payer).toLocaleString('fr-FR')}</td>
</tr>`).join('')}
</tbody></table>
</body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: `bilan-financier-${mois}-${annee}.pdf` };
}

// ─── Helpers partagés (grilles pédagogiques) ─────────────────────────────────

/** Normalise une note brute vers /10 selon le barème de la matière */
function n10(valeur: number, noteMax: number): number {
  return noteMax > 0 ? (valeur / noteMax) * 10 : 0;
}

/** Valeur la plus fréquente d'une liste (arrondie à 2 décimales) */
function modeOf(vals: number[]): number | null {
  if (!vals.length) return null;
  const freq = new Map<string, number>();
  for (const v of vals) {
    const k = v.toFixed(2);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  let best = 0; let res = vals[0];
  for (const [k, f] of freq) { if (f > best) { best = f; res = parseFloat(k); } }
  return res;
}

/** Écart-type d'une liste de valeurs */
function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
}

/** Renvoie le professeur principal de la classe (heuristique : 1er trouvé) */
async function getTitulaire(classe_id: string, annee_scolaire_id: string): Promise<string> {
  const r = await prisma.personnelMatiereClasse.findFirst({
    where: { classe_id, annee_scolaire_id },
    include: { personnel: { include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } } },
  });
  if (!r) return '...';
  const u = r.personnel.utilisateur;
  return [u.prenom_fr, u.nom_fr].filter(Boolean).join(' ');
}

/** Inscriptions actives de la classe, ordonnées par nom élève */
async function fetchInscriptions(classe_id: string, annee_scolaire_id: string) {
  return prisma.inscription.findMany({
    where: {
      annee_scolaire_id,
      statut: 'actif',
      classes: { some: { classe_id } },
    },
    include: {
      eleve: { select: { id: true, sexe: true, nom_fr: true, prenom_fr: true, date_naissance: true } },
    },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });
}

const DOM_LABELS: Record<string, string> = {
  LANGUE_COMMUNICATION: 'Langue et Communication',
  MATHEMATIQUES:        'Mathématiques',
  ESVS:                 'Éd. Science et Vie Sociale',
  EPSA:                 'Éd. Physique Sportive et Artistique',
  RELIGION:             'Religion',
  EVEIL:                'Éveil',
};

// ─── Rapport Grille IEF (inspection officielle, portrait A4) ─────────────────

export async function rapportGrilleIef(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const { classe_id, annee_scolaire_id, periode } = params;

  const [classeRaw, etab, config] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: classe_id, etablissement_id },
      include: { niveau: true, annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissement_id } }),
    prisma.configNotes.findUnique({ where: { etablissement_id } }),
  ]);
  if (!classeRaw) throw new NotFoundError('Classe introuvable');

  const [inscriptions, titulaireNom] = await Promise.all([
    fetchInscriptions(classe_id, annee_scolaire_id),
    getTitulaire(classe_id, annee_scolaire_id),
  ]);

  const eleveIds = inscriptions.map(i => i.eleve_id);
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const nbPeriodes = config?.nb_periodes ?? 3;
  const periodes = periode && periode > 0 ? [periode] : Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const seuilMoyenne = baseNote / 2; // seuil de réussite = moitié de l'échelle (ex: 5 sur /10)

  const noteWhere: Record<string, unknown> = { eleve_id: { in: eleveIds }, annee_scolaire_id };
  if (periode && periode > 0) noteWhere.periode = periode;

  const [notes, absentRecords] = await Promise.all([
    prisma.note.findMany({ where: noteWhere, include: { matiere: { include: { domaine: true } } } }),
    prisma.absenceEleve.findMany({
      where: { classe_id, annee_scolaire_id, statut: 'absent', eleve_id: { in: eleveIds } },
      select: { eleve_id: true },
      distinct: ['eleve_id'],
    }),
  ]);

  const absentSet = new Set(absentRecords.map(a => a.eleve_id));

  // Moyenne générale normalisée/pondérée — même calcul que le bulletin.
  const moyGen = await calculerMoyennesClasse(etablissement_id, classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id));

  // Moyennes par domaine, chaque note ramenée sur l'échelle établissement via son barème effectif.
  const baremes = await getBaremesClasseCohorte(classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id), baseNote);
  const norm = (v: number, nm: number) => (nm > 0 ? (v / nm) * baseNote : 0);
  const domMoy = new Map<string, Map<string, number>>();
  const dnb = new Map<string, Map<string, number[]>>();
  for (const note of notes) {
    const dCode = note.matiere.domaine?.code;
    if (!dCode) continue;
    const nm = baremes.get(`${note.matiere_id}|${note.periode}`)?.note_max ?? baseNote;
    if (!dnb.has(note.eleve_id)) dnb.set(note.eleve_id, new Map());
    const dm = dnb.get(note.eleve_id)!;
    if (!dm.has(dCode)) dm.set(dCode, []);
    dm.get(dCode)!.push(norm(Number(note.valeur), nm));
  }
  for (const [eid, dm] of dnb) {
    domMoy.set(eid, new Map());
    for (const [dc, vals] of dm) {
      domMoy.get(eid)!.set(dc, vals.reduce((s, v) => s + v, 0) / vals.length);
    }
  }

  type Inscrip = (typeof inscriptions)[number];

  function sectionI(subset: Inscrip[]) {
    const evalues = subset.filter(i => moyGen.has(i.eleve_id));
    const ontMoy  = evalues.filter(i => (moyGen.get(i.eleve_id) ?? 0) >= seuilMoyenne);
    const absents = subset.filter(i => absentSet.has(i.eleve_id));
    const pct     = evalues.length ? Math.round((ontMoy.length / evalues.length) * 1000) / 10 : 0;
    return { eff: subset.length, abs: absents.length, eval: evalues.length, moy: ontMoy.length, pct };
  }

  function domReussite(subset: Inscrip[], code: string) {
    const evalues = subset.filter(i => domMoy.get(i.eleve_id)?.has(code));
    const ok      = evalues.filter(i => (domMoy.get(i.eleve_id)?.get(code) ?? 0) >= seuilMoyenne);
    const taux    = evalues.length ? Math.round((ok.length / evalues.length) * 1000) / 10 : 0;
    return { nbre: ok.length, taux };
  }

  const garcons = inscriptions.filter(i => i.eleve.sexe === 'M');
  const filles  = inscriptions.filter(i => i.eleve.sexe === 'F');
  const [sG, sF, sT] = [garcons, filles, inscriptions].map(sectionI);

  const domCodes = ['LANGUE_COMMUNICATION', 'MATHEMATIQUES', 'ESVS', 'EPSA'];
  const periodeLabel = periode && periode > 0 ? `${periode}ème Trimestre` : 'Annuel';

  function domRow(label: string, fn: (s: Inscrip[], c: string) => { nbre: number; taux: number }, key: 'nbre' | 'taux', suffix = '') {
    return `<tr><td class="lbl">${esc(label)}</td>${domCodes.map(dc => {
      const g = fn(garcons, dc);
      const f = fn(filles, dc);
      const t = fn(inscriptions, dc);
      const v = (x: { nbre: number; taux: number }) => x[key] + suffix;
      return `<td>${v(g)}</td><td>${v(f)}</td><td>${v(t)}</td>`;
    }).join('')}</tr>`;
  }

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:9.5px;color:#000;padding:12mm 10mm;}
.etab{font-weight:bold;font-size:11px;margin-bottom:2px;}
.titre{text-align:center;font-size:13px;font-weight:bold;text-decoration:underline;margin:6px 0;}
.sub{text-align:center;font-size:10px;margin-bottom:8px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-bottom:8px;font-size:9.5px;}
.info-grid span{display:block;}
h3{font-size:10px;font-weight:bold;text-decoration:underline;margin:10px 0 4px;}
table{width:100%;border-collapse:collapse;margin-bottom:6px;}
th,td{border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;}
.lbl{text-align:left;background:#f0f0f0;font-weight:500;}
.th-h{background:#ddd;font-weight:bold;}
.obs{border:1px solid #000;min-height:14mm;padding:4px;margin:4px 0;}
.prop-title{font-size:9px;font-weight:bold;text-decoration:underline;margin:6px 0 2px;}
.prop-line{border-bottom:1px dotted #999;min-height:5mm;margin:2px 0;}
.sigs{display:flex;justify-content:space-around;margin-top:12mm;}
.sig{text-align:center;font-weight:bold;font-size:10px;}
</style></head><body>
<div class="etab">${esc(etab?.nom_fr ?? '')}</div>
<div class="titre">GRILLE D'ÉVALUATION — ${esc(periodeLabel)}</div>
<div class="sub">Année scolaire : ${esc(classeRaw.annee_scolaire.libelle)} &nbsp;|&nbsp; Classe : ${esc(classeRaw.nom_fr)} &nbsp;|&nbsp; Niveau : ${esc(classeRaw.niveau?.libelle ?? '...')}</div>
<div class="info-grid">
  <span><strong>Titulaire de la classe :</strong> ${esc(titulaireNom)}</span>
  <span><strong>Seuil de réussite :</strong> ${seuilMoyenne} pts</span>
</div>

<h3>I. RÉSULTATS GLOBAUX PAR NIVEAU</h3>
<table>
  <thead><tr><th class="lbl"></th><th class="th-h">GARÇONS</th><th class="th-h">FILLES</th><th class="th-h">TOTAL</th></tr></thead>
  <tbody>
    <tr><td class="lbl">EFFECTIF</td><td>${sG.eff}</td><td>${sF.eff}</td><td>${sT.eff}</td></tr>
    <tr><td class="lbl">ABSENTS</td><td>${sG.abs}</td><td>${sF.abs}</td><td>${sT.abs}</td></tr>
    <tr><td class="lbl">ÉVALUÉ(S)</td><td>${sG.eval}</td><td>${sF.eval}</td><td>${sT.eval}</td></tr>
    <tr><td class="lbl">ONT LA MOYENNE</td><td>${sG.moy}</td><td>${sF.moy}</td><td>${sT.moy}</td></tr>
    <tr><td class="lbl">% RÉUSSITE</td><td>${sG.pct}%</td><td>${sF.pct}%</td><td>${sT.pct}%</td></tr>
  </tbody>
</table>
<div class="prop-title">OBSERVATIONS GÉNÉRALES</div>
<div class="obs"></div>

<h3>II. RÉCAPITULATION RÉUSSITE PAR DOMAINE</h3>
<table>
  <thead>
    <tr>
      <th class="lbl" rowspan="2"></th>
      ${domCodes.map(dc => `<th colspan="3" class="th-h">${esc(DOM_LABELS[dc] ?? dc)}</th>`).join('')}
    </tr>
    <tr>${domCodes.map(() => '<th>G</th><th>F</th><th>T</th>').join('')}</tr>
  </thead>
  <tbody>
    ${domRow('Nbre réussite', domReussite, 'nbre')}
    ${domRow('Taux réussite (%)', domReussite, 'taux', '%')}
  </tbody>
</table>

<h3>IV. PROPOSITIONS D'AMÉLIORATION</h3>
${domCodes.map(dc => `<div class="prop-title">${esc(DOM_LABELS[dc] ?? dc)} :</div><div class="prop-line"></div><div class="prop-line"></div>`).join('')}

<div class="sigs">
  <div class="sig">LE TESTEUR</div>
  <div class="sig">LE DIRECTEUR</div>
</div>
</body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: `grille-ief-${classeRaw.nom_fr}-T${periode ?? 'annuel'}.pdf` };
}

// ─── Rapport Grille Performance (CI-CP / CE1-CE2 / CM1-CM2, portrait A4) ─────

export async function rapportGrillePerformance(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const { classe_id, annee_scolaire_id, periode } = params;

  const [classeRaw, etab] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: classe_id, etablissement_id },
      include: { niveau: true, annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissement_id } }),
  ]);
  if (!classeRaw) throw new NotFoundError('Classe introuvable');

  const groupeGrille = classeRaw.niveau?.groupe_grille ?? 'AUTRE';
  // Seuils différents selon le groupe de niveau
  const isCI_CP   = groupeGrille === 'CI_CP';
  const seuilBas  = isCI_CP ? 7  : 5;   // < seuilBas = en-dessous
  const seuilHaut = isCI_CP ? 8  : 7;   // >= seuilHaut = maîtrise
  // Bandes : [< seuilBas], [seuilBas .. seuilHaut[, [>= seuilHaut]
  const bandeLabels = isCI_CP
    ? [`< ${seuilBas}/10`, `${seuilBas} et ${seuilHaut}/10`, `Seuil de maîtrise (≥ ${seuilHaut}/10)`]
    : [`< ${seuilBas}/10`, `${seuilBas} et ${seuilHaut}/10`, `Seuil de maîtrise (≥ ${seuilHaut}/10)`];
  // Domaines (seulement 3 : pas d'EPSA dans ces grilles)
  const domCodes3 = ['LANGUE_COMMUNICATION', 'MATHEMATIQUES', 'ESVS'];

  const [inscriptions, titulaireNom] = await Promise.all([
    fetchInscriptions(classe_id, annee_scolaire_id),
    getTitulaire(classe_id, annee_scolaire_id),
  ]);

  const eleveIds = inscriptions.map(i => i.eleve_id);
  const cfg = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { nb_periodes: true, note_max: true } });
  const nbPeriodes = cfg?.nb_periodes ?? 3;
  const baseNote = Number(cfg?.note_max ?? DEFAULT_NOTE_MAX);
  const periodes = periode && periode > 0 ? [periode] : Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const baremes = await getBaremesClasseCohorte(classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id), baseNote);
  const noteWhere: Record<string, unknown> = { eleve_id: { in: eleveIds }, annee_scolaire_id };
  if (periode && periode > 0) noteWhere.periode = periode;

  const notes = await prisma.note.findMany({
    where: noteWhere,
    include: { matiere: { include: { domaine: true } } },
  });

  // Moyenne par domaine par élève (normalisée sur /10)
  // Pour CE1-CE2 / CM1-CM2 : on sépare aussi Ressources et Compétence
  interface DomScore { all: number | null; res: number | null; comp: number | null }
  const domScores = new Map<string, Map<string, DomScore>>();

  const accByEleve = new Map<string, Map<string, { all: number[]; res: number[]; comp: number[] }>>();
  for (const note of notes) {
    const dCode   = note.matiere.domaine?.code;
    const typeNote = note.matiere.type_note;
    const noteMax  = baremes.get(`${note.matiere_id}|${note.periode}`)?.note_max ?? baseNote;
    const valNorm  = n10(Number(note.valeur), noteMax);
    if (!dCode || !domCodes3.includes(dCode)) continue;

    if (!accByEleve.has(note.eleve_id)) accByEleve.set(note.eleve_id, new Map());
    const em = accByEleve.get(note.eleve_id)!;
    if (!em.has(dCode)) em.set(dCode, { all: [], res: [], comp: [] });
    const bucket = em.get(dCode)!;
    bucket.all.push(valNorm);
    if (typeNote === 'RESSOURCE')  bucket.res.push(valNorm);
    if (typeNote === 'COMPETENCE') bucket.comp.push(valNorm);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  for (const [eid, em] of accByEleve) {
    domScores.set(eid, new Map());
    for (const [dc, b] of em) {
      domScores.get(eid)!.set(dc, { all: avg(b.all), res: avg(b.res), comp: avg(b.comp) });
    }
  }

  type Inscrip = (typeof inscriptions)[number];

  // Compte les élèves dans une bande de seuil pour un domaine / un type de score
  function countBande(subset: Inscrip[], dc: string, type: 'all' | 'res' | 'comp', low: number, high: number | null): number {
    return subset.filter(i => {
      const s = domScores.get(i.eleve_id)?.get(dc)?.[type];
      if (s === null || s === undefined) return false;
      return s >= low && (high === null || s < high);
    }).length;
  }

  const garcons = inscriptions.filter(i => i.eleve.sexe === 'M');
  const filles  = inscriptions.filter(i => i.eleve.sexe === 'F');

  const effectifG = garcons.length;
  const effectifF = filles.length;
  const effectifT = inscriptions.length;

  // Élèves présents = inscrits ayant au moins 1 note
  const presentIds = new Set(notes.map(n => n.eleve_id));
  const presentsG  = garcons.filter(i => presentIds.has(i.eleve_id)).length;
  const presentsF  = filles.filter(i => presentIds.has(i.eleve_id)).length;
  const presentsT  = presentsG + presentsF;

  const periodeLabel = periode && periode > 0 ? `${periode}ème Trimestre` : 'Annuel';
  const titreGrille  = isCI_CP ? 'CI-CP' : groupeGrille === 'CE1_CE2' ? 'CE1-CE2' : groupeGrille === 'CM1_CM2' ? 'CM1-CM2' : classeRaw.nom_fr;

  // Bandes de seuil : basse / milieu / haute
  const bandes = [
    { label: bandeLabels[0], low: 0,           high: seuilBas },
    { label: bandeLabels[1], low: seuilBas,     high: seuilHaut },
    { label: bandeLabels[2], low: seuilHaut,    high: null },
  ] as const;

  // Génère les lignes du tableau (Nombre ou %)
  function genRows(useRatio: boolean) {
    return bandes.map(({ label, low, high }) => {
      const cols = domCodes3.map(dc => {
        if (isCI_CP) {
          // Pas de split Ressources / Compétence
          const denom = (subset: Inscrip[]) => subset.filter(i => domScores.get(i.eleve_id)?.get(dc)?.all !== null).length;
          const g = countBande(garcons, dc, 'all', low, high);
          const f = countBande(filles,  dc, 'all', low, high);
          const t = g + f;
          if (useRatio) {
            const dg = denom(garcons); const df = denom(filles); const dt = dg + df;
            return `<td>${dg ? (g / dg * 100).toFixed(1) + '%' : '-'}</td><td>${df ? (f / df * 100).toFixed(1) + '%' : '-'}</td><td>${dt ? (t / dt * 100).toFixed(1) + '%' : '-'}</td>`;
          }
          return `<td>${g}</td><td>${f}</td><td>${t}</td>`;
        } else {
          // Avec split Ressources / Compétence
          const cell = (type: 'res' | 'comp') => {
            const denom = (sub: Inscrip[]) => sub.filter(i => domScores.get(i.eleve_id)?.get(dc)?.[type] !== null).length;
            const g = countBande(garcons, dc, type, low, high);
            const f = countBande(filles,  dc, type, low, high);
            const t = g + f;
            if (useRatio) {
              const dg = denom(garcons); const df = denom(filles); const dt = dg + df;
              return `<td>${dg ? (g / dg * 100).toFixed(1) + '%' : '-'}</td><td>${df ? (f / df * 100).toFixed(1) + '%' : '-'}</td><td>${dt ? (t / dt * 100).toFixed(1) + '%' : '-'}</td>`;
            }
            return `<td>${g}</td><td>${f}</td><td>${t}</td>`;
          };
          return cell('res') + cell('comp');
        }
      }).join('');
      return `<tr><td class="lbl">${esc(label)}</td>${cols}</tr>`;
    }).join('');
  }

  // En-tête du tableau : colonnes domaine + G/F/T (+ Ressources/Compétence pour CE1-CM2)
  const thDomaines = domCodes3.map(dc => {
    const nbCols = isCI_CP ? 3 : 6;
    return `<th colspan="${nbCols}" class="th-h">${esc(DOM_LABELS[dc] ?? dc)}</th>`;
  }).join('');
  const thSubCols = domCodes3.map(() => {
    if (isCI_CP) return '<th>G</th><th>F</th><th>T</th>';
    return '<th colspan="3">Ressources</th><th colspan="3">Compétence</th>';
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:9px;color:#000;padding:10mm 8mm;}
.etab{font-weight:bold;font-size:11px;margin-bottom:2px;}
.titre{text-align:center;font-size:12px;font-weight:bold;text-decoration:underline;margin:6px 0 4px;}
.info{font-size:9px;margin:2px 0;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:6px 0;}
table{width:100%;border-collapse:collapse;margin-bottom:8px;}
th,td{border:1px solid #000;padding:2.5px 3px;text-align:center;font-size:8.5px;}
.lbl{text-align:left;background:#f0f0f0;font-size:8.5px;font-weight:500;}
.th-h{background:#ddd;font-weight:bold;}
h3{font-size:9.5px;font-weight:bold;text-decoration:underline;margin:8px 0 3px;}
.analyse-domain{font-weight:bold;font-size:9px;margin:5px 0 2px;text-decoration:underline;}
.analyse-line{border-bottom:1px dotted #999;min-height:5mm;margin:1px 0;}
.sigs{display:flex;justify-content:center;margin-top:10mm;}
.sig{text-align:center;font-weight:bold;font-size:10px;}
</style></head><body>
<div class="etab">${esc(etab?.nom_fr ?? '')}</div>
<div class="titre">GRILLE D'ÉVALUATION — CLASSE ${esc(titreGrille)}</div>
<div class="info-grid">
  <div>
    <div class="info"><strong>Classe :</strong> ${esc(classeRaw.nom_fr)} &nbsp; <strong>Niveau :</strong> ${esc(classeRaw.niveau?.libelle ?? '...')}</div>
    <div class="info"><strong>Titulaire :</strong> ${esc(titulaireNom)}</div>
    <div class="info"><strong>Année scolaire :</strong> ${esc(classeRaw.annee_scolaire.libelle)} &nbsp; <strong>Période :</strong> ${esc(periodeLabel)}</div>
  </div>
  <div>
    <div class="info"><strong>EFFECTIF :</strong> G : ${effectifG} &nbsp; F : ${effectifF} &nbsp; T : ${effectifT}</div>
    <div class="info"><strong>PRÉSENTS :</strong> G : ${presentsG} &nbsp; F : ${presentsF} &nbsp; T : ${presentsT}</div>
  </div>
</div>

<h3>I. Nombre d'élèves selon le seuil de performance</h3>
<table>
  <thead>
    <tr><th class="lbl" rowspan="${isCI_CP ? 2 : 3}">SEUIL DE<br>PERFORMANCE</th>${thDomaines}</tr>
    ${isCI_CP
      ? `<tr>${thSubCols}</tr>`
      : `<tr>${domCodes3.map(() => '<th colspan="3">Ressources</th><th colspan="3">Compétence</th>').join('')}</tr>
         <tr>${domCodes3.map(() => '<th>G</th><th>F</th><th>T</th><th>G</th><th>F</th><th>T</th>').join('')}</tr>`
    }
  </thead>
  <tbody>${genRows(false)}</tbody>
</table>

<h3>II. Pourcentage des élèves selon le seuil de performance</h3>
<table>
  <thead>
    <tr><th class="lbl" rowspan="${isCI_CP ? 2 : 3}">SEUIL DE<br>PERFORMANCE</th>${thDomaines}</tr>
    ${isCI_CP
      ? `<tr>${thSubCols}</tr>`
      : `<tr>${domCodes3.map(() => '<th colspan="3">Ressources</th><th colspan="3">Compétence</th>').join('')}</tr>
         <tr>${domCodes3.map(() => '<th>G</th><th>F</th><th>T</th><th>G</th><th>F</th><th>T</th>').join('')}</tr>`
    }
  </thead>
  <tbody>${genRows(true)}</tbody>
</table>

<h3>Analyse des résultats</h3>
${domCodes3.map(dc => `<div class="analyse-domain">${esc(DOM_LABELS[dc] ?? dc)} :</div><div class="analyse-line"></div><div class="analyse-line"></div>`).join('')}

<div class="sigs"><div class="sig">Le (La) Maître(sse)</div></div>
</body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: `grille-perf-${titreGrille}-T${periode ?? 'annuel'}.pdf` };
}

// ─── Rapport Performance par Domaine (paysage A4) ────────────────────────────

export async function rapportPerformanceDomaine(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const { classe_id, annee_scolaire_id, periode } = params;

  const [classeRaw, etab] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: classe_id, etablissement_id },
      include: { annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissement_id } }),
  ]);
  if (!classeRaw) throw new NotFoundError('Classe introuvable');

  const [inscriptions, titulaireNom] = await Promise.all([
    fetchInscriptions(classe_id, annee_scolaire_id),
    getTitulaire(classe_id, annee_scolaire_id),
  ]);

  // Grille restreinte à 3 colonnes : Langue & communication (FR), (AR) et
  // Mathématiques. Le domaine LANGUE_COMMUNICATION est scindé par filière.
  const COLS = [
    { key: 'LC_FR', label: 'Langue & communication (FR)' },
    { key: 'LC_AR', label: 'Langue & communication (AR)' },
    { key: 'MATHS', label: 'Mathématiques' },
  ] as const;
  const colKeys: string[] = COLS.map(c => c.key);
  const colForNote = (note: { matiere: { filiere: string; domaine: { code: string } | null } }): string | null => {
    const dc = note.matiere.domaine?.code;
    if (dc === 'MATHEMATIQUES') return 'MATHS';
    if (dc === 'LANGUE_COMMUNICATION') return note.matiere.filiere === 'AR' ? 'LC_AR' : 'LC_FR';
    return null;
  };

  const eleveIds = inscriptions.map(i => i.eleve_id);
  const cfg = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { nb_periodes: true, note_max: true } });
  const nbPeriodes = cfg?.nb_periodes ?? 3;
  const baseNote = Number(cfg?.note_max ?? DEFAULT_NOTE_MAX);
  const periodes = periode && periode > 0 ? [periode] : Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const baremes = await getBaremesClasseCohorte(classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id), baseNote);
  const noteWhere: Record<string, unknown> = { eleve_id: { in: eleveIds }, annee_scolaire_id };
  if (periode && periode > 0) noteWhere.periode = periode;

  const notes = await prisma.note.findMany({
    where: noteWhere,
    include: { matiere: { include: { domaine: true } } },
  });

  // Score par colonne par élève (normalisé /10 via le barème effectif)
  const acc = new Map<string, Map<string, number[]>>();
  for (const note of notes) {
    const col = colForNote(note);
    if (!col) continue;
    const bar = baremes.get(`${note.matiere_id}|${note.periode}`)?.note_max ?? baseNote;
    const nm = n10(Number(note.valeur), bar);
    if (!acc.has(note.eleve_id)) acc.set(note.eleve_id, new Map());
    const dm = acc.get(note.eleve_id)!;
    if (!dm.has(col)) dm.set(col, []);
    dm.get(col)!.push(nm);
  }

  // Construire les lignes élèves
  const rows = inscriptions.map(i => {
    const dm = acc.get(i.eleve_id);
    const domAvgs = colKeys.map(ck => {
      const vals = dm?.get(ck);
      return vals?.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    });
    const nonNull = domAvgs.filter((v): v is number => v !== null);
    const total   = nonNull.reduce((s, v) => s + v, 0);
    const moy     = nonNull.length ? total / nonNull.length : null;
    return { eleve: i.eleve, domAvgs, total: nonNull.length ? total : null, moy };
  }).sort((a, b) => (b.moy ?? -1) - (a.moy ?? -1));

  // Rang
  const rowsRanked = rows.map((r, idx) => ({ ...r, rang: r.moy !== null ? idx + 1 : '—' }));

  // Stats par colonne (sur les valeurs normalisées)
  const domStats = colKeys.map(ck => {
    const vals = rows.map(r => r.domAvgs[colKeys.indexOf(ck)]).filter((v): v is number => v !== null);
    if (!vals.length) return { min: null, max: null, freq: null, moy: null };
    const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
    return {
      min:  Math.min(...vals),
      max:  Math.max(...vals),
      freq: modeOf(vals),
      moy,
    };
  });

  const allMoys     = rows.map(r => r.moy).filter((v): v is number => v !== null);
  const moyClasse   = allMoys.length ? allMoys.reduce((s, v) => s + v, 0) / allMoys.length : 0;
  const nbAvecMoy   = allMoys.filter(v => v >= moyClasse).length;
  const ecartTypeV  = stdDev(allMoys);
  const periodeLabel = periode && periode > 0 ? `${periode}ème Trimestre` : 'Annuel';

  const fmt  = (v: number | null) => v === null ? '—' : v.toFixed(2);

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:9px;color:#000;padding:8mm 10mm;}
.header-line{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;}
.etab{font-size:10px;font-weight:bold;}
.annee{font-size:9px;}
.titre{text-align:center;font-size:12px;font-weight:bold;text-decoration:underline;margin:6px 0 2px;}
.sous-titre{text-align:center;font-size:9px;margin-bottom:6px;}
.meta{display:grid;grid-template-columns:1fr 1fr;font-size:9px;margin-bottom:6px;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #000;padding:2.5px 3px;text-align:center;font-size:8.5px;}
th{background:#d0d0d0;font-weight:bold;}
.lbl{text-align:left;}
.ok{color:#1a7a1a;font-weight:bold;}
.nok{color:#b30000;}
.stat-row td{background:#ececec;font-size:8px;font-style:italic;}
.footer{font-size:9px;margin-top:6px;}
.sigs{display:flex;justify-content:space-around;margin-top:10mm;font-weight:bold;font-size:10px;}
</style></head><body>
<div class="header-line">
  <div class="etab">${esc(etab?.nom_fr ?? '')}</div>
  <div class="annee">Année scolaire : ${esc(classeRaw.annee_scolaire.libelle)}</div>
</div>
<div class="titre">PERFORMANCE PAR DOMAINE D'ÉTUDE — ${esc(periodeLabel)}</div>
<div class="sous-titre">${esc(etab?.nom_fr ?? '')}</div>
<div class="meta">
  <span><strong>Classe :</strong> ${esc(classeRaw.nom_fr)}</span>
  <span><strong>Tenu par :</strong> ${esc(titulaireNom)}</span>
</div>
<table>
  <thead>
    <tr>
      <th>N°</th>
      <th>PRÉNOM(S) &amp; NOM</th>
      ${COLS.map(c => `<th>${esc(c.label)}</th>`).join('')}
      <th>TOTAL</th>
      <th>MOYENNE</th>
      <th>RANG</th>
    </tr>
  </thead>
  <tbody>
    ${rowsRanked.map((r, i) => {
      const m = r.moy;
      const cls = m === null ? '' : m >= moyClasse ? 'ok' : 'nok';
      return `<tr>
        <td>${i + 1}</td>
        <td class="lbl">${esc(r.eleve.prenom_fr)} ${esc(r.eleve.nom_fr)}</td>
        ${r.domAvgs.map(v => `<td>${fmt(v)}</td>`).join('')}
        <td>${fmt(r.total)}</td>
        <td class="${cls}">${fmt(m)}</td>
        <td>${r.rang}</td>
      </tr>`;
    }).join('')}
    <tr class="stat-row">
      <td colspan="2" class="lbl">Note la plus faible</td>
      ${domStats.map(s => `<td>${fmt(s.min)}</td>`).join('')}<td colspan="3"></td>
    </tr>
    <tr class="stat-row">
      <td colspan="2" class="lbl">Note la plus forte</td>
      ${domStats.map(s => `<td>${fmt(s.max)}</td>`).join('')}<td colspan="3"></td>
    </tr>
    <tr class="stat-row">
      <td colspan="2" class="lbl">Note la plus fréquente</td>
      ${domStats.map(s => `<td>${fmt(s.freq)}</td>`).join('')}<td colspan="3"></td>
    </tr>
    <tr class="stat-row">
      <td colspan="2" class="lbl">Note moyenne</td>
      ${domStats.map(s => `<td>${fmt(s.moy)}</td>`).join('')}<td colspan="3"></td>
    </tr>
  </tbody>
</table>
<div class="footer">
  * ${nbAvecMoy} élève(s) ont réalisé la moyenne de la classe (${moyClasse.toFixed(2)}) &nbsp;|&nbsp;
  Écart type de la classe : ${ecartTypeV.toFixed(2)}
</div>
<div class="sigs">
  <div>LA MAÎTRESSE / LE MAÎTRE</div>
  <div>LE DIRECTEUR</div>
</div>
</body></html>`;

  const buffer = await renderPdfHtml(html, {
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
  });
  return { buffer, mime: 'application/pdf', filename: `perf-domaine-${classeRaw.nom_fr}-T${periode ?? 'annuel'}.pdf` };
}

// ─── Rapport Relevé de Notes (paysage A4) ────────────────────────────────────

export async function rapportReleveNotes(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const { classe_id, annee_scolaire_id, periode } = params;

  const [classeRaw, etab] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: classe_id, etablissement_id },
      include: { annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissement_id } }),
  ]);
  if (!classeRaw) throw new NotFoundError('Classe introuvable');

  const [inscriptions, classeMatieres, titulaireNom] = await Promise.all([
    fetchInscriptions(classe_id, annee_scolaire_id),
    prisma.classeMatiere.findMany({
      where: { classe_id },
      include: { matiere: { select: { id: true, nom_fr: true, nom_ar: true, code_court: true, ordre_bulletin: true, note_max: true } } },
      // Ordre du Programme (réorganisation par classe) puis ordre_bulletin — identique à
      // la saisie et au relevé « documents », pour que le prof retrouve le même ordre.
      orderBy: [{ ordre_override: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
    }),
    getTitulaire(classe_id, annee_scolaire_id),
  ]);

  const cfg = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { nb_periodes: true, note_max: true } });
  const baseNote = Number(cfg?.note_max ?? DEFAULT_NOTE_MAX);
  // Barème effectif par matière = override de classe si présent, sinon échelle établissement.
  const matieres = classeMatieres.map(cm => ({ ...cm.matiere, note_max_eff: Number(cm.note_max_override ?? cm.matiere.note_max ?? baseNote) }));
  const eleveIds = inscriptions.map(i => i.eleve_id);
  const nbPeriodes = cfg?.nb_periodes ?? 3;
  const periodes = periode && periode > 0 ? [periode] : Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const moyennes = await calculerMoyennesClasse(etablissement_id, classe_id, annee_scolaire_id, periodes, await filieresActivesCodes(etablissement_id));
  const noteWhere: Record<string, unknown> = {
    eleve_id: { in: eleveIds },
    annee_scolaire_id,
    matiere_id: { in: matieres.map(m => m.id) },
  };
  if (periode && periode > 0) noteWhere.periode = periode;

  const notes = await prisma.note.findMany({ where: noteWhere });

  // Index notes : eleveId → matiereId → valeur
  const noteIdx = new Map<string, Map<string, number>>();
  for (const note of notes) {
    if (!noteIdx.has(note.eleve_id)) noteIdx.set(note.eleve_id, new Map());
    noteIdx.get(note.eleve_id)!.set(note.matiere_id, Number(note.valeur));
  }

  // Calcul rang par moyenne générale
  const rows = inscriptions.map(i => {
    const nm = noteIdx.get(i.eleve_id);
    const vals = matieres.map(m => nm?.get(m.id) ?? null);
    const nonNull = vals.filter((v): v is number => v !== null);
    const total   = nonNull.reduce((s, v) => s + v, 0);
    // Moyenne générale = calcul pondéré/normalisé du bulletin (et non somme brute).
    const moy     = moyennes.get(i.eleve_id) ?? null;
    return { eleve: i.eleve, vals, total: nonNull.length ? total : null, moy };
  }).sort((a, b) => (b.moy ?? -1) - (a.moy ?? -1));

  const rowsRanked = rows.map((r, idx) => ({ ...r, rang: r.moy !== null ? idx + 1 : '—' }));

  // Statistiques par matière
  const matStats = matieres.map((m, mi) => {
    const vals = rows.map(r => r.vals[mi]).filter((v): v is number => v !== null);
    if (!vals.length) return { eff: 0, comp: 0, ontMoy: 0, max: null, min: null, moy: null, txR: 0, txE: 0 };
    const moy        = vals.reduce((s, v) => s + v, 0) / vals.length;
    const demi       = m.note_max_eff / 2;
    const ontMoy     = vals.filter(v => v >= demi).length;
    return {
      eff:   rows.length,
      comp:  vals.length,
      ontMoy,
      max:   Math.max(...vals),
      min:   Math.min(...vals),
      moy,
      txR:   vals.length ? Math.round((ontMoy / vals.length) * 1000) / 10 : 0,
      txE:   vals.length ? Math.round(((vals.length - ontMoy) / vals.length) * 1000) / 10 : 0,
    };
  });

  const periodeLabel = periode && periode > 0 ? `${periode}ème Trimestre` : 'Annuel';
  const fmtVal = (v: number | null) => v === null ? '' : v.toFixed(2);

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:8px;color:#000;padding:7mm 8mm;}
.header{display:flex;justify-content:space-between;margin-bottom:4px;}
.titre{text-align:center;font-size:11px;font-weight:bold;text-decoration:underline;margin:4px 0;}
.meta{display:flex;gap:20px;font-size:8.5px;margin-bottom:6px;justify-content:center;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #333;padding:2px 2px;text-align:center;font-size:7.5px;}
th{background:#ccc;font-weight:bold;}
.lbl{text-align:left;font-size:7.5px;}
.stat-row{background:#ececec;font-style:italic;font-size:7px;}
.sigs{display:flex;justify-content:space-around;margin-top:8mm;font-weight:bold;font-size:9.5px;}
</style></head><body>
<div class="header">
  <div style="font-weight:bold;font-size:10px">${esc(etab?.nom_fr ?? '')}</div>
  <div style="font-size:8.5px">Année scolaire : ${esc(classeRaw.annee_scolaire.libelle)}</div>
</div>
<div class="titre">RELEVÉ DE NOTES — ${esc(periodeLabel)}</div>
<div class="meta">
  <span><strong>Classe :</strong> ${esc(classeRaw.nom_fr)}</span>
  <span><strong>Tenu par :</strong> ${esc(titulaireNom)}</span>
  <span><strong>École :</strong> ${esc(etab?.nom_fr ?? '')}</span>
</div>
<table>
  <thead>
    <tr>
      <th>N°</th>
      <th class="lbl">Prénom &amp; Nom</th>
      ${matieres.map(m => `<th>${esc(m.code_court ?? m.nom_fr.substring(0, 5))}</th>`).join('')}
      <th>Total</th>
      <th>Moy</th>
      <th>Rang</th>
    </tr>
  </thead>
  <tbody>
    ${rowsRanked.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td class="lbl">${esc(r.eleve.prenom_fr)} ${esc(r.eleve.nom_fr)}</td>
      ${r.vals.map(v => `<td>${fmtVal(v)}</td>`).join('')}
      <td>${fmtVal(r.total)}</td>
      <td>${fmtVal(r.moy)}</td>
      <td>${r.rang}</td>
    </tr>`).join('')}
    <tr class="stat-row"><td colspan="2" class="lbl">Effectif</td>${matStats.map(s => `<td>${s.eff}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Ont composé</td>${matStats.map(s => `<td>${s.comp}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Ont la moyenne</td>${matStats.map(s => `<td>${s.ontMoy}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Plus forte moy.</td>${matStats.map(s => `<td>${fmtVal(s.max)}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Plus faible moy.</td>${matStats.map(s => `<td>${fmtVal(s.min)}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Moyenne classe</td>${matStats.map(s => `<td>${fmtVal(s.moy)}</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Taux réussite (%)</td>${matStats.map(s => `<td>${s.txR}%</td>`).join('')}<td colspan="3"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Taux échec (%)</td>${matStats.map(s => `<td>${s.txE}%</td>`).join('')}<td colspan="3"></td></tr>
  </tbody>
</table>
<div class="sigs">
  <div>LA MAÎTRESSE / LE MAÎTRE</div>
  <div>LE DIRECTEUR</div>
</div>
</body></html>`;

  const buffer = await renderPdfHtml(html, {
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '7mm', bottom: '7mm', left: '7mm', right: '7mm' },
  });
  return { buffer, mime: 'application/pdf', filename: `releve-notes-${classeRaw.nom_fr}-T${periode ?? 'annuel'}.pdf` };
}

// ─── Rapport Propositions de Fin d'Année / Conseil de Classe (paysage A4) ────

export async function rapportPropositionsFin(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string },
) {
  const { classe_id, annee_scolaire_id } = params;

  const [classeRaw, etab] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: classe_id, etablissement_id },
      include: { annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissement_id } }),
  ]);
  if (!classeRaw) throw new NotFoundError('Classe introuvable');

  const [inscriptions, titulaireNom] = await Promise.all([
    fetchInscriptions(classe_id, annee_scolaire_id),
    getTitulaire(classe_id, annee_scolaire_id),
  ]);

  const eleveIds = inscriptions.map(i => i.eleve_id);

  // Bulletins pour T1, T2, T3 (et annuel = période 4 si existe)
  const bulletins = await prisma.bulletin.findMany({
    where: { eleve_id: { in: eleveIds }, annee_scolaire_id, filiere: classeRaw.filiere },
    select: { eleve_id: true, periode: true, moyenne: true },
  });

  // Progressions (décision déjà saisie)
  const progressions = await prisma.progressionEleve.findMany({
    where: { eleve_id: { in: eleveIds }, annee_scolaire_id },
    select: { eleve_id: true, decision: true, validee: true },
  });

  // Index bulletins : eleveId → periode → moyenne
  const bulIdx = new Map<string, Map<number, number>>();
  for (const b of bulletins) {
    if (!bulIdx.has(b.eleve_id)) bulIdx.set(b.eleve_id, new Map());
    bulIdx.get(b.eleve_id)!.set(b.periode, Number(b.moyenne ?? 0));
  }
  // Index progressions : eleveId → decision
  const progIdx = new Map(progressions.map(p => [p.eleve_id, p]));

  // Si pas de bulletins générés, on calcule depuis les notes
  const notesParEleve = await prisma.note.findMany({
    where: { eleve_id: { in: eleveIds }, annee_scolaire_id },
    select: { eleve_id: true, periode: true, valeur: true },
  });
  const notesPeriodeIdx = new Map<string, Map<number, number[]>>();
  for (const n of notesParEleve) {
    if (!notesPeriodeIdx.has(n.eleve_id)) notesPeriodeIdx.set(n.eleve_id, new Map());
    const pm = notesPeriodeIdx.get(n.eleve_id)!;
    if (!pm.has(n.periode)) pm.set(n.periode, []);
    pm.get(n.periode)!.push(Number(n.valeur));
  }

  const getMoy = (eleveId: string, periode: number): number | null => {
    // Priorité : bulletin généré
    const fromBul = bulIdx.get(eleveId)?.get(periode);
    if (fromBul !== undefined && fromBul > 0) return fromBul;
    // Sinon : calcul depuis notes
    const vals = notesPeriodeIdx.get(eleveId)?.get(periode);
    if (!vals || !vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const DECISION_LABELS: Record<string, string> = {
    admis:       'Admis(e)',
    redoublant:  'Redoublant(e)',
    transfere:   'Transféré(e)',
    exclu:       'Exclu(e)',
  };

  const rows = inscriptions.map(i => {
    const t1  = getMoy(i.eleve_id, 1);
    const t2  = getMoy(i.eleve_id, 2);
    const t3  = getMoy(i.eleve_id, 3);
    const nonNull = [t1, t2, t3].filter((v): v is number => v !== null);
    const ann = nonNull.length ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length : null;
    // La décision n'apparaît que si elle a été VALIDÉE en conseil de classe
    // (module Progression). Sinon la case reste vide (à statuer pendant le conseil).
    const prog = progIdx.get(i.eleve_id);
    const decision = prog?.validee ? (DECISION_LABELS[prog.decision] ?? prog.decision) : '';
    return { eleve: i.eleve, t1, t2, t3, ann, decision };
  });

  const fmt = (v: number | null) => v === null ? '—' : v.toFixed(2);
  const age = (v: Date) => Math.floor((Date.now() - new Date(v).getTime()) / 31557600000);

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:9px;color:#000;padding:8mm 10mm;}
.header{display:flex;justify-content:space-between;margin-bottom:4px;}
.titre{text-align:center;font-size:12px;font-weight:bold;text-decoration:underline;margin:6px 0 4px;}
.meta{display:grid;grid-template-columns:1fr 1fr;font-size:9px;margin-bottom:6px;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #000;padding:3px 3px;text-align:center;font-size:8.5px;}
th{background:#d0d0d0;font-weight:bold;}
.lbl{text-align:left;}
.sigs{display:flex;justify-content:space-around;margin-top:12mm;font-weight:bold;font-size:10px;}
</style></head><body>
<div class="header">
  <div style="font-weight:bold;font-size:11px">${esc(etab?.nom_fr ?? '')}</div>
  <div style="font-size:9px">Année scolaire : ${esc(classeRaw.annee_scolaire.libelle)}</div>
</div>
<div class="titre">PROPOSITIONS DE FIN D'ANNÉE</div>
<div class="meta">
  <span><strong>Classe :</strong> ${esc(classeRaw.nom_fr)}</span>
  <span><strong>Tenu par :</strong> ${esc(titulaireNom)}</span>
</div>
<table>
  <thead>
    <tr>
      <th>N°</th>
      <th class="lbl">PRÉNOM(S)</th>
      <th class="lbl">NOM</th>
      <th>ÂGE</th>
      <th>MOY. T1</th>
      <th>MOY. T2</th>
      <th>MOY. T3</th>
      <th>SITUATION<br>ANNUELLE</th>
      <th>CLASSE(S)<br>REDOUBLÉE(S)</th>
      <th>DÉCISION DU C.M.</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td class="lbl">${esc(r.eleve.prenom_fr)}</td>
      <td class="lbl">${esc(r.eleve.nom_fr)}</td>
      <td>${age(r.eleve.date_naissance)} ans</td>
      <td>${fmt(r.t1)}</td>
      <td>${fmt(r.t2)}</td>
      <td>${fmt(r.t3)}</td>
      <td><strong>${fmt(r.ann)}</strong></td>
      <td></td>
      <td>${esc(r.decision)}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="sigs">
  <div>LA MAÎTRESSE / LE MAÎTRE</div>
  <div>LE DIRECTEUR</div>
</div>
</body></html>`;

  const buffer = await renderPdfHtml(html, {
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
  });
  return { buffer, mime: 'application/pdf', filename: `propositions-fin-${classeRaw.nom_fr}.pdf` };
}

// ─── Aperçus HTML ─────────────────────────────────────────────────────────────
// Chaque fonction force le format PDF, capture le HTML via AsyncLocalStorage,
// et le renvoie sans passer par Puppeteer.

export async function apercuPresencesEleves(
  etablissement_id: string,
  params: { classe_id?: string; annee_scolaire_id?: string; mois?: number; annee?: number },
) {
  const html = await capturePreviewHtml(() =>
    rapportPresencesEleves(etablissement_id, { ...params, format: 'pdf' }),
  );
  return { html };
}

export async function apercuPresencesPersonnel(
  etablissement_id: string,
  params: { mois?: number; annee?: number },
) {
  const html = await capturePreviewHtml(() =>
    rapportPresencesPersonnel(etablissement_id, { ...params, format: 'pdf' }),
  );
  return { html };
}

export async function apercuResultatsClasse(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const html = await capturePreviewHtml(() =>
    rapportResultatsClasse(etablissement_id, { ...params, format: 'pdf' }),
  );
  return { html };
}

export async function apercuBilanFinancier(
  etablissement_id: string,
  params: { mois?: number; annee?: number },
) {
  const html = await capturePreviewHtml(() =>
    rapportBilanFinancier(etablissement_id, { ...params, format: 'pdf' }),
  );
  return { html };
}

export async function apercuGrilleIef(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const html = await capturePreviewHtml(() => rapportGrilleIef(etablissement_id, params));
  return { html };
}

export async function apercuGrillePerformance(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const html = await capturePreviewHtml(() => rapportGrillePerformance(etablissement_id, params));
  return { html };
}

export async function apercuPerformanceDomaine(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const html = await capturePreviewHtml(() => rapportPerformanceDomaine(etablissement_id, params));
  return { html };
}

export async function apercuReleveNotes(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number },
) {
  const html = await capturePreviewHtml(() => rapportReleveNotes(etablissement_id, params));
  return { html };
}

export async function apercuPropositionsFin(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string },
) {
  const html = await capturePreviewHtml(() => rapportPropositionsFin(etablissement_id, params));
  return { html };
}

// ─── Rapport charges horaires personnel ─────────────────────────────────────
// Agrège Creneau par personnel pour calculer les heures hebdomadaires.
// Donnée RH critique pour le suivi de service / paie horaire des vacataires.

function dureeHeures(heureDebut: string, heureFin: string): number {
  // Format "HH:MM" → fraction d'heure (ex. "08:00" → "10:30" = 2.5)
  const [hd, md] = heureDebut.split(':').map(Number);
  const [hf, mf] = heureFin.split(':').map(Number);
  if ([hd, md, hf, mf].some(n => Number.isNaN(n))) return 0;
  return Math.max(0, (hf * 60 + mf - hd * 60 - md) / 60);
}

export async function rapportChargesPersonnel(
  etablissement_id: string,
  params: { annee_scolaire_id: string; format: string },
) {
  const { annee_scolaire_id, format } = params;

  const creneaux = await prisma.creneau.findMany({
    where: { etablissement_id, annee_scolaire_id },
    include: {
      personnel: { include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
      matiere: { select: { nom_fr: true } },
      classe:  { select: { nom_fr: true } },
    },
  });

  type Agg = {
    personnel_id: string;
    nom: string;
    prenom: string;
    heuresHebdo: number;
    nbCreneaux: number;
    matieres: Set<string>;
    classes: Set<string>;
  };
  const agg = new Map<string, Agg>();

  for (const c of creneaux) {
    const h = dureeHeures(c.heure_debut, c.heure_fin);
    const key = c.personnel_id;
    if (!agg.has(key)) {
      agg.set(key, {
        personnel_id: key,
        nom: c.personnel.utilisateur.nom_fr,
        prenom: c.personnel.utilisateur.prenom_fr ?? '',
        heuresHebdo: 0,
        nbCreneaux: 0,
        matieres: new Set(),
        classes: new Set(),
      });
    }
    const a = agg.get(key)!;
    a.heuresHebdo += h;
    a.nbCreneaux += 1;
    a.matieres.add(c.matiere.nom_fr);
    a.classes.add(c.classe.nom_fr);
  }

  const lignes = Array.from(agg.values()).sort((x, y) => y.heuresHebdo - x.heuresHebdo);

  if (format === 'csv') {
    const rows = [
      csvRow(['Nom', 'Prénom', 'Heures hebdo', 'Nb créneaux', 'Matières', 'Classes']),
      ...lignes.map(l => csvRow([
        l.nom, l.prenom,
        l.heuresHebdo.toFixed(2),
        l.nbCreneaux,
        Array.from(l.matieres).join(' / '),
        Array.from(l.classes).join(' / '),
      ])),
    ];
    return { buffer: Buffer.from(rows.join('\n'), 'utf-8'), mime: 'text/csv', filename: 'charges-personnel.csv' };
  }

  const totalHeures = lignes.reduce((s, l) => s + l.heuresHebdo, 0);

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:18px;margin-bottom:4px;}
  .sub{color:#666;font-size:11px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f3f3;text-align:left;padding:6px 8px;font-size:11px;border-bottom:2px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  .total{font-weight:600;background:#fafafa;}
</style></head><body>
<h1>Charges horaires hebdomadaires du personnel enseignant</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} — ${lignes.length} personne(s) — Total ${totalHeures.toFixed(1)} h hebdo</div>
<table>
<thead><tr><th>Personnel</th><th class="num">H. hebdo</th><th class="num">Créneaux</th><th>Matières</th><th>Classes</th></tr></thead>
<tbody>
${lignes.map(l => `<tr>
  <td>${esc(l.nom)} ${esc(l.prenom)}</td>
  <td class="num">${l.heuresHebdo.toFixed(2)} h</td>
  <td class="num">${l.nbCreneaux}</td>
  <td>${Array.from(l.matieres).map(esc).join(', ')}</td>
  <td>${Array.from(l.classes).map(esc).join(', ')}</td>
</tr>`).join('')}
<tr class="total"><td>Total</td><td class="num">${totalHeures.toFixed(2)} h</td><td class="num">${creneaux.length}</td><td colspan="2"></td></tr>
</tbody></table></body></html>`;

  const buffer = await renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  return { buffer, mime: 'application/pdf', filename: 'charges-personnel.pdf' };
}

export async function apercuChargesPersonnel(
  etablissement_id: string,
  params: { annee_scolaire_id: string },
) {
  const html = await capturePreviewHtml(() =>
    rapportChargesPersonnel(etablissement_id, { ...params, format: 'pdf' }),
  );
  return { html };
}
