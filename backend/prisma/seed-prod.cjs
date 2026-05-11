'use strict';
/**
 * Seed de production — CommonJS pur, aucune dépendance à tsx.
 * Ne crée que les données essentielles (idempotent via upsert).
 */
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🏫  DaaraGest — Seed production\n');

  await prisma.etablissement.upsert({
    where: { id: 'etablissement-default' },
    update: {
      nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
    create: {
      id: 'etablissement-default',
      nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
  });
  console.log('✅ Établissement');

  const roles = [
    { id: 'role-admin',         libelle_fr: 'admin' },
    { id: 'role-directeur',     libelle_fr: 'directeur' },
    { id: 'role-gestionnaire',  libelle_fr: 'gestionnaire' },
    { id: 'role-caissier',      libelle_fr: 'agent de scolarité' },
    { id: 'role-professeur',    libelle_fr: 'professeur' },
    { id: 'role-pointeur',      libelle_fr: 'pointeur' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, update: { libelle_fr: r.libelle_fr }, create: r });
  }
  console.log('✅ Rôles');

  await prisma.configNotes.upsert({
    where: { etablissement_id: 'etablissement-default' },
    update: {},
    create: { etablissement_id: 'etablissement-default', note_max: 20, note_min: 0, nb_periodes: 3 },
  });
  console.log('✅ ConfigNotes');

  const hash = await bcrypt.hash('Admin123!', 10);
  await prisma.utilisateur.upsert({
    where: { id: 'user-admin' },
    update: {},
    create: {
      id: 'user-admin', identifiant: 'admin', mot_de_passe: hash,
      role_id: 'role-admin', etablissement_id: 'etablissement-default',
      nom_fr: 'Administrateur',
      nom_ar: 'مدير',
      langue: 'fr', theme: 'light',
      must_change_password: true,
    },
  });
  console.log('✅ Admin (admin / Admin123!) — changement de mot de passe requis à la première connexion');

  const matieres = [
    { id: 'mat-francais',  nom_fr: 'Français',            nom_ar: 'اللغة الفرنسية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-maths',     nom_fr: 'Mathématiques',       nom_ar: 'الرياضيات',          filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-sciences',  nom_fr: 'Sciences',            nom_ar: 'علوم الحياة',        filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-histgeo',   nom_fr: 'Histoire-Géographie', nom_ar: 'التاريخ والجغرافيا', filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-edcivique', nom_fr: 'Éducation Civique',   nom_ar: 'التربية المدنية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
    { id: 'mat-coran',     nom_fr: 'Coran',               nom_ar: 'القرآن الكريم',      filiere: 'AR', coeff_defaut: new Prisma.Decimal(4), note_max: new Prisma.Decimal(30), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-fiqh',      nom_fr: 'Fiqh',                nom_ar: 'الفقه',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-nahw',      nom_fr: 'Nahw',                nom_ar: 'النحو',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-adab',      nom_fr: 'Adab (Littérature)',  nom_ar: 'الأدب العربي',       filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-histislam', nom_fr: 'Histoire Islamique',  nom_ar: 'التاريخ الإسلامي',   filiere: 'AR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
  ];
  for (const m of matieres) {
    await prisma.matiere.upsert({ where: { id: m.id }, update: {}, create: { ...m, etablissement_id: 'etablissement-default' } });
  }
  console.log('✅ Matières (5 FR + 5 AR)');

  const niveaux = [
    { id: 'niv-ps',       libelle: 'Petite Section', ordre: 1  },
    { id: 'niv-ms',       libelle: 'Moyenne Section', ordre: 2 },
    { id: 'niv-gs',       libelle: 'Grande Section',  ordre: 3 },
    { id: 'niv-ci',       libelle: 'CI',              ordre: 4 },
    { id: 'niv-cp',       libelle: 'CP',              ordre: 5 },
    { id: 'niv-ce1',      libelle: 'CE1',             ordre: 6 },
    { id: 'niv-ce2',      libelle: 'CE2',             ordre: 7 },
    { id: 'niv-cm1',      libelle: 'CM1',             ordre: 8 },
    { id: 'niv-cm2',      libelle: 'CM2',             ordre: 9 },
    { id: 'niv-6e',       libelle: '6e',              ordre: 10 },
    { id: 'niv-5e',       libelle: '5e',              ordre: 11 },
    { id: 'niv-4e',       libelle: '4e',              ordre: 12 },
    { id: 'niv-3e',       libelle: '3e',              ordre: 13 },
    { id: 'niv-seconde',  libelle: 'Seconde',         ordre: 14 },
    { id: 'niv-premiere', libelle: 'Première',        ordre: 15 },
    { id: 'niv-terminale',libelle: 'Terminale',       ordre: 16 },
  ];
  for (const n of niveaux) {
    await prisma.niveau.upsert({
      where: { id: n.id },
      update: { libelle: n.libelle, ordre: n.ordre },
      create: { ...n, etablissement_id: 'etablissement-default' },
    });
  }
  console.log('✅ Niveaux (16 — communs FR et AR)');

  console.log('\n✅  Seed production terminé.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
