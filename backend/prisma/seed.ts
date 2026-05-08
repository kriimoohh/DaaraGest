import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === 'production';

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
  const etab = await prisma.etablissement.upsert({
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
  console.log('✅ Établissement :', etab.nom_fr);

  // ── 2. Rôles ────────────────────────────────────────────────────────────────
  const roles = [
    { id: 'role-admin',         libelle_fr: 'admin',               libelle_ar: 'مدير النظام' },
    { id: 'role-directeur',     libelle_fr: 'directeur',           libelle_ar: 'المدير' },
    { id: 'role-gestionnaire',  libelle_fr: 'gestionnaire',        libelle_ar: 'المدير التنفيذي' },
    { id: 'role-caissier',      libelle_fr: 'agent de scolarité',  libelle_ar: 'عون التمدرس' },
    { id: 'role-professeur',    libelle_fr: 'professeur',          libelle_ar: 'الأستاذ' },
    { id: 'role-pointeur',      libelle_fr: 'pointeur',            libelle_ar: 'مسجّل الحضور' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, update: { libelle_fr: r.libelle_fr, libelle_ar: r.libelle_ar }, create: r });
  }
  console.log('✅ Rôles :', roles.map(r => r.libelle_fr).join(', '));

  // ── 3. Config notes ─────────────────────────────────────────────────────────
  await prisma.configNotes.upsert({
    where: { etablissement_id: 'etablissement-default' },
    update: {},
    create: { etablissement_id: 'etablissement-default', note_max: 20, note_min: 0, nb_periodes: 3 },
  });
  console.log('✅ ConfigNotes');

  // ── 4. Compte admin (toujours créé) ─────────────────────────────────────────
  await prisma.utilisateur.upsert({
    where: { identifiant: 'admin' },
    update: {},
    create: {
      id: 'user-admin',
      identifiant: 'admin',
      mot_de_passe: await bcrypt.hash('Admin123!', 10),
      role_id: 'role-admin',
      etablissement_id: 'etablissement-default',
      nom_fr: 'Administrateur',
      nom_ar: 'مدير',
      langue: 'fr', theme: 'light',
      doit_changer_mdp: true, // Forcer le changement à la première connexion
    },
  });
  console.log('✅ Compte admin créé (admin / Admin123!) — changement de mot de passe requis');

  // ── 5. Matières (utiles dès le départ, même en production) ──────────────────
  const matieres = [
    { id: 'mat-francais',  nom_fr: 'Français',            nom_ar: 'اللغة الفرنسية',   filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-maths',     nom_fr: 'Mathématiques',       nom_ar: 'الرياضيات',         filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-sciences',  nom_fr: 'Sciences',            nom_ar: 'علوم الحياة',       filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-histgeo',   nom_fr: 'Histoire-Géographie', nom_ar: 'التاريخ والجغرافيا', filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-edcivique', nom_fr: 'Éducation Civique',   nom_ar: 'التربية المدنية',   filiere: 'FR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
    { id: 'mat-coran',     nom_fr: 'Coran',               nom_ar: 'القرآن الكريم',     filiere: 'AR', coeff_defaut: new Prisma.Decimal(4), note_max: new Prisma.Decimal(30), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-fiqh',      nom_fr: 'Fiqh',                nom_ar: 'الفقه',             filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-nahw',      nom_fr: 'Nahw',                nom_ar: 'النحو',             filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-adab',      nom_fr: 'Adab (Littérature)',  nom_ar: 'الأدب العربي',      filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-histislam', nom_fr: 'Histoire Islamique',  nom_ar: 'التاريخ الإسلامي',  filiere: 'AR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
  ];
  for (const m of matieres) {
    await prisma.matiere.upsert({ where: { id: m.id }, update: {}, create: { ...m, etablissement_id: 'etablissement-default' } });
  }
  console.log('✅ Matières (5 FR + 5 AR)');

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
    { id: 'user-directeur',  identifiant: 'directeur',  mot_de_passe: await bcrypt.hash('Directeur123!', 10), role_id: 'role-directeur',
      nom_fr: 'Diop', nom_ar: 'ديوب' },
    { id: 'user-caissier',   identifiant: 'caissier',   mot_de_passe: await bcrypt.hash('Caissier123!', 10),  role_id: 'role-caissier',
      nom_fr: 'Sow', nom_ar: 'ساو' },
    { id: 'user-prof1',      identifiant: 'prof.fall',  mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: 'role-professeur',
      nom_fr: 'Fall', nom_ar: 'فال' },
    { id: 'user-prof2',      identifiant: 'prof.diallo',mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: 'role-professeur',
      nom_fr: 'Diallo', nom_ar: 'ديالو' },
    { id: 'user-prof3',      identifiant: 'prof.ahmed', mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: 'role-professeur',
      nom_fr: 'Ahmed', nom_ar: 'أحمد' },
    { id: 'user-prof4',      identifiant: 'prof.ndiaye',mot_de_passe: await bcrypt.hash('Prof123!', 10),      role_id: 'role-professeur',
      nom_fr: 'Ndiaye', nom_ar: 'نجاي' },
    { id: 'user-pointeur',   identifiant: 'pointeur',   mot_de_passe: await bcrypt.hash('Pointeur123!', 10),  role_id: 'role-pointeur',
      nom_fr: 'Ba', nom_ar: 'با' },
  ];
  for (const u of testUsers) {
    await prisma.utilisateur.upsert({
      where: { identifiant: u.identifiant },
      update: {},
      create: { ...u, etablissement_id: 'etablissement-default', langue: 'fr', theme: 'light' },
    });
  }
  console.log('✅ Utilisateurs test :', testUsers.map(u => u.identifiant).join(', '));

  // Professeurs
  const profsData = [
    { id: 'prof-1', utilisateur_id: 'user-prof1', specialite_fr: 'Français & Mathématiques', type_contrat: 'permanent', salaire_base: new Prisma.Decimal(250000), date_embauche: new Date('2020-09-01') },
    { id: 'prof-2', utilisateur_id: 'user-prof2', specialite_fr: 'Sciences Naturelles',      type_contrat: 'permanent', salaire_base: new Prisma.Decimal(220000), date_embauche: new Date('2019-09-01') },
    { id: 'prof-3', utilisateur_id: 'user-prof3', specialite_fr: 'Coran & Fiqh',             type_contrat: 'permanent', salaire_base: new Prisma.Decimal(230000), date_embauche: new Date('2021-09-01') },
    { id: 'prof-4', utilisateur_id: 'user-prof4', specialite_fr: 'Langue Arabe & Nahw',      type_contrat: 'vacataire', salaire_base: new Prisma.Decimal(180000), date_embauche: new Date('2022-01-15') },
  ];
  for (const p of profsData) {
    await prisma.professeur.upsert({ where: { utilisateur_id: p.utilisateur_id }, update: {}, create: p });
  }

  // Années scolaires
  await prisma.anneeScolaire.updateMany({ where: { etablissement_id: 'etablissement-default' }, data: { active: false } });
  const annees = [
    { id: 'annee-2024-2025', libelle: '2024-2025', date_debut: new Date('2024-09-02'), date_fin: new Date('2025-06-27'), active: true },
    { id: 'annee-2023-2024', libelle: '2023-2024', date_debut: new Date('2023-09-04'), date_fin: new Date('2024-06-28'), active: false },
  ];
  for (const a of annees) {
    await prisma.anneeScolaire.upsert({ where: { id: a.id }, update: { active: a.active }, create: { ...a, etablissement_id: 'etablissement-default' } });
  }

  // Classes
  const classes = [
    { id: 'classe-cm1-fr', nom_fr: 'CM1 Français', filiere: 'FR', niveau: 'CM1', capacite: 35, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-cm2-fr', nom_fr: 'CM2 Français', filiere: 'FR', niveau: 'CM2', capacite: 30, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-5ar',    nom_fr: '5ème Arabe',   filiere: 'AR', niveau: '5ème', capacite: 30, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-6ar',    nom_fr: '6ème Arabe',   filiere: 'AR', niveau: '6ème', capacite: 25, annee_scolaire_id: 'annee-2024-2025' },
  ];
  for (const cl of classes) {
    await prisma.classe.upsert({ where: { id: cl.id }, update: {}, create: { ...cl, etablissement_id: 'etablissement-default' } });
  }

  // Élèves
  const elevesData = [
    { id: 'el-01', matricule: 'DG-2024-001', nom_fr: 'Diallo',  prenom_fr: 'Oumar',      sexe: 'M', dn: '2013-03-15', cf: 'classe-cm1-fr', parent: { nom: 'Mamadou Diallo',   lien: 'pere', tel: '+221 77 123 45 01' } },
    { id: 'el-02', matricule: 'DG-2024-002', nom_fr: 'Ndiaye',  prenom_fr: 'Fatou',      sexe: 'F', dn: '2013-07-22', cf: 'classe-cm1-fr', parent: { nom: 'Rokhaya Ndiaye',   lien: 'mere', tel: '+221 76 234 56 02' } },
    { id: 'el-03', matricule: 'DG-2024-003', nom_fr: 'Sall',    prenom_fr: 'Ibrahima',   sexe: 'M', dn: '2012-11-08', cf: 'classe-cm1-fr', parent: { nom: 'Abdou Sall',        lien: 'pere', tel: '+221 78 345 67 03' } },
    { id: 'el-04', matricule: 'DG-2024-004', nom_fr: 'Camara',  prenom_fr: 'Mariama',    sexe: 'F', dn: '2013-05-30', cf: 'classe-cm1-fr', parent: { nom: 'Aissatou Camara',   lien: 'mere', tel: '+221 70 456 78 04' } },
    { id: 'el-05', matricule: 'DG-2024-005', nom_fr: 'Mbaye',   prenom_fr: 'Cheikh',     sexe: 'M', dn: '2013-01-14', cf: 'classe-cm1-fr', parent: { nom: 'Omar Mbaye',        lien: 'pere', tel: '+221 77 567 89 05' } },
    { id: 'el-06', matricule: 'DG-2024-006', nom_fr: 'Thiam',   prenom_fr: 'Modou',      sexe: 'M', dn: '2012-08-19', cf: 'classe-cm2-fr', parent: { nom: 'Lamine Thiam',      lien: 'pere', tel: '+221 76 678 90 06' } },
    { id: 'el-07', matricule: 'DG-2024-007', nom_fr: 'Sarr',    prenom_fr: 'Aissatou',   sexe: 'F', dn: '2012-04-03', cf: 'classe-cm2-fr', parent: { nom: 'Bineta Sarr',       lien: 'mere', tel: '+221 78 789 01 07' } },
    { id: 'el-08', matricule: 'DG-2024-008', nom_fr: 'Fall',    prenom_fr: 'Babacar',    sexe: 'M', dn: '2012-09-25', cf: 'classe-cm2-fr', parent: { nom: 'Abdoulaye Fall',    lien: 'pere', tel: '+221 70 890 12 08' } },
    { id: 'el-09', matricule: 'DG-2024-009', nom_fr: 'Toure',   prenom_fr: 'Ndeye',      sexe: 'F', dn: '2012-12-11', cf: 'classe-cm2-fr', parent: { nom: 'Moussa Toure',      lien: 'pere', tel: '+221 77 901 23 09' } },
    { id: 'el-10', matricule: 'DG-2024-010', nom_fr: 'Gaye',    prenom_fr: 'Lamine',     sexe: 'M', dn: '2012-06-07', cf: 'classe-cm2-fr', parent: { nom: 'Sokhna Gaye',       lien: 'mere', tel: '+221 76 012 34 10' } },
    { id: 'el-11', matricule: 'DG-2024-011', nom_fr: 'Baldé',   prenom_fr: 'Kadiatou',   sexe: 'F', dn: '2012-02-28', ca: 'classe-5ar',    parent: { nom: 'Amadou Baldé',      lien: 'pere', tel: '+221 78 123 45 11' } },
    { id: 'el-12', matricule: 'DG-2024-012', nom_fr: 'Diop',    prenom_fr: 'Bamba',      sexe: 'M', dn: '2012-10-16', ca: 'classe-5ar',    parent: { nom: 'Serigne Diop',      lien: 'pere', tel: '+221 70 234 56 12' } },
    { id: 'el-13', matricule: 'DG-2024-013', nom_fr: 'Kouyaté', prenom_fr: 'Seydina',    sexe: 'M', dn: '2011-07-04', ca: 'classe-5ar',    parent: { nom: 'Boubacar Kouyaté', lien: 'pere', tel: '+221 77 345 67 13' } },
    { id: 'el-14', matricule: 'DG-2024-014', nom_fr: 'Ly',      prenom_fr: 'Khady',      sexe: 'F', dn: '2012-03-20', ca: 'classe-5ar',    parent: { nom: 'Mor Ly',            lien: 'pere', tel: '+221 76 456 78 14' } },
    { id: 'el-15', matricule: 'DG-2024-015', nom_fr: 'Cissé',   prenom_fr: 'Abdourahman',sexe: 'M', dn: '2011-11-30', ca: 'classe-5ar',    parent: { nom: 'Issa Cissé',        lien: 'pere', tel: '+221 78 567 89 15' } },
    { id: 'el-16', matricule: 'DG-2024-016', nom_fr: 'Kane',    prenom_fr: 'Mariétou',   sexe: 'F', dn: '2011-05-12', ca: 'classe-6ar',    parent: { nom: 'Alioune Kane',      lien: 'pere', tel: '+221 70 678 90 16' } },
    { id: 'el-17', matricule: 'DG-2024-017', nom_fr: 'Sy',      prenom_fr: 'Omar',       sexe: 'M', dn: '2011-08-07', ca: 'classe-6ar',    parent: { nom: 'El-Hadj Sy',        lien: 'pere', tel: '+221 77 789 01 17' } },
    { id: 'el-18', matricule: 'DG-2024-018', nom_fr: 'Diouf',   prenom_fr: 'Rokhaya',    sexe: 'F', dn: '2011-01-25', ca: 'classe-6ar',    parent: { nom: 'Ibou Diouf',        lien: 'pere', tel: '+221 76 890 12 18' } },
    { id: 'el-19', matricule: 'DG-2024-019', nom_fr: 'Bâ',      prenom_fr: 'Hamidou',    sexe: 'M', dn: '2010-09-14', ca: 'classe-6ar',    parent: { nom: 'Amadou Bâ',         lien: 'pere', tel: '+221 78 901 23 19' } },
    { id: 'el-20', matricule: 'DG-2024-020', nom_fr: 'Faye',    prenom_fr: 'Amy',        sexe: 'F', dn: '2011-04-09', ca: 'classe-6ar',    parent: { nom: 'Bocar Faye',        lien: 'tuteur',tel: '+221 70 012 34 20' } },
  ];

  for (const e of elevesData) {
    await prisma.eleve.upsert({
      where: { matricule: e.matricule },
      update: {},
      create: {
        id: e.id, etablissement_id: 'etablissement-default',
        matricule: e.matricule, nom_fr: e.nom_fr,
        prenom_fr: e.prenom_fr,
        sexe: e.sexe, date_naissance: new Date(e.dn),
        parents: { create: { nom_fr: e.parent.nom, lien: e.parent.lien, telephone: e.parent.tel } },
      },
    });
    const inscId = `insc-${e.id}`;
    if (!await prisma.inscription.findFirst({ where: { id: inscId } })) {
      await prisma.inscription.create({
        data: { id: inscId, eleve_id: e.id, annee_scolaire_id: 'annee-2024-2025', statut: 'actif',
          ...(e.cf ? { classe_fr_id: e.cf } : {}),
          ...(e.ca ? { classe_ar_id: e.ca } : {}),
        },
      });
    }
  }
  console.log('✅ Élèves test (20) + inscriptions');

  // Notes T1 + T2
  const matFR = ['mat-francais','mat-maths','mat-sciences','mat-histgeo','mat-edcivique'];
  const matAR = ['mat-coran','mat-fiqh','mat-nahw','mat-adab','mat-histislam'];
  let noteCount = 0;
  for (const periode of [1, 2]) {
    for (const e of elevesData.filter(e => e.cf)) {
      for (const matId of matFR) {
        if (!await prisma.note.findUnique({ where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025' } } })) {
          await prisma.note.create({ data: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025', valeur: note(8, 19) } });
          noteCount++;
        }
      }
    }
    for (const e of elevesData.filter(e => e.ca)) {
      for (const matId of matAR) {
        if (!await prisma.note.findUnique({ where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025' } } })) {
          await prisma.note.create({ data: { eleve_id: e.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025', valeur: note(7, 18) } });
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
      await prisma.paiementEleve.create({ data: { eleve_id: e.id, inscription_id: `insc-${e.id}`, type: 'inscription', montant: 15000, annee: 2024, recu_numero: recu(), statut: 'paye' } });
      paiCount++;
    }
    const nbMois = ['el-04','el-12'].includes(e.id) ? 3 : ['el-17','el-19'].includes(e.id) ? 4 : moisPaies.length;
    for (let i = 0; i < nbMois; i++) {
      const mois = moisPaies[i];
      const annee = mois >= 9 ? 2024 : 2025;
      if (!await prisma.paiementEleve.findFirst({ where: { eleve_id: e.id, type: 'mensualite', mois, annee } })) {
        await prisma.paiementEleve.create({ data: { eleve_id: e.id, inscription_id: `insc-${e.id}`, type: 'mensualite', montant: 7500, mois, annee, recu_numero: recu(), statut: 'paye' } });
        paiCount++;
      }
    }
  }
  console.log(`✅ Paiements test élèves : ${paiCount}`);

  // Paiements professeurs
  let profPaiCount = 0;
  const profPaie = [['prof-1', 250000], ['prof-2', 220000], ['prof-3', 230000], ['prof-4', 180000]] as [string, number][];
  for (const [profId, brut] of profPaie) {
    for (const mois of [9, 10, 11, 12, 1, 2]) {
      const annee = mois >= 9 ? 2024 : 2025;
      if (!await prisma.paiementProfesseur.findFirst({ where: { professeur_id: profId, mois, annee } })) {
        const retenues = Math.round(brut * 0.05);
        await prisma.paiementProfesseur.create({ data: { professeur_id: profId, mois, annee, montant_brut: brut, retenues, net_a_payer: brut - retenues, statut: 'paye' } });
        profPaiCount++;
      }
    }
  }
  console.log(`✅ Paiements test profs : ${profPaiCount}`);

  console.log('\n🎉  Seed développement terminé !\n');
  console.log('  admin / Admin123!  |  directeur / Directeur123!');
  console.log('  caissier / Caissier123!  |  prof.fall / Prof123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
