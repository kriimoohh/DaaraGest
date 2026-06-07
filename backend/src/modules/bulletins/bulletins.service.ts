import prisma from '../../config/database';
import { GenererBulletinInput, GenererBulletinAnnuelInput, ObservationInput, PreflightInput } from './bulletins.schema';
import { renderPdfHtml } from '../../utils/browserPool';
import { assertProfPeutAccederClasse } from '../../utils/teachingPolicy';
import { logAction } from '../../utils/audit';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

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
  // Matière effectivement évaluée pour cette période ? Résolution :
  // ClasseMatierePeriode.evaluee (si non null) > ClasseMatiere.evaluee.
  evaluee_effectif: boolean;
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
  // Overrides par trimestre (coeff/barème/évaluée spécifiques à une période) — prioritaires.
  const overrides = new Map<string, { coeff: number; note_max: number; evaluee: boolean | null }>();
  if (periode != null) {
    const ov = await prisma.classeMatierePeriode.findMany({ where: { classe_id, periode } });
    for (const o of ov) overrides.set(o.matiere_id, { coeff: Number(o.coeff), note_max: Number(o.note_max), evaluee: o.evaluee });
  }
  return rows.map(r => {
    const o = overrides.get(r.matiere_id);
    return {
      ...r.matiere,
      coeff_effectif: o ? o.coeff : (r.coeff_override ?? r.matiere.coeff_defaut),
      note_max_effectif: o ? o.note_max : (r.note_max_override ?? baseNote),
      ordre_bulletin: r.ordre_override ?? r.matiere.ordre_bulletin,
      evaluee_effectif: o?.evaluee != null ? o.evaluee : r.evaluee,
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

  // Coeff/barème/évaluée par période (gère les coefficients qui changent de trimestre)
  const coefByP = new Map<number, Map<string, number>>();
  const nmByP = new Map<number, Map<string, number>>();
  const evByP = new Map<number, Map<string, boolean>>();
  const matIds = new Set<string>();
  for (const p of periodes) {
    const cM = new Map<string, number>(), nM = new Map<string, number>(), eM = new Map<string, boolean>();
    for (const f of filieres) for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
      cM.set(m.id, Number(m.coeff_effectif)); nM.set(m.id, Number(m.note_max_effectif)); eM.set(m.id, m.evaluee_effectif); matIds.add(m.id);
    }
    coefByP.set(p, cM); nmByP.set(p, nM); evByP.set(p, eM);
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
      // Matière marquée non évaluée pour cette période → exclue (note conservée en base).
      if (evByP.get(n.periode)?.get(n.matiere_id) === false) continue;
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
): Promise<Map<string, { coeff: number; note_max: number; evaluee: boolean }>> {
  const map = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
  for (const p of periodes) for (const f of filieres) {
    for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
      map.set(`${m.id}|${p}`, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif), evaluee: m.evaluee_effectif });
    }
  }
  return map;
}

type InscriptionClasses = { eleve_id: string; classe_fr_id: string | null; classe_ar_id: string | null };

/**
 * Barème + coefficient EFFECTIFS par (élève → période → matière), en combinant les
 * DEUX classes de l'élève (classe_fr_id ET classe_ar_id). Indispensable aux
 * bulletins COMBINE : un élève bilingue a ses matières FR et AR dans deux classes
 * distinctes — n'utiliser qu'un seul classe_id n'en compterait qu'une (la moyenne
 * COMBINE ne refléterait alors qu'une filière).
 */
type Bareme = { coeff: number; note_max: number; evaluee: boolean };

async function baremesParElevePeriode(
  inscriptions: InscriptionClasses[], filieres: ('FR' | 'AR')[], periodes: number[], baseNote: number,
): Promise<Map<string, Map<number, Map<string, Bareme>>>> {
  const cache = new Map<string, Map<string, Bareme>>(); // `${classeId}|${f}|${p}`
  const getClasse = async (classeId: string, f: 'FR' | 'AR', p: number) => {
    const key = `${classeId}|${f}|${p}`;
    let m = cache.get(key);
    if (!m) {
      const mats = await getMatieresDeclasse(classeId, f, p, baseNote);
      m = new Map(mats.map(x => [x.id, { coeff: Number(x.coeff_effectif), note_max: Number(x.note_max_effectif), evaluee: x.evaluee_effectif }]));
      cache.set(key, m);
    }
    return m;
  };
  const res = new Map<string, Map<number, Map<string, Bareme>>>();
  for (const insc of inscriptions) {
    const parPeriode = new Map<number, Map<string, Bareme>>();
    for (const p of periodes) {
      const merged = new Map<string, Bareme>();
      for (const f of filieres) {
        const cid = f === 'FR' ? insc.classe_fr_id : insc.classe_ar_id;
        if (!cid) continue;
        for (const [mid, v] of await getClasse(cid, f, p)) merged.set(mid, v);
      }
      parPeriode.set(p, merged);
    }
    res.set(insc.eleve_id, parPeriode);
  }
  return res;
}

// ─── Lister ─────────────────────────────────────────────────────────────────

export async function listerBulletins(
  etablissement_id: string, annee_scolaire_id?: string, periode?: number,
  eleve_id?: string, filiere?: string, classe_id?: string,
) {
  // Le Bulletin n'a pas de classe_id : on filtre via les inscriptions de l'élève
  // pour l'année scolaire considérée (un élève bilingue peut être dans une classe
  // FR et une classe AR distinctes — d'où le OR sur les deux colonnes).
  const eleveWhere: Record<string, unknown> = { etablissement_id };
  if (classe_id) {
    eleveWhere.inscriptions = {
      some: {
        ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
        OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      },
    };
  }
  const where: Record<string, unknown> = { eleve: eleveWhere };
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

// ─── Impact sur bulletins déjà générés (phase 2) ────────────────────────────

type BulletinImpacte = { id: string; eleve_id: string; periode: number; filiere: string; valide_le: Date | null };

/**
 * Bulletins déjà générés qui dépendent d'une matière donnée.
 * Pris en compte : bulletin avec la même filière que la matière OU `COMBINE`.
 * Pris en compte (élève) : inscrit dans cette classe (côté FR OU côté AR).
 * Annuel : `periode=0` est inclus si `0 ∈ periodes`.
 */
export async function bulletinsImpactesParMatiere(
  classe_id: string, matiere_id: string, periodes: number[],
): Promise<{ unsigned: BulletinImpacte[]; signed: BulletinImpacte[] }> {
  const matiere = await prisma.matiere.findUnique({ where: { id: matiere_id }, select: { filiere: true } });
  if (!matiere) return { unsigned: [], signed: [] };
  const filieres = matiere.filiere === 'FR' ? ['FR', 'COMBINE'] : ['AR', 'COMBINE'];
  const bulletins = await prisma.bulletin.findMany({
    where: {
      filiere: { in: filieres },
      periode: { in: periodes },
      eleve: { inscriptions: { some: { OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] } } },
    },
    select: { id: true, eleve_id: true, periode: true, filiere: true, valide_le: true },
  });
  return {
    unsigned: bulletins.filter(b => b.valide_le === null),
    signed: bulletins.filter(b => b.valide_le !== null),
  };
}

/**
 * Déverrouille les bulletins validés d'un (classe, année, période, filière) en
 * remettant `valide_par/valide_le = null`. Étape requise avant de modifier la
 * config (evaluee) si des bulletins ont été signés.
 */
export async function deverrouillerPeriode(
  etablissement_id: string,
  data: { classe_id: string; annee_scolaire_id: string; periode: number; filiere: 'FR' | 'AR' | 'COMBINE' },
  acteur_id: string,
): Promise<{ count: number }> {
  const bulletins = await prisma.bulletin.findMany({
    where: {
      annee_scolaire_id: data.annee_scolaire_id,
      periode: data.periode,
      filiere: data.filiere,
      valide_le: { not: null },
      eleve: {
        etablissement_id,
        inscriptions: { some: { OR: [{ classe_fr_id: data.classe_id }, { classe_ar_id: data.classe_id }] } },
      },
    },
    select: { id: true },
  });
  if (bulletins.length === 0) return { count: 0 };
  await prisma.bulletin.updateMany({
    where: { id: { in: bulletins.map(b => b.id) } },
    data: { valide_par: null, valide_le: null },
  });
  await logAction(etablissement_id, acteur_id, 'UPDATE', 'Bulletin', 'deverrouillage_periode', {
    classe_id: data.classe_id, periode: data.periode, filiere: data.filiere, count: bulletins.length,
  });
  return { count: bulletins.length };
}

// ─── Pré-vol avant génération ────────────────────────────────────────────────

export type PreflightWarning = { code: 'matieres_non_evaluees' | 'matieres_sans_notes' | 'eleves_sans_aucune_note'; message: string };

export type PreflightResult = {
  classe_id: string; periode: number; filiere: string;
  matieres_evaluees: { id: string; nom_fr: string; nom_ar: string | null; coeff: number; note_max: number; filiere: 'FR' | 'AR'; eleves_avec_notes: number }[];
  matieres_non_evaluees: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR'; source: 'periode' | 'classe' }[];
  matieres_sans_notes: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR' }[];
  eleves_sans_aucune_note: { id: string; nom_fr: string; prenom_fr: string; matricule: string }[];
  total_eleves: number;
  warnings: PreflightWarning[];
};

/**
 * Pré-vol avant génération de bulletins : liste les matières évaluées / non évaluées,
 * détecte les matières sans aucune note saisie, et les élèves sans aucune note.
 * Le front affiche ce rapport dans une modale et propose les flags
 * `inclure_non_evaluees` / `traiter_manquantes_comme_zero` avant de générer pour de vrai.
 * Periode = 0 → vérification sur toutes les périodes (cas annuel).
 */
export async function preflightBulletins(etablissement_id: string, data: PreflightInput): Promise<PreflightResult> {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const nbPeriodes = config?.nb_periodes ?? 3;
  const periodes = periode === 0 ? Array.from({ length: nbPeriodes }, (_, i) => i + 1) : [periode];
  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];

  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const elevesIds = inscriptions.map(i => i.eleve_id);
  const total_eleves = inscriptions.length;

  // Programme effectif PAR période, en distinguant la source du flag evaluee
  // (override période vs. flag classe) — utile pour expliciter dans la modale.
  type ProgPeriode = { id: string; nom_fr: string; nom_ar: string | null; coeff: number; note_max: number; evaluee: boolean; filiere: 'FR' | 'AR'; source: 'periode' | 'classe' };
  const progByPeriode = new Map<number, Map<string, ProgPeriode>>();
  for (const p of periodes) {
    const mp = new Map<string, ProgPeriode>();
    const overrides = await prisma.classeMatierePeriode.findMany({ where: { classe_id, periode: p } });
    const ovEval = new Map<string, boolean | null>();
    for (const o of overrides) ovEval.set(o.matiere_id, o.evaluee);
    for (const f of filieres) {
      for (const m of await getMatieresDeclasse(classe_id, f, p, baseNote)) {
        const hasPeriodeOverride = ovEval.has(m.id) && ovEval.get(m.id) !== null;
        mp.set(m.id, {
          id: m.id, nom_fr: m.nom_fr, nom_ar: m.nom_ar,
          coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif),
          evaluee: m.evaluee_effectif, filiere: f,
          source: hasPeriodeOverride ? 'periode' : 'classe',
        });
      }
    }
    progByPeriode.set(p, mp);
  }

  // Notes du périmètre — pour compter qui a / n'a pas saisi.
  const allMatIds = new Set<string>();
  for (const mp of progByPeriode.values()) for (const id of mp.keys()) allMatIds.add(id);
  const notes = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIds }, annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: [...allMatIds] } },
    select: { eleve_id: true, matiere_id: true, periode: true },
  });

  // Comptage élèves avec notes par matière (sur le périmètre)
  const elevesByMat = new Map<string, Set<string>>();
  const elevesAvecAuMoinsUneNote = new Set<string>();
  for (const n of notes) {
    if (!elevesByMat.has(n.matiere_id)) elevesByMat.set(n.matiere_id, new Set());
    elevesByMat.get(n.matiere_id)!.add(n.eleve_id);
    elevesAvecAuMoinsUneNote.add(n.eleve_id);
  }

  // Agréger : une matière est "évaluée" si elle est évaluée sur AU MOINS une période
  // du périmètre, "non évaluée" sinon.
  const aggregat = new Map<string, ProgPeriode>(); // matiere_id → entrée représentative
  const evalueeOnAnyPeriode = new Map<string, boolean>();
  for (const mp of progByPeriode.values()) {
    for (const [id, p] of mp) {
      if (!aggregat.has(id)) aggregat.set(id, p);
      if (p.evaluee) evalueeOnAnyPeriode.set(id, true);
      else if (!evalueeOnAnyPeriode.has(id)) evalueeOnAnyPeriode.set(id, false);
    }
  }

  const matieres_evaluees: PreflightResult['matieres_evaluees'] = [];
  const matieres_non_evaluees: PreflightResult['matieres_non_evaluees'] = [];
  const matieres_sans_notes: PreflightResult['matieres_sans_notes'] = [];

  for (const [id, p] of aggregat) {
    const evaluee = evalueeOnAnyPeriode.get(id) ?? true;
    if (evaluee) {
      matieres_evaluees.push({
        id: p.id, nom_fr: p.nom_fr, nom_ar: p.nom_ar, coeff: p.coeff, note_max: p.note_max,
        filiere: p.filiere, eleves_avec_notes: elevesByMat.get(id)?.size ?? 0,
      });
      if ((elevesByMat.get(id)?.size ?? 0) === 0 && total_eleves > 0) {
        matieres_sans_notes.push({ id: p.id, nom_fr: p.nom_fr, nom_ar: p.nom_ar, filiere: p.filiere });
      }
    } else {
      matieres_non_evaluees.push({ id: p.id, nom_fr: p.nom_fr, nom_ar: p.nom_ar, filiere: p.filiere, source: p.source });
    }
  }

  const eleves_sans_aucune_note = inscriptions
    .filter(i => !elevesAvecAuMoinsUneNote.has(i.eleve_id))
    .map(i => ({ id: i.eleve.id, nom_fr: i.eleve.nom_fr, prenom_fr: i.eleve.prenom_fr, matricule: i.eleve.matricule }));

  const warnings: PreflightWarning[] = [];
  if (matieres_non_evaluees.length > 0) {
    warnings.push({
      code: 'matieres_non_evaluees',
      message: `${matieres_non_evaluees.length} matière(s) marquée(s) non évaluée(s) — exclues de la moyenne sauf option contraire.`,
    });
  }
  if (matieres_sans_notes.length > 0) {
    warnings.push({
      code: 'matieres_sans_notes',
      message: `${matieres_sans_notes.length} matière(s) du programme n'ont aucune note saisie sur la/les période(s) demandée(s).`,
    });
  }
  if (eleves_sans_aucune_note.length > 0) {
    warnings.push({
      code: 'eleves_sans_aucune_note',
      message: `${eleves_sans_aucune_note.length} élève(s) n'ont aucune note saisie.`,
    });
  }

  return {
    classe_id, periode, filiere,
    matieres_evaluees, matieres_non_evaluees, matieres_sans_notes,
    eleves_sans_aucune_note, total_eleves, warnings,
  };
}

// ─── Générer bulletins trimestriels (FR | AR | COMBINE) ──────────────────────

export async function genererBulletins(etablissement_id: string, data: GenererBulletinInput) {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;
  const inclureNonEvaluees = data.inclure_non_evaluees ?? false;
  const manquantesCommeZero = data.traiter_manquantes_comme_zero ?? false;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const mentions = await getMentions(etablissement_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  // Barème/coeff/évaluée effectifs par élève en combinant SES classes FR et AR (un élève
  // bilingue a deux classes) — sinon une moyenne COMBINE ne refléterait qu'une filière.
  const baremes = await baremesParElevePeriode(inscriptions, filieres, [periode], baseNote);

  // Fetch toutes les notes d'un coup (évite N+1). On laisse le barème par élève
  // décider quelles matières comptent (matières hors programme = ignorées).
  const elevesIds = inscriptions.map(i => i.eleve_id);
  const toutesLesNotes = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIds }, annee_scolaire_id, periode },
    include: { matiere: true },
  });
  const notesByEleve = new Map<string, typeof toutesLesNotes>();
  for (const n of toutesLesNotes) {
    if (!notesByEleve.has(n.eleve_id)) notesByEleve.set(n.eleve_id, []);
    notesByEleve.get(n.eleve_id)!.push(n);
  }

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    const bm = baremes.get(eleve_id)?.get(periode);
    let totalP = 0, totalC = 0;
    const notesIndex = new Map((notesByEleve.get(eleve_id) ?? []).map(n => [n.matiere_id, n]));
    // Itération sur le PROGRAMME (et non sur les notes) pour pouvoir traiter
    // les notes manquantes comme 0 si l'utilisateur l'a demandé.
    for (const [matiere_id, eff] of bm ?? []) {
      if (!eff.evaluee && !inclureNonEvaluees) continue; // matière non évaluée → exclue
      if (eff.coeff === 0) continue;
      const note = notesIndex.get(matiere_id);
      if (!note) {
        if (manquantesCommeZero) totalC += eff.coeff; // 0 pts + coeff au dénominateur
        continue;
      }
      totalP += contributionNote(Number(note.valeur), eff.note_max, baseNote, eff.coeff);
      totalC += eff.coeff;
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
  const inclureNonEvaluees = data.inclure_non_evaluees ?? false;
  const manquantesCommeZero = data.traiter_manquantes_comme_zero ?? false;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');
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
  // Barème/coeff/évaluée effectifs PAR ÉLÈVE et PAR PÉRIODE (les coeff peuvent changer d'un
  // trimestre à l'autre), en combinant les deux classes FR+AR de l'élève.
  const baremes = await baremesParElevePeriode(inscriptions, filieres, periodesAnnuelles, baseNote);

  // Fetch toutes les notes annuelles d'un coup (évite N+1)
  const elevesIdsAnnuel = inscriptions.map(i => i.eleve_id);
  const toutesLesNotesAnnuel = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIdsAnnuel }, annee_scolaire_id, periode: { in: periodesAnnuelles } },
    include: { matiere: true },
  });
  const notesByEleveAnnuel = new Map<string, typeof toutesLesNotesAnnuel>();
  for (const n of toutesLesNotesAnnuel) {
    if (!notesByEleveAnnuel.has(n.eleve_id)) notesByEleveAnnuel.set(n.eleve_id, []);
    notesByEleveAnnuel.get(n.eleve_id)!.push(n);
  }

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    const parP = baremes.get(eleve_id);
    let totalP = 0, totalC = 0;
    // Indexer les notes par (periode|matiere) pour itérer sur le PROGRAMME (annuel).
    const idx = new Map<string, typeof toutesLesNotesAnnuel[number]>();
    for (const n of notesByEleveAnnuel.get(eleve_id) ?? []) idx.set(`${n.periode}|${n.matiere_id}`, n);
    for (const p of periodesAnnuelles) {
      for (const [matiere_id, eff] of parP?.get(p) ?? []) {
        if (!eff.evaluee && !inclureNonEvaluees) continue;
        if (eff.coeff === 0) continue;
        const note = idx.get(`${p}|${matiere_id}`);
        if (!note) {
          if (manquantesCommeZero) totalC += eff.coeff;
          continue;
        }
        totalP += contributionNote(Number(note.valeur), eff.note_max, baseNote, eff.coeff);
        totalC += eff.coeff;
      }
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
  if (!bulletin) throw new NotFoundError('Bulletin introuvable');

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
    const periodes = bulletin.periode === 0
      ? Array.from({ length: nbPeriodes }, (_, i) => i + 1)
      : [bulletin.periode];

    // Programme effectif (barème + coeff + evaluée) résolu PAR PÉRIODE pour pouvoir
    // afficher les matières non évaluées (sans note) avec leur statut.
    type ProgEntry = { matiere: { id: string; nom_fr: string; nom_ar: string | null; coeff_defaut: unknown; note_max: number }; evaluee: boolean };
    const progParPeriode = new Map<number, Map<string, ProgEntry>>();
    if (classeId) {
      for (const p of periodes) {
        const mp = new Map<string, ProgEntry>();
        for (const m of await getMatieresDeclasse(classeId, f, p, baseNote)) {
          mp.set(m.id, {
            matiere: { id: m.id, nom_fr: m.nom_fr, nom_ar: m.nom_ar, coeff_defaut: m.coeff_effectif, note_max: Number(m.note_max_effectif) },
            evaluee: m.evaluee_effectif,
          });
        }
        progParPeriode.set(p, mp);
      }
    } else {
      // Pas d'inscription en classe pour cette filière → matières étab par défaut (toutes évaluées).
      const matieresEtab = await getMatieres(etablissement_id, f);
      for (const p of periodes) {
        const mp = new Map<string, ProgEntry>();
        for (const m of matieresEtab) {
          mp.set(m.id, {
            matiere: { id: m.id, nom_fr: m.nom_fr, nom_ar: m.nom_ar, coeff_defaut: m.coeff_defaut, note_max: baseNote },
            evaluee: true,
          });
        }
        progParPeriode.set(p, mp);
      }
    }

    const allMatIds = new Set<string>();
    for (const mp of progParPeriode.values()) for (const id of mp.keys()) allMatIds.add(id);
    const notesRaw = await prisma.note.findMany({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: [...allMatIds] } },
      include: { matiere: true },
      orderBy: { matiere: { ordre_bulletin: 'asc' } },
    });
    const notesIndex = new Map<string, typeof notesRaw[number]>();
    for (const n of notesRaw) notesIndex.set(`${n.periode}|${n.matiere_id}`, n);

    // Construction de la sortie : une entrée par (matière × période), même quand la
    // matière n'a pas de note (pour pouvoir afficher "—" et la mention "Non évaluée").
    const rows: Array<{
      matiere_id: string; periode: number; valeur: unknown;
      matiere: { id: string; nom_fr: string; nom_ar: string | null; coeff_defaut: unknown; note_max: number };
      evaluee: boolean;
      commentaire?: string | null;
    }> = [];
    for (const p of periodes) {
      const mp = progParPeriode.get(p) ?? new Map<string, ProgEntry>();
      for (const [matiere_id, prog] of mp) {
        const note = notesIndex.get(`${p}|${matiere_id}`);
        rows.push({
          matiere_id, periode: p,
          valeur: note?.valeur ?? null,
          matiere: prog.matiere,
          evaluee: prog.evaluee,
          commentaire: note?.commentaire ?? null,
        });
      }
    }
    notesByFiliere[f] = rows;
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
  if (!bulletin) throw new NotFoundError('Bulletin introuvable');

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
      throw new NotFoundError('Inscription introuvable pour ce bulletin');
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
  if (!etab) throw new NotFoundError('Établissement introuvable');

  // Nb de périodes dynamique (cf. genererBulletinsAnnuels + getBulletin)
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  const mentions = await getMentions(etablissement_id);

  // Barème + coefficient EFFECTIFS par matière (override de classe/période prioritaire),
  // résolus depuis les classes FR et AR de l'élève. Sans ça, l'affichage retombe sur un
  // défaut plat (/20), avec des appréciations et des moyennes par filière fausses.
  const insc = data.eleve.inscriptions.find(
    i => i.annee_scolaire_id === data.annee_scolaire_id
  ) as { classe_fr_id?: string | null; classe_ar_id?: string | null } | undefined;
  const periodeForBareme = data.periode === 0 ? undefined : data.periode;
  const effMap = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
  for (const [cid, f] of [
    [insc?.classe_fr_id, 'FR'] as const,
    [insc?.classe_ar_id, 'AR'] as const,
  ]) {
    if (!cid) continue;
    for (const m of await getMatieresDeclasse(cid, f, periodeForBareme, baseNote)) {
      effMap.set(m.id, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif), evaluee: m.evaluee_effectif });
    }
  }

  const { generateBulletinHtml, generateBulletinAnnuelHtml } = await import('./bulletin.template');

  const base = {
    etablissement_nom_fr: etab.nom_fr,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_matricule: data.eleve.matricule, annee_libelle: data.annee_scolaire.libelle,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null, rang: data.rang,
    appreciation: data.appreciation, devise: etab.devise,
    note_max_etab: baseNote, mentions,
  };

  type NoteRaw = { matiere_id: string; valeur: unknown; periode: number; evaluee?: boolean; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };

  const toRows = (f: 'FR' | 'AR') =>
    ((data.notesByFiliere[f] ?? []) as NoteRaw[]).map(n => {
      const eff = effMap.get(n.matiere_id);
      return {
        nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
        coeff: eff?.coeff ?? Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
        note_max: eff?.note_max ?? baseNote,
        evaluee: n.evaluee ?? eff?.evaluee ?? true,
      };
    });

  const toAnnuelRows = (f: 'FR' | 'AR') => {
    const map = new Map<string, { nom_fr: string; nom_ar: string; coeff: number; note_max: number; vals: Record<number, number | null>; evaluee: boolean }>();
    for (const n of (data.notesByFiliere[f] ?? []) as NoteRaw[]) {
      if (!map.has(n.matiere.nom_fr)) {
        const eff = effMap.get(n.matiere_id);
        map.set(n.matiere.nom_fr, { nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr, coeff: eff?.coeff ?? Number(n.matiere.coeff_defaut), note_max: eff?.note_max ?? baseNote, vals: {}, evaluee: n.evaluee ?? eff?.evaluee ?? true });
      }
      map.get(n.matiere.nom_fr)!.vals[n.periode] = n.valeur !== null ? Number(n.valeur) : null;
      // Annuel : une matière est considérée évaluée sur l'année si évaluée sur au moins une période.
      if (n.evaluee) map.get(n.matiere.nom_fr)!.evaluee = true;
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
  if (!etab) throw new NotFoundError('Établissement introuvable');
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

  // CSS partagée du template réutilisée pour le PDF classe (sinon rendu non stylé).
  const { generateBulletinHtml, CSS: BULLETIN_CSS } = await import('./bulletin.template');
  const pages: string[] = [];

  for (const bulletin of bulletins) {
    // Pour CHAQUE filière, on fusionne le programme (toutes matières) avec les notes
    // existantes — ainsi les matières non évaluées apparaissent quand même.
    const rowsByFiliere: Record<string, { nom_fr: string; nom_ar: string; coeff: number; valeur: number | null; note_max: number; evaluee: boolean }[]> = {};
    for (const f of filieres) {
      const notes = await prisma.note.findMany({
        where: { eleve_id: bulletin.eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
        select: { matiere_id: true, valeur: true },
      });
      const noteByMat = new Map(notes.map(n => [n.matiere_id, Number(n.valeur)]));
      rowsByFiliere[f] = matMap[f].map(m => ({
        nom_fr: m.nom_fr, nom_ar: m.nom_ar ?? m.nom_fr,
        coeff: Number(m.coeff_effectif),
        valeur: noteByMat.has(m.id) ? noteByMat.get(m.id)! : null,
        note_max: Number(m.note_max_effectif),
        evaluee: m.evaluee_effectif,
      }));
    }
    const toRows = (f: 'FR' | 'AR') => rowsByFiliere[f] ?? [];

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

  // On reconstruit un document unique en réutilisant la CSS partagée du template
  // (sinon le rendu retombe sur du HTML non stylé, complètement différent du PDF
  // individuel). Chaque bulletin est isolé dans `.bulletin-page` avec le même
  // padding que `body` en mode individuel (18px 28px) ; `body` doit donc être
  // remis à padding:0 pour ne pas ajouter d'offset global. Les marges PDF sont
  // alignées sur celles du bulletin individuel (10mm/8mm).
  const pageContents = pages.map(p => {
    const m = p.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    return m ? m[1] : p;
  });
  const combined = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
${BULLETIN_CSS}
body { padding: 0 }
.bulletin-page { padding: 18px 28px; page-break-after: always }
.bulletin-page:last-child { page-break-after: auto }
</style></head><body>
${pageContents.map(c => `<div class="bulletin-page">${c}</div>`).join('\n')}
</body></html>`;

  return renderPdfHtml(combined, { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
}
