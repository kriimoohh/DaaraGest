import prisma from '../../config/database';
import { calculerMoyennesClasse } from '../bulletins/bulletins.service';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';

function dateDebutSemaine(): Date {
  const d = new Date();
  const jour = d.getDay() === 0 ? 6 : d.getDay() - 1; // lundi = 0
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateDebutMois(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dateMoisPrecedent(): { debut: Date; fin: Date } {
  const d = new Date();
  const debut = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const fin   = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
  return { debut, fin };
}

async function getTauxPresenceEleves(etablissement_id: string) {
  const debutSemaine = dateDebutSemaine();
  const debutMois    = dateDebutMois();
  const maintenant   = new Date();

  const [semaine, mois] = await Promise.all([
    prisma.absenceEleve.groupBy({
      by: ['statut'],
      where: { etablissement_id, date: { gte: debutSemaine, lte: maintenant } },
      _count: { id: true },
    }),
    prisma.absenceEleve.groupBy({
      by: ['statut'],
      where: { etablissement_id, date: { gte: debutMois, lte: maintenant } },
      _count: { id: true },
    }),
  ]);

  function calcTaux(rows: { statut: string; _count: { id: number } }[]) {
    const total   = rows.reduce((s, r) => s + r._count.id, 0);
    const absents = rows.filter(r => r.statut === 'absent' || r.statut === 'retard').reduce((s, r) => s + r._count.id, 0);
    const presents = total - absents;
    return { total, presents, absents, taux: total > 0 ? Math.round((presents / total) * 1000) / 10 : 0 };
  }

  return { semaine: calcTaux(semaine), mois: calcTaux(mois) };
}

async function getTauxPresenceProfesseurs(etablissement_id: string) {
  const debutSemaine = dateDebutSemaine();
  const debutMois    = dateDebutMois();
  const maintenant   = new Date();

  const [semaine, mois] = await Promise.all([
    prisma.presencePersonnel.groupBy({
      by: ['statut'],
      where: {
        personnel: { utilisateur: { etablissement_id } },
        date: { gte: debutSemaine, lte: maintenant },
      },
      _count: { id: true },
    }),
    prisma.presencePersonnel.groupBy({
      by: ['statut'],
      where: {
        personnel: { utilisateur: { etablissement_id } },
        date: { gte: debutMois, lte: maintenant },
      },
      _count: { id: true },
    }),
  ]);

  function calcTaux(rows: { statut: string; _count: { id: number } }[]) {
    const total   = rows.reduce((s, r) => s + r._count.id, 0);
    const absents = rows.filter(r => r.statut === 'absent' || r.statut === 'retard').reduce((s, r) => s + r._count.id, 0);
    const presents = total - absents;
    return { total, presents, absents, taux: total > 0 ? Math.round((presents / total) * 1000) / 10 : 0 };
  }

  return { semaine: calcTaux(semaine), mois: calcTaux(mois) };
}

// Source UNIQUE des moyennes du tableau de bord : normalisées sur l'échelle de
// l'établissement (ConfigNotes.note_max) et pondérées par les barèmes/coefficients
// EFFECTIFS (override de période prioritaire), via `calculerMoyennesClasse` du
// module bulletins. Remplace l'ancienne moyenne brute des notes (_avg valeur) qui,
// avec des barèmes variables (/10../60) et le mélange FR+AR, donnait des moyennes
// incohérentes avec les bulletins.
async function calculerStatsNotes(etablissement_id: string, annee: string) {
  const config = await prisma.configNotes.findUnique({
    where: { etablissement_id }, select: { nb_periodes: true, note_max: true },
  });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const periodes = Array.from({ length: config?.nb_periodes ?? 3 }, (_, i) => i + 1);

  const classes = await prisma.classe.findMany({
    where: { etablissement_id, annee_scolaire_id: annee, active: true },
    select: { id: true, nom_fr: true, filiere: true },
  });

  const moyennesClasses: Array<{
    classe_id: string; classe_nom: string; filiere: string; nb_eleves: number; moyenne: number | null;
  }> = [];
  // eleve_id → cumul des moyennes par filière (moyenne globale = moyenne des
  // moyennes de chaque filière de l'élève : FR, AR, EN…)
  const parEleve = new Map<string, { somme: number; n: number; classe: string }>();

  for (const c of classes) {
    const inscriptions = await prisma.inscription.findMany({
      where: { annee_scolaire_id: annee, statut: 'actif', classes: { some: { classe_id: c.id } } },
      select: { eleve_id: true },
    });
    if (inscriptions.length === 0) {
      moyennesClasses.push({ classe_id: c.id, classe_nom: c.nom_fr, filiere: c.filiere, nb_eleves: 0, moyenne: null });
      continue;
    }

    const moys = await calculerMoyennesClasse(etablissement_id, c.id, annee, periodes, [c.filiere as 'FR' | 'AR' | 'EN']);
    const vals = [...moys.values()];
    const moyenne = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
    moyennesClasses.push({ classe_id: c.id, classe_nom: c.nom_fr, filiere: c.filiere, nb_eleves: inscriptions.length, moyenne });

    for (const [eleve_id, moy] of moys) {
      const cur = parEleve.get(eleve_id) ?? { somme: 0, n: 0, classe: c.nom_fr };
      cur.somme += moy; cur.n += 1;
      if (c.filiere === 'FR') cur.classe = c.nom_fr; // libellé : classe FR de préférence
      parEleve.set(eleve_id, cur);
    }
  }

  moyennesClasses.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
  return { baseNote, moyennesClasses, parEleve };
}

type ParEleve = Map<string, { somme: number; n: number; classe: string }>;

function moyenneGlobale(v: { somme: number; n: number }): number {
  return Math.round((v.somme / v.n) * 100) / 100;
}

async function getTopBottomEleves(parEleve: ParEleve) {
  const arr = [...parEleve.entries()]
    .map(([eleve_id, v]) => ({ eleve_id, moyenne: moyenneGlobale(v), classe: v.classe }))
    .sort((a, b) => b.moyenne - a.moyenne);

  const top5    = arr.slice(0, 5);
  const bottom5 = arr.slice(-5).reverse();
  const allIds  = [...new Set([...top5, ...bottom5].map(x => x.eleve_id))];
  if (allIds.length === 0) return { top5: [], bottom5: [] };

  const eleves = await prisma.eleve.findMany({
    where: { id: { in: allIds } },
    select: { id: true, nom_fr: true, prenom_fr: true, matricule: true },
  });
  const eleveMap = new Map(eleves.map(e => [e.id, e]));

  function format(x: { eleve_id: string; moyenne: number; classe: string }) {
    const e = eleveMap.get(x.eleve_id);
    if (!e) return null;
    return { eleve_id: e.id, nom: `${e.nom_fr} ${e.prenom_fr}`, matricule: e.matricule, moyenne: x.moyenne, classe: x.classe };
  }

  return {
    top5:    top5.map(format).filter(Boolean),
    bottom5: bottom5.map(format).filter(Boolean),
  };
}

async function getFinancesEvolution(etablissement_id: string) {
  const now           = new Date();
  const moisCourant   = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const { debut: debPrev, fin: finPrev } = dateMoisPrecedent();

  const [courant, precedent] = await Promise.all([
    prisma.paiementEleve.aggregate({
      where: {
        eleve: { etablissement_id },
        mois: moisCourant,
        annee: anneeCourante,
      },
      _sum: { montant: true },
    }),
    prisma.paiementEleve.aggregate({
      where: {
        eleve: { etablissement_id },
        created_at: { gte: debPrev, lte: finPrev },
      },
      _sum: { montant: true },
    }),
  ]);

  const mc = Number(courant._sum.montant ?? 0);
  const mp = Number(precedent._sum.montant ?? 0);
  const evolution_pct = mp > 0 ? Math.round(((mc - mp) / mp) * 1000) / 10 : null;

  return { mois_courant: mc, mois_precedent: mp, evolution_pct };
}

async function getAlertes(etablissement_id: string, annee: string | undefined, parEleve: ParEleve) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const seuilAbsences  = config?.seuil_absences_alerte   ?? 3;
  const baseNote       = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const seuilReussite  = baseNote / 2; // moitié de l'échelle (ex: 5 sur /10)

  const alertes: Array<{
    type: string; eleve_id: string; nom: string; matricule: string; valeur: number; classe?: string;
  }> = [];

  // Absences répétées
  const absGroups = await prisma.absenceEleve.groupBy({
    by: ['eleve_id'],
    where: {
      etablissement_id,
      statut: { in: ['absent'] },
      ...(annee ? { annee_scolaire_id: annee } : {}),
    },
    _count: { id: true },
    having: { id: { _count: { gte: seuilAbsences } } },
  });

  if (absGroups.length > 0) {
    const eleveIds = absGroups.map(g => g.eleve_id);
    const eleves = await prisma.eleve.findMany({
      where: { id: { in: eleveIds } },
      select: { id: true, nom_fr: true, prenom_fr: true, matricule: true },
    });
    const eleveMap = new Map(eleves.map(e => [e.id, e]));
    for (const g of absGroups) {
      const e = eleveMap.get(g.eleve_id);
      if (e) alertes.push({ type: 'absences_repetees', eleve_id: e.id, nom: `${e.nom_fr} ${e.prenom_fr}`, matricule: e.matricule, valeur: g._count.id });
    }
  }

  // Notes insuffisantes — moyenne globale (moy FR+AR)/2 NORMALISÉE et pondérée,
  // calculée à la volée (cf. calculerStatsNotes) et NON lue depuis la table
  // Bulletin : les alertes ne dépendent plus de la génération des bulletins.
  const faibles = [...parEleve.entries()]
    .map(([eleve_id, v]) => ({ eleve_id, moyenne: moyenneGlobale(v) }))
    .filter(m => m.moyenne < seuilReussite)
    .sort((a, b) => a.moyenne - b.moyenne);

  if (faibles.length > 0) {
    const eleves = await prisma.eleve.findMany({
      where: { id: { in: faibles.map(f => f.eleve_id) } },
      select: { id: true, nom_fr: true, prenom_fr: true, matricule: true },
    });
    const em = new Map(eleves.map(e => [e.id, e]));
    for (const f of faibles) {
      const e = em.get(f.eleve_id);
      if (e) alertes.push({ type: 'note_insuffisante', eleve_id: e.id, nom: `${e.nom_fr} ${e.prenom_fr}`, matricule: e.matricule, valeur: f.moyenne });
    }
  }

  return alertes.slice(0, 20);
}

export async function getTableauDeBord(etablissement_id: string, annee_scolaire_id?: string) {
  const annee = annee_scolaire_id ?? (await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { id: true },
  }))?.id;

  // Moyennes (classes + par élève) calculées une seule fois, partagées par le
  // classement top/bottom et les alertes.
  const statsNotes = annee
    ? await calculerStatsNotes(etablissement_id, annee)
    : { baseNote: Number((await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { note_max: true } }))?.note_max ?? DEFAULT_NOTE_MAX), moyennesClasses: [] as Array<{ classe_id: string; classe_nom: string; filiere: string; nb_eleves: number; moyenne: number | null }>, parEleve: new Map() as ParEleve };

  const [presenceEleves, presencePersonnel, topBottom, finances, alertes] = await Promise.all([
    getTauxPresenceEleves(etablissement_id),
    getTauxPresenceProfesseurs(etablissement_id),
    getTopBottomEleves(statsNotes.parEleve),
    getFinancesEvolution(etablissement_id),
    getAlertes(etablissement_id, annee, statsNotes.parEleve),
  ]);

  return {
    presence_eleves:      presenceEleves,
    presence_personnel:   presencePersonnel,
    // Alias rétro-compat — frontend Dashboard lit encore presence_professeurs.
    // À supprimer après mise à jour des consommateurs.
    presence_professeurs: presencePersonnel,
    // Échelle des moyennes (ConfigNotes.note_max, ex: 10) — le frontend doit
    // s'y référer au lieu de supposer /20.
    note_max_base:        statsNotes.baseNote,
    moyennes_classes:     statsNotes.moyennesClasses.filter(r => r.moyenne !== null),
    top5_eleves:          topBottom.top5,
    bottom5_eleves:       topBottom.bottom5,
    finances,
    alertes,
  };
}
