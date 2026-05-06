import prisma from '../../config/database';
import { GenererBulletinInput, GenererBulletinAnnuelInput } from './bulletins.schema';

function appreciation(m: number): string {
  if (m >= 16) return 'Très bien — Félicitations du conseil';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez bien';
  if (m >= 10) return 'Passable';
  return 'Insuffisant — Doit faire des efforts';
}

async function getMatieres(etablissement_id: string, filiere: 'FR' | 'AR') {
  return prisma.matiere.findMany({
    where: { etablissement_id, filiere, active: true },
    orderBy: { ordre_bulletin: 'asc' },
  });
}

async function getElevesClasse(classe_id: string, annee_scolaire_id: string) {
  return prisma.inscription.findMany({
    where: { annee_scolaire_id, statut: 'actif', OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] },
    include: { eleve: true },
  });
}

// ─── Lister ─────────────────────────────────────────────────────────────────

export async function listerBulletins(
  etablissement_id: string, annee_scolaire_id?: string, periode?: number,
  eleve_id?: string, filiere?: string,
) {
  const where: Record<string, unknown> = { eleve: { etablissement_id } };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (periode !== undefined) where.periode = periode;
  if (eleve_id) where.eleve_id = eleve_id;
  if (filiere) where.filiere = filiere;
  return prisma.bulletin.findMany({
    where,
    include: {
      eleve: { select: { id: true, nom_fr: true, nom_ar: true, prenom_fr: true, prenom_ar: true, matricule: true } },
      annee_scolaire: true,
    },
    orderBy: [{ periode: 'asc' }, { rang: 'asc' }],
  });
}

// ─── Générer bulletins trimestriels (FR | AR | COMBINE) ──────────────────────

export async function genererBulletins(etablissement_id: string, data: GenererBulletinInput) {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, Awaited<ReturnType<typeof getMatieres>>> = {};
  for (const f of filieres) matMap[f] = await getMatieres(etablissement_id, f);

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const f of filieres) {
      const notes = await prisma.note.findMany({
        where: { eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
        include: { matiere: true },
      });
      for (const n of notes) {
        const c = Number(n.matiere.coeff_defaut);
        totalP += Number(n.valeur) * c;
        totalC += c;
      }
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode } },
      create: { eleve_id, annee_scolaire_id, filiere, periode, moyenne, rang: i + 1, appreciation: appreciation(moyenne), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: appreciation(moyenne), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) généré(s)`, bulletins };
}

// ─── Générer bulletins annuels (periode=0) ───────────────────────────────────

export async function genererBulletinsAnnuels(etablissement_id: string, data: GenererBulletinAnnuelInput) {
  const { classe_id, annee_scolaire_id, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, Awaited<ReturnType<typeof getMatieres>>> = {};
  for (const f of filieres) matMap[f] = await getMatieres(etablissement_id, f);

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const f of filieres) {
      for (const periode of [1, 2, 3]) {
        const notes = await prisma.note.findMany({
          where: { eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
          include: { matiere: true },
        });
        for (const n of notes) {
          const c = Number(n.matiere.coeff_defaut);
          totalP += Number(n.valeur) * c;
          totalC += c;
        }
      }
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode: 0 } },
      create: { eleve_id, annee_scolaire_id, filiere, periode: 0, moyenne, rang: i + 1, appreciation: appreciation(moyenne), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: appreciation(moyenne), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) annuel(s) généré(s)`, bulletins };
}

// ─── Détail bulletin ─────────────────────────────────────────────────────────

export async function getBulletin(id: string, etablissement_id: string) {
  const bulletin = await prisma.bulletin.findFirst({
    where: { id, eleve: { etablissement_id } },
    include: {
      eleve: { include: { inscriptions: { include: { classe_fr: true, classe_ar: true } } } },
      annee_scolaire: true,
    },
  });
  if (!bulletin) throw new Error('Bulletin introuvable');

  const filieres: ('FR' | 'AR')[] = bulletin.filiere === 'COMBINE' ? ['FR', 'AR'] : [bulletin.filiere as 'FR' | 'AR'];
  const notesByFiliere: Record<string, unknown[]> = {};
  for (const f of filieres) {
    const matieres = await getMatieres(etablissement_id, f);
    const periodes = bulletin.periode === 0 ? [1, 2, 3] : [bulletin.periode];
    notesByFiliere[f] = await prisma.note.findMany({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: matieres.map(m => m.id) } },
      include: { matiere: true },
      orderBy: { matiere: { ordre_bulletin: 'asc' } },
    });
  }
  return { ...bulletin, notesByFiliere };
}

// ─── PDF individuel ──────────────────────────────────────────────────────────

export async function genererPdfBulletin(id: string, etablissement_id: string): Promise<Buffer> {
  const data = await getBulletin(id, etablissement_id);
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  const { generateBulletinHtml, generateBulletinAnnuelHtml } = await import('./bulletin.template');

  const base = {
    etablissement_nom_fr: etab.nom_fr, etablissement_nom_ar: etab.nom_ar,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_nom_ar: `${data.eleve.prenom_ar} ${data.eleve.nom_ar}`,
    eleve_matricule: data.eleve.matricule, annee_libelle: data.annee_scolaire.libelle,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null, rang: data.rang,
    appreciation: data.appreciation, devise: etab.devise,
  };

  type NoteRaw = { valeur: unknown; periode: number; matiere: { nom_fr: string; nom_ar: string; coeff_defaut: unknown } };

  const toRows = (f: 'FR' | 'AR') =>
    ((data.notesByFiliere[f] ?? []) as NoteRaw[]).map(n => ({
      nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar,
      coeff: Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
    }));

  const toAnnuelRows = (f: 'FR' | 'AR') => {
    const map = new Map<string, { nom_fr: string; nom_ar: string; coeff: number; vals: Record<number, number | null> }>();
    for (const n of (data.notesByFiliere[f] ?? []) as NoteRaw[]) {
      if (!map.has(n.matiere.nom_fr)) map.set(n.matiere.nom_fr, { nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar, coeff: Number(n.matiere.coeff_defaut), vals: {} });
      map.get(n.matiere.nom_fr)!.vals[n.periode] = n.valeur !== null ? Number(n.valeur) : null;
    }
    return Array.from(map.values()).map(m => {
      const vals = [1, 2, 3].map(p => m.vals[p] ?? null);
      const nums = vals.filter(v => v !== null) as number[];
      return { ...m, valeurs: vals, moyenne_annuelle: nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : null };
    });
  };

  let html: string;
  if (data.periode === 0) {
    const type = data.filiere === 'COMBINE' ? 'ANNUEL_COMBINE' : data.filiere === 'AR' ? 'ANNUEL_AR' : 'ANNUEL_FR';
    html = generateBulletinAnnuelHtml({
      ...base, type,
      matieres_fr: data.filiere !== 'AR' ? toAnnuelRows('FR') : undefined,
      matieres_ar: data.filiere !== 'FR' ? toAnnuelRows('AR') : undefined,
    });
  } else {
    const type = data.filiere as 'FR' | 'AR' | 'COMBINE';
    html = generateBulletinHtml({
      ...base, type, periode: data.periode,
      notes_fr: data.filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: data.filiere !== 'FR' ? toRows('AR') : undefined,
    });
  }

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
  await browser.close();
  return Buffer.from(pdf);
}

// ─── PDF toute la classe ─────────────────────────────────────────────────────

export async function genererPdfClasse(
  classe_id: string, annee_scolaire_id: string, periode: number,
  filiere: string, etablissement_id: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  const bulletins = await prisma.bulletin.findMany({
    where: {
      annee_scolaire_id, periode, filiere,
      eleve: { etablissement_id, inscriptions: { some: { annee_scolaire_id, OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] } } },
    },
    include: { eleve: true, annee_scolaire: true },
    orderBy: [{ rang: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
  if (bulletins.length === 0) throw new Error('Aucun bulletin trouvé');

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, Awaited<ReturnType<typeof getMatieres>>> = {};
  for (const f of filieres) matMap[f] = await getMatieres(etablissement_id, f);

  const { generateBulletinHtml } = await import('./bulletin.template');
  const pages: string[] = [];

  for (const bulletin of bulletins) {
    const notesByFiliere: Record<string, unknown[]> = {};
    for (const f of filieres) {
      notesByFiliere[f] = await prisma.note.findMany({
        where: { eleve_id: bulletin.eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
        include: { matiere: true }, orderBy: { matiere: { ordre_bulletin: 'asc' } },
      });
    }
    type NoteRaw = { valeur: unknown; matiere: { nom_fr: string; nom_ar: string; coeff_defaut: unknown } };
    const toRows = (f: 'FR' | 'AR') =>
      ((notesByFiliere[f] ?? []) as NoteRaw[]).map(n => ({
        nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar,
        coeff: Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
      }));

    pages.push(generateBulletinHtml({
      type: filiere as 'FR' | 'AR' | 'COMBINE', periode: bulletin.periode,
      etablissement_nom_fr: etab.nom_fr, etablissement_nom_ar: etab.nom_ar,
      eleve_nom_fr: `${bulletin.eleve.prenom_fr} ${bulletin.eleve.nom_fr}`,
      eleve_nom_ar: `${bulletin.eleve.prenom_ar} ${bulletin.eleve.nom_ar}`,
      eleve_matricule: bulletin.eleve.matricule, annee_libelle: bulletin.annee_scolaire.libelle,
      moyenne: bulletin.moyenne !== null ? Number(bulletin.moyenne) : null,
      rang: bulletin.rang, appreciation: bulletin.appreciation, devise: etab.devise,
      notes_fr: filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: filiere !== 'FR' ? toRows('AR') : undefined,
    }));
  }

  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>.pb{page-break-after:always}body{margin:0;padding:0}</style></head><body>
    ${pages.map((p, i) => { const m = p.match(/<body>([\s\S]*)<\/body>/); const c = m ? m[1] : p; return i < pages.length - 1 ? `<div class="pb" style="padding:28px 36px">${c}</div>` : `<div style="padding:28px 36px">${c}</div>`; }).join('\n')}
  </body></html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(combined, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  return Buffer.from(pdf);
}
