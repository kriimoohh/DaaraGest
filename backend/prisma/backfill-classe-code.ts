/**
 * Backfill du champ Classe.code pour les classes existantes (créées avant la
 * migration). Idempotent. DRY-RUN par défaut ; --apply pour écrire.
 *
 *   tsx prisma/backfill-classe-code.ts            # aperçu
 *   tsx prisma/backfill-classe-code.ts --apply    # exécute
 *   DATABASE_URL=<prod> tsx prisma/backfill-classe-code.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { classeCode } from '../src/utils/classeCode';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const classes = await prisma.classe.findMany({ select: { id: true, nom_fr: true, filiere: true, code: true } });
  let toSet = 0;
  for (const c of classes) {
    const code = classeCode(c.nom_fr, c.filiere);
    if (c.code === code) continue;
    toSet++;
    if (toSet <= 12) console.log(`   ${c.nom_fr} [${c.filiere}] → ${code}`);
    if (APPLY) await prisma.classe.update({ where: { id: c.id }, data: { code } });
  }
  console.log(`\nClasses : ${classes.length} · codes ${APPLY ? 'écrits' : 'à écrire'} : ${toSet}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
