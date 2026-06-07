import prisma from '../../config/database';
import { AnneeScolaireInput } from './annees-scolaires.schema';
import { NotFoundError } from '../../utils/errors';

export async function listerAnneesScolaires(etablissement_id: string) {
  return prisma.anneeScolaire.findMany({
    where: { etablissement_id },
    orderBy: { date_debut: 'desc' },
  });
}

export async function creerAnneeScolaire(etablissement_id: string, data: AnneeScolaireInput) {
  return prisma.anneeScolaire.create({
    data: {
      etablissement_id,
      libelle: data.libelle,
      date_debut: new Date(data.date_debut),
      date_fin: new Date(data.date_fin),
    },
  });
}

export async function modifierAnneeScolaire(id: string, etablissement_id: string, data: AnneeScolaireInput) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Année scolaire introuvable');

  return prisma.anneeScolaire.update({
    where: { id },
    data: {
      libelle: data.libelle,
      date_debut: new Date(data.date_debut),
      date_fin: new Date(data.date_fin),
    },
  });
}

export async function activerAnneeScolaire(id: string, etablissement_id: string) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Année scolaire introuvable');

  await prisma.anneeScolaire.updateMany({
    where: { etablissement_id, active: true },
    data: { active: false },
  });

  return prisma.anneeScolaire.update({
    where: { id },
    data: { active: true },
  });
}

export async function supprimerAnneeScolaire(id: string, etablissement_id: string) {
  const existing = await prisma.anneeScolaire.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw Object.assign(new NotFoundError('Année scolaire introuvable'), { statusCode: 404 });

  // L'année est référencée par de nombreuses tables (Restrict par défaut) : on
  // refuse la suppression si des données y sont rattachées, avec un message clair
  // plutôt que de laisser remonter une erreur FK brute (P2003).
  const [classes, inscriptions, bulletins] = await Promise.all([
    prisma.classe.count({ where: { annee_scolaire_id: id } }),
    prisma.inscription.count({ where: { annee_scolaire_id: id } }),
    prisma.bulletin.count({ where: { annee_scolaire_id: id } }),
  ]);

  if (classes > 0 || inscriptions > 0 || bulletins > 0) {
    const details = [
      classes > 0 && `${classes} classe(s)`,
      inscriptions > 0 && `${inscriptions} inscription(s)`,
      bulletins > 0 && `${bulletins} bulletin(s)`,
    ].filter(Boolean).join(', ');
    throw Object.assign(
      new Error(`Impossible de supprimer cette année scolaire : ${details} y sont rattaché(e)s. Désactivez-la plutôt que de la supprimer.`),
      { statusCode: 409 },
    );
  }

  return prisma.anneeScolaire.delete({ where: { id } });
}
