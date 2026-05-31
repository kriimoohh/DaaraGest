import prisma from '../../config/database';
import { CreerMentionInput, ModifierMentionInput } from './mentions.schema';

const MENTIONS_DEFAUT = [
  { libelle_fr: 'Très bien',  seuil_min: 16, couleur: 'success', ordre: 1, is_system: false },
  { libelle_fr: 'Bien',       seuil_min: 14, couleur: 'info',    ordre: 2, is_system: false },
  { libelle_fr: 'Assez bien', seuil_min: 12, couleur: 'info',    ordre: 3, is_system: false },
  { libelle_fr: 'Passable',   seuil_min: 10, couleur: 'warning', ordre: 4, is_system: false },
  { libelle_fr: 'Insuffisant',seuil_min:  0, couleur: 'error',   ordre: 99, is_system: true  },
];

async function ensureMentionsExist(etablissement_id: string) {
  const count = await prisma.mention.count({ where: { etablissement_id } });
  if (count > 0) return;

  // Premier accès : on tente de lire les seuils ConfigNotes pour pré-remplir
  const cn = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const rows = [
    { libelle_fr: 'Très bien',  seuil_min: Number(cn?.seuil_tres_bien  ?? 16), couleur: 'success', ordre: 1,  is_system: false },
    { libelle_fr: 'Bien',       seuil_min: Number(cn?.seuil_bien       ?? 14), couleur: 'info',    ordre: 2,  is_system: false },
    { libelle_fr: 'Assez bien', seuil_min: Number(cn?.seuil_assez_bien ?? 12), couleur: 'info',    ordre: 3,  is_system: false },
    { libelle_fr: 'Passable',   seuil_min: Number(cn?.seuil_passable   ?? 10), couleur: 'warning', ordre: 4,  is_system: false },
    { libelle_fr: 'Insuffisant',seuil_min: 0,                                  couleur: 'error',   ordre: 99, is_system: true  },
  ];

  await prisma.mention.createMany({
    data: rows.map(r => ({ ...r, etablissement_id })),
    skipDuplicates: true,
  });
}

export async function listerMentions(etablissement_id: string) {
  await ensureMentionsExist(etablissement_id);
  return prisma.mention.findMany({
    where: { etablissement_id },
    orderBy: [{ seuil_min: 'desc' }],
  });
}

export async function creerMention(etablissement_id: string, data: CreerMentionInput) {
  const conflit = await prisma.mention.findFirst({
    where: { etablissement_id, seuil_min: data.seuil_min },
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
      libelle_fr: data.libelle_fr,
      seuil_min:  data.seuil_min,
      couleur:    data.couleur ?? 'info',
      ordre:      data.ordre   ?? 0,
      is_system:  false,
    },
  });
}

export async function modifierMention(id: string, etablissement_id: string, data: ModifierMentionInput) {
  const mention = await prisma.mention.findFirst({ where: { id, etablissement_id } });
  if (!mention) throw Object.assign(new Error('Mention introuvable'), { statusCode: 404 });

  if (mention.is_system && data.seuil_min !== undefined && data.seuil_min !== 0) {
    throw Object.assign(
      new Error('Le seuil de la mention "Insuffisant" doit rester à 0'),
      { statusCode: 400 },
    );
  }

  if (data.seuil_min !== undefined && Number(data.seuil_min) !== Number(mention.seuil_min)) {
    const conflit = await prisma.mention.findFirst({
      where: { etablissement_id, seuil_min: data.seuil_min, NOT: { id } },
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
      seuil_min:  data.seuil_min,
      couleur:    data.couleur,
      ordre:      data.ordre,
    },
  });
}

export async function supprimerMention(id: string, etablissement_id: string) {
  const mention = await prisma.mention.findFirst({ where: { id, etablissement_id } });
  if (!mention) throw Object.assign(new Error('Mention introuvable'), { statusCode: 404 });
  if (mention.is_system) {
    throw Object.assign(
      new Error('La mention "Insuffisant" est système et ne peut pas être supprimée'),
      { statusCode: 400 },
    );
  }
  await prisma.mention.delete({ where: { id } });
}
