import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { assertProfPeutModifierNotes } from '../../utils/teachingPolicy';
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

export async function bulkUpsertNotes(
  notes: NoteItem[],
  insertOnly = false,
  acteurId?: string,
  etablissement_id?: string,
  classe_id?: string,
  role?: string,
) {
  if (notes.length === 0) return [];

  // Précharger toutes les matières concernées en une seule requête (élimine le N+1)
  const matiereIds = [...new Set(notes.map(n => n.matiere_id))];

  // Policy : un professeur ne peut modifier que les notes des classes/matières
  // où il a une affectation PersonnelMatiereClasse.
  if (role && acteurId && classe_id) {
    await assertProfPeutModifierNotes(role, acteurId, classe_id, matiereIds);
  }

  // Si classe_id fourni, vérifier que toutes les matières sont dans le programme de la classe
  if (classe_id) {
    const programmeMatieres = await prisma.classeMatiere.findMany({
      where: { classe_id },
      select: { matiere_id: true },
    });
    const matieresAutorisees = new Set(programmeMatieres.map(pm => pm.matiere_id));
    for (const note of notes) {
      if (!matieresAutorisees.has(note.matiere_id)) {
        throw new Error(`La matière ${note.matiere_id} ne fait pas partie du programme de cette classe`);
      }
    }
  }
  const matieres = await prisma.matiere.findMany({ where: { id: { in: matiereIds } } });
  const matiereMap = new Map(matieres.map(m => [m.id, m]));

  // Valider toutes les notes avant d'ouvrir la transaction
  for (const note of notes) {
    const matiere = matiereMap.get(note.matiere_id);
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
  }

  const results = await prisma.$transaction(async (tx) => {
    const saved: unknown[] = [];
    for (const note of notes) {
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
        const existing = await tx.note.findUnique({ where: uniqueKey });
        if (existing) continue;
      }

      const result = await tx.note.upsert({
        where: uniqueKey,
        create: {
          eleve_id: note.eleve_id, matiere_id: note.matiere_id,
          periode: note.periode, annee_scolaire_id: note.annee_scolaire_id,
          valeur: note.valeur, commentaire: note.commentaire,
        },
        update: { valeur: note.valeur, commentaire: note.commentaire },
      });
      saved.push(result);
    }
    return saved;
  });

  if (results.length > 0 && acteurId && etablissement_id) {
    await logAction(etablissement_id, acteurId, insertOnly ? 'CREATE' : 'UPDATE', 'Note', 'bulk', {
      count: results.length, insertOnly,
    });
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
