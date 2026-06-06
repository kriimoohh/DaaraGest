import prisma from '../../config/database';
import { GenererBulletinInput, GenererBulletinAnnuelInput, ObservationInput } from './bulletins.schema';
import { renderPdfHtml } from '../../utils/browserPool';
import { assertProfPeutAccederClasse } from '../../utils/teachingPolicy';
import { logAction } from '../../utils/audit';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';

type Filiere = 'FR' | 'AR' | 'COMBINE';

export type SeuilsMentions = {
  tres_bien: number;
  bien: number;
  assez_bien: number;
  passable: number;
};

const SEUILS_DEFAUT: SeuilsMentions = { tres_bien: 16, bien: 14, assez_bien: 12, passable: 10 };

const LIBELLES: Record<'FR' | 'AR', { tres_bien: string; bien: string; assez_bien: string; passable: string; insuffisant: string }> = {
  FR: {
    tres_bien:   'Très bien — Félicitations du conseil',
    bien:        'Bien',
    assez_bien:  'Assez bien',
    passable:    'Passable',
    insuffisant: 'Insuffisant — Doit faire des efforts',
  },
  AR: {
    tres_bien:   'ممتاز — تهنئة المجلس',
    bien:        'جيد جدا',
    assez_bien:  'جيد',
    passable:    'مقبول',
    insuffisant: 'ضعيف — يجب بذل المزيد من الجهد',
  },
};

/** Extrait les seuils de ConfigNotes (ou applique les valeurs par défaut). */
export function extractSeuilsMentions(config: { seuil_tres_bien?: unknown; seuil_bien?: unknown; seuil_assez_bien?: unknown; seuil_passable?: unknown } | null): SeuilsMentions {
  if (!config) return SEUILS_DEFAUT;
  return {
    tres_bien:  Number(config.seuil_tres_bien)  || SEUILS_DEFAUT.tres_bien,
    bien:       Number(config.seuil_bien)       || SEUILS_DEFAUT.bien,
    assez_bien: Number(config.seuil_assez_bien) || SEUILS_DEFAUT.assez_bien,
    passable:   Number(config.seuil_passable)   || SEUILS_DEFAUT.passable,
  };
}

export type MentionDef = { libelle_fr: string; seuil_min: number };

/** Mentions configurables de l'établissement (table Mention), triées par seuil décroissant. */
async function getMentions(etablissement_id: string): Promise<MentionDef[]> {
  const rows = await prisma.mention.findMany({ where: { etablissement_id }, orderBy: { seuil_min: 'desc' } });
  return rows.map(r => ({ libelle_fr: r.libelle_fr, seuil_min: Number(r.seuil_min) }));
}

/** Libellé de mention pour une moyenne (sur l'échelle de l'établissement). */
export function mentionPour(m: number, mentions: MentionDef[]): string {
  for (const mention of mentions) if (m + 1e-9 >= mention.seuil_min) return mention.libelle_fr;
  return mentions.length ? mentions[mentions.length - 1].libelle_fr : '';
}

export function appreciation(m: number, filiere: Filiere = 'FR', seuils: SeuilsMentions = SEUILS_DEFAUT): string {
  // COMBINE renvoie les deux versions séparées par un retour à la ligne
  // pour préserver les deux entêtes du bulletin bilingue.
  if (filiere === 'COMBINE') {
    return `${appreciation(m, 'FR', seuils)}\n${appreciation(m, 'AR', seuils)}`;
  }
  const l = LIBELLES[filiere];
  if (m >= seuils.tres_bien)  return l.tres_bien;
  if (m >= seuils.bien)       return l.bien;
  if (m >= seuils.assez_bien) return l.assez_bien;
  if (m >= seuils.passable)   return l.passable;
  return l.insuffisant;
}

type MatiereAvecCoeff = {
  id: string; nom_fr: string; nom_ar: string | null; filiere: string;
  coeff_defaut: unknown; coeff_effectif: unknown;
  note_max_effectif: unknown; note_min: unknown; ordre_bulletin: number;
};

// Contribution d'une note à la moyenne pondérée. Les notes sont saisies sur le
// barème de la matière (ex: 59/60) ; on les ramène d'abord sur l'échelle de
// l'établissement (ConfigNotes.note_max, ex: /10 ou /20) puis on pondère par le
// coefficient. Rétro-compatible : si note_max == base, on retrouve valeur×coeff.
function contributionNote(valeur: number, noteMax: number, base: number, coeff: number): number {
  return noteMax > 0 ? (valeur / noteMax) * base * coeff : 0;
}

// `baseNote` = échelle de l'établissement (ConfigNotes.note_max). Sert de barème
// par défaut quand une matière de la classe n'a ni override de période ni override
// de classe : la note est alors réputée saisie sur l'échelle de l'établissement.
async function getMatieresDeclasse(
  classe_id: string, filiere: 'FR' | 'AR', periode?: number, baseNote: number = DEFAULT_NOTE_MAX,
): Promise<MatiereAvecCoeff[]> {
  const rows = await prisma.classeMatiere.findMany({
    where: { classe_id, matiere: { filiere, active: true } },
    include: { matiere: true },
    orderBy: [{ ordre_override: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
  });
  // Overrides par trimestre (coeff/barème spécifiques à une période) — prioritaires.
  const overrides = new Map<string, { coeff: number; note_max: number }>();
  if (periode != null) {
    const ov = await prisma.classeMatierePeriode.findMany({ where: { classe_id, periode } });
    for (const o of ov) overrides.set(o.matiere_id, { coeff: Number(o.coeff), note_max: Number(o.note_max) });
  }
  return rows.map(r => {
    const o = overrides.get(r.matiere_id);
    return {
      ...r.matiere,
      coeff_effectif: o ? o.coeff : (r.coeff_override ?? r.matiere.coeff_defaut),
      note_max_effectif: o ? o.note_max : (r.note_max_override ?? baseNote),
      ordre_bulletin: r.ordre_override ?? r.matiere.ordre_bulletin,
    };
  });
}

async function getMatieres(etablissement_id: string, filiere: 'FR' | 'AR') {
  return prisma.matiere.findMany({
    where: { etablissement_id, filiere, active: true },
    orderBy: { ordre_bulletin: 'asc' },
  });
}

async function getElevesClasse(classe_id: string, annee_scolaire_id: string) {
  return prisma.inscription.findMany({
    where: { annee_scolaire_id, statut: 'actif', OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] },
    include: { eleve: true },
  });
}

/**
 * Moyenne(s) pondérée(s) et normalisées d'une classe — SOURCE UNIQUE de calcul,
 * réutilisée par les bulletins ET les rapports/stats pour garantir la cohérence.
 * Chaque note est ramenée sur l'échelle établissement (ConfigNotes.note_max) via
 * son barème effectif, pondérée par le coefficient (override de période prioritaire).
 * `periodes` : [p] pour un trimestre, [1,2,3] pour l'annuel.
 * Retourne eleve_id → moyenne (arrondie 2 déc.).
 */
export async function calculerMoyennesClasse(
  etablissement_id: string, classe_id: string, annee_scolaire_id: string,
  periodes: number[], filieres: ('FR' | 'AR')[] = ['FR', 'AR'],
): Promise<Map<string, number>> {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return new Map();

  // Coeff/barème par période (gère les coefficients qui changent de trimestre)
  const coefByP = new Map<number, Map<string, number>>();
  const nmByP = new Map<number, Map<string, number>>();
  const matIds = new Set<string>();
  for (const p of periodes) {
    const cM = new Map<string, number>(), nM = new Map<string, number>();
    for (const f of filieres) for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
      cM.set(m.id, Number(m.coeff_effectif)); nM.set(m.id, Number(m.note_max_effectif)); matIds.add(m.id);
    }
    coefByP.set(p, cM); nmByP.set(p, nM);
  }

  const notes = await prisma.note.findMany({
    where: { eleve_id: { in: inscriptions.map(i => i.eleve_id) }, annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: [...matIds] } },
    include: { matiere: true },
  });
  const byEleve = new Map<string, typeof notes>();
  for (const n of notes) {
    if (!byEleve.has(n.eleve_id)) byEleve.set(n.eleve_id, []);
    byEleve.get(n.eleve_id)!.push(n);
  }

  const res = new Map<string, number>();
  for (const { eleve_id } of inscriptions) {
    let tp = 0, tc = 0;
    for (const n of byEleve.get(eleve_id) ?? []) {
      const c = coefByP.get(n.periode)?.get(n.matiere_id) ?? Number(n.matiere.coeff_defaut);
      const nm = nmByP.get(n.periode)?.get(n.matiere_id) ?? baseNote;
      if (c === 0) continue;
      tp += contributionNote(Number(n.valeur), nm, baseNote, c); tc += c;
    }
    if (tc > 0) res.set(eleve_id, Math.round((tp / tc) * 100) / 100);
  }
  return res;
}

/** Mentions configurables de l'établissement (réutilisable par les rapports). */
export async function getMentionsEtab(etablissement_id: string): Promise<MentionDef[]> {
  return getMentions(etablissement_id);
}

/**
 * Barème + coefficient EFFECTIFS par (matière, période) pour une classe.
 * Indispensable pour normaliser correctement une note brute (saisie sur son
 * barème, ex: 56/60) — les rapports doivent l'utiliser au lieu de Matiere.note_max.
 * Clé de la map : `${matiere_id}|${periode}`.
 */
export async function getBaremesClasse(
  classe_id: string, periodes: number[], filieres: ('FR' | 'AR')[] = ['FR', 'AR'],
  baseNote: number = DEFAULT_NOTE_MAX,
): Promise<Map<string, { coeff: number; note_max: number }>> {
  const map = new Map<string, { coeff: number; note_max: number }>();
  for (const p of periodes) for (const f of filieres) {
    for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
      map.set(`${m.id}|${p}`, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif) });
    }
  }
  return map;
}

// ─── Lister ─────────────────────────────────────────────────────────────────

export async function listerBulletins(
  etablissement_id: string, annee_scolaire_id?: string, periode?: number,
  eleve_id?: string, filiere?: string,
) {
  const where: Record<string, unknown> = { eleve: { etablissement_id } };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (periode !== undefined) where.periode = periode;
  if (eleve_id) where.eleve_id = eleve_id;
  if (filiere) where.filiere = filiere;
  return prisma.bulletin.findMany({
    where,
    include: {
      eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
      annee_scolaire: true,
    },
    orderBy: [{ periode: 'asc' }, { rang: 'asc' }],
  });
}

// ─── Générer bulletins trimestriels (FR | AR | COMBINE) ──────────────────────

export async function genererBulletins(etablissement_id: string, data: GenererBulletinInput) {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const mentions = await getMentions(etablissement_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMap[f] = await getMatieresDeclasse(classe_id, f, periode, baseNote);

  // Fetch toutes les notes d'un coup (évite N+1)
  const tousMatIds = filieres.flatMap(f => matMap[f].map(m => m.id));
  const elevesIds = inscriptions.map(i => i.eleve_id);
  const toutesLesNotes = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIds }, annee_scolaire_id, periode, matiere_id: { in: tousMatIds } },
    include: { matiere: true },
  });
  const notesByEleve = new Map<string, typeof toutesLesNotes>();
  for (const n of toutesLesNotes) {
    if (!notesByEleve.has(n.eleve_id)) notesByEleve.set(n.eleve_id, []);
    notesByEleve.get(n.eleve_id)!.push(n);
  }

  // Map matiere_id → coeff_effectif / note_max_effectif (override prioritaire)
  const coeffMap = new Map<string, number>(
    filieres.flatMap(f => matMap[f].map(m => [m.id, Number(m.coeff_effectif)]))
  );
  const noteMaxMap = new Map<string, number>(
    filieres.flatMap(f => matMap[f].map(m => [m.id, Number(m.note_max_effectif)]))
  );

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const n of notesByEleve.get(eleve_id) ?? []) {
      const c = coeffMap.get(n.matiere_id) ?? Number(n.matiere.coeff_defaut);
      const nm = noteMaxMap.get(n.matiere_id) ?? baseNote;
      totalP += contributionNote(Number(n.valeur), nm, baseNote, c);
      totalC += c;
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode } },
      create: { eleve_id, annee_scolaire_id, filiere, periode, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) généré(s)`, bulletins };
}

// ─── Générer bulletins annuels (periode=0) ───────────────────────────────────

export async function genererBulletinsAnnuels(etablissement_id: string, data: GenererBulletinAnnuelInput) {
  const { classe_id, annee_scolaire_id, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  // Nombre de périodes configurable par établissement (2 = semestres,
  // 3 = trimestres, 6 = bimestres). Par défaut 3 si non défini.
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const periodesAnnuelles = Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const mentions = await getMentions(etablissement_id);

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMapAnnuel: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMapAnnuel[f] = await getMatieresDeclasse(classe_id, f, undefined, baseNote);

  // Fetch toutes les notes annuelles d'un coup (évite N+1)
  const tousMatIdsAnnuel = filieres.flatMap(f => matMapAnnuel[f].map(m => m.id));
  const elevesIdsAnnuel = inscriptions.map(i => i.eleve_id);
  const toutesLesNotesAnnuel = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIdsAnnuel }, annee_scolaire_id, periode: { in: periodesAnnuelles }, matiere_id: { in: tousMatIdsAnnuel } },
    include: { matiere: true },
  });
  const notesByEleveAnnuel = new Map<string, typeof toutesLesNotesAnnuel>();
  for (const n of toutesLesNotesAnnuel) {
    if (!notesByEleveAnnuel.has(n.eleve_id)) notesByEleveAnnuel.set(n.eleve_id, []);
    notesByEleveAnnuel.get(n.eleve_id)!.push(n);
  }

  // Coeff/barème PAR PÉRIODE (les coefficients peuvent changer d'un trimestre à
  // l'autre, surtout en arabe). On bâtit une carte par période.
  const coeffParPeriode = new Map<number, Map<string, number>>();
  const noteMaxParPeriode = new Map<number, Map<string, number>>();
  for (const p of periodesAnnuelles) {
    const cMap = new Map<string, number>(), nmMap = new Map<string, number>();
    for (const f of filieres) {
      for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
        cMap.set(m.id, Number(m.coeff_effectif)); nmMap.set(m.id, Number(m.note_max_effectif));
      }
    }
    coeffParPeriode.set(p, cMap); noteMaxParPeriode.set(p, nmMap);
  }

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const n of notesByEleveAnnuel.get(eleve_id) ?? []) {
      const c = coeffParPeriode.get(n.periode)?.get(n.matiere_id) ?? Number(n.matiere.coeff_defaut);
      const nm = noteMaxParPeriode.get(n.periode)?.get(n.matiere_id) ?? baseNote;
      totalP += contributionNote(Number(n.valeur), nm, baseNote, c);
      totalC += c;
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode: 0 } },
      create: { eleve_id, annee_scolaire_id, filiere, periode: 0, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) annuel(s) généré(s)`, bulletins };
}

// ─── Détail bulletin ─────────────────────────────────────────────────────────

export async function getBulletin(id: string, etablissement_id: string) {
  const bulletin = await prisma.bulletin.findFirst({
    where: { id, eleve: { etablissement_id } },
    include: {
      eleve: { include: { inscriptions: { include: { classe_fr: true, classe_ar: true } } } },
      annee_scolaire: true,
    },
  });
  if (!bulletin) throw new Error('Bulletin introuvable');

  const filieres: ('FR' | 'AR')[] = bulletin.filiere === 'COMBINE' ? ['FR', 'AR'] : [bulletin.filiere as 'FR' | 'AR'];

  // Nb de périodes configurable (2=semestres, 3=trimestres, 6=bimestres). On
  // ne dépend plus de [1,2,3] hardcodé pour les bulletins annuels.
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  // Chercher la classe de l'élève pour l'année scolaire du bulletin
  const inscription = bulletin.eleve.inscriptions.find(
    i => i.annee_scolaire_id === bulletin.annee_scolaire_id
  ) as { classe_fr_id?: string | null; classe_ar_id?: string | null } | undefined;
  const classeIdFR = inscription?.classe_fr_id ?? null;
  const classeIdAR = inscription?.classe_ar_id ?? null;

  const notesByFiliere: Record<string, unknown[]> = {};
  for (const f of filieres) {
    const classeId = f === 'FR' ? classeIdFR : classeIdAR;
    const matieres = classeId
      ? await getMatieresDeclasse(classeId, f, undefined, baseNote)
      : await getMatieres(etablissement_id, f);
    const baremeMap = new Map(matieres.map(m => [m.id, 'note_max_effectif' in m ? Number(m.note_max_effectif) : baseNote]));
    const periodes = bulletin.periode === 0
      ? Array.from({ length: nbPeriodes }, (_, i) => i + 1)
      : [bulletin.periode];
    const notesRaw = await prisma.note.findMany({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: matieres.map(m => m.id) } },
      include: { matiere: true },
      orderBy: { matiere: { ordre_bulletin: 'asc' } },
    });
    // Exposer le barème effectif sur la matière (note_max) pour l'affichage : la note
    // est saisie sur ce barème, pas sur un défaut plat.
    notesByFiliere[f] = notesRaw.map(n => ({
      ...n,
      matiere: { ...n.matiere, note_max: baremeMap.get(n.matiere_id) ?? baseNote },
    }));
  }
  return { ...bulletin, notesByFiliere };
}

// ─── Mettre à jour les observations ─────────────────────────────────────────

export async function mettreAJourObservation(
  id: string,
  etablissement_id: string,
  data: ObservationInput,
  valide_par: string,
  role?: string,
) {
  const bulletin = await prisma.bulletin.findFirst({ where: { id, eleve: { etablissement_id } } });
  if (!bulletin) throw new Error('Bulletin introuvable');

  if (role) {
    const inscription = await prisma.inscription.findFirst({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id },
      select: { classe_fr_id: true, classe_ar_id: true },
    });
    const candidateClasses = [
      bulletin.filiere === 'AR' ? null : inscription?.classe_fr_id,
      bulletin.filiere === 'FR' ? null : inscription?.classe_ar_id,
    ].filter((c): c is string => Boolean(c));
    if (candidateClasses.length === 0) {
      throw new Error('Inscription introuvable pour ce bulletin');
    }
    let acces = false;
    for (const classe_id of candidateClasses) {
      try {
        await assertProfPeutAccederClasse(role, valide_par, classe_id);
        acces = true;
        break;
      } catch {
        // essai suivant
      }
    }
    if (!acces) {
      const err = new Error('Vous n\'enseignez pas dans la classe de cet élève');
      (err as { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  const updated = await prisma.bulletin.update({
    where: { id },
    data: {
      observation_fr: data.observation_fr ?? bulletin.observation_fr,
      observation_prof: data.observation_prof ?? bulletin.observation_prof,
      valide_par,
      valide_le: new Date(),
    },
  });

  await logAction(etablissement_id, valide_par, 'UPDATE', 'Bulletin', id, {
    action: 'observation',
    has_fr: data.observation_fr !== undefined,
    has_prof: data.observation_prof !== undefined,
  });

  return updated;
}

// ─── PDF individuel ──────────────────────────────────────────────────────────

export async function genererPdfBulletin(id: string, etablissement_id: string): Promise<Buffer> {
  const data = await getBulletin(id, etablissement_id);
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  // Nb de périodes dynamique (cf. genererBulletinsAnnuels + getBulletin)
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;

  const { generateBulletinHtml, generateBulletinAnnuelHtml } = await import('./bulletin.template');

  const base = {
    etablissement_nom_fr: etab.nom_fr,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_matricule: data.eleve.matricule, annee_libelle: data.annee_scolaire.libelle,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null, rang: data.rang,
    appreciation: data.appreciation, devise: etab.devise,
  };

  type NoteRaw = { valeur: unknown; periode: number; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };

  const toRows = (f: 'FR' | 'AR') =>
    ((data.notesByFiliere[f] ?? []) as NoteRaw[]).map(n => ({
      nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
      coeff: Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
    }));

  const toAnnuelRows = (f: 'FR' | 'AR') => {
    const map = new Map<string, { nom_fr: string; nom_ar: string; coeff: number; vals: Record<number, number | null> }>();
    for (const n of (data.notesByFiliere[f] ?? []) as NoteRaw[]) {
      if (!map.has(n.matiere.nom_fr)) map.set(n.matiere.nom_fr, { nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr, coeff: Number(n.matiere.coeff_defaut), vals: {} });
      map.get(n.matiere.nom_fr)!.vals[n.periode] = n.valeur !== null ? Number(n.valeur) : null;
    }
    return Array.from(map.values()).map(m => {
      const vals = Array.from({ length: nbPeriodes }, (_, i) => m.vals[i + 1] ?? null);
      const nums = vals.filter(v => v !== null) as number[];
      return { ...m, valeurs: vals, moyenne_annuelle: nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : null };
    });
  };

  let html: string;
  if (data.periode === 0) {
    const type = data.filiere === 'COMBINE' ? 'ANNUEL_COMBINE' : data.filiere === 'AR' ? 'ANNUEL_AR' : 'ANNUEL_FR';
    html = generateBulletinAnnuelHtml({
      ...base, type,
      matieres_fr: data.filiere !== 'AR' ? toAnnuelRows('FR') : undefined,
      matieres_ar: data.filiere !== 'FR' ? toAnnuelRows('AR') : undefined,
    });
  } else {
    const type = data.filiere as 'FR' | 'AR' | 'COMBINE';
    html = generateBulletinHtml({
      ...base, type, periode: data.periode,
      notes_fr: data.filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: data.filiere !== 'FR' ? toRows('AR') : undefined,
    });
  }

  return renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
}

// ─── PDF toute la classe ─────────────────────────────────────────────────────

export async function genererPdfClasse(
  classe_id: string, annee_scolaire_id: string, periode: number,
  filiere: string, etablissement_id: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const mentions = await getMentions(etablissement_id);

  const bulletins = await prisma.bulletin.findMany({
    where: {
      annee_scolaire_id, periode, filiere,
      eleve: { etablissement_id, inscriptions: { some: { annee_scolaire_id, OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] } } },
    },
    include: { eleve: true, annee_scolaire: true },
    orderBy: [{ rang: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
  if (bulletins.length === 0) throw new Error('Aucun bulletin trouvé');

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMap[f] = await getMatieresDeclasse(classe_id, f, periode, baseNote);

  // Coeff/barème effectifs par matière (override de classe prioritaire) pour l'affichage.
  const effMap = new Map<string, { coeff: number; note_max: number }>(
    filieres.flatMap(f => matMap[f].map(m => [m.id, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif) }]))
  );

  const { generateBulletinHtml } = await import('./bulletin.template');
  const pages: string[] = [];

  for (const bulletin of bulletins) {
    const notesByFiliere: Record<string, unknown[]> = {};
    for (const f of filieres) {
      notesByFiliere[f] = await prisma.note.findMany({
        where: { eleve_id: bulletin.eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
        include: { matiere: true }, orderBy: { matiere: { ordre_bulletin: 'asc' } },
      });
    }
    type NoteRaw = { matiere_id: string; valeur: unknown; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };
    const toRows = (f: 'FR' | 'AR') =>
      ((notesByFiliere[f] ?? []) as NoteRaw[]).map(n => {
        const eff = effMap.get(n.matiere_id);
        return {
          nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
          coeff: eff?.coeff ?? Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
          note_max: eff?.note_max ?? baseNote,
        };
      });

    pages.push(generateBulletinHtml({
      type: filiere as 'FR' | 'AR' | 'COMBINE', periode: bulletin.periode,
      etablissement_nom_fr: etab.nom_fr,
      eleve_nom_fr: `${bulletin.eleve.prenom_fr} ${bulletin.eleve.nom_fr}`,
      eleve_matricule: bulletin.eleve.matricule, annee_libelle: bulletin.annee_scolaire.libelle,
      moyenne: bulletin.moyenne !== null ? Number(bulletin.moyenne) : null,
      rang: bulletin.rang, appreciation: bulletin.appreciation, devise: etab.devise,
      note_max_etab: baseNote, mentions,
      notes_fr: filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: filiere !== 'FR' ? toRows('AR') : undefined,
    }));
  }

  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>.pb{page-break-after:always}body{margin:0;padding:0}</style></head><body>
    ${pages.map((p, i) => { const m = p.match(/<body>([\s\S]*)<\/body>/); const c = m ? m[1] : p; return i < pages.length - 1 ? `<div class="pb" style="padding:28px 36px">${c}</div>` : `<div style="padding:28px 36px">${c}</div>`; }).join('\n')}
  </body></html>`;

  return renderPdfHtml(combined, { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}
