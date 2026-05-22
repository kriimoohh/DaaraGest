import prisma from '../config/database';

const BLOCKING_TYPES = new Set(['vacances', 'fermeture']);

/**
 * Vérifie qu'une date ne tombe pas dans un événement bloquant
 * (vacances scolaires ou fermeture d'établissement).
 * Lève une erreur explicite si la date est bloquée.
 *
 * Utilisé par :
 * - Absences élève (saisie d'absence)
 * - Notes (création d'évaluation, modification d'une note avec date)
 * - Créneaux (planification d'un cours)
 *
 * @param etablissement_id Identifiant de l'établissement
 * @param date             Date à vérifier (string ISO ou Date)
 * @param contexte         Libellé pour le message d'erreur ("absence", "note", "créneau")
 */
export async function assertDateNonVacances(
  etablissement_id: string,
  date: string | Date,
  contexte = 'saisie',
): Promise<void> {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return; // pas notre rôle de valider le format

  const evt = await prisma.evenementCalendrier.findFirst({
    where: {
      etablissement_id,
      type: { in: Array.from(BLOCKING_TYPES) },
      date_debut: { lte: d },
      date_fin:   { gte: d },
    },
    select: { titre_fr: true, type: true, date_debut: true, date_fin: true },
  });

  if (evt) {
    const err = new Error(
      `Impossible d'enregistrer cette ${contexte} : la date tombe pendant "${evt.titre_fr}" (${evt.type}).`,
    );
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
}
