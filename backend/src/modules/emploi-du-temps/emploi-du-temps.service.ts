import prisma from '../../config/database';
import { CreneauInput } from './emploi-du-temps.schema';

function heureToMinutes(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

function conflitHoraire(a_debut: string, a_fin: string, b_debut: string, b_fin: string): boolean {
  const ad = heureToMinutes(a_debut), af = heureToMinutes(a_fin);
  const bd = heureToMinutes(b_debut), bf = heureToMinutes(b_fin);
  return ad < bf && bd < af;
}

export async function listerCreneaux(
  etablissement_id: string,
  annee_scolaire_id: string,
  classe_id?: string,
  personnel_id?: string,
) {
  const where: Record<string, unknown> = { etablissement_id, annee_scolaire_id };
  if (classe_id) where.classe_id = classe_id;
  if (personnel_id) where.personnel_id = personnel_id;

  return prisma.creneau.findMany({
    where,
    include: {
      classe: { select: { id: true, nom_fr: true, filiere: true } },
      matiere: { select: { id: true, nom_fr: true, nom_ar: true } },
      personnel: { select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
    },
    orderBy: [{ jour: 'asc' }, { heure_debut: 'asc' }],
  });
}

export async function creerCreneau(etablissement_id: string, data: CreneauInput) {
  const [classe, matiere, professeur, annee, config] = await Promise.all([
    prisma.classe.findFirst({ where: { id: data.classe_id, etablissement_id } }),
    prisma.matiere.findFirst({ where: { id: data.matiere_id, etablissement_id } }),
    prisma.personnel.findFirst({ where: { id: data.personnel_id, utilisateur: { etablissement_id } } }),
    prisma.anneeScolaire.findFirst({ where: { id: data.annee_scolaire_id, etablissement_id } }),
    prisma.configNotes.findUnique({ where: { etablissement_id } }),
  ]);
  if (!classe) throw new Error('Classe introuvable');
  if (!matiere) throw new Error('Matière introuvable');
  if (!professeur) throw new Error('Personnel introuvable');
  if (!annee) throw new Error('Année scolaire introuvable');

  const joursActifs = (config?.jours_cours as string[]) ?? ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  if (!joursActifs.includes(data.jour)) {
    throw new Error(`"${data.jour}" n'est pas un jour de cours actif pour cet établissement`);
  }

  if (heureToMinutes(data.heure_debut) >= heureToMinutes(data.heure_fin)) {
    throw new Error('L\'heure de début doit être avant l\'heure de fin');
  }

  // Check professor conflicts on same day
  const creneauxProf = await prisma.creneau.findMany({
    where: { personnel_id: data.personnel_id, annee_scolaire_id: data.annee_scolaire_id, jour: data.jour },
  });
  for (const c of creneauxProf) {
    if (conflitHoraire(data.heure_debut, data.heure_fin, c.heure_debut, c.heure_fin)) {
      throw new Error(`Conflit horaire : ce professeur a déjà un cours de ${c.heure_debut} à ${c.heure_fin}`);
    }
  }

  // Check class conflicts on same day
  const creneauxClasse = await prisma.creneau.findMany({
    where: { classe_id: data.classe_id, annee_scolaire_id: data.annee_scolaire_id, jour: data.jour },
  });
  for (const c of creneauxClasse) {
    if (conflitHoraire(data.heure_debut, data.heure_fin, c.heure_debut, c.heure_fin)) {
      throw new Error(`Conflit horaire : cette classe a déjà un cours de ${c.heure_debut} à ${c.heure_fin}`);
    }
  }

  return prisma.creneau.create({
    data: { ...data, etablissement_id },
    include: {
      classe: { select: { id: true, nom_fr: true, filiere: true } },
      matiere: { select: { id: true, nom_fr: true, nom_ar: true } },
      personnel: { select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
    },
  });
}

export async function modifierCreneau(id: string, etablissement_id: string, data: Partial<CreneauInput>) {
  const existing = await prisma.creneau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Créneau introuvable');

  const updated = { ...existing, ...data };

  if (heureToMinutes(updated.heure_debut) >= heureToMinutes(updated.heure_fin)) {
    throw new Error('L\'heure de début doit être avant l\'heure de fin');
  }

  // Check conflicts excluding self
  const creneauxProf = await prisma.creneau.findMany({
    where: { personnel_id: updated.personnel_id, annee_scolaire_id: updated.annee_scolaire_id, jour: updated.jour, NOT: { id } },
  });
  for (const c of creneauxProf) {
    if (conflitHoraire(updated.heure_debut, updated.heure_fin, c.heure_debut, c.heure_fin)) {
      throw new Error(`Conflit horaire : ce professeur a déjà un cours de ${c.heure_debut} à ${c.heure_fin}`);
    }
  }

  const creneauxClasse = await prisma.creneau.findMany({
    where: { classe_id: updated.classe_id, annee_scolaire_id: updated.annee_scolaire_id, jour: updated.jour, NOT: { id } },
  });
  for (const c of creneauxClasse) {
    if (conflitHoraire(updated.heure_debut, updated.heure_fin, c.heure_debut, c.heure_fin)) {
      throw new Error(`Conflit horaire : cette classe a déjà un cours de ${c.heure_debut} à ${c.heure_fin}`);
    }
  }

  return prisma.creneau.update({
    where: { id },
    data,
    include: {
      classe: { select: { id: true, nom_fr: true, filiere: true } },
      matiere: { select: { id: true, nom_fr: true, nom_ar: true } },
      personnel: { select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } } },
    },
  });
}

export async function supprimerCreneau(id: string, etablissement_id: string) {
  const existing = await prisma.creneau.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Créneau introuvable');
  await prisma.creneau.delete({ where: { id } });
}
