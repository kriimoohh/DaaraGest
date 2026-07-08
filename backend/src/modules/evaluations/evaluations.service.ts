import prisma from '../../config/database';
import { assertProfPeutModifierNotes } from '../../utils/teachingPolicy';
import { EvaluationInput, NoteEvaluationItem } from './evaluations.schema';
import { NotFoundError } from '../../utils/errors';

export async function listerEvaluations(
  etablissement_id: string,
  classe_id?: string,
  matiere_id?: string,
  periode?: number,
  annee_scolaire_id?: string,
) {
  const where: Record<string, unknown> = { etablissement_id };
  if (classe_id)          where.classe_id         = classe_id;
  if (matiere_id)         where.matiere_id         = matiere_id;
  if (periode !== undefined) where.periode         = periode;
  if (annee_scolaire_id)  where.annee_scolaire_id  = annee_scolaire_id;

  return prisma.evaluation.findMany({
    where,
    include: {
      classe:  { select: { nom_fr: true } },
      matiere: { select: { nom_fr: true, nom_ar: true } },
      _count:  { select: { notes_eleves: true } },
    },
    orderBy: [{ periode: 'asc' }, { date: 'desc' }],
  });
}

export async function creerEvaluation(etablissement_id: string, data: EvaluationInput, created_by: string, role?: string) {
  const classe = await prisma.classe.findFirst({ where: { id: data.classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const matiere = await prisma.matiere.findFirst({ where: { id: data.matiere_id, etablissement_id } });
  if (!matiere) throw new NotFoundError('Matière introuvable');

  if (role) {
    await assertProfPeutModifierNotes(role, created_by, data.classe_id, [data.matiere_id]);
  }

  return prisma.evaluation.create({
    data: {
      etablissement_id,
      classe_id:         data.classe_id,
      matiere_id:        data.matiere_id,
      annee_scolaire_id: data.annee_scolaire_id,
      periode:           data.periode,
      titre:             data.titre,
      type:              data.type,
      date:              new Date(data.date),
      coefficient:       data.coefficient,
      note_max:          data.note_max,
      created_by,
    },
    include: {
      classe:  { select: { nom_fr: true } },
      matiere: { select: { nom_fr: true, nom_ar: true } },
    },
  });
}

export async function modifierEvaluation(id: string, etablissement_id: string, data: Partial<EvaluationInput>, role?: string, acteurId?: string) {
  const existing = await prisma.evaluation.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Évaluation introuvable');

  if (role && acteurId) {
    await assertProfPeutModifierNotes(role, acteurId, existing.classe_id, [existing.matiere_id]);
  }

  return prisma.evaluation.update({
    where: { id },
    data: {
      ...(data.titre       !== undefined && { titre: data.titre }),
      ...(data.type        !== undefined && { type: data.type }),
      ...(data.date        !== undefined && { date: new Date(data.date) }),
      ...(data.coefficient !== undefined && { coefficient: data.coefficient }),
      ...(data.note_max    !== undefined && { note_max: data.note_max }),
      ...(data.periode     !== undefined && { periode: data.periode }),
    },
  });
}

export async function supprimerEvaluation(id: string, etablissement_id: string) {
  const existing = await prisma.evaluation.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Évaluation introuvable');
  return prisma.evaluation.delete({ where: { id } });
}

export async function listerNotesEvaluation(evaluation_id: string, etablissement_id: string) {
  const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluation_id, etablissement_id } });
  if (!evaluation) throw new NotFoundError('Évaluation introuvable');

  return prisma.noteEvaluation.findMany({
    where: { evaluation_id },
    include: {
      eleve: { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
    },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });
}

export async function bulkUpsertNotesEvaluation(
  evaluation_id: string,
  etablissement_id: string,
  notes: NoteEvaluationItem[],
  role?: string,
  acteurId?: string,
) {
  const evaluation = await prisma.evaluation.findFirst({ where: { id: evaluation_id, etablissement_id } });
  if (!evaluation) throw new NotFoundError('Évaluation introuvable');

  if (role && acteurId) {
    await assertProfPeutModifierNotes(role, acteurId, evaluation.classe_id, [evaluation.matiere_id]);
  }

  const noteMax = Number(evaluation.note_max);
  for (const note of notes) {
    if (!note.absent && note.valeur !== null && note.valeur !== undefined && note.valeur > noteMax) {
      throw new Error(`La note ${note.valeur} dépasse le maximum autorisé (${noteMax})`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const note of notes) {
      const result = await tx.noteEvaluation.upsert({
        where: { evaluation_id_eleve_id: { evaluation_id, eleve_id: note.eleve_id } },
        create: {
          evaluation_id,
          eleve_id:    note.eleve_id,
          valeur:      note.absent ? null : (note.valeur ?? null),
          absent:      note.absent ?? false,
          commentaire: note.commentaire,
        },
        update: {
          valeur:      note.absent ? null : (note.valeur ?? null),
          absent:      note.absent ?? false,
          commentaire: note.commentaire,
        },
      });
      saved.push(result);
    }
    return saved;
  }, { timeout: 20000, maxWait: 10000 }); // marge pour une classe entière (cf. bulkUpsertNotes)
}

export async function calculerMoyenneEvaluation(
  eleve_id: string,
  classe_id: string,
  matiere_id: string,
  periode: number,
  annee_scolaire_id: string,
  etablissement_id: string,
) {
  const evaluations = await prisma.evaluation.findMany({
    where: { classe_id, matiere_id, periode, annee_scolaire_id, etablissement_id },
    include: { notes_eleves: { where: { eleve_id } } },
  });

  if (evaluations.length === 0) return { moyenne: null, detail: [] };

  let totalPondere = 0;
  let totalCoeff   = 0;
  const detail = [];

  for (const ev of evaluations) {
    const noteEleve = ev.notes_eleves[0];
    if (noteEleve && !noteEleve.absent && noteEleve.valeur !== null) {
      const coeff = Number(ev.coefficient);
      totalPondere += Number(noteEleve.valeur) * coeff;
      totalCoeff   += coeff;
      detail.push({
        evaluation_id: ev.id,
        titre:         ev.titre,
        type:          ev.type,
        coefficient:   coeff,
        valeur:        Number(noteEleve.valeur),
      });
    }
  }

  return {
    moyenne: totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : null,
    detail,
  };
}
