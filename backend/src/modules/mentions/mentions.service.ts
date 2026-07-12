import prisma from '../../config/database';
import { CreerMentionInput, ModifierMentionInput } from './mentions.schema';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

// Pourcentages des seuils par défaut, appliqués à note_max (base 20 = 80%, 70%, 60%, 50%)
const SEUILS_DEFAUT_PCT = [
  { libelle_fr: 'Très bien',  pct: 0.80, couleur: 'success', ordre: 1 },
  { libelle_fr: 'Bien',       pct: 0.70, couleur: 'info',    ordre: 2 },
  { libelle_fr: 'Assez bien', pct: 0.60, couleur: 'info',    ordre: 3 },
  { libelle_fr: 'Passable',   pct: 0.50, couleur: 'warning', ordre: 4 },
];

// Arrondi au 0.5 le plus proche (utile pour les barèmes sur 10 ou 20)
function arrondir(v: number) { return Math.round(v * 2) / 2; }

async function ensureMentionsExist(etablissement_id: string) {
  // On ne sème que les mentions PAR DÉFAUT de l'établissement (aucune filière, aucun niveau).
  // Les établissements existants ont été backfillés depuis leurs anciens seuils
  // ConfigNotes (migration mentions_consolidation) : ce semis paresseux ne sert
  // plus qu'aux nouveaux établissements → pourcentages standard de note_max.
  const count = await prisma.mention.count({ where: { etablissement_id, filiere_id: null, niveau_id: null } });
  if (count > 0) return;

  const cn = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const noteMax = Number(cn?.note_max ?? DEFAULT_NOTE_MAX);
  const seuils = SEUILS_DEFAUT_PCT.map(s => arrondir(s.pct * noteMax));

  const rows = SEUILS_DEFAUT_PCT.map((s, i) => ({
    libelle_fr:  s.libelle_fr,
    seuil_min:   seuils[i],
    couleur:     s.couleur,
    ordre:       s.ordre,
    is_system:   false,
    etablissement_id,
  }));
  rows.push({ libelle_fr: 'Insuffisant', seuil_min: 0, couleur: 'error', ordre: 99, is_system: true, etablissement_id });

  await prisma.mention.createMany({ data: rows, skipDuplicates: true });
}

// Échelle applicable à une mention : celle du NIVEAU si la mention est propre à un
// niveau (ex. secondaire /20), sinon l'échelle établissement. Les seuils de mention
// se saisissent ainsi sur la bonne échelle.
async function getNoteMax(etablissement_id: string, niveau_id?: string | null): Promise<number> {
  if (niveau_id) {
    const n = await prisma.niveau.findFirst({ where: { id: niveau_id, etablissement_id }, select: { note_max: true } });
    if (n?.note_max != null) return Number(n.note_max);
  }
  const cn = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { note_max: true } });
  return Number(cn?.note_max ?? DEFAULT_NOTE_MAX);
}

// Portée (filiere_id, niveau_id) : null = défaut. La portée « défaut établissement »
// (aucune filière, aucun niveau) est semée si vide ; les autres portées peuvent être
// vides (héritage par la résolution filière+niveau > filière > niveau > établissement).
export async function listerMentions(etablissement_id: string, niveau_id?: string | null, filiere_id?: string | null) {
  const fid = filiere_id ?? null;
  const nid = niveau_id ?? null;
  if (fid === null && nid === null) {
    await ensureMentionsExist(etablissement_id);
  }
  return prisma.mention.findMany({
    where: { etablissement_id, filiere_id: fid, niveau_id: nid },
    orderBy: [{ seuil_min: 'desc' }],
  });
}

export async function creerMention(etablissement_id: string, data: CreerMentionInput) {
  const noteMax = await getNoteMax(etablissement_id, data.niveau_id);
  if (data.seuil_min >= noteMax) {
    throw Object.assign(
      new Error(`Le seuil (${data.seuil_min}) doit être inférieur à la note max (${noteMax})`),
      { statusCode: 400 },
    );
  }

  const niveau_id = data.niveau_id ?? null;
  if (niveau_id) {
    const niveau = await prisma.niveau.findFirst({ where: { id: niveau_id, etablissement_id }, select: { id: true } });
    if (!niveau) throw Object.assign(new NotFoundError('Niveau introuvable'), { statusCode: 404 });
  }
  const filiere_id = data.filiere_id ?? null;
  if (filiere_id) {
    const filiere = await prisma.filiere.findFirst({ where: { id: filiere_id, etablissement_id }, select: { id: true } });
    if (!filiere) throw Object.assign(new NotFoundError('Filière introuvable'), { statusCode: 404 });
  }

  const conflit = await prisma.mention.findFirst({
    where: { etablissement_id, filiere_id, niveau_id, seuil_min: data.seuil_min },
  });
  if (conflit) {
    throw Object.assign(
      new Error(`Un seuil à ${data.seuil_min} existe déjà (${conflit.libelle_fr})`),
      { statusCode: 409 },
    );
  }

  return prisma.mention.create({
    data: {
      etablissement_id,
      filiere_id,
      niveau_id,
      libelle_fr: data.libelle_fr,
      libelle_ar: data.libelle_ar ?? null,
      seuil_min:  data.seuil_min,
      couleur:    data.couleur ?? 'info',
      ordre:      data.ordre   ?? 0,
      is_system:  false,
    },
  });
}

export async function modifierMention(id: string, etablissement_id: string, data: ModifierMentionInput) {
  const mention = await prisma.mention.findFirst({ where: { id, etablissement_id } });
  if (!mention) throw Object.assign(new NotFoundError('Mention introuvable'), { statusCode: 404 });

  if (mention.is_system && data.seuil_min !== undefined && data.seuil_min !== 0) {
    throw Object.assign(
      new Error('Le seuil de la mention "Insuffisant" doit rester à 0'),
      { statusCode: 400 },
    );
  }

  if (data.seuil_min !== undefined && !mention.is_system) {
    const noteMax = await getNoteMax(etablissement_id, mention.niveau_id);
    if (data.seuil_min >= noteMax) {
      throw Object.assign(
        new Error(`Le seuil (${data.seuil_min}) doit être inférieur à la note max (${noteMax})`),
        { statusCode: 400 },
      );
    }
  }

  if (data.seuil_min !== undefined && Number(data.seuil_min) !== Number(mention.seuil_min)) {
    const conflit = await prisma.mention.findFirst({
      where: { etablissement_id, filiere_id: mention.filiere_id, niveau_id: mention.niveau_id, seuil_min: data.seuil_min, NOT: { id } },
    });
    if (conflit) {
      throw Object.assign(
        new Error(`Un seuil à ${data.seuil_min} existe déjà (${conflit.libelle_fr})`),
        { statusCode: 409 },
      );
    }
  }

  return prisma.mention.update({
    where: { id },
    data: {
      libelle_fr: data.libelle_fr,
      libelle_ar: data.libelle_ar,
      seuil_min:  data.seuil_min,
      couleur:    data.couleur,
      ordre:      data.ordre,
    },
  });
}

export async function supprimerMention(id: string, etablissement_id: string) {
  const mention = await prisma.mention.findFirst({ where: { id, etablissement_id } });
  if (!mention) throw Object.assign(new NotFoundError('Mention introuvable'), { statusCode: 404 });
  if (mention.is_system) {
    throw Object.assign(
      new Error('La mention "Insuffisant" est système et ne peut pas être supprimée'),
      { statusCode: 400 },
    );
  }
  await prisma.mention.delete({ where: { id } });
}
