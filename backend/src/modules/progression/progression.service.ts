import prisma from '../../config/database';
import { ValiderProgressionInput } from './progression.schema';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

export async function listerProgressions(
  etablissement_id: string,
  annee_scolaire_id?: string,
  classe_id?: string,
  filiere?: string,
) {
  const where: Record<string, unknown> = { etablissement_id };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;

  if (classe_id) {
    where.eleve = {
      inscriptions: {
        some: {
          ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
          classes: { some: { classe_id } },
        },
      },
    };
  } else if (filiere) {
    where.eleve = {
      inscriptions: {
        some: {
          ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
          ...(filiere === 'FR' ? { classe_fr_id: { not: null } } : { classe_ar_id: { not: null } }),
        },
      },
    };
  }

  const progressions = await prisma.progressionEleve.findMany({
    where,
    include: {
      eleve:          { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
      annee_scolaire: { select: { libelle: true } },
    },
    orderBy: [{ validee: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
  if (progressions.length === 0) return progressions.map(p => ({ ...p, moyenne_annuelle: null as number | null }));

  // Moyenne annuelle (bulletins période 0) par élève — contexte pour le conseil de classe.
  const eleveIds = progressions.map(p => p.eleve_id);
  const annees = [...new Set(progressions.map(p => p.annee_scolaire_id))];
  const annuels = await prisma.bulletin.findMany({
    where: { periode: 0, eleve_id: { in: eleveIds }, annee_scolaire_id: { in: annees } },
    select: { eleve_id: true, annee_scolaire_id: true, moyenne: true },
  });
  const moyMap = new Map<string, number[]>();
  for (const b of annuels) {
    if (b.moyenne == null) continue;
    const k = `${b.eleve_id}|${b.annee_scolaire_id}`;
    const arr = moyMap.get(k) ?? [];
    arr.push(Number(b.moyenne));
    moyMap.set(k, arr);
  }
  return progressions.map(p => {
    const arr = moyMap.get(`${p.eleve_id}|${p.annee_scolaire_id}`) ?? [];
    const moyenne_annuelle: number | null = arr.length
      ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100
      : null;
    return { ...p, moyenne_annuelle };
  });
}

export async function genererProgressions(etablissement_id: string, annee_scolaire_id: string) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const seuil  = baseNote / 2; // seuil de passage = moitié de l'échelle (ex: 5 sur /10)

  // Récupérer tous les élèves inscrits cette année
  const inscriptions = await prisma.inscription.findMany({
    where: { annee_scolaire_id, eleve: { etablissement_id } },
    include: { eleve: true },
  });

  const eleve_ids = inscriptions.map(i => i.eleve_id);

  // Décision basée sur la MOYENNE ANNUELLE du bulletin (pondérée + normalisée).
  // Une moyenne brute des notes serait fausse (barèmes variables + coeff par trimestre).
  const annuels = await prisma.bulletin.findMany({
    where: { annee_scolaire_id, periode: 0, eleve_id: { in: eleve_ids } },
    select: { eleve_id: true, moyenne: true },
  });
  const moyByEleve = new Map<string, number[]>();
  for (const b of annuels) {
    if (b.moyenne == null) continue;
    const arr = moyByEleve.get(b.eleve_id) ?? [];
    arr.push(Number(b.moyenne));
    moyByEleve.set(b.eleve_id, arr);
  }

  // Charger les progressions existantes en une seule requête
  const existantes = await prisma.progressionEleve.findMany({
    where: { eleve_id: { in: eleve_ids }, annee_scolaire_id },
  });
  const existantesMap = new Map(existantes.map(p => [p.eleve_id, p]));

  const created = [];

  for (const inscription of inscriptions) {
    const eleve_id = inscription.eleve_id;

    const moys = moyByEleve.get(eleve_id) ?? [];
    const moyenne: number | null = moys.length
      ? Math.round((moys.reduce((s, v) => s + v, 0) / moys.length) * 100) / 100
      : null;

    const decision_auto = moyenne === null ? 'admis' : (moyenne >= seuil ? 'admis' : 'redoublant');

    const existing = existantesMap.get(eleve_id);

    if (!existing) {
      const progression = await prisma.progressionEleve.create({
        data: { etablissement_id, eleve_id, annee_scolaire_id, decision: decision_auto, decision_auto },
      });
      created.push(progression);
    } else if (!existing.validee) {
      await prisma.progressionEleve.update({
        where: { id: existing.id },
        data:  { decision_auto, decision: decision_auto },
      });
    }
  }

  return { genere: created.length, total: inscriptions.length };
}

export async function validerProgression(
  id: string,
  etablissement_id: string,
  data: ValiderProgressionInput,
  validee_par: string,
) {
  const existing = await prisma.progressionEleve.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Progression introuvable');

  return prisma.progressionEleve.update({
    where: { id },
    data: {
      decision:       data.decision,
      note_directeur: data.note_directeur,
      validee:        true,
      validee_par,
      validee_le:     new Date(),
    },
    include: {
      eleve:          { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
      annee_scolaire: { select: { libelle: true } },
    },
  });
}

export async function historiqueEleve(eleve_id: string, etablissement_id: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: eleve_id, etablissement_id } });
  if (!eleve) throw new NotFoundError('Élève introuvable');

  const [inscriptions, progressions, absencesParAnnee, paiementsParAnnee] = await Promise.all([
    prisma.inscription.findMany({
      where: { eleve_id },
      include: {
        annee_scolaire: true,
        classe_fr:      { select: { nom_fr: true } },
        classe_ar:      { select: { nom_fr: true } },
      },
      orderBy: { annee_scolaire: { date_debut: 'desc' } },
    }),
    prisma.progressionEleve.findMany({
      where: { eleve_id },
      include: { annee_scolaire: { select: { libelle: true } } },
      orderBy: { annee_scolaire: { date_debut: 'desc' } },
    }),
    prisma.absenceEleve.groupBy({
      by:    ['annee_scolaire_id'],
      where: { eleve_id },
      _count: { id: true },
    }),
    prisma.paiementEleve.groupBy({
      by:    ['annee'],
      where: { eleve_id },
      _sum:  { montant: true },
    }),
  ]);

  return {
    eleve,
    inscriptions,
    progressions,
    absences_par_annee: absencesParAnnee,
    paiements_par_annee: paiementsParAnnee,
  };
}
