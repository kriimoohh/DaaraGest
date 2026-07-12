import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LGM_DOMAINES, LGM_MATIERES } from './data/lgm-matieres';

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === 'production';

// ── UUIDs stables (v4 valides) ─────────────────────────────────────────────
// Format : <prefix>-0000-4000-a000-<séquentiel 12 hex>
// Idempotents entre runs car utilisés dans les clauses `where: { id }`.

const ID = {
  etab: '10000000-0000-4000-a000-000000000001',

  roles: {
    admin:        '20000000-0000-4000-a000-000000000001',
    directeur:    '20000000-0000-4000-a000-000000000002',
    gestionnaire:   '20000000-0000-4000-a000-000000000003',
    agentScolarite: '20000000-0000-4000-a000-000000000004',
    professeur:   '20000000-0000-4000-a000-000000000005',
    pointeur:     '20000000-0000-4000-a000-000000000006',
  },

  users: {
    admin:          '30000000-0000-4000-a000-000000000001',
    directeur:      '30000000-0000-4000-a000-000000000002',
    agentScolarite: '30000000-0000-4000-a000-000000000003',
    prof1:     '30000000-0000-4000-a000-000000000004',
    prof2:     '30000000-0000-4000-a000-000000000005',
    prof3:     '30000000-0000-4000-a000-000000000006',
    prof4:     '30000000-0000-4000-a000-000000000007',
    pointeur:  '30000000-0000-4000-a000-000000000008',
  },

  // Matières : pilotées par data/lgm-matieres.ts (76 matières du référentiel LGM).
  // Pas d'IDs fixes ici — on les retrouve par nom_fr+filiere lors du seeding des notes.

  profs: {
    p1: '50000000-0000-4000-a000-000000000001',
    p2: '50000000-0000-4000-a000-000000000002',
    p3: '50000000-0000-4000-a000-000000000003',
    p4: '50000000-0000-4000-a000-000000000004',
  },

  annees: {
    y2425: '60000000-0000-4000-a000-000000000001',
    y2324: '60000000-0000-4000-a000-000000000002',
  },

  classes: {
    cm1fr: '70000000-0000-4000-a000-000000000001',
    cm2fr: '70000000-0000-4000-a000-000000000002',
    a5ar:  '70000000-0000-4000-a000-000000000003',
    a6ar:  '70000000-0000-4000-a000-000000000004',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function note(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 4) / 4;
}

function recu(): string {
  return `REC-${String(Math.floor(Math.random() * 90000 + 10000))}`;
}

// ── Seed principal ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏫  DaaraGest — Seed ${isProd ? 'PRODUCTION' : 'développement'}\n`);

  // ── 1. Établissement ────────────────────────────────────────────────────────
  // update: {} → on ne ré-écrase pas les modifications faites via Paramètres
  // si la seed est relancée sur une DB existante.
  const etab = await prisma.etablissement.upsert({
    where: { id: ID.etab },
    update: {},
    create: {
      id: ID.etab,
      nom_fr: 'F.I.C.A.A.M. — École Franco-Arabe Cheikh Abdoul Ahad Mbacké',
      code: 'FIC',
      adresse: 'Cité AKF Guédiawaye',
      telephone: '33 877 76 30',
      devise: 'FCFA',
    },
  });
  console.log('✅ Établissement :', etab.nom_fr);

  // ── 2. Rôles ────────────────────────────────────────────────────────────────
  const roles = [
    { id: ID.roles.admin,        libelle_fr: 'admin' },
    { id: ID.roles.directeur,    libelle_fr: 'directeur' },
    { id: ID.roles.gestionnaire, libelle_fr: 'gestionnaire' },
    { id: ID.roles.agentScolarite, libelle_fr: 'agent de scolarité' },
    { id: ID.roles.professeur,   libelle_fr: 'professeur' },
    { id: ID.roles.pointeur,     libelle_fr: 'pointeur' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, update: { libelle_fr: r.libelle_fr }, create: r });
  }
  console.log('✅ Rôles :', roles.map(r => r.libelle_fr).join(', '));

  // ── 3. Config notes ─────────────────────────────────────────────────────────
  await prisma.configNotes.upsert({
    where: { etablissement_id: ID.etab },
    update: {},
    create: { etablissement_id: ID.etab, note_max: 20, note_min: 0, nb_periodes: 3 },
  });
  console.log('✅ ConfigNotes');

  // ── 4. Compte admin (toujours créé) ─────────────────────────────────────────
  await prisma.utilisateur.upsert({
    where: { identifiant: 'admin' },
    update: {},
    create: {
      id: ID.users.admin,
      identifiant: 'admin',
      mot_de_passe: await bcrypt.hash('Admin123!', 10),
      role_id: ID.roles.admin,
      etablissement_id: ID.etab,
      nom_fr: 'Administrateur',
      langue: 'fr', theme: 'light',
      must_change_password: true,
    },
  });
  console.log('✅ Compte admin créé (admin / Admin123!) — changement de mot de passe requis à la connexion');

  // ── 5. Domaines pédagogiques (référentiel LGM) ──────────────────────────────
  for (const d of LGM_DOMAINES) {
    await prisma.domaine.upsert({
      where: { etablissement_id_code: { etablissement_id: ID.etab, code: d.code } },
      update: { nom_fr: d.nom_fr, ordre: d.ordre, actif: true },
      create: { etablissement_id: ID.etab, code: d.code, nom_fr: d.nom_fr, ordre: d.ordre, actif: true },
    });
  }
  console.log(`✅ Domaines (${LGM_DOMAINES.length})`);

  // ── 5b. Filières (entité Phase 0 refonte filières : FR + AR) ────────────────
  const FILIERES_SEED = [
    { code: 'FR', nom_fr: 'Filière française', nom_ar: null,            langue: 'fr', sens_ecriture: 'LTR', couleur: '#DDE2F1', ordre: 0 },
    { code: 'AR', nom_fr: 'Filière arabe',     nom_ar: 'الشعبة العربية', langue: 'ar', sens_ecriture: 'RTL', couleur: '#DCEBDF', ordre: 1 },
  ];
  for (const f of FILIERES_SEED) {
    await prisma.filiere.upsert({
      where: { etablissement_id_code: { etablissement_id: ID.etab, code: f.code } },
      update: {},
      create: { etablissement_id: ID.etab, ...f },
    });
  }
  const filiereByCode = new Map(
    (await prisma.filiere.findMany({ where: { etablissement_id: ID.etab } })).map(f => [f.code, f.id]),
  );
  console.log(`✅ Filières (${FILIERES_SEED.length})`);

  // ── 6. Matières (référentiel LGM — 76 matières classées par domaine) ────────
  const domainesByCode = new Map(
    (await prisma.domaine.findMany({ where: { etablissement_id: ID.etab } }))
      .map(d => [d.code, d.id]),
  );
  for (const m of LGM_MATIERES) {
    const filiereId = filiereByCode.get(m.filiere);
    if (!filiereId) throw new Error(`Filière ${m.filiere} absente du seed`);
    const existing = await prisma.matiere.findFirst({
      where: { etablissement_id: ID.etab, nom_fr: m.nom_fr, filiere_id: filiereId },
    });
    const data = {
      etablissement_id: ID.etab,
      nom_fr: m.nom_fr,
      nom_ar: m.nom_ar,
      filiere_id: filiereId,
      coeff_defaut: new Prisma.Decimal(1),
      note_min: new Prisma.Decimal(0),
      ordre_bulletin: m.ordre_bulletin,
      code_court: m.code_court,
      type_note: m.type_note,
      domaine_id: domainesByCode.get(m.domaine_code) ?? null,
      active: true,
    };
    if (existing) {
      await prisma.matiere.update({ where: { id: existing.id }, data });
    } else {
      await prisma.matiere.create({ data });
    }
  }
  console.log(`✅ Matières (${LGM_MATIERES.length} — référentiel LGM)`);

  if (isProd) {
    console.log('\n✅  Seed production terminé — base prête.\n');
    console.log('  Connectez-vous avec : admin / Admin123!');
    console.log('  (changez ce mot de passe immédiatement)\n');
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  DONNÉES DE TEST — développement uniquement (NODE_ENV !== 'production')
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n📦  Insertion des données de test...\n');

  // Utilisateurs test
  const testUsers = [
    { id: ID.users.directeur, identifiant: 'directeur',   mot_de_passe: await bcrypt.hash('Directeur123!', 10), role_id: ID.roles.directeur,
      nom_fr: 'Diop' },
    // Identifiant de connexion « caissier » conservé (habitudes dev) ; le rôle
    // pointé est bien « agent de scolarité ».
    { id: ID.users.agentScolarite, identifiant: 'caissier', mot_de_passe: await bcrypt.hash('Caissier123!', 10), role_id: ID.roles.agentScolarite,
      nom_fr: 'Sow' },
    { id: ID.users.prof1,     identifiant: 'prof.fall',   mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: ID.roles.professeur,
      nom_fr: 'Fall' },
    { id: ID.users.prof2,     identifiant: 'prof.diallo', mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: ID.roles.professeur,
      nom_fr: 'Diallo' },
    { id: ID.users.prof3,     identifiant: 'prof.ahmed',  mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: ID.roles.professeur,
      nom_fr: 'Ahmed' },
    { id: ID.users.prof4,     identifiant: 'prof.ndiaye', mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: ID.roles.professeur,
      nom_fr: 'Ndiaye' },
    { id: ID.users.pointeur,  identifiant: 'pointeur',    mot_de_passe: await bcrypt.hash('Pointeur123!', 10),  role_id: ID.roles.pointeur,
      nom_fr: 'Ba' },
  ];
  for (const u of testUsers) {
    await prisma.utilisateur.upsert({
      where: { identifiant: u.identifiant },
      update: {},
      create: { ...u, etablissement_id: ID.etab, langue: 'fr', theme: 'light' },
    });
  }
  console.log('✅ Utilisateurs test :', testUsers.map(u => u.identifiant).join(', '));

  // Personnel (anciennement Professeur — refactor unifié)
  const profsData = [
    { id: ID.profs.p1, utilisateur_id: ID.users.prof1, matricule: 'FIC-P-24-001', specialite_fr: 'Français & Mathématiques', type_contrat: 'permanent', salaire_base: new Prisma.Decimal(250000), date_embauche: new Date('2020-09-01') },
    { id: ID.profs.p2, utilisateur_id: ID.users.prof2, matricule: 'FIC-P-24-002', specialite_fr: 'Sciences Naturelles',      type_contrat: 'permanent', salaire_base: new Prisma.Decimal(220000), date_embauche: new Date('2019-09-01') },
    { id: ID.profs.p3, utilisateur_id: ID.users.prof3, matricule: 'FIC-P-24-003', specialite_fr: 'Coran & Fiqh',             type_contrat: 'permanent', salaire_base: new Prisma.Decimal(230000), date_embauche: new Date('2021-09-01') },
    { id: ID.profs.p4, utilisateur_id: ID.users.prof4, matricule: 'FIC-P-24-004', specialite_fr: 'Langue Arabe & Nahw',      type_contrat: 'vacataire', salaire_base: new Prisma.Decimal(180000), date_embauche: new Date('2022-01-15') },
  ];
  for (const p of profsData) {
    await prisma.personnel.upsert({ where: { utilisateur_id: p.utilisateur_id }, update: { matricule: p.matricule }, create: p });
  }

  // Années scolaires
  await prisma.anneeScolaire.updateMany({ where: { etablissement_id: ID.etab }, data: { active: false } });
  const annees = [
    { id: ID.annees.y2425, libelle: '2024-2025', date_debut: new Date('2024-09-02'), date_fin: new Date('2025-06-27'), active: true },
    { id: ID.annees.y2324, libelle: '2023-2024', date_debut: new Date('2023-09-04'), date_fin: new Date('2024-06-28'), active: false },
  ];
  for (const a of annees) {
    await prisma.anneeScolaire.upsert({ where: { id: a.id }, update: { active: a.active }, create: { ...a, etablissement_id: ID.etab } });
  }

  // Classes — niveau_id laissé null pour le seed dev (renseigné via Paramètres
  // ou via le script seed-prod.cjs qui peuple les 16 Niveau du référentiel).
  const classes = [
    { id: ID.classes.cm1fr, nom_fr: 'CM1 Français', filiere: 'FR', capacite: 35, annee_scolaire_id: ID.annees.y2425 },
    { id: ID.classes.cm2fr, nom_fr: 'CM2 Français', filiere: 'FR', capacite: 30, annee_scolaire_id: ID.annees.y2425 },
    { id: ID.classes.a5ar,  nom_fr: '5ème Arabe',   filiere: 'AR', capacite: 30, annee_scolaire_id: ID.annees.y2425 },
    { id: ID.classes.a6ar,  nom_fr: '6ème Arabe',   filiere: 'AR', capacite: 25, annee_scolaire_id: ID.annees.y2425 },
  ];
  for (const { filiere, ...cl } of classes) {
    await prisma.classe.upsert({
      where: { id: cl.id },
      update: {},
      create: { ...cl, etablissement_id: ID.etab, filiere_id: filiereByCode.get(filiere)! },
    });
  }

  // Élèves
  const elevesData = [
    { id: '80000000-0000-4000-a000-000000000001', inscId: '90000000-0000-4000-a000-000000000001', matricule: 'FIC-E-24-001', nom_fr: 'Diallo',  prenom_fr: 'Oumar',       sexe: 'M', dn: '2013-03-15', cf: ID.classes.cm1fr, ca: null,          parent: { nom: 'Mamadou Diallo',   lien: 'pere',   tel: '+221 77 123 45 01' } },
    { id: '80000000-0000-4000-a000-000000000002', inscId: '90000000-0000-4000-a000-000000000002', matricule: 'FIC-E-24-002', nom_fr: 'Ndiaye',  prenom_fr: 'Fatou',       sexe: 'F', dn: '2013-07-22', cf: ID.classes.cm1fr, ca: null,          parent: { nom: 'Rokhaya Ndiaye',   lien: 'mere',   tel: '+221 76 234 56 02' } },
    { id: '80000000-0000-4000-a000-000000000003', inscId: '90000000-0000-4000-a000-000000000003', matricule: 'FIC-E-24-003', nom_fr: 'Sall',    prenom_fr: 'Ibrahima',    sexe: 'M', dn: '2012-11-08', cf: ID.classes.cm1fr, ca: null,          parent: { nom: 'Abdou Sall',        lien: 'pere',   tel: '+221 78 345 67 03' } },
    { id: '80000000-0000-4000-a000-000000000004', inscId: '90000000-0000-4000-a000-000000000004', matricule: 'FIC-E-24-004', nom_fr: 'Camara',  prenom_fr: 'Mariama',     sexe: 'F', dn: '2013-05-30', cf: ID.classes.cm1fr, ca: null,          parent: { nom: 'Aissatou Camara',   lien: 'mere',   tel: '+221 70 456 78 04' } },
    { id: '80000000-0000-4000-a000-000000000005', inscId: '90000000-0000-4000-a000-000000000005', matricule: 'FIC-E-24-005', nom_fr: 'Mbaye',   prenom_fr: 'Cheikh',      sexe: 'M', dn: '2013-01-14', cf: ID.classes.cm1fr, ca: null,          parent: { nom: 'Omar Mbaye',        lien: 'pere',   tel: '+221 77 567 89 05' } },
    { id: '80000000-0000-4000-a000-000000000006', inscId: '90000000-0000-4000-a000-000000000006', matricule: 'FIC-E-24-006', nom_fr: 'Thiam',   prenom_fr: 'Modou',       sexe: 'M', dn: '2012-08-19', cf: ID.classes.cm2fr, ca: null,          parent: { nom: 'Lamine Thiam',      lien: 'pere',   tel: '+221 76 678 90 06' } },
    { id: '80000000-0000-4000-a000-000000000007', inscId: '90000000-0000-4000-a000-000000000007', matricule: 'FIC-E-24-007', nom_fr: 'Sarr',    prenom_fr: 'Aissatou',    sexe: 'F', dn: '2012-04-03', cf: ID.classes.cm2fr, ca: null,          parent: { nom: 'Bineta Sarr',       lien: 'mere',   tel: '+221 78 789 01 07' } },
    { id: '80000000-0000-4000-a000-000000000008', inscId: '90000000-0000-4000-a000-000000000008', matricule: 'FIC-E-24-008', nom_fr: 'Fall',    prenom_fr: 'Babacar',     sexe: 'M', dn: '2012-09-25', cf: ID.classes.cm2fr, ca: null,          parent: { nom: 'Abdoulaye Fall',    lien: 'pere',   tel: '+221 70 890 12 08' } },
    { id: '80000000-0000-4000-a000-000000000009', inscId: '90000000-0000-4000-a000-000000000009', matricule: 'FIC-E-24-009', nom_fr: 'Toure',   prenom_fr: 'Ndeye',       sexe: 'F', dn: '2012-12-11', cf: ID.classes.cm2fr, ca: null,          parent: { nom: 'Moussa Toure',      lien: 'pere',   tel: '+221 77 901 23 09' } },
    { id: '80000000-0000-4000-a000-00000000000a', inscId: '90000000-0000-4000-a000-00000000000a', matricule: 'FIC-E-24-010', nom_fr: 'Gaye',    prenom_fr: 'Lamine',      sexe: 'M', dn: '2012-06-07', cf: ID.classes.cm2fr, ca: null,          parent: { nom: 'Sokhna Gaye',       lien: 'mere',   tel: '+221 76 012 34 10' } },
    { id: '80000000-0000-4000-a000-00000000000b', inscId: '90000000-0000-4000-a000-00000000000b', matricule: 'FIC-E-24-011', nom_fr: 'Baldé',   prenom_fr: 'Kadiatou',    sexe: 'F', dn: '2012-02-28', cf: null,             ca: ID.classes.a5ar, parent: { nom: 'Amadou Baldé',      lien: 'pere',   tel: '+221 78 123 45 11' } },
    { id: '80000000-0000-4000-a000-00000000000c', inscId: '90000000-0000-4000-a000-00000000000c', matricule: 'FIC-E-24-012', nom_fr: 'Diop',    prenom_fr: 'Bamba',       sexe: 'M', dn: '2012-10-16', cf: null,             ca: ID.classes.a5ar, parent: { nom: 'Serigne Diop',      lien: 'pere',   tel: '+221 70 234 56 12' } },
    { id: '80000000-0000-4000-a000-00000000000d', inscId: '90000000-0000-4000-a000-00000000000d', matricule: 'FIC-E-24-013', nom_fr: 'Kouyaté', prenom_fr: 'Seydina',     sexe: 'M', dn: '2011-07-04', cf: null,             ca: ID.classes.a5ar, parent: { nom: 'Boubacar Kouyaté', lien: 'pere',   tel: '+221 77 345 67 13' } },
    { id: '80000000-0000-4000-a000-00000000000e', inscId: '90000000-0000-4000-a000-00000000000e', matricule: 'FIC-E-24-014', nom_fr: 'Ly',      prenom_fr: 'Khady',       sexe: 'F', dn: '2012-03-20', cf: null,             ca: ID.classes.a5ar, parent: { nom: 'Mor Ly',            lien: 'pere',   tel: '+221 76 456 78 14' } },
    { id: '80000000-0000-4000-a000-00000000000f', inscId: '90000000-0000-4000-a000-00000000000f', matricule: 'FIC-E-24-015', nom_fr: 'Cissé',   prenom_fr: 'Abdourahman', sexe: 'M', dn: '2011-11-30', cf: null,             ca: ID.classes.a5ar, parent: { nom: 'Issa Cissé',        lien: 'pere',   tel: '+221 78 567 89 15' } },
    { id: '80000000-0000-4000-a000-000000000010', inscId: '90000000-0000-4000-a000-000000000010', matricule: 'FIC-E-24-016', nom_fr: 'Kane',    prenom_fr: 'Mariétou',    sexe: 'F', dn: '2011-05-12', cf: null,             ca: ID.classes.a6ar, parent: { nom: 'Alioune Kane',      lien: 'pere',   tel: '+221 70 678 90 16' } },
    { id: '80000000-0000-4000-a000-000000000011', inscId: '90000000-0000-4000-a000-000000000011', matricule: 'FIC-E-24-017', nom_fr: 'Sy',      prenom_fr: 'Omar',        sexe: 'M', dn: '2011-08-07', cf: null,             ca: ID.classes.a6ar, parent: { nom: 'El-Hadj Sy',        lien: 'pere',   tel: '+221 77 789 01 17' } },
    { id: '80000000-0000-4000-a000-000000000012', inscId: '90000000-0000-4000-a000-000000000012', matricule: 'FIC-E-24-018', nom_fr: 'Diouf',   prenom_fr: 'Rokhaya',     sexe: 'F', dn: '2011-01-25', cf: null,             ca: ID.classes.a6ar, parent: { nom: 'Ibou Diouf',        lien: 'pere',   tel: '+221 76 890 12 18' } },
    { id: '80000000-0000-4000-a000-000000000013', inscId: '90000000-0000-4000-a000-000000000013', matricule: 'FIC-E-24-019', nom_fr: 'Bâ',      prenom_fr: 'Hamidou',     sexe: 'M', dn: '2010-09-14', cf: null,             ca: ID.classes.a6ar, parent: { nom: 'Amadou Bâ',         lien: 'pere',   tel: '+221 78 901 23 19' } },
    { id: '80000000-0000-4000-a000-000000000014', inscId: '90000000-0000-4000-a000-000000000014', matricule: 'FIC-E-24-020', nom_fr: 'Faye',    prenom_fr: 'Amy',         sexe: 'F', dn: '2011-04-09', cf: null,             ca: ID.classes.a6ar, parent: { nom: 'Bocar Faye',        lien: 'tuteur', tel: '+221 70 012 34 20' } },
  ];

  for (const e of elevesData) {
    await prisma.eleve.upsert({
      where: { id: e.id },
      update: { matricule: e.matricule },
      create: {
        id: e.id, etablissement_id: ID.etab,
        matricule: e.matricule, nom_fr: e.nom_fr,
        prenom_fr: e.prenom_fr,
        sexe: e.sexe, date_naissance: new Date(e.dn),
        parents: { create: { nom_fr: e.parent.nom, lien: e.parent.lien, telephone: e.parent.tel } },
      },
    });
    if (!await prisma.inscription.findFirst({ where: { id: e.inscId } })) {
      await prisma.inscription.create({
        data: { id: e.inscId, eleve_id: e.id, annee_scolaire_id: ID.annees.y2425, statut: 'actif' },
      });
      // Jointure InscriptionClasse : une ligne par filière assignée.
      const liens = [
        ...(e.cf && filiereByCode.get('FR') ? [{ inscription_id: e.inscId, filiere_id: filiereByCode.get('FR')!, classe_id: e.cf }] : []),
        ...(e.ca && filiereByCode.get('AR') ? [{ inscription_id: e.inscId, filiere_id: filiereByCode.get('AR')!, classe_id: e.ca }] : []),
      ];
      if (liens.length) await prisma.inscriptionClasse.createMany({ data: liens, skipDuplicates: true });
    }
  }
  console.log('✅ Élèves test (20) + inscriptions');

  // Notes T1 + T2 — échantillon représentatif (5 matières FR + 5 matières AR)
  // Choix : Lecture, Grammaire, Mathématiques: Ressources, Géométrie, Calcul (FR)
  //         Coran, Hadith, Tawhid, Étude du Texte / Arabe, Arabe (AR)
  const matieresAll = await prisma.matiere.findMany({ where: { etablissement_id: ID.etab } });
  const pick = (nom: string, fil: 'FR' | 'AR') => {
    const m = matieresAll.find(x => x.nom_fr === nom && x.filiere_id === filiereByCode.get(fil));
    if (!m) throw new Error(`Matière introuvable pour seed notes : ${nom} (${fil})`);
    return m.id;
  };
  const matFR = [
    pick('Lecture', 'FR'),
    pick('Grammaire', 'FR'),
    pick('Mathématiques : Ressources', 'FR'),
    pick('Géométrie', 'FR'),
    pick('Calcul', 'FR'),
  ];
  const matAR = [
    pick('Coran', 'AR'),
    pick('Hadith', 'AR'),
    pick('Tawhid', 'AR'),
    pick('Étude du Texte / Arabe', 'AR'),
    pick('Arabe', 'AR'),
  ];

  // Programme : rattacher ces matières aux classes correspondantes (ClasseMatiere).
  // Sans ces entrées, les bulletins seraient vides et la page Notes refuserait
  // la saisie via l'API. On utilise skipDuplicates pour rester idempotent.
  const programme: { classe_id: string; matiere_id: string }[] = [];
  for (const cId of [ID.classes.cm1fr, ID.classes.cm2fr]) {
    for (const mId of matFR) programme.push({ classe_id: cId, matiere_id: mId });
  }
  for (const cId of [ID.classes.a5ar, ID.classes.a6ar]) {
    for (const mId of matAR) programme.push({ classe_id: cId, matiere_id: mId });
  }
  const cmRes = await prisma.classeMatiere.createMany({ data: programme, skipDuplicates: true });
  console.log(`✅ Programme classes (ClasseMatiere) : +${cmRes.count}/${programme.length} entrées`);

  let noteCount = 0;
  for (const periode of [1, 2]) {
    for (const e of elevesData.filter(e => e.cf)) {
      for (const matId of matFR) {
        if (!await prisma.note.findUnique({ where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: ID.annees.y2425 } } })) {
          await prisma.note.create({ data: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: ID.annees.y2425, valeur: note(8, 19) } });
          noteCount++;
        }
      }
    }
    for (const e of elevesData.filter(e => e.ca)) {
      for (const matId of matAR) {
        if (!await prisma.note.findUnique({ where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: ID.annees.y2425 } } })) {
          await prisma.note.create({ data: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: ID.annees.y2425, valeur: note(7, 18) } });
          noteCount++;
        }
      }
    }
  }
  console.log(`✅ Notes test : ${noteCount} (T1 + T2)`);

  // Paiements élèves
  const moisPaies = [9, 10, 11, 12, 1, 2, 3];
  let paiCount = 0;
  for (const e of elevesData) {
    if (!await prisma.paiementEleve.findFirst({ where: { eleve_id: e.id, type: 'inscription' } })) {
      await prisma.paiementEleve.create({ data: { eleve_id: e.id, inscription_id: e.inscId, type: 'inscription', montant: 15000, annee: 2024, recu_numero: recu(), statut: 'paye' } });
      paiCount++;
    }
    const nbMois = ['80000000-0000-4000-a000-000000000004','80000000-0000-4000-a000-00000000000c'].includes(e.id) ? 3
      : ['80000000-0000-4000-a000-000000000011','80000000-0000-4000-a000-000000000013'].includes(e.id) ? 4
      : moisPaies.length;
    for (let i = 0; i < nbMois; i++) {
      const mois = moisPaies[i];
      const annee = mois >= 9 ? 2024 : 2025;
      if (!await prisma.paiementEleve.findFirst({ where: { eleve_id: e.id, type: 'mensualite', mois, annee } })) {
        await prisma.paiementEleve.create({ data: { eleve_id: e.id, inscription_id: e.inscId, type: 'mensualite', montant: 7500, mois, annee, recu_numero: recu(), statut: 'paye' } });
        paiCount++;
      }
    }
  }
  console.log(`✅ Paiements test élèves : ${paiCount}`);

  // Paiements personnel
  let profPaiCount = 0;
  const profPaie = [
    [ID.profs.p1, 250000], [ID.profs.p2, 220000],
    [ID.profs.p3, 230000], [ID.profs.p4, 180000],
  ] as [string, number][];
  for (const [profId, brut] of profPaie) {
    for (const mois of [9, 10, 11, 12, 1, 2]) {
      const annee = mois >= 9 ? 2024 : 2025;
      if (!await prisma.paiementPersonnel.findFirst({ where: { personnel_id: profId, mois, annee } })) {
        const retenues = Math.round(brut * 0.05);
        await prisma.paiementPersonnel.create({ data: { personnel_id: profId, mois, annee, montant_brut: brut, retenues, net_a_payer: brut - retenues, statut: 'paye' } });
        profPaiCount++;
      }
    }
  }
  console.log(`✅ Paiements test personnel : ${profPaiCount}`);

  console.log('\n🎉  Seed développement terminé !\n');
  console.log('  admin / Admin123!  |  directeur / Directeur123!');
  console.log('  caissier / Caissier123!  |  prof.fall / Prof123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
