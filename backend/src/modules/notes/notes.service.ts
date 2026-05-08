import prisma from '../../config/database';
import { NoteItem } from './notes.schema';

export async function listerNotes(
  etablissement_id: string,
  classe_id?: string,
  matiere_id?: string,
  periode?: number,
  annee_scolaire_id?: string
) {
  if (classe_id) {
    const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
    if (!classe) throw new Error('Classe introuvable');
  }

  const where: Record<string, unknown> = {};
  if (matiere_id) where.matiere_id = matiere_id;
  if (periode !== undefined) where.periode = periode;
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (classe_id) {
    where.eleve = { inscriptions: { some: { OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] } } };
  }

  return prisma.note.findMany({
    where,
    include: { matiere: true },
    orderBy: [{ periode: 'asc' }],
  });
}

export async function bulkUpsertNotes(notes: NoteItem[], insertOnly = false) {
  if (notes.length === 0) return [];
  const results: unknown[] = [];

  for (const note of notes) {
    const matiere = await prisma.matiere.findUnique({ where: { id: note.matiere_id } });
    if (matiere) {
      const noteMax = Number(matiere.note_max);
      const noteMin = Number(matiere.note_min);
      if (note.valeur > noteMax) {
        throw new Error(`La note ${note.valeur} dépasse le maximum autorisé (${noteMax}) pour "${matiere.nom_fr}"`);
      }
      if (note.valeur < noteMin) {
        throw new Error(`La note ${note.valeur} est inférieure au minimum (${noteMin}) pour "${matiere.nom_fr}"`);
      }
    }

    const uniqueKey = {
      eleve_id_matiere_id_periode_annee_scolaire_id: {
        eleve_id: note.eleve_id,
        matiere_id: note.matiere_id,
        periode: note.periode,
        annee_scolaire_id: note.annee_scolaire_id,
      },
    };

    // En mode insertOnly (professeur), ignorer les notes qui existent déjà
    if (insertOnly) {
      const existing = await prisma.note.findUnique({ where: uniqueKey });
      if (existing) continue;
    }

    const result = await prisma.note.upsert({
      where: uniqueKey,
      create: {
        eleve_id: note.eleve_id, matiere_id: note.matiere_id,
        periode: note.periode, annee_scolaire_id: note.annee_scolaire_id,
        valeur: note.valeur, commentaire: note.commentaire,
      },
      update: { valeur: note.valeur, commentaire: note.commentaire },
    });
    results.push(result);
  }
  return results;
}

export async function listerNotesEleve(eleve_id: string, etablissement_id: string, annee_scolaire_id?: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id, etablissement_id } });
  if (!eleve) throw new Error('Élève introuvable');
  return prisma.note.findMany({
    where: { eleve_id, ...(annee_scolaire_id ? { annee_scolaire_id } : {}) },
    include: { matiere: true, annee_scolaire: true },
    orderBy: [{ periode: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
  });
}
