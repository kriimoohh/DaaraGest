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
      nom_ar: 'مدرسة الشيخ عبد الأحد مبكي الفرنسية العربية',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
    create: {
      id: 'etablissement-default',
      nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
      nom_ar: 'مدرسة الشيخ عبد الأحد مبكي الفرنسية العربية',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
  });
  console.log('✅ Établissement');

  const roles = [
    { id: 'role-admin',      libelle_fr: 'admin',      libelle_ar: 'مدير النظام' },
    { id: 'role-directeur',  libelle_fr: 'directeur',  libelle_ar: 'المدير' },
    { id: 'role-caissier',   libelle_fr: 'caissier',   libelle_ar: 'أمين الصندوق' },
    { id: 'role-professeur', libelle_fr: 'professeur', libelle_ar: 'الأستاذ' },
    { id: 'role-pointeur',   libelle_fr: 'pointeur',   libelle_ar: 'مسجّل الحضور' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { libelle_fr: r.libelle_fr }, update: {}, create: r });
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
    where: { identifiant: 'admin' },
    update: {},
    create: {
      id: 'user-admin', identifiant: 'admin', mot_de_passe: hash,
      role_id: 'role-admin', etablissement_id: 'etablissement-default',
      nom_fr: 'Administrateur', prenom_fr: 'Super',
      nom_ar: 'مدير', prenom_ar: 'سوبر',
      langue: 'fr', theme: 'light',
    },
  });
  console.log('✅ Admin (admin / Admin123!)');

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

  console.log('\n✅  Seed production terminé.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
