'use strict';
/**
 * Seed de production — idempotent, résistant aux IDs existants.
 * Upsert par contrainte métier (libelle_fr, nom_fr+filiere, etc.)
 * plutôt que par ID fixe, pour éviter les conflits avec des déploiements antérieurs.
 */
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🏫  DaaraGest — Seed production\n');

  // ── Établissement ────────────────────────────────────────────────────────────
  let etab = await prisma.etablissement.findFirst();
  if (!etab) {
    etab = await prisma.etablissement.create({
      data: {
        nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
        adresse: 'Guédiawaye, Dakar, Sénégal',
        telephone: '+221 33 820 12 34',
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

  // ── Matières ─────────────────────────────────────────────────────────────────
  const matieres = [
    { nom_fr: 'Français',            nom_ar: 'اللغة الفرنسية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { nom_fr: 'Mathématiques',       nom_ar: 'الرياضيات',          filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { nom_fr: 'Sciences',            nom_ar: 'علوم الحياة',        filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { nom_fr: 'Histoire-Géographie', nom_ar: 'التاريخ والجغرافيا', filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { nom_fr: 'Éducation Civique',   nom_ar: 'التربية المدنية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
    { nom_fr: 'Coran',               nom_ar: 'القرآن الكريم',      filiere: 'AR', coeff_defaut: new Prisma.Decimal(4), note_max: new Prisma.Decimal(30), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { nom_fr: 'Fiqh',                nom_ar: 'الفقه',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { nom_fr: 'Nahw',                nom_ar: 'النحو',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { nom_fr: 'Adab (Littérature)',  nom_ar: 'الأدب العربي',       filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { nom_fr: 'Histoire Islamique',  nom_ar: 'التاريخ الإسلامي',   filiere: 'AR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
  ];
  for (const m of matieres) {
    const existing = await prisma.matiere.findFirst({
      where: { nom_fr: m.nom_fr, filiere: m.filiere, etablissement_id: etab.id },
    });
    if (!existing) {
      await prisma.matiere.create({ data: { ...m, etablissement_id: etab.id } });
    }
  }
  console.log('✅ Matières (5 FR + 5 AR)');

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
