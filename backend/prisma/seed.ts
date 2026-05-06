import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const etablissement = await prisma.etablissement.upsert({
    where: { id: 'etablissement-default' },
    update: {},
    create: {
      id: 'etablissement-default',
      nom_fr: 'École Franco-Arabe de Test',
      nom_ar: 'المدرسة الفرنسية العربية',
      adresse: 'Dakar, Sénégal',
      devise: 'FCFA',
    },
  });
  console.log('Etablissement créé:', etablissement.nom_fr);

  const roles = [
    { id: 'role-admin', libelle_fr: 'admin', libelle_ar: 'مدير النظام' },
    { id: 'role-directeur', libelle_fr: 'directeur', libelle_ar: 'المدير' },
    { id: 'role-caissier', libelle_fr: 'caissier', libelle_ar: 'أمين الصندوق' },
    { id: 'role-professeur', libelle_fr: 'professeur', libelle_ar: 'الأستاذ' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { libelle_fr: role.libelle_fr },
      update: {},
      create: role,
    });
  }
  console.log('Rôles créés:', roles.map((r) => r.libelle_fr).join(', '));

  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.utilisateur.upsert({
    where: { identifiant: 'admin' },
    update: {},
    create: {
      etablissement_id: 'etablissement-default',
      role_id: 'role-admin',
      nom_fr: 'Admin',
      nom_ar: 'مدير',
      prenom_fr: 'Super',
      prenom_ar: 'سوبر',
      identifiant: 'admin',
      mot_de_passe: hashedPassword,
    },
  });
  console.log('Utilisateur admin créé:', admin.identifiant);

  await prisma.configNotes.upsert({
    where: { etablissement_id: 'etablissement-default' },
    update: {},
    create: {
      etablissement_id: 'etablissement-default',
      note_max: 20,
      note_min: 0,
      nb_periodes: 3,
    },
  });
  console.log('Configuration des notes créée');

  const matieresFR = [
    { nom_fr: 'Français', nom_ar: 'الفرنسية', filiere: 'FR', ordre_bulletin: 1 },
    { nom_fr: 'Mathématiques', nom_ar: 'الرياضيات', filiere: 'FR', ordre_bulletin: 2 },
    { nom_fr: 'Sciences', nom_ar: 'العلوم', filiere: 'FR', ordre_bulletin: 3 },
  ];

  const matieresAR = [
    { nom_fr: 'Coran', nom_ar: 'القرآن الكريم', filiere: 'AR', ordre_bulletin: 1 },
    { nom_fr: 'Fiqh', nom_ar: 'الفقه', filiere: 'AR', ordre_bulletin: 2 },
    { nom_fr: 'Nahw', nom_ar: 'النحو', filiere: 'AR', ordre_bulletin: 3 },
  ];

  for (const matiere of [...matieresFR, ...matieresAR]) {
    await prisma.matiere.upsert({
      where: {
        id: `matiere-${matiere.nom_fr.toLowerCase().replace(/\s/g, '-')}`,
      },
      update: {},
      create: {
        id: `matiere-${matiere.nom_fr.toLowerCase().replace(/\s/g, '-')}`,
        etablissement_id: 'etablissement-default',
        ...matiere,
      },
    });
  }
  console.log('Matières créées');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
