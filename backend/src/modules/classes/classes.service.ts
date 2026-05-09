import prisma from '../../config/database';
import { ClasseInput } from './classes.schema';

type ListeData = Awaited<ReturnType<typeof listerElevesDeClasse>>;

const LISTE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #10B981; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 700; color: #10B981; letter-spacing: 0.5px; }
  .header h2 { font-size: 14px; font-weight: 600; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  thead tr { background: #10B981; color: white; }
  thead th { padding: 7px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f0fdf4; }
  td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  td:first-child { text-align: center; color: #6b7280; font-size: 10px; font-weight: 600; }
  .mono { font-family: monospace; font-size: 10px; color: #374151; }
  .center { text-align: center; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
  .signature-box { text-align: center; font-size: 10px; color: #374151; }
  .signature-line { border-top: 1px solid #374151; width: 160px; margin: 30px auto 4px; }
  @page { size: A4; margin: 0; }
`;

export async function listerClasses(etablissement_id: string, annee_scolaire_id?: string) {
  return prisma.classe.findMany({
    where: {
      etablissement_id,
      active: true,
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
    },
    include: { annee_scolaire: true },
    orderBy: [{ filiere: 'asc' }, { niveau: 'asc' }, { nom_fr: 'asc' }],
  });
}

export async function getClasse(id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({
    where: { id, etablissement_id },
    include: { annee_scolaire: true },
  });
  if (!classe) throw new Error('Classe introuvable');
  return classe;
}

export async function creerClasse(etablissement_id: string, data: ClasseInput) {
  return prisma.classe.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite ?? 30,
    },
  });
}

export async function modifierClasse(id: string, etablissement_id: string, data: ClasseInput) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite,
    },
  });
}

export async function supprimerClasse(id: string, etablissement_id: string) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({ where: { id }, data: { active: false } });
}

export async function listerElevesDeClasse(
  classe_id: string,
  etablissement_id: string,
  annee_scolaire_id?: string
) {
  const classe = await prisma.classe.findFirst({
    where: { id: classe_id, etablissement_id },
    include: { annee_scolaire: true },
  });
  if (!classe) throw new Error('Classe introuvable');

  const inscriptions = await prisma.inscription.findMany({
    where: {
      OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      ...(annee_scolaire_id ? { annee_scolaire_id } : { annee_scolaire_id: classe.annee_scolaire_id }),
      eleve: { etablissement_id, actif: true },
    },
    include: {
      eleve: { include: { parents: true } },
      annee_scolaire: true,
      classe_fr: true,
      classe_ar: true,
    },
    orderBy: [{ eleve: { nom_fr: 'asc' } }, { eleve: { prenom_fr: 'asc' } }],
  });

  return {
    classe,
    total: inscriptions.length,
    eleves: inscriptions.map((i, idx) => ({
      rang: idx + 1,
      ...i.eleve,
      annee_scolaire: i.annee_scolaire,
      classe_fr: i.classe_fr,
      classe_ar: i.classe_ar,
    })),
  };
}

// ─── PDF liste élèves ────────────────────────────────────────────────────────

function buildListeBodyContent(data: ListeData, etablissementNom: string): string {
  const { classe, eleves, total } = data;
  const anneeLabel = (classe.annee_scolaire as { libelle: string })?.libelle ?? '';
  const filiereLabel = classe.filiere === 'FR' ? 'Filière Française' : 'Filière Arabe';
  const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nbM = eleves.filter((e: { sexe: string }) => e.sexe === 'M').length;
  const nbF = total - nbM;
  const badgeBg = classe.filiere === 'FR' ? '#dbeafe' : '#d1fae5';
  const badgeColor = classe.filiere === 'FR' ? '#1e40af' : '#065f46';

  const rows = eleves.map((e: {
    matricule: string; nom_fr: string; prenom_fr: string; sexe: string;
    date_naissance: Date | null; parents?: { nom_fr: string; telephone: string }[];
  }, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="mono">${e.matricule}</td>
      <td>${e.nom_fr}</td>
      <td>${e.prenom_fr}</td>
      <td class="center">${e.sexe === 'M' ? 'M' : 'F'}</td>
      <td>${e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
      <td>${e.parents?.[0]?.nom_fr ?? '—'}</td>
      <td class="mono">${e.parents?.[0]?.telephone ?? '—'}</td>
    </tr>`).join('');

  return `
  <div class="header">
    <h1>${etablissementNom}</h1>
    <h2>Liste des élèves — ${classe.nom_fr}</h2>
    <div class="meta">
      <span>Année scolaire : <strong>${anneeLabel}</strong></span>
      <span class="badge" style="background:${badgeBg};color:${badgeColor}">${filiereLabel}</span>
      <span>Niveau : <strong>${classe.niveau || '—'}</strong></span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px">N°</th>
        <th>Matricule</th>
        <th>Nom</th>
        <th>Prénom</th>
        <th style="width:36px">Sexe</th>
        <th>Date de naissance</th>
        <th>Parent / Tuteur</th>
        <th>Téléphone</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Total : <strong>${total} élève${total > 1 ? 's' : ''}</strong> &nbsp;·&nbsp; Garçons : <strong>${nbM}</strong> &nbsp;·&nbsp; Filles : <strong>${nbF}</strong></span>
    <span>Imprimé le ${dateImpression}</span>
  </div>
  <div class="signature">
    <div class="signature-box">
      <div class="signature-line"></div>
      Signature du responsable
    </div>
  </div>`;
}

function buildSingleListeHtml(data: ListeData, etablissementNom: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Liste ${data.classe.nom_fr}</title>
  <style>${LISTE_CSS} body { padding: 15mm; }</style>
</head>
<body>${buildListeBodyContent(data, etablissementNom)}</body>
</html>`;
}

function buildCombinedListeHtml(dataList: ListeData[], etablissementNom: string): string {
  const pages = dataList.map((data, i) =>
    `<div class="${i < dataList.length - 1 ? 'page pb' : 'page'}">${buildListeBodyContent(data, etablissementNom)}</div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Toutes les classes</title>
  <style>
    ${LISTE_CSS}
    .page { padding: 15mm; }
    .pb { page-break-after: always; }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

async function renderPdf(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  return Buffer.from(pdf);
}

export async function genererPdfListeClasse(
  classe_id: string,
  etablissement_id: string,
  annee_scolaire_id?: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } });
  const etablissementNom = etab?.nom_fr ?? '';
  const data = await listerElevesDeClasse(classe_id, etablissement_id, annee_scolaire_id);
  return renderPdf(buildSingleListeHtml(data, etablissementNom));
}

export async function genererPdfToutesClasses(
  etablissement_id: string,
  annee_scolaire_id?: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } });
  const etablissementNom = etab?.nom_fr ?? '';

  const classes = await listerClasses(etablissement_id, annee_scolaire_id);
  if (classes.length === 0) throw new Error('Aucune classe trouvée');

  const dataList: ListeData[] = [];
  for (const classe of classes) {
    try {
      const data = await listerElevesDeClasse(classe.id, etablissement_id, annee_scolaire_id);
      if (data.eleves.length > 0) dataList.push(data);
    } catch { /* ignore */ }
  }
  if (dataList.length === 0) throw new Error('Aucun élève trouvé dans les classes');

  return renderPdf(buildCombinedListeHtml(dataList, etablissementNom));
}
