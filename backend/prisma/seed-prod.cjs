'use strict';
/**
 * Seed de production — CommonJS pur, aucune dépendance à tsx.
 * Ne crée que les données essentielles (idempotent via upsert).
 */
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ── UUIDs stables (v4 valides) ─────────────────────────────────────────────
const ID = {
  etab: '10000000-0000-4000-a000-000000000001',
  roles: {
    admin:        '20000000-0000-4000-a000-000000000001',
    directeur:    '20000000-0000-4000-a000-000000000002',
    gestionnaire: '20000000-0000-4000-a000-000000000003',
    caissier:     '20000000-0000-4000-a000-000000000004',
    professeur:   '20000000-0000-4000-a000-000000000005',
    pointeur:     '20000000-0000-4000-a000-000000000006',
  },
  users: {
    admin: '30000000-0000-4000-a000-000000000001',
  },
  matieres: {
    francais:  '40000000-0000-4000-a000-000000000001',
    maths:     '40000000-0000-4000-a000-000000000002',
    sciences:  '40000000-0000-4000-a000-000000000003',
    histgeo:   '40000000-0000-4000-a000-000000000004',
    edcivique: '40000000-0000-4000-a000-000000000005',
    coran:     '40000000-0000-4000-a000-000000000006',
    fiqh:      '40000000-0000-4000-a000-000000000007',
    nahw:      '40000000-0000-4000-a000-000000000008',
    adab:      '40000000-0000-4000-a000-000000000009',
    histislam: '40000000-0000-4000-a000-00000000000a',
  },
  niveaux: {
    ps:        'a0000000-0000-4000-a000-000000000001',
    ms:        'a0000000-0000-4000-a000-000000000002',
    gs:        'a0000000-0000-4000-a000-000000000003',
    ci:        'a0000000-0000-4000-a000-000000000004',
    cp:        'a0000000-0000-4000-a000-000000000005',
    ce1:       'a0000000-0000-4000-a000-000000000006',
    ce2:       'a0000000-0000-4000-a000-000000000007',
    cm1:       'a0000000-0000-4000-a000-000000000008',
    cm2:       'a0000000-0000-4000-a000-000000000009',
    n6e:       'a0000000-0000-4000-a000-00000000000a',
    n5e:       'a0000000-0000-4000-a000-00000000000b',
    n4e:       'a0000000-0000-4000-a000-00000000000c',
    n3e:       'a0000000-0000-4000-a000-00000000000d',
    seconde:   'a0000000-0000-4000-a000-00000000000e',
    premiere:  'a0000000-0000-4000-a000-00000000000f',
    terminale: 'a0000000-0000-4000-a000-000000000010',
  },
};

async function main() {
  console.log('\n🏫  DaaraGest — Seed production\n');

  await prisma.etablissement.upsert({
    where: { id: ID.etab },
    update: {
      nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
    create: {
      id: ID.etab,
      nom_fr: 'École Franco Arabe Cheikh Abdoul Ahad Mbacké',
      adresse: 'Guédiawaye, Dakar, Sénégal',
      telephone: '+221 33 820 12 34',
      devise: 'FCFA',
    },
  });
  console.log('✅ Établissement');

  const roles = [
    { id: ID.roles.admin,        libelle_fr: 'admin' },
    { id: ID.roles.directeur,    libelle_fr: 'directeur' },
    { id: ID.roles.gestionnaire, libelle_fr: 'gestionnaire' },
    { id: ID.roles.caissier,     libelle_fr: 'agent de scolarité' },
    { id: ID.roles.professeur,   libelle_fr: 'professeur' },
    { id: ID.roles.pointeur,     libelle_fr: 'pointeur' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, update: { libelle_fr: r.libelle_fr }, create: r });
  }
  console.log('✅ Rôles');

  await prisma.configNotes.upsert({
    where: { etablissement_id: ID.etab },
    update: {},
    create: { etablissement_id: ID.etab, note_max: 20, note_min: 0, nb_periodes: 3 },
  });
  console.log('✅ ConfigNotes');

  const hash = await bcrypt.hash('Admin123!', 10);
  await prisma.utilisateur.upsert({
    where: { identifiant: 'admin' },
    update: {},
    create: {
      id: ID.users.admin, identifiant: 'admin', mot_de_passe: hash,
      role_id: ID.roles.admin, etablissement_id: ID.etab,
      nom_fr: 'Administrateur',
      nom_ar: 'مدير',
      langue: 'fr', theme: 'light',
      must_change_password: true,
    },
  });
  console.log('✅ Admin (admin / Admin123!) — changement de mot de passe requis à la première connexion');

  const matieres = [
    { id: ID.matieres.francais,  nom_fr: 'Français',            nom_ar: 'اللغة الفرنسية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: ID.matieres.maths,     nom_fr: 'Mathématiques',       nom_ar: 'الرياضيات',          filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: ID.matieres.sciences,  nom_fr: 'Sciences',            nom_ar: 'علوم الحياة',        filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: ID.matieres.histgeo,   nom_fr: 'Histoire-Géographie', nom_ar: 'التاريخ والجغرافيا',  filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: ID.matieres.edcivique, nom_fr: 'Éducation Civique',   nom_ar: 'التربية المدنية',    filiere: 'FR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
    { id: ID.matieres.coran,     nom_fr: 'Coran',               nom_ar: 'القرآن الكريم',      filiere: 'AR', coeff_defaut: new Prisma.Decimal(4), note_max: new Prisma.Decimal(30), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: ID.matieres.fiqh,      nom_fr: 'Fiqh',                nom_ar: 'الفقه',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: ID.matieres.nahw,      nom_fr: 'Nahw',                nom_ar: 'النحو',              filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: ID.matieres.adab,      nom_fr: 'Adab (Littérature)',  nom_ar: 'الأدب العربي',       filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: ID.matieres.histislam, nom_fr: 'Histoire Islamique',  nom_ar: 'التاريخ الإسلامي',   filiere: 'AR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
  ];
  for (const m of matieres) {
    await prisma.matiere.upsert({ where: { id: m.id }, update: {}, create: { ...m, etablissement_id: ID.etab } });
  }
  console.log('✅ Matières (5 FR + 5 AR)');

  const niveaux = [
    { id: ID.niveaux.ps,        libelle: 'Petite Section', ordre: 1  },
    { id: ID.niveaux.ms,        libelle: 'Moyenne Section', ordre: 2 },
    { id: ID.niveaux.gs,        libelle: 'Grande Section',  ordre: 3 },
    { id: ID.niveaux.ci,        libelle: 'CI',              ordre: 4 },
    { id: ID.niveaux.cp,        libelle: 'CP',              ordre: 5 },
    { id: ID.niveaux.ce1,       libelle: 'CE1',             ordre: 6 },
    { id: ID.niveaux.ce2,       libelle: 'CE2',             ordre: 7 },
    { id: ID.niveaux.cm1,       libelle: 'CM1',             ordre: 8 },
    { id: ID.niveaux.cm2,       libelle: 'CM2',             ordre: 9 },
    { id: ID.niveaux.n6e,       libelle: '6e',              ordre: 10 },
    { id: ID.niveaux.n5e,       libelle: '5e',              ordre: 11 },
    { id: ID.niveaux.n4e,       libelle: '4e',              ordre: 12 },
    { id: ID.niveaux.n3e,       libelle: '3e',              ordre: 13 },
    { id: ID.niveaux.seconde,   libelle: 'Seconde',         ordre: 14 },
    { id: ID.niveaux.premiere,  libelle: 'Première',        ordre: 15 },
    { id: ID.niveaux.terminale, libelle: 'Terminale',       ordre: 16 },
  ];
  for (const n of niveaux) {
    await prisma.niveau.upsert({
      where: { id: n.id },
      update: { libelle: n.libelle, ordre: n.ordre },
      create: { ...n, etablissement_id: ID.etab },
    });
  }
  console.log('✅ Niveaux (16 — communs FR et AR)');

  console.log('\n✅  Seed production terminé.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
