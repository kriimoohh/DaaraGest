import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { assertProfPeutSaisirNotes, getPolitiqueSaisieNotes, estModeStrict } from '../../utils/teachingPolicy';
import { NoteItem } from './notes.schema';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

export async function listerNotes(
  etablissement_id: string,
  classe_id?: string,
  matiere_id?: string,
  periode?: number,
  annee_scolaire_id?: string
) {
  if (classe_id) {
    const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
    if (!classe) throw new NotFoundError('Classe introuvable');
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
  insertOnlyHint = false,
  acteurId?: string,
  etablissement_id?: string,
  classe_id?: string,
  role?: string,
) {
  if (notes.length === 0) return [];

  // Précharger toutes les matières concernées en une seule requête (élimine le N+1)
  const matiereIds = [...new Set(notes.map(n => n.matiere_id))];

  // Politique de saisie : strict (chacun ses matières/classes) ou variantes
  // libérées définies par ConfigNotes.autoriser_toutes_matieres/_classes.
  let insertOnly = insertOnlyHint;
  let politiqueAppliquee = { autoriser_toutes_matieres: false, autoriser_toutes_classes: false };
  if (role && acteurId && classe_id && etablissement_id) {
    await assertProfPeutSaisirNotes(role, acteurId, classe_id, matiereIds, etablissement_id);
    politiqueAppliquee = await getPolitiqueSaisieNotes(etablissement_id);
    // insertOnly couplé : seul le mode strict conserve le verrou anti-modification.
    if (insertOnlyHint && !estModeStrict(politiqueAppliquee)) {
      insertOnly = false;
    }
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

  // Échelle de l'établissement : barème de repli quand une matière n'a aucun
  // override de classe/période (la note est alors réputée sur cette échelle).
  const etabId = etablissement_id ?? matieres[0]?.etablissement_id;
  const config = etabId
    ? await prisma.configNotes.findUnique({ where: { etablissement_id: etabId }, select: { note_max: true } })
    : null;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  // Barème EFFECTIF de chaque matière pour cette classe : on valide sur le barème
  // réellement utilisé (ex: CLC /40 ou /60, Rés.Prob /4), pas sur l'échelle plate
  // de l'établissement — sinon on rejette des notes /60 légitimes ET on accepte
  // des notes hors barème pour les matières < base. Priorité : période > classe > établissement.
  const baremeOverride = new Map<string, number>();     // matiere_id → note_max (défaut classe)
  const baremePeriode  = new Map<string, number>();      // `${matiere_id}|${periode}` → note_max
  if (classe_id) {
    const [cms, cmps] = await Promise.all([
      prisma.classeMatiere.findMany({
        where: { classe_id, matiere_id: { in: matiereIds } },
        select: { matiere_id: true, note_max_override: true },
      }),
      prisma.classeMatierePeriode.findMany({
        where: { classe_id, matiere_id: { in: matiereIds } },
        select: { matiere_id: true, periode: true, note_max: true },
      }),
    ]);
    for (const cm of cms) if (cm.note_max_override != null) baremeOverride.set(cm.matiere_id, Number(cm.note_max_override));
    for (const cmp of cmps) baremePeriode.set(`${cmp.matiere_id}|${cmp.periode}`, Number(cmp.note_max));
  }

  // Valider toutes les notes avant d'ouvrir la transaction
  for (const note of notes) {
    const matiere = matiereMap.get(note.matiere_id);
    if (matiere) {
      const noteMax = baremePeriode.get(`${note.matiere_id}|${note.periode}`)
        ?? baremeOverride.get(note.matiere_id)
        ?? baseNote;
      const noteMin = Number(matiere.note_min);
      if (note.valeur > noteMax) {
        throw new Error(`La note ${note.valeur} dépasse le maximum autorisé (${noteMax}) pour "${matiere.nom_fr}"`);
      }
      if (note.valeur < noteMin) {
        throw new Error(`La note ${note.valeur} est inférieure au minimum (${noteMin}) pour "${matiere.nom_fr}"`);
      }
    }
  }

  const keyOf = (n: { eleve_id: string; matiere_id: string; periode: number; annee_scolaire_id: string }) =>
    `${n.eleve_id}|${n.matiere_id}|${n.periode}|${n.annee_scolaire_id}`;

  // Transaction efficace : une boucle de N upsert (findUnique + upsert par note) sur
  // une classe entière (ex. 507 notes → ~1000 allers-retours séquentiels) dépasse le
  // timeout de transaction (5 s par défaut) → « Transaction not found ». On précharge
  // donc les notes existantes en UNE requête, puis createMany (nouvelles) + update
  // ciblés (existantes modifiées). Le timeout est aussi relevé par sécurité.
  const { created, updated } = await prisma.$transaction(async (tx) => {
    const existing = await tx.note.findMany({
      where: {
        eleve_id:          { in: [...new Set(notes.map(n => n.eleve_id))] },
        matiere_id:        { in: matiereIds },
        periode:           { in: [...new Set(notes.map(n => n.periode))] },
        annee_scolaire_id: { in: [...new Set(notes.map(n => n.annee_scolaire_id))] },
      },
      select: { id: true, eleve_id: true, matiere_id: true, periode: true, annee_scolaire_id: true, valeur: true, commentaire: true },
    });
    const existingMap = new Map(existing.map(e => [keyOf(e), e]));

    const toCreate: { eleve_id: string; matiere_id: string; periode: number; annee_scolaire_id: string; valeur: number; commentaire?: string | null }[] = [];
    const toUpdate: { id: string; valeur: number; commentaire?: string | null }[] = [];
    for (const note of notes) {
      const ex = existingMap.get(keyOf(note));
      if (!ex) {
        toCreate.push({
          eleve_id: note.eleve_id, matiere_id: note.matiere_id,
          periode: note.periode, annee_scolaire_id: note.annee_scolaire_id,
          valeur: note.valeur, commentaire: note.commentaire,
        });
      } else if (!insertOnly) {
        // Mise à jour seulement si la valeur ou le commentaire change (évite des écritures inutiles).
        if (Number(ex.valeur) !== note.valeur || (ex.commentaire ?? null) !== (note.commentaire ?? null)) {
          toUpdate.push({ id: ex.id, valeur: note.valeur, commentaire: note.commentaire });
        }
      }
      // insertOnly + note déjà existante → ignorée (verrou professeur).
    }

    if (toCreate.length > 0) await tx.note.createMany({ data: toCreate, skipDuplicates: true });
    for (const u of toUpdate) {
      await tx.note.update({ where: { id: u.id }, data: { valeur: u.valeur, commentaire: u.commentaire } });
    }
    return { created: toCreate.length, updated: toUpdate.length };
  }, { timeout: 20000, maxWait: 10000 });

  const count = created + updated;
  if (count > 0 && acteurId && etablissement_id) {
    await logAction(etablissement_id, acteurId, insertOnly ? 'CREATE' : 'UPDATE', 'Note', 'bulk', {
      count, created, updated, insertOnly, matiere_ids: matiereIds, politique: politiqueAppliquee,
    });
  }
  return { count, created, updated };
}

export async function listerNotesEleve(eleve_id: string, etablissement_id: string, annee_scolaire_id?: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id, etablissement_id } });
  if (!eleve) throw new NotFoundError('Élève introuvable');
  return prisma.note.findMany({
    where: { eleve_id, ...(annee_scolaire_id ? { annee_scolaire_id } : {}) },
    include: { matiere: true, annee_scolaire: true },
    orderBy: [{ periode: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
  });
}
