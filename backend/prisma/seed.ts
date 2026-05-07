import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function note(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 4) / 4;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function recu(): string {
  return `REC-${String(Math.floor(Math.random() * 90000 + 10000))}`;
}

async function main() {
  console.log('\n🏫  DaaraGest — Seed complet\n');

  // ── 1. Établissement ────────────────────────────────────────────────────────
  const etab = await prisma.etablissement.upsert({
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
  console.log('✅ Établissement :', etab.nom_fr);

  // ── 2. Rôles ────────────────────────────────────────────────────────────────
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
  console.log('✅ Rôles créés');

  // ── 3. Config notes ─────────────────────────────────────────────────────────
  await prisma.configNotes.upsert({
    where: { etablissement_id: 'etablissement-default' },
    update: {},
    create: { etablissement_id: 'etablissement-default', note_max: 20, note_min: 0, nb_periodes: 3 },
  });

  // ── 4. Utilisateurs ─────────────────────────────────────────────────────────
  const pwd = (p: string) => bcrypt.hash(p, 10);

  const utilisateurs = [
    { id: 'user-admin',      identifiant: 'admin',     mot_de_passe: await pwd('Admin123!'),     role_id: 'role-admin',
      nom_fr: 'Administrateur', prenom_fr: 'Super',    nom_ar: 'مدير', prenom_ar: 'سوبر' },
    { id: 'user-directeur',  identifiant: 'directeur', mot_de_passe: await pwd('Directeur123!'), role_id: 'role-directeur',
      nom_fr: 'Diop',       prenom_fr: 'Moussa',       nom_ar: 'ديوب', prenom_ar: 'موسى' },
    { id: 'user-caissier',   identifiant: 'caissier',  mot_de_passe: await pwd('Caissier123!'),  role_id: 'role-caissier',
      nom_fr: 'Sow',        prenom_fr: 'Aminata',      nom_ar: 'ساو', prenom_ar: 'أمينتا' },
    { id: 'user-prof1',      identifiant: 'prof.fall',  mot_de_passe: await pwd('Prof123!'),      role_id: 'role-professeur',
      nom_fr: 'Fall',       prenom_fr: 'Abdoulaye',    nom_ar: 'فال', prenom_ar: 'عبدالله' },
    { id: 'user-prof2',      identifiant: 'prof.diallo',mot_de_passe: await pwd('Prof123!'),      role_id: 'role-professeur',
      nom_fr: 'Diallo',     prenom_fr: 'Fatou',        nom_ar: 'ديالو', prenom_ar: 'فاطو' },
    { id: 'user-prof3',      identifiant: 'prof.ahmed', mot_de_passe: await pwd('Prof123!'),      role_id: 'role-professeur',
      nom_fr: 'Ahmed',      prenom_fr: 'Sheikh',       nom_ar: 'أحمد', prenom_ar: 'شيخ' },
    { id: 'user-prof4',      identifiant: 'prof.ndiaye',mot_de_passe: await pwd('Prof123!'),      role_id: 'role-professeur',
      nom_fr: 'Ndiaye',     prenom_fr: 'Ibrahima',     nom_ar: 'نجاي', prenom_ar: 'إبراهيم' },
    { id: 'user-pointeur',   identifiant: 'pointeur',  mot_de_passe: await pwd('Pointeur123!'), role_id: 'role-pointeur',
      nom_fr: 'Ba',         prenom_fr: 'Oumar',         nom_ar: 'با', prenom_ar: 'عمر' },
  ];

  for (const u of utilisateurs) {
    await prisma.utilisateur.upsert({
      where: { identifiant: u.identifiant },
      update: {},
      create: { ...u, etablissement_id: 'etablissement-default', langue: 'fr', theme: 'light' },
    });
  }
  console.log('✅ Utilisateurs :', utilisateurs.map(u => u.identifiant).join(', '));

  // ── 5. Professeurs ──────────────────────────────────────────────────────────
  const profsData = [
    { id: 'prof-1', utilisateur_id: 'user-prof1', specialite_fr: 'Français & Mathématiques', type_contrat: 'permanent', salaire_base: new Prisma.Decimal(250000), date_embauche: new Date('2020-09-01') },
    { id: 'prof-2', utilisateur_id: 'user-prof2', specialite_fr: 'Sciences Naturelles',       type_contrat: 'permanent', salaire_base: new Prisma.Decimal(220000), date_embauche: new Date('2019-09-01') },
    { id: 'prof-3', utilisateur_id: 'user-prof3', specialite_fr: 'Coran & Fiqh',              type_contrat: 'permanent', salaire_base: new Prisma.Decimal(230000), date_embauche: new Date('2021-09-01') },
    { id: 'prof-4', utilisateur_id: 'user-prof4', specialite_fr: 'Langue Arabe & Nahw',       type_contrat: 'vacataire', salaire_base: new Prisma.Decimal(180000), date_embauche: new Date('2022-01-15') },
  ];
  for (const p of profsData) {
    await prisma.professeur.upsert({ where: { utilisateur_id: p.utilisateur_id }, update: {}, create: p });
  }
  console.log('✅ Professeurs créés');

  // ── 6. Années scolaires ─────────────────────────────────────────────────────
  const annees = [
    { id: 'annee-2024-2025', libelle: '2024-2025', date_debut: new Date('2024-09-02'), date_fin: new Date('2025-06-27'), active: true },
    { id: 'annee-2023-2024', libelle: '2023-2024', date_debut: new Date('2023-09-04'), date_fin: new Date('2024-06-28'), active: false },
  ];
  // désactiver toutes d'abord
  await prisma.anneeScolaire.updateMany({ where: { etablissement_id: 'etablissement-default' }, data: { active: false } });
  for (const a of annees) {
    await prisma.anneeScolaire.upsert({
      where: { id: a.id },
      update: { active: a.active },
      create: { ...a, etablissement_id: 'etablissement-default' },
    });
  }
  console.log('✅ Années scolaires créées (active: 2024-2025)');

  // ── 7. Matières ─────────────────────────────────────────────────────────────
  const matieres = [
    // FR
    { id: 'mat-francais',   nom_fr: 'Français',              nom_ar: 'اللغة الفرنسية',   filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-maths',      nom_fr: 'Mathématiques',         nom_ar: 'الرياضيات',         filiere: 'FR', coeff_defaut: new Prisma.Decimal(3), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-sciences',   nom_fr: 'Sciences',              nom_ar: 'علوم الحياة',       filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-histgeo',    nom_fr: 'Histoire-Géographie',   nom_ar: 'التاريخ والجغرافيا', filiere: 'FR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-edcivique',  nom_fr: 'Éducation Civique',     nom_ar: 'التربية المدنية',   filiere: 'FR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
    // AR
    { id: 'mat-coran',      nom_fr: 'Coran',                 nom_ar: 'القرآن الكريم',     filiere: 'AR', coeff_defaut: new Prisma.Decimal(4), note_max: new Prisma.Decimal(30), note_min: new Prisma.Decimal(0), ordre_bulletin: 1 },
    { id: 'mat-fiqh',       nom_fr: 'Fiqh',                  nom_ar: 'الفقه',             filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 2 },
    { id: 'mat-nahw',       nom_fr: 'Nahw',                  nom_ar: 'النحو',             filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 3 },
    { id: 'mat-adab',       nom_fr: 'Adab (Littérature)',    nom_ar: 'الأدب العربي',      filiere: 'AR', coeff_defaut: new Prisma.Decimal(2), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 4 },
    { id: 'mat-histislam',  nom_fr: 'Histoire Islamique',    nom_ar: 'التاريخ الإسلامي',  filiere: 'AR', coeff_defaut: new Prisma.Decimal(1), note_max: new Prisma.Decimal(20), note_min: new Prisma.Decimal(0), ordre_bulletin: 5 },
  ];
  for (const m of matieres) {
    const { id: _id, ...rest } = m;
    await prisma.matiere.upsert({ where: { id: m.id }, update: { ...rest }, create: { ...m, etablissement_id: 'etablissement-default' } });
  }
  console.log('✅ Matières créées (5 FR + 5 AR)');

  // ── 8. Classes ──────────────────────────────────────────────────────────────
  const classes = [
    { id: 'classe-cm1-fr',  nom_fr: 'CM1 Français',   nom_ar: 'السنة الخامسة ابتدائي', filiere: 'FR', niveau: 'CM1', capacite: 35, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-cm2-fr',  nom_fr: 'CM2 Français',   nom_ar: 'السنة السادسة ابتدائي', filiere: 'FR', niveau: 'CM2', capacite: 30, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-5ar',     nom_fr: '5ème Arabe',     nom_ar: 'الصف الخامس',           filiere: 'AR', niveau: '5ème', capacite: 30, annee_scolaire_id: 'annee-2024-2025' },
    { id: 'classe-6ar',     nom_fr: '6ème Arabe',     nom_ar: 'الصف السادس',           filiere: 'AR', niveau: '6ème', capacite: 25, annee_scolaire_id: 'annee-2024-2025' },
  ];
  for (const cl of classes) {
    await prisma.classe.upsert({ where: { id: cl.id }, update: {}, create: { ...cl, etablissement_id: 'etablissement-default' } });
  }
  console.log('✅ Classes créées (2 FR + 2 AR)');

  // ── 9. Élèves & Parents & Inscriptions ──────────────────────────────────────
  const elevesData = [
    // CM1 FR
    { id: 'el-01', matricule: 'DG-2024-001', nom_fr: 'Diallo',   prenom_fr: 'Oumar',      sexe: 'M', date_naissance: '2013-03-15', classe_fr: 'classe-cm1-fr', parent: { nom: 'Mamadou Diallo', lien: 'pere', tel: '+221 77 123 45 01' } },
    { id: 'el-02', matricule: 'DG-2024-002', nom_fr: 'Ndiaye',   prenom_fr: 'Fatou',      sexe: 'F', date_naissance: '2013-07-22', classe_fr: 'classe-cm1-fr', parent: { nom: 'Rokhaya Ndiaye', lien: 'mere', tel: '+221 76 234 56 02' } },
    { id: 'el-03', matricule: 'DG-2024-003', nom_fr: 'Sall',     prenom_fr: 'Ibrahima',   sexe: 'M', date_naissance: '2012-11-08', classe_fr: 'classe-cm1-fr', parent: { nom: 'Abdou Sall',     lien: 'pere', tel: '+221 78 345 67 03' } },
    { id: 'el-04', matricule: 'DG-2024-004', nom_fr: 'Camara',   prenom_fr: 'Mariama',    sexe: 'F', date_naissance: '2013-05-30', classe_fr: 'classe-cm1-fr', parent: { nom: 'Aissatou Camara',lien: 'mere', tel: '+221 70 456 78 04' } },
    { id: 'el-05', matricule: 'DG-2024-005', nom_fr: 'Mbaye',    prenom_fr: 'Cheikh',     sexe: 'M', date_naissance: '2013-01-14', classe_fr: 'classe-cm1-fr', parent: { nom: 'Omar Mbaye',     lien: 'pere', tel: '+221 77 567 89 05' } },
    // CM2 FR
    { id: 'el-06', matricule: 'DG-2024-006', nom_fr: 'Thiam',    prenom_fr: 'Modou',      sexe: 'M', date_naissance: '2012-08-19', classe_fr: 'classe-cm2-fr', parent: { nom: 'Lamine Thiam',   lien: 'pere', tel: '+221 76 678 90 06' } },
    { id: 'el-07', matricule: 'DG-2024-007', nom_fr: 'Sarr',     prenom_fr: 'Aissatou',   sexe: 'F', date_naissance: '2012-04-03', classe_fr: 'classe-cm2-fr', parent: { nom: 'Bineta Sarr',    lien: 'mere', tel: '+221 78 789 01 07' } },
    { id: 'el-08', matricule: 'DG-2024-008', nom_fr: 'Fall',     prenom_fr: 'Babacar',    sexe: 'M', date_naissance: '2012-09-25', classe_fr: 'classe-cm2-fr', parent: { nom: 'Abdoulaye Fall',  lien: 'pere', tel: '+221 70 890 12 08' } },
    { id: 'el-09', matricule: 'DG-2024-009', nom_fr: 'Toure',    prenom_fr: 'Ndeye',      sexe: 'F', date_naissance: '2012-12-11', classe_fr: 'classe-cm2-fr', parent: { nom: 'Moussa Toure',   lien: 'pere', tel: '+221 77 901 23 09' } },
    { id: 'el-10', matricule: 'DG-2024-010', nom_fr: 'Gaye',     prenom_fr: 'Lamine',     sexe: 'M', date_naissance: '2012-06-07', classe_fr: 'classe-cm2-fr', parent: { nom: 'Sokhna Gaye',    lien: 'mere', tel: '+221 76 012 34 10' } },
    // 5ème Arabe
    { id: 'el-11', matricule: 'DG-2024-011', nom_fr: 'Baldé',    prenom_fr: 'Kadiatou',   sexe: 'F', date_naissance: '2012-02-28', classe_ar: 'classe-5ar',    parent: { nom: 'Amadou Baldé',   lien: 'pere', tel: '+221 78 123 45 11' } },
    { id: 'el-12', matricule: 'DG-2024-012', nom_fr: 'Diop',     prenom_fr: 'Bamba',      sexe: 'M', date_naissance: '2012-10-16', classe_ar: 'classe-5ar',    parent: { nom: 'Serigne Diop',   lien: 'pere', tel: '+221 70 234 56 12' } },
    { id: 'el-13', matricule: 'DG-2024-013', nom_fr: 'Kouyaté',  prenom_fr: 'Seydina',    sexe: 'M', date_naissance: '2011-07-04', classe_ar: 'classe-5ar',    parent: { nom: 'Boubacar Kouyaté',lien: 'pere', tel: '+221 77 345 67 13' } },
    { id: 'el-14', matricule: 'DG-2024-014', nom_fr: 'Ly',       prenom_fr: 'Khady',      sexe: 'F', date_naissance: '2012-03-20', classe_ar: 'classe-5ar',    parent: { nom: 'Mor Ly',         lien: 'pere', tel: '+221 76 456 78 14' } },
    { id: 'el-15', matricule: 'DG-2024-015', nom_fr: 'Cissé',    prenom_fr: 'Abdourahman',sexe: 'M', date_naissance: '2011-11-30', classe_ar: 'classe-5ar',    parent: { nom: 'Issa Cissé',     lien: 'pere', tel: '+221 78 567 89 15' } },
    // 6ème Arabe
    { id: 'el-16', matricule: 'DG-2024-016', nom_fr: 'Kane',     prenom_fr: 'Mariétou',   sexe: 'F', date_naissance: '2011-05-12', classe_ar: 'classe-6ar',    parent: { nom: 'Alioune Kane',   lien: 'pere', tel: '+221 70 678 90 16' } },
    { id: 'el-17', matricule: 'DG-2024-017', nom_fr: 'Sy',       prenom_fr: 'Omar',       sexe: 'M', date_naissance: '2011-08-07', classe_ar: 'classe-6ar',    parent: { nom: 'El-Hadj Sy',     lien: 'pere', tel: '+221 77 789 01 17' } },
    { id: 'el-18', matricule: 'DG-2024-018', nom_fr: 'Diouf',    prenom_fr: 'Rokhaya',    sexe: 'F', date_naissance: '2011-01-25', classe_ar: 'classe-6ar',    parent: { nom: 'Ibou Diouf',     lien: 'pere', tel: '+221 76 890 12 18' } },
    { id: 'el-19', matricule: 'DG-2024-019', nom_fr: 'Bâ',       prenom_fr: 'Hamidou',    sexe: 'M', date_naissance: '2010-09-14', classe_ar: 'classe-6ar',    parent: { nom: 'Amadou Bâ',      lien: 'pere', tel: '+221 78 901 23 19' } },
    { id: 'el-20', matricule: 'DG-2024-020', nom_fr: 'Faye',     prenom_fr: 'Amy',        sexe: 'F', date_naissance: '2011-04-09', classe_ar: 'classe-6ar',    parent: { nom: 'Bocar Faye',     lien: 'tuteur', tel: '+221 70 012 34 20' } },
  ];

  for (const e of elevesData) {
    await prisma.eleve.upsert({
      where: { matricule: e.matricule },
      update: {},
      create: {
        id: e.id,
        etablissement_id: 'etablissement-default',
        matricule: e.matricule,
        nom_fr: e.nom_fr,
        nom_ar: e.nom_fr,
        prenom_fr: e.prenom_fr,
        prenom_ar: e.prenom_fr,
        sexe: e.sexe,
        date_naissance: new Date(e.date_naissance),
        parents: {
          create: {
            nom_fr: e.parent.nom,
            lien: e.parent.lien,
            telephone: e.parent.tel,
          },
        },
      },
    });

    // Inscription
    const inscId = `insc-${e.id}`;
    const inscExist = await prisma.inscription.findFirst({ where: { id: inscId } });
    if (!inscExist) {
      await prisma.inscription.create({
        data: {
          id: inscId,
          eleve_id: e.id,
          annee_scolaire_id: 'annee-2024-2025',
          statut: 'actif',
          ...(e.classe_fr ? { classe_fr_id: e.classe_fr } : {}),
          ...(e.classe_ar ? { classe_ar_id: e.classe_ar } : {}),
        },
      });
    }
  }
  console.log('✅ Élèves créés (20) avec parents et inscriptions');

  // ── 10. Notes (T1 + T2) ─────────────────────────────────────────────────────
  const matFR = ['mat-francais', 'mat-maths', 'mat-sciences', 'mat-histgeo', 'mat-edcivique'];
  const matAR = ['mat-coran', 'mat-fiqh', 'mat-nahw', 'mat-adab', 'mat-histislam'];
  const elevesFR = elevesData.filter(e => e.classe_fr);
  const elevesAR = elevesData.filter(e => e.classe_ar);

  let noteCount = 0;
  for (const periode of [1, 2]) {
    // Notes FR
    for (const eleve of elevesFF(elevesData, 'FR')) {
      for (const matId of matFR) {
        const existing = await prisma.note.findUnique({
          where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: eleve.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025' } }
        });
        if (!existing) {
          await prisma.note.create({ data: { eleve_id: eleve.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025', valeur: note(8, 19) } });
          noteCount++;
        }
      }
    }
    // Notes AR
    for (const eleve of elevesFF(elevesData, 'AR')) {
      for (const matId of matAR) {
        const existing = await prisma.note.findUnique({
          where: { eleve_id_matiere_id_periode_annee_scolaire_id: { eleve_id: eleve.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025' } }
        });
        if (!existing) {
          await prisma.note.create({ data: { eleve_id: eleve.id, matiere_id: matId, periode, annee_scolaire_id: 'annee-2024-2025', valeur: note(7, 18) } });
          noteCount++;
        }
      }
    }
  }
  console.log(`✅ Notes créées : ${noteCount} (T1 + T2)`);

  // ── 11. Bulletins ────────────────────────────────────────────────────────────
  await genererBulletins(elevesFF(elevesData, 'FR'), matFR, 'FR', [1, 2]);
  await genererBulletins(elevesFF(elevesData, 'AR'), matAR, 'AR', [1, 2]);
  console.log('✅ Bulletins générés (T1 + T2)');

  // ── 12. Paiements élèves ────────────────────────────────────────────────────
  const types = ['mensualite', 'inscription', 'mensualite', 'mensualite'];
  const moisPaies = [9, 10, 11, 12, 1, 2, 3];
  let paiCount = 0;

  for (const eleve of elevesData) {
    // Frais d'inscription
    const inscExist = await prisma.paiementEleve.findFirst({ where: { eleve_id: eleve.id, type: 'inscription' } });
    if (!inscExist) {
      await prisma.paiementEleve.create({
        data: { eleve_id: eleve.id, inscription_id: `insc-${eleve.id}`, type: 'inscription', montant: 15000, annee: 2024, recu_numero: recu(), statut: 'paye' }
      });
      paiCount++;
    }

    // Mensualités (la plupart ont payé, 4 élèves ont du retard)
    const nbMoisPaies = eleve.id === 'el-04' || eleve.id === 'el-12' ? 3
                     : eleve.id === 'el-17' || eleve.id === 'el-19' ? 4
                     : moisPaies.length;

    for (let i = 0; i < nbMoisPaies; i++) {
      const mois = moisPaies[i];
      const annee = mois >= 9 ? 2024 : 2025;
      const existing = await prisma.paiementEleve.findFirst({ where: { eleve_id: eleve.id, type: 'mensualite', mois, annee } });
      if (!existing) {
        await prisma.paiementEleve.create({
          data: { eleve_id: eleve.id, inscription_id: `insc-${eleve.id}`, type: 'mensualite', montant: 7500, mois, annee, recu_numero: recu(), statut: 'paye' }
        });
        paiCount++;
      }
    }
  }
  console.log(`✅ Paiements élèves : ${paiCount}`);

  // ── 13. Paiements professeurs ───────────────────────────────────────────────
  const profIds = ['prof-1', 'prof-2', 'prof-3', 'prof-4'];
  const salaires = [250000, 220000, 230000, 180000];
  let profPaiCount = 0;

  for (let i = 0; i < profIds.length; i++) {
    for (const mois of [9, 10, 11, 12, 1, 2]) {
      const annee = mois >= 9 ? 2024 : 2025;
      const existing = await prisma.paiementProfesseur.findFirst({ where: { professeur_id: profIds[i], mois, annee } });
      if (!existing) {
        const brut = salaires[i];
        const retenues = Math.round(brut * 0.05); // IPRES 5%
        await prisma.paiementProfesseur.create({
          data: { professeur_id: profIds[i], mois, annee, montant_brut: brut, retenues, net_a_payer: brut - retenues, statut: 'paye' }
        });
        profPaiCount++;
      }
    }
  }
  console.log(`✅ Paiements professeurs : ${profPaiCount}`);

  console.log('\n🎉  Seed terminé avec succès !\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Comptes de test :');
  console.log('  admin        / Admin123!      (Administrateur)');
  console.log('  directeur    / Directeur123!  (Directeur)');
  console.log('  caissier     / Caissier123!   (Caissier)');
  console.log('  prof.fall    / Prof123!        (Professeur FR)');
  console.log('  prof.ahmed   / Prof123!        (Professeur AR)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ── Helpers internes ─────────────────────────────────────────────────────────

function elevesFF(all: { id: string; classe_fr?: string; classe_ar?: string }[], filiere: 'FR' | 'AR') {
  return all.filter(e => filiere === 'FR' ? !!e.classe_fr : !!e.classe_ar);
}

async function genererBulletins(
  eleves: { id: string }[],
  matIds: string[],
  filiere: string,
  periodes: number[]
) {
  for (const periode of periodes) {
    const moyennes: { eleve_id: string; moyenne: number }[] = [];

    for (const eleve of eleves) {
      const notes = await prisma.note.findMany({
        where: { eleve_id: eleve.id, annee_scolaire_id: 'annee-2024-2025', periode, matiere_id: { in: matIds } },
        include: { matiere: true },
      });
      if (notes.length === 0) continue;

      let totalP = 0, totalC = 0;
      for (const n of notes) {
        const c = Number(n.matiere.coeff_defaut);
        totalP += Number(n.valeur) * c;
        totalC += c;
      }
      moyennes.push({ eleve_id: eleve.id, moyenne: totalC > 0 ? Math.round((totalP / totalC) * 100) / 100 : 0 });
    }

    moyennes.sort((a, b) => b.moyenne - a.moyenne);

    for (let i = 0; i < moyennes.length; i++) {
      const { eleve_id, moyenne } = moyennes[i];
      const rang = i + 1;
      const existing = await prisma.bulletin.findUnique({
        where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id: 'annee-2024-2025', filiere, periode } }
      });
      if (!existing) {
        await prisma.bulletin.create({
          data: {
            eleve_id, annee_scolaire_id: 'annee-2024-2025', filiere, periode,
            moyenne, rang,
            appreciation: moyenne >= 16 ? 'Très bien — Félicitations' : moyenne >= 14 ? 'Bien' : moyenne >= 12 ? 'Assez bien' : moyenne >= 10 ? 'Passable' : 'Insuffisant',
            generated_at: new Date(),
          }
        });
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
