import prisma from '../../config/database';
import { ValiderProgressionInput } from './progression.schema';

export async function listerProgressions(etablissement_id: string, annee_scolaire_id?: string) {
  const where: Record<string, unknown> = { etablissement_id };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;

  return prisma.progressionEleve.findMany({
    where,
    include: {
      eleve:          { select: { id: true, matricule: true, nom_fr: true, prenom_fr: true } },
      annee_scolaire: { select: { libelle: true } },
    },
    orderBy: [{ validee: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
}

export async function genererProgressions(etablissement_id: string, annee_scolaire_id: string) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const seuil  = config ? Number(config.seuil_note_insuffisante) : 10;

  // Récupérer tous les élèves inscrits cette année
  const inscriptions = await prisma.inscription.findMany({
    where: { annee_scolaire_id, eleve: { etablissement_id } },
    include: { eleve: true },
  });

  const eleve_ids = inscriptions.map(i => i.eleve_id);

  // Charger toutes les notes + matières en une seule requête (élimine le N+1)
  const toutesLesNotes = await prisma.note.findMany({
    where: { eleve_id: { in: eleve_ids }, annee_scolaire_id },
    include: { matiere: { select: { coeff_defaut: true } } },
  });

  // Grouper les notes par élève
  const notesByEleve = new Map<string, typeof toutesLesNotes>();
  for (const note of toutesLesNotes) {
    const bucket = notesByEleve.get(note.eleve_id) ?? [];
    bucket.push(note);
    notesByEleve.set(note.eleve_id, bucket);
  }

  // Charger les progressions existantes en une seule requête
  const existantes = await prisma.progressionEleve.findMany({
    where: { eleve_id: { in: eleve_ids }, annee_scolaire_id },
  });
  const existantesMap = new Map(existantes.map(p => [p.eleve_id, p]));

  const created = [];

  for (const inscription of inscriptions) {
    const eleve_id = inscription.eleve_id;
    const notes    = notesByEleve.get(eleve_id) ?? [];

    let moyenne: number | null = null;
    if (notes.length > 0) {
      let totalPondere = 0;
      let totalCoeff   = 0;
      for (const note of notes) {
        const coeff = Number(note.matiere.coeff_defaut);
        totalPondere += Number(note.valeur) * coeff;
        totalCoeff   += coeff;
      }
      moyenne = totalCoeff > 0 ? Math.round((totalPondere / totalCoeff) * 100) / 100 : null;
    }

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
  if (!existing) throw new Error('Progression introuvable');

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
  if (!eleve) throw new Error('Élève introuvable');

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
