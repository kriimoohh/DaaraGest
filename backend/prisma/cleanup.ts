/**
 * Script de nettoyage — supprime toutes les données de test
 * Conserve : établissement, rôles, configNotes, compte admin, matières
 *
 * Usage (Railway Shell) : npx tsx prisma/cleanup.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧹  Nettoyage des données de test...\n');

  // Ordre important : respecter les contraintes FK
  const bulletin     = await prisma.bulletin.deleteMany({});
  const note         = await prisma.note.deleteMany({});
  const paiEleve     = await prisma.paiementEleve.deleteMany({});
  const paiProf      = await prisma.paiementProfesseur.deleteMany({});
  const presence     = await prisma.presenceProfesseur.deleteMany({});
  const inscription  = await prisma.inscription.deleteMany({});
  const parent       = await prisma.parent.deleteMany({});
  const eleve        = await prisma.eleve.deleteMany({});
  const classe       = await prisma.classe.deleteMany({});
  const annee        = await prisma.anneeScolaire.deleteMany({});
  const professeur   = await prisma.professeur.deleteMany({});

  // Supprimer les utilisateurs test (garder admin)
  const usersTest    = await prisma.utilisateur.deleteMany({
    where: { identifiant: { not: 'admin' } },
  });

  console.log(`✅ Bulletins supprimés     : ${bulletin.count}`);
  console.log(`✅ Notes supprimées        : ${note.count}`);
  console.log(`✅ Paiements élèves        : ${paiEleve.count}`);
  console.log(`✅ Paiements profs         : ${paiProf.count}`);
  console.log(`✅ Présences               : ${presence.count}`);
  console.log(`✅ Inscriptions            : ${inscription.count}`);
  console.log(`✅ Parents                 : ${parent.count}`);
  console.log(`✅ Élèves                  : ${eleve.count}`);
  console.log(`✅ Classes                 : ${classe.count}`);
  console.log(`✅ Années scolaires        : ${annee.count}`);
  console.log(`✅ Professeurs             : ${professeur.count}`);
  console.log(`✅ Utilisateurs test       : ${usersTest.count}`);
  console.log('\n✅  Base nettoyée. Seuls admin, rôles, matières et config sont conservés.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
