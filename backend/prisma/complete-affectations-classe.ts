/**
 * Complète les affectations enseignant existantes à TOUTE la classe.
 *
 * Contexte : l'affectation est passée de « par (classe, domaine) » à « par classe
 * entière ». Les affectations historiques qui ne couvraient qu'une partie des
 * domaines d'une classe sont ici étendues à toutes les matières du programme de
 * la classe, pour chaque (personnel, classe, année) déjà présent.
 *
 * Idempotent. DRY-RUN par défaut ; --apply pour écrire.
 *
 *   tsx prisma/complete-affectations-classe.ts            # aperçu
 *   tsx prisma/complete-affectations-classe.ts --apply    # exécute
 *   DATABASE_URL=<prod> tsx prisma/complete-affectations-classe.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  // Affectations existantes regroupées par (personnel, classe, année).
  const liens = await prisma.personnelMatiereClasse.findMany({
    select: { personnel_id: true, classe_id: true, annee_scolaire_id: true, matiere_id: true },
  });

  const groupes = new Map<string, { personnel_id: string; classe_id: string; annee_scolaire_id: string; matieres: Set<string> }>();
  for (const l of liens) {
    const key = `${l.personnel_id}|${l.classe_id}|${l.annee_scolaire_id}`;
    let g = groupes.get(key);
    if (!g) { g = { personnel_id: l.personnel_id, classe_id: l.classe_id, annee_scolaire_id: l.annee_scolaire_id, matieres: new Set() }; groupes.set(key, g); }
    g.matieres.add(l.matiere_id);
  }

  // Programme (matières) par classe.
  const classeIds = [...new Set([...groupes.values()].map(g => g.classe_id))];
  const programmes = await prisma.classeMatiere.findMany({
    where: { classe_id: { in: classeIds } },
    select: { classe_id: true, matiere_id: true },
  });
  const progParClasse = new Map<string, Set<string>>();
  for (const p of programmes) {
    if (!progParClasse.has(p.classe_id)) progParClasse.set(p.classe_id, new Set());
    progParClasse.get(p.classe_id)!.add(p.matiere_id);
  }

  const aCreer: { personnel_id: string; classe_id: string; matiere_id: string; annee_scolaire_id: string }[] = [];
  let groupesIncomplets = 0;
  for (const g of groupes.values()) {
    const prog = progParClasse.get(g.classe_id);
    if (!prog || prog.size === 0) continue;
    const manquantes = [...prog].filter(m => !g.matieres.has(m));
    if (manquantes.length === 0) continue;
    groupesIncomplets++;
    if (groupesIncomplets <= 15) {
      console.log(`   personnel=${g.personnel_id.slice(0, 8)}… classe=${g.classe_id.slice(0, 8)}… : +${manquantes.length} matière(s)`);
    }
    for (const m of manquantes) {
      aCreer.push({ personnel_id: g.personnel_id, classe_id: g.classe_id, matiere_id: m, annee_scolaire_id: g.annee_scolaire_id });
    }
  }

  console.log(`\nGroupes (personnel × classe × année) : ${groupes.size}`);
  console.log(`Groupes incomplets à compléter        : ${groupesIncomplets}`);
  console.log(`Lignes PersonnelMatiereClasse ${APPLY ? 'créées' : 'à créer'}  : ${aCreer.length}`);

  if (APPLY && aCreer.length > 0) {
    const res = await prisma.personnelMatiereClasse.createMany({ data: aCreer });
    console.log(`✅ ${res.count} lignes insérées.`);
  } else if (!APPLY) {
    console.log('\n(DRY-RUN — relancer avec --apply pour écrire)');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
