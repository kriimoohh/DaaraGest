'use strict';
/**
 * Seed de production — idempotent, résistant aux IDs existants.
 * Upsert par contrainte métier (libelle_fr, nom_fr+filiere, etc.)
 * plutôt que par ID fixe, pour éviter les conflits avec des déploiements antérieurs.
 */
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const LGM = require('./data/lgm-matieres.json');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🏫  DaaraGest — Seed production\n');

  // Court-circuit : si l'établissement + les rôles + un admin + les 6 domaines
  // LGM existent déjà, le seed a déjà tourné — on saute tout. Le check sur les
  // domaines force un re-run après l'introduction du référentiel LGM (bases
  // pré-existantes qui n'avaient ni domaines ni les 76 matières).
  const [etabCount, roleCount, adminUser, domaineCount] = await Promise.all([
    prisma.etablissement.count(),
    prisma.role.count(),
    prisma.utilisateur.findFirst({ where: { identifiant: 'admin' } }),
    prisma.domaine.count(),
  ]);
  if (etabCount > 0 && roleCount >= 6 && adminUser && domaineCount >= 6) {
    console.log('✅  Seed déjà effectué — démarrage immédiat.\n');
    return;
  }

  // ── Établissement ────────────────────────────────────────────────────────────
  let etab = await prisma.etablissement.findFirst();
  if (!etab) {
    etab = await prisma.etablissement.create({
      data: {
        nom_fr: 'F.I.C.A.A.M. — École Franco-Arabe Cheikh Abdoul Ahad Mbacké',
        adresse: 'Cité AKF Guédiawaye',
        telephone: '33 877 76 30',
        devise: 'FCFA',
      },
    });
  }
  console.log('✅ Établissement');

  // ── Rôles ────────────────────────────────────────────────────────────────────
  const rolesData = [
    'admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur',
  ];
  for (const libelle_fr of rolesData) {
    await prisma.role.upsert({ where: { libelle_fr }, update: {}, create: { libelle_fr } });
  }
  console.log('✅ Rôles');

  // ── Config Notes ─────────────────────────────────────────────────────────────
  await prisma.configNotes.upsert({
    where: { etablissement_id: etab.id },
    update: {},
    create: { etablissement_id: etab.id, note_max: 20, note_min: 0, nb_periodes: 3 },
  });
  console.log('✅ ConfigNotes');

  // ── Admin ─────────────────────────────────────────────────────────────────────
  const roleAdmin = await prisma.role.findUnique({ where: { libelle_fr: 'admin' } });
  if (!roleAdmin) throw new Error('Rôle admin introuvable');

  const existingAdmin = await prisma.utilisateur.findFirst({ where: { role_id: roleAdmin.id } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash('Admin123!', 10);
    await prisma.utilisateur.create({
      data: {
        identifiant: 'admin', mot_de_passe: hash,
        role_id: roleAdmin.id, etablissement_id: etab.id,
        nom_fr: 'Administrateur', nom_ar: 'مدير',
        langue: 'fr', theme: 'light',
        must_change_password: true,
      },
    });
    console.log('✅ Admin (admin / Admin123!) — changement de mot de passe requis');
  } else {
    console.log('✅ Admin (compte existant conservé)');
  }

  // ── Domaines pédagogiques (référentiel LGM) ──────────────────────────────────
  for (const d of LGM.domaines) {
    await prisma.domaine.upsert({
      where: { etablissement_id_code: { etablissement_id: etab.id, code: d.code } },
      update: { nom_fr: d.nom_fr, nom_ar: d.nom_ar, ordre: d.ordre, actif: true },
      create: { etablissement_id: etab.id, code: d.code, nom_fr: d.nom_fr, nom_ar: d.nom_ar, ordre: d.ordre, actif: true },
    });
  }
  console.log(`✅ Domaines (${LGM.domaines.length})`);

  // ── Matières (référentiel LGM — 76 matières classées par domaine) ────────────
  const domaineRows = await prisma.domaine.findMany({ where: { etablissement_id: etab.id } });
  const domaineByCode = new Map(domaineRows.map(d => [d.code, d.id]));
  for (const m of LGM.matieres) {
    const existing = await prisma.matiere.findFirst({
      where: { nom_fr: m.nom_fr, filiere: m.filiere, etablissement_id: etab.id },
    });
    const data = {
      etablissement_id: etab.id,
      nom_fr: m.nom_fr,
      nom_ar: m.nom_ar,
      filiere: m.filiere,
      coeff_defaut: new Prisma.Decimal(1),
      note_max: new Prisma.Decimal(20),
      note_min: new Prisma.Decimal(0),
      ordre_bulletin: m.ordre_bulletin,
      code_court: m.code_court,
      type_note: m.type_note,
      domaine_id: domaineByCode.get(m.domaine_code) || null,
      active: true,
    };
    if (existing) {
      await prisma.matiere.update({ where: { id: existing.id }, data });
    } else {
      await prisma.matiere.create({ data });
    }
  }
  console.log(`✅ Matières (${LGM.matieres.length} — référentiel LGM)`);

  // ── Niveaux ──────────────────────────────────────────────────────────────────
  const niveaux = [
    { libelle: 'Petite Section', ordre: 1  },
    { libelle: 'Moyenne Section', ordre: 2 },
    { libelle: 'Grande Section',  ordre: 3 },
    { libelle: 'CI',              ordre: 4 },
    { libelle: 'CP',              ordre: 5 },
    { libelle: 'CE1',             ordre: 6 },
    { libelle: 'CE2',             ordre: 7 },
    { libelle: 'CM1',             ordre: 8 },
    { libelle: 'CM2',             ordre: 9 },
    { libelle: '6e',              ordre: 10 },
    { libelle: '5e',              ordre: 11 },
    { libelle: '4e',              ordre: 12 },
    { libelle: '3e',              ordre: 13 },
    { libelle: 'Seconde',         ordre: 14 },
    { libelle: 'Première',        ordre: 15 },
    { libelle: 'Terminale',       ordre: 16 },
  ];
  for (const n of niveaux) {
    await prisma.niveau.upsert({
      where: { etablissement_id_libelle: { etablissement_id: etab.id, libelle: n.libelle } },
      update: { ordre: n.ordre },
      create: { ...n, etablissement_id: etab.id },
    });
  }
  console.log('✅ Niveaux (16 — communs FR et AR)');

  console.log('\n✅  Seed production terminé.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
