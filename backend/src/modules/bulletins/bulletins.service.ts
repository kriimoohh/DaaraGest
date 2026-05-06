import prisma from '../../config/database';
import { GenererBulletinInput } from './bulletins.schema';

export async function listerBulletins(
  etablissement_id: string,
  annee_scolaire_id?: string,
  periode?: number,
  eleve_id?: string
) {
  const where: Record<string, unknown> = {
    eleve: { etablissement_id },
  };

  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (periode !== undefined) where.periode = periode;
  if (eleve_id) where.eleve_id = eleve_id;

  return prisma.bulletin.findMany({
    where,
    include: {
      eleve: { select: { id: true, nom_fr: true, nom_ar: true, prenom_fr: true, prenom_ar: true, matricule: true } },
      annee_scolaire: true,
    },
    orderBy: [{ periode: 'asc' }],
  });
}

export async function genererBulletins(etablissement_id: string, data: GenererBulletinInput) {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;

  // Verify class belongs to etablissement
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  // Get inscriptions for this class
  const inscriptions = await prisma.inscription.findMany({
    where: {
      annee_scolaire_id,
      OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      statut: 'actif',
    },
    include: { eleve: true },
  });

  if (inscriptions.length === 0) {
    return { message: 'Aucun élève inscrit dans cette classe', bulletins: [] };
  }

  // Get matieres for this filiere and etablissement
  const matieres = await prisma.matiere.findMany({
    where: { etablissement_id, filiere, active: true },
  });

  // Calculate moyennes for each eleve
  const moyennes: { eleve_id: string; moyenne: number }[] = [];

  for (const inscription of inscriptions) {
    const notes = await prisma.note.findMany({
      where: {
        eleve_id: inscription.eleve_id,
        annee_scolaire_id,
        periode,
        matiere_id: { in: matieres.map((m) => m.id) },
      },
      include: { matiere: true },
    });

    if (notes.length === 0) continue;

    let totalPondere = 0;
    let totalCoeff = 0;

    for (const note of notes) {
      const coeff = Number(note.matiere.coeff_defaut);
      totalPondere += Number(note.valeur) * coeff;
      totalCoeff += coeff;
    }

    const moyenne = totalCoeff > 0 ? totalPondere / totalCoeff : 0;
    moyennes.push({ eleve_id: inscription.eleve_id, moyenne });
  }

  // Sort by moyenne desc to compute ranks
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];

  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const rang = i + 1;

    const bulletin = await prisma.bulletin.upsert({
      where: {
        eleve_id_annee_scolaire_id_filiere_periode: {
          eleve_id,
          annee_scolaire_id,
          filiere,
          periode,
        },
      },
      create: {
        eleve_id,
        annee_scolaire_id,
        filiere,
        periode,
        moyenne,
        rang,
        generated_at: new Date(),
      },
      update: {
        moyenne,
        rang,
        generated_at: new Date(),
      },
    });
    bulletins.push(bulletin);
  }

  return { message: `${bulletins.length} bulletin(s) généré(s)`, bulletins };
}

export async function getBulletin(id: string, etablissement_id: string) {
  const bulletin = await prisma.bulletin.findFirst({
    where: { id, eleve: { etablissement_id } },
    include: {
      eleve: {
        include: { parents: true, inscriptions: { include: { classe_fr: true, classe_ar: true } } },
      },
      annee_scolaire: true,
    },
  });
  if (!bulletin) throw new Error('Bulletin introuvable');

  // Fetch notes for this eleve, period, year, filiere
  const matieres = await prisma.matiere.findMany({
    where: { etablissement_id, filiere: bulletin.filiere, active: true },
  });

  const notes = await prisma.note.findMany({
    where: {
      eleve_id: bulletin.eleve_id,
      annee_scolaire_id: bulletin.annee_scolaire_id,
      periode: bulletin.periode,
      matiere_id: { in: matieres.map((m) => m.id) },
    },
    include: { matiere: true },
    orderBy: { matiere: { ordre_bulletin: 'asc' } },
  });

  return { ...bulletin, notes };
}

export async function genererPdfBulletin(id: string, etablissement_id: string): Promise<Buffer> {
  const data = await getBulletin(id, etablissement_id);
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  const { generateBulletinHtml } = await import('./bulletin.template');

  const noteRows = (data.notes as Array<{
    valeur: unknown;
    matiere: { nom_fr: string; nom_ar: string; filiere: string; coeff_defaut: unknown };
  }>).map((n) => ({
    nom_fr: n.matiere.nom_fr,
    nom_ar: n.matiere.nom_ar,
    filiere: n.matiere.filiere,
    coeff: Number(n.matiere.coeff_defaut),
    valeur: n.valeur !== null && n.valeur !== undefined ? Number(n.valeur) : null,
  }));

  const html = generateBulletinHtml({
    etablissement_nom_fr: etab.nom_fr,
    etablissement_nom_ar: etab.nom_ar,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_nom_ar: `${data.eleve.prenom_ar} ${data.eleve.nom_ar}`,
    eleve_matricule: data.eleve.matricule,
    annee_libelle: data.annee_scolaire.libelle,
    periode: data.periode,
    filiere: data.filiere,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null,
    rang: data.rang,
    appreciation: data.appreciation,
    notes: noteRows,
    devise: etab.devise,
  });

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
  await browser.close();

  return Buffer.from(pdf);
}
