/**
 * Backfill PROD — état civil + qualifications du personnel FICAAM.
 *
 * Renseigne les colonnes ajoutées par la migration personnel_etat_civil_qualifications
 * (date_naissance, lieu_naissance, cni, numero_autorisation, diplome_academique,
 * diplome_professionnel) à partir de prisma/data/personnel-ficaam-details.csv.
 *
 * Match sur le personnel ACTIF par nom+prénom normalisés (insensible casse/accents).
 * Idempotent : ré-applique simplement les mêmes valeurs. N'écrase JAMAIS un champ
 * existant avec une valeur vide (les champs vides du CSV sont ignorés).
 *
 *   tsx prisma/personnel-ficaam/backfill-details.ts                 # dry-run
 *   DATABASE_URL=<url prod> tsx prisma/personnel-ficaam/backfill-details.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { parseFile } from 'fast-csv';
import { join } from 'node:path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const CSV = join(__dirname, '..', 'data', 'personnel-ficaam-details.csv');

interface Row {
  nom_fr: string; prenom_fr: string; date_naissance: string; lieu_naissance: string;
  cni: string; numero_autorisation: string; diplome_academique: string; diplome_professionnel: string;
}

const slug = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');
const key = (nom: string, prenom: string) => `${slug(nom)}|${slug(prenom)}`;

function loadCsv(): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    parseFile(CSV, { headers: true, ignoreEmpty: true })
      .on('error', reject).on('data', (r: Row) => rows.push(r)).on('end', () => resolve(rows));
  });
}

async function main() {
  console.log(`\n━━━ Backfill détails Personnel FICAAM ${APPLY ? '' : '(DRY-RUN — relancer avec --apply)'} ━━━`);

  const etab = await prisma.etablissement.findFirst({ select: { id: true, code: true } });
  if (!etab) throw new Error('Aucun établissement en base.');

  const rows = await loadCsv();
  const persos = await prisma.personnel.findMany({
    where: { utilisateur: { etablissement_id: etab.id, actif: true } },
    select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } },
  });
  const byKey = new Map(persos.map(p => [key(p.utilisateur.nom_fr, p.utilisateur.prenom_fr ?? ''), p.id]));

  let updated = 0, notFound = 0;
  for (const r of rows) {
    const id = byKey.get(key(r.nom_fr, r.prenom_fr));
    if (!id) { console.log(`  ❓ INTROUVABLE ${r.prenom_fr} ${r.nom_fr}`); notFound++; continue; }

    // N'écrit que les champs non vides (ne pas effacer ce qui existe déjà).
    const data: Record<string, unknown> = {};
    if (r.date_naissance) data.date_naissance = new Date(r.date_naissance);
    if (r.lieu_naissance) data.lieu_naissance = r.lieu_naissance;
    if (r.cni) data.cni = r.cni;
    if (r.numero_autorisation) data.numero_autorisation = r.numero_autorisation;
    if (r.diplome_academique) data.diplome_academique = r.diplome_academique;
    if (r.diplome_professionnel) data.diplome_professionnel = r.diplome_professionnel;

    const champs = Object.keys(data);
    if (champs.length === 0) { console.log(`  ⏭️  ${r.prenom_fr} ${r.nom_fr} — rien à renseigner`); continue; }
    console.log(`  ✅ MAJ ${r.prenom_fr} ${r.nom_fr} · ${champs.join(', ')}`);
    if (APPLY) await prisma.personnel.update({ where: { id }, data });
    updated++;
  }

  console.log(`\nRésumé : ${updated} ${APPLY ? 'mis à jour' : 'à mettre à jour'} · ${notFound} introuvables`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
