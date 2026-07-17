import prisma from '../../config/database';
import { ValiderProgressionInput } from './progression.schema';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { selectLiensClasseObjet, classeParFiliere } from '../../utils/inscriptionClasse';

/**
 * Moyenne annuelle DÉCISIONNAIRE d'un élève parmi ses bulletins annuels (periode 0).
 *
 * On ne moyenne JAMAIS plusieurs filières entre elles : un élève bilingue a un
 * bulletin FR, un AR ET un COMBINE, or COMBINE est déjà l'agrégat pondéré de FR+AR.
 * Les moyenner tous ensemble comptait deux fois les mêmes matières et faisait
 * dépendre la décision de quels bulletins avaient été générés.
 *
 * Règle : le bulletin de la filière configurée (`filiere_decision`, défaut COMBINE) ;
 * à défaut, l'unique bulletin annuel de l'élève (cas mono-filière) ; sinon `null`
 * (aucun bulletin, ou plusieurs sans correspondance → décision indécidable).
 */
function moyenneDecision(
  annuelsEleve: { filiere: string; moyenne: number | null }[],
  filiereDecision: string,
): number | null {
  const cible = annuelsEleve.find(b => b.filiere === filiereDecision && b.moyenne != null);
  if (cible) return Number(cible.moyenne);
  const avecMoy = annuelsEleve.filter(b => b.moyenne != null);
  if (avecMoy.length === 1) return Number(avecMoy[0].moyenne);
  return null;
}

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
          classes: { some: { filiere: { code: filiere } } },
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

  // Moyenne annuelle (bulletins période 0) par élève — contexte pour le conseil de
  // classe. MÊME sélection filière-consciente que la décision (moyenneDecision) :
  // on ne moyenne pas FR+AR+COMBINE ensemble (double comptage).
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { filiere_decision: true } });
  const filiereDecision = config?.filiere_decision ?? 'COMBINE';
  const eleveIds = progressions.map(p => p.eleve_id);
  const annees = [...new Set(progressions.map(p => p.annee_scolaire_id))];
  const annuels = await prisma.bulletin.findMany({
    where: { periode: 0, eleve_id: { in: eleveIds }, annee_scolaire_id: { in: annees } },
    select: { eleve_id: true, annee_scolaire_id: true, filiere: true, moyenne: true },
  });
  const parEleveAnnee = new Map<string, { filiere: string; moyenne: number | null }[]>();
  for (const b of annuels) {
    const k = `${b.eleve_id}|${b.annee_scolaire_id}`;
    const arr = parEleveAnnee.get(k) ?? [];
    arr.push({ filiere: b.filiere, moyenne: b.moyenne == null ? null : Number(b.moyenne) });
    parEleveAnnee.set(k, arr);
  }
  return progressions.map(p => {
    const annuelsEleve = parEleveAnnee.get(`${p.eleve_id}|${p.annee_scolaire_id}`) ?? [];
    return { ...p, moyenne_annuelle: moyenneDecision(annuelsEleve, filiereDecision) };
  });
}

export async function genererProgressions(etablissement_id: string, annee_scolaire_id: string) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const seuil  = baseNote / 2; // seuil de passage = moitié de l'échelle (ex: 5 sur /10)
  const filiereDecision = config?.filiere_decision ?? 'COMBINE';

  // Récupérer tous les élèves inscrits cette année
  const inscriptions = await prisma.inscription.findMany({
    where: { annee_scolaire_id, eleve: { etablissement_id } },
    include: { eleve: true },
  });

  const eleve_ids = inscriptions.map(i => i.eleve_id);

  // Décision basée sur la MOYENNE ANNUELLE du bulletin (pondérée + normalisée) de la
  // filière décisionnaire — cf. moyenneDecision. On charge `filiere` pour choisir le
  // bon bulletin plutôt que de moyenner FR+AR+COMBINE (double comptage).
  const annuels = await prisma.bulletin.findMany({
    where: { annee_scolaire_id, periode: 0, eleve_id: { in: eleve_ids } },
    select: { eleve_id: true, filiere: true, moyenne: true },
  });
  const annuelsByEleve = new Map<string, { filiere: string; moyenne: number | null }[]>();
  for (const b of annuels) {
    const arr = annuelsByEleve.get(b.eleve_id) ?? [];
    arr.push({ filiere: b.filiere, moyenne: b.moyenne == null ? null : Number(b.moyenne) });
    annuelsByEleve.set(b.eleve_id, arr);
  }

  // Charger les progressions existantes en une seule requête
  const existantes = await prisma.progressionEleve.findMany({
    where: { eleve_id: { in: eleve_ids }, annee_scolaire_id },
  });
  const existantesMap = new Map(existantes.map(p => [p.eleve_id, p]));

  const created = [];

  for (const inscription of inscriptions) {
    const eleve_id = inscription.eleve_id;

    const moyenne = moyenneDecision(annuelsByEleve.get(eleve_id) ?? [], filiereDecision);

    // Pas de moyenne annuelle (bulletin non généré, ou décision indécidable entre
    // filières) → 'a_examiner' : le directeur tranche, jamais d'« admis » par défaut.
    const decision_auto = moyenne === null ? 'a_examiner' : (moyenne >= seuil ? 'admis' : 'redoublant');

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

  // 'a_examiner' est un état d'attente, pas une décision : on ne valide jamais
  // dessus. Le directeur doit choisir un statut réel.
  if (data.decision === 'a_examiner') {
    throw new ValidationError('Choisissez une décision (admis, redoublant, transféré ou exclu) avant de valider.');
  }

  // Justification obligatoire quand la décision s'écarte de la proposition
  // automatique (passage forcé malgré une moyenne insuffisante, redoublement d'un
  // élève admissible…) ou quand l'auto ne s'est pas prononcée ('a_examiner') : la
  // trace du POURQUOI est indispensable là où le directeur exerce son jugement.
  const contreditAuto = existing.decision_auto != null && data.decision !== existing.decision_auto;
  if (contreditAuto && !data.note_directeur?.trim()) {
    throw new ValidationError('Une justification est requise lorsque la décision diffère de la proposition automatique.');
  }

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
        ...selectLiensClasseObjet,
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
    // Rétro-compat d'affichage : classe_fr / classe_ar dérivés de la jointure.
    inscriptions: inscriptions.map(i => ({
      ...i,
      classe_fr: classeParFiliere(i.classes, 'FR'),
      classe_ar: classeParFiliere(i.classes, 'AR'),
    })),
    progressions,
    absences_par_annee: absencesParAnnee,
    paiements_par_annee: paiementsParAnnee,
  };
}
