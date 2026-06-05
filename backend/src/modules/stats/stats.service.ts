import prisma from '../../config/database';

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

async function getMoyennesClasses(etablissement_id: string, annee_scolaire_id?: string) {
  const annee = annee_scolaire_id ?? (await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { id: true },
  }))?.id;

  if (!annee) return [];

  const classes = await prisma.classe.findMany({
    where: { etablissement_id, annee_scolaire_id: annee, active: true },
    select: { id: true, nom_fr: true, filiere: true },
  });

  const results = await Promise.all(classes.map(async (c) => {
    const inscriptions = await prisma.inscription.findMany({
      where: {
        annee_scolaire_id: annee,
        statut: 'actif',
        OR: [{ classe_fr_id: c.id }, { classe_ar_id: c.id }],
      },
      select: { eleve_id: true },
    });
    const eleveIds = inscriptions.map(i => i.eleve_id);
    if (eleveIds.length === 0) return { ...c, moyenne: null, nb_eleves: 0 };

    const agg = await prisma.note.aggregate({
      where: { eleve_id: { in: eleveIds }, annee_scolaire_id: annee },
      _avg: { valeur: true },
      _count: { id: true },
    });

    return {
      classe_id: c.id,
      classe_nom: c.nom_fr,
      filiere: c.filiere,
      nb_eleves: eleveIds.length,
      moyenne: agg._avg.valeur ? Math.round(Number(agg._avg.valeur) * 100) / 100 : null,
    };
  }));

  return results.filter(r => r.moyenne !== null).sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
}

async function getTopBottomEleves(etablissement_id: string, annee_scolaire_id?: string) {
  const annee = annee_scolaire_id ?? (await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { id: true },
  }))?.id;

  if (!annee) return { top5: [], bottom5: [] };

  const notes = await prisma.note.groupBy({
    by: ['eleve_id'],
    where: {
      eleve: { etablissement_id },
      annee_scolaire_id: annee,
    },
    _avg: { valeur: true },
    _count: { id: true },
    having: { valeur: { _count: { gte: 3 } } },
  });

  notes.sort((a, b) => Number(b._avg.valeur ?? 0) - Number(a._avg.valeur ?? 0));

  const top5Ids    = notes.slice(0, 5).map(n => n.eleve_id);
  const bottom5Ids = notes.slice(-5).reverse().map(n => n.eleve_id);
  const allIds     = [...new Set([...top5Ids, ...bottom5Ids])];

  if (allIds.length === 0) return { top5: [], bottom5: [] };

  const eleves = await prisma.eleve.findMany({
    where: { id: { in: allIds } },
    include: {
      inscriptions: {
        where: { annee_scolaire_id: annee, statut: 'actif' },
        include: {
          classe_fr: { select: { nom_fr: true } },
          classe_ar: { select: { nom_fr: true } },
        },
      },
    },
  });

  const eleveMap = new Map(eleves.map(e => [e.id, e]));
  const moyenneMap = new Map(notes.map(n => [n.eleve_id, Math.round(Number(n._avg.valeur ?? 0) * 100) / 100]));

  function format(id: string) {
    const e = eleveMap.get(id);
    if (!e) return null;
    const insc = e.inscriptions[0];
    const classe = insc?.classe_fr?.nom_fr ?? insc?.classe_ar?.nom_fr ?? '—';
    return {
      eleve_id: e.id,
      nom: `${e.nom_fr} ${e.prenom_fr}`,
      matricule: e.matricule,
      moyenne: moyenneMap.get(id) ?? 0,
      classe,
    };
  }

  return {
    top5:    top5Ids.map(format).filter(Boolean),
    bottom5: bottom5Ids.map(format).filter(Boolean),
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

async function getAlertes(etablissement_id: string, annee_scolaire_id?: string) {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const seuilAbsences  = config?.seuil_absences_alerte   ?? 3;
  const baseNote       = Number(config?.note_max ?? 20);
  const seuilReussite  = baseNote / 2; // moitié de l'échelle (ex: 5 sur /10)

  const annee = annee_scolaire_id ?? (await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
    select: { id: true },
  }))?.id;

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

  // Notes insuffisantes — basées sur la MOYENNE du bulletin (pondérée/normalisée),
  // et non sur une moyenne brute des notes (barèmes variables). Seuil = base/2.
  if (annee) {
    const bulletins = await prisma.bulletin.findMany({
      where: { annee_scolaire_id: annee, periode: { gt: 0 }, moyenne: { lt: seuilReussite }, eleve: { etablissement_id } },
      select: { eleve_id: true, moyenne: true, eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } } },
      orderBy: { moyenne: 'asc' },
    });
    const vus = new Set<string>();
    for (const b of bulletins) {
      if (vus.has(b.eleve_id)) continue;
      vus.add(b.eleve_id);
      alertes.push({ type: 'note_insuffisante', eleve_id: b.eleve_id, nom: `${b.eleve.nom_fr} ${b.eleve.prenom_fr}`, matricule: b.eleve.matricule, valeur: Math.round(Number(b.moyenne ?? 0) * 100) / 100 });
    }
  }

  return alertes.slice(0, 20);
}

export async function getTableauDeBord(etablissement_id: string, annee_scolaire_id?: string) {
  const [presenceEleves, presencePersonnel, moyennesClasses, topBottom, finances, alertes] = await Promise.all([
    getTauxPresenceEleves(etablissement_id),
    getTauxPresenceProfesseurs(etablissement_id),
    getMoyennesClasses(etablissement_id, annee_scolaire_id),
    getTopBottomEleves(etablissement_id, annee_scolaire_id),
    getFinancesEvolution(etablissement_id),
    getAlertes(etablissement_id, annee_scolaire_id),
  ]);

  return {
    presence_eleves:      presenceEleves,
    presence_personnel:   presencePersonnel,
    // Alias rétro-compat — frontend Dashboard lit encore presence_professeurs.
    // À supprimer après mise à jour des consommateurs.
    presence_professeurs: presencePersonnel,
    moyennes_classes:     moyennesClasses,
    top5_eleves:          topBottom.top5,
    bottom5_eleves:       topBottom.bottom5,
    finances,
    alertes,
  };
}
