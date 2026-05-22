import prisma from '../../config/database';
import { renderPdfHtml } from '../../utils/browserPool';

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

// ─── Rapport présences professeurs ──────────────────────────────────────────

export async function rapportPresencesProfesseurs(
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
    return { buffer: Buffer.from(lines.join('\n'), 'utf-8'), mime: 'text/csv', filename: 'presences-professeurs.csv' };
  }

  const titre = `Rapport de présences professeurs${mois && annee ? ` — ${MOIS_LABELS[mois-1]} ${annee}` : ''}`;
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
  return { buffer, mime: 'application/pdf', filename: 'presences-professeurs.pdf' };
}

// ─── Rapport résultats classe ────────────────────────────────────────────────

export async function rapportResultatsClasse(
  etablissement_id: string,
  params: { classe_id: string; annee_scolaire_id: string; periode?: number; format: string },
) {
  const { classe_id, annee_scolaire_id, periode, format } = params;

  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  const inscriptions = await prisma.inscription.findMany({
    where: {
      annee_scolaire_id,
      statut: 'actif',
      OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
    },
    include: { eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } } },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });

  const noteWhere: Record<string, unknown> = {
    eleve_id: { in: inscriptions.map(i => i.eleve_id) },
    annee_scolaire_id,
  };
  if (periode !== undefined && periode > 0) noteWhere.periode = periode;

  const notes = await prisma.note.findMany({
    where: noteWhere,
    include: { matiere: { select: { nom_fr: true } } },
  });

  // Grouper par élève
  const notesParEleve = new Map<string, { moyenne: number; nb: number }>();
  const groupes = notes.reduce((acc, n) => {
    if (!acc.has(n.eleve_id)) acc.set(n.eleve_id, []);
    acc.get(n.eleve_id)!.push(Number(n.valeur));
    return acc;
  }, new Map<string, number[]>());

  for (const [eleve_id, vals] of groupes) {
    const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
    notesParEleve.set(eleve_id, { moyenne: Math.round(moy * 100) / 100, nb: vals.length });
  }

  const rows = inscriptions.map(i => ({
    matricule: i.eleve.matricule,
    nom: `${i.eleve.nom_fr} ${i.eleve.prenom_fr}`,
    ...notesParEleve.get(i.eleve_id) ?? { moyenne: null, nb: 0 },
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
  const cls = m === null ? '' : m >= 10 ? 'ok' : 'nok';
  const app = m === null ? '—' : m >= 16 ? 'Très bien' : m >= 14 ? 'Bien' : m >= 12 ? 'Assez bien' : m >= 10 ? 'Passable' : 'Insuffisant';
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
      ['Total versé (professeurs)', totalVersé, devise],
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
  <div class="kpi"><div class="kpi-label">Versé profs</div><div class="kpi-val red">${totalVersé.toLocaleString('fr-FR')} ${devise}</div></div>
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
<h2>Versements professeurs (${paiementsProfs.length})</h2>
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
