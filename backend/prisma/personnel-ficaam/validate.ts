/**
 * Validation lecture seule de l'import Personnel FICAAM.
 *   tsx prisma/personnel-ficaam/validate.ts
 *   DATABASE_URL=<url prod> tsx prisma/personnel-ficaam/validate.ts
 *
 * Ne modifie rien. Recompte le personnel actif par fonction, vérifie l'unicité
 * des matricules/identifiants et liste les comptes du roster retrouvés.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const etab = await prisma.etablissement.findFirst({ select: { id: true, code: true, nom_fr: true } });
  if (!etab) throw new Error('Aucun établissement en base.');
  console.log(`\n━━━ Validation Personnel — ${etab.nom_fr} (${etab.code}) ━━━`);

  const actifs = await prisma.personnel.findMany({
    where: { utilisateur: { etablissement_id: etab.id, actif: true } },
    select: { fonction: true, matricule: true, utilisateur: { select: { identifiant: true, nom_fr: true, prenom_fr: true } } },
    orderBy: { utilisateur: { nom_fr: 'asc' } },
  });

  const parFonction = actifs.reduce<Record<string, number>>((acc, p) => {
    acc[p.fonction] = (acc[p.fonction] ?? 0) + 1; return acc;
  }, {});
  console.log(`\nPersonnel actif : ${actifs.length}`);
  for (const [f, n] of Object.entries(parFonction).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(16)} ${n}`);

  // Unicité matricules / identifiants
  const mats = actifs.map(p => p.matricule).filter(Boolean) as string[];
  const idents = actifs.map(p => p.utilisateur.identifiant);
  const dup = (arr: string[]) => [...new Set(arr.filter((v, i) => arr.indexOf(v) !== i))];
  const dupMat = dup(mats), dupId = dup(idents);
  console.log(`\nMatricules uniques : ${dupMat.length === 0 ? 'OK' : '⚠️ doublons ' + dupMat.join(', ')}`);
  console.log(`Identifiants uniques : ${dupId.length === 0 ? 'OK' : '⚠️ doublons ' + dupId.join(', ')}`);
  const sansMat = actifs.filter(p => !p.matricule);
  if (sansMat.length) console.log(`⚠️ ${sansMat.length} personnel sans matricule`);

  console.log(`\nListe (actifs) :`);
  for (const p of actifs) {
    console.log(`  ${(p.matricule ?? '—').padEnd(14)} ${p.utilisateur.identifiant.padEnd(28)} ${p.utilisateur.prenom_fr ?? ''} ${p.utilisateur.nom_fr} · ${p.fonction}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
