import prisma from '../../config/database';
import type { TypeModeleBulletin } from './bulletin.template';
import { GenererBulletinInput, GenererBulletinAnnuelInput, ObservationInput, PreflightInput } from './bulletins.schema';
import { renderPdfHtml } from '../../utils/browserPool';
import { assertProfPeutAccederClasse } from '../../utils/teachingPolicy';
import { logAction } from '../../utils/audit';
import { DEFAULT_NOTE_MAX, MentionDef, mentionPour } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';
import { selectLiensClasse, selectLiensClasseObjet, classeIdParFiliere, LienClasseCode } from '../../utils/inscriptionClasse';

const mapMentions = (rows: { libelle_fr: string; libelle_ar: string | null; seuil_min: unknown }[]): MentionDef[] =>
  rows.map(r => ({ libelle_fr: r.libelle_fr, libelle_ar: r.libelle_ar, seuil_min: Number(r.seuil_min) }));

/** Mentions PAR DÉFAUT de l'établissement (aucune filière, aucun niveau), triées par seuil décroissant. */
async function getMentions(etablissement_id: string): Promise<MentionDef[]> {
  const rows = await prisma.mention.findMany({ where: { etablissement_id, filiere_id: null, niveau_id: null }, orderBy: { seuil_min: 'desc' } });
  return mapMentions(rows);
}

/**
 * Mentions EFFECTIVES pour une (filière, niveau), par précédence décroissante :
 * filière+niveau > filière > niveau > établissement (défaut). `filiereCode` null ou
 * 'COMBINE' = pas de filière (base canonique établissement).
 */
async function resolveMentions(
  etablissement_id: string, filiereCode?: string | null, niveau_id?: string | null,
): Promise<MentionDef[]> {
  let filiere_id: string | null = null;
  if (filiereCode && filiereCode !== 'COMBINE') {
    const f = await prisma.filiere.findFirst({ where: { etablissement_id, code: filiereCode }, select: { id: true } });
    filiere_id = f?.id ?? null;
  }
  const fetch = (fid: string | null, nid: string | null) =>
    prisma.mention.findMany({ where: { etablissement_id, filiere_id: fid, niveau_id: nid }, orderBy: { seuil_min: 'desc' } });
  if (filiere_id && niveau_id) { const r = await fetch(filiere_id, niveau_id); if (r.length) return mapMentions(r); }
  if (filiere_id)             { const r = await fetch(filiere_id, null);      if (r.length) return mapMentions(r); }
  if (niveau_id)              { const r = await fetch(null, niveau_id);       if (r.length) return mapMentions(r); }
  return getMentions(etablissement_id);
}


/** niveau_id de la classe FR (prioritaire) ou AR pour résoudre les mentions du bulletin. */
async function niveauPourBulletin(classe_fr_id?: string | null, classe_ar_id?: string | null): Promise<string | null> {
  const cid = classe_fr_id ?? classe_ar_id;
  if (!cid) return null;
  const c = await prisma.classe.findUnique({ where: { id: cid }, select: { niveau_id: true } });
  return c?.niveau_id ?? null;
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
  classe_id: string, filiere: 'FR' | 'AR' | 'EN', periode?: number, baseNote: number = DEFAULT_NOTE_MAX,
): Promise<MatiereAvecCoeff[]> {
  const rows = await prisma.classeMatiere.findMany({
    where: { classe_id, matiere: { filiere_ref: { code: filiere }, active: true } },
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
      // Code de filière : celui demandé (les lignes sont filtrées dessus) —
      // la colonne string Matiere.filiere n'existe plus (Phase 2d).
      filiere,
      coeff_effectif: o ? o.coeff : (r.coeff_override ?? r.matiere.coeff_defaut),
      // Barème effectif : période > classe > matière (défaut) > échelle établissement.
      note_max_effectif: o ? o.note_max : (r.note_max_override ?? r.matiere.note_max ?? baseNote),
      ordre_bulletin: r.ordre_override ?? r.matiere.ordre_bulletin,
      evaluee_effectif: o?.evaluee != null ? o.evaluee : r.evaluee,
    };
  });
}

async function getMatieres(etablissement_id: string, filiere: 'FR' | 'AR' | 'EN') {
  return prisma.matiere.findMany({
    where: { etablissement_id, filiere_ref: { code: filiere }, active: true },
    orderBy: { ordre_bulletin: 'asc' },
  });
}

// Ordre canonique des codes de filière (garantit ['FR','AR'] pour un établissement
// franco-arabe → COMBINE inchangé, et un ordre déterministe pour EN).
const CODE_ORDER: ('FR' | 'AR' | 'EN')[] = ['FR', 'AR', 'EN'];

// Codes des filières ACTIVES de l'établissement, dans l'ordre canonique. Périmètre
// d'un bulletin COMBINE (« combiné » = toutes les filières actives) ET des rapports
// /stats agrégés par classe. Un établissement FR+AR seul renvoie ['FR','AR'].
export async function filieresActivesCodes(etablissement_id: string): Promise<('FR' | 'AR' | 'EN')[]> {
  const fils = await prisma.filiere.findMany({
    where: { etablissement_id, actif: true },
    select: { code: true },
  });
  const actifs = new Set(fils.map(f => f.code));
  const codes = CODE_ORDER.filter(c => actifs.has(c));
  // Repli de sûreté : si aucune filière n'est configurée (données anciennes), on
  // retombe sur le franco-arabe historique.
  return codes.length > 0 ? codes : ['FR', 'AR'];
}

// Échelle d'AFFICHAGE d'un bulletin = celle du NIVEAU de la classe (Niveau.note_max),
// sinon repli sur l'échelle établissement (→ aucun re-scale). Un élève étant dans UN
// seul niveau, tout le bulletin (y compris le combiné) partage la même échelle. Le
// calcul reste toujours canonique (base établissement). undefined = pas de re-scale.
async function echelleNiveau(niveau_id: string | null | undefined): Promise<number | undefined> {
  if (!niveau_id) return undefined;
  const n = await prisma.niveau.findUnique({ where: { id: niveau_id }, select: { note_max: true } });
  return n?.note_max != null ? Number(n.note_max) : undefined;
}

// Filières effectivement fusionnées d'un combiné : le sous-ensemble choisi (validé
// contre les filières actives, ordre canonique) ou, à défaut, toutes les actives.
function combineCodesChoisis(actifs: ('FR' | 'AR' | 'EN')[], choix?: string[] | null): ('FR' | 'AR' | 'EN')[] {
  if (!choix?.length) return actifs;
  const sel = actifs.filter(c => choix.includes(c));
  return sel.length ? sel : actifs;
}

async function getElevesClasse(classe_id: string, annee_scolaire_id: string) {
  return prisma.inscription.findMany({
    where: { annee_scolaire_id, statut: 'actif', classes: { some: { classe_id } } },
    include: { eleve: true, ...selectLiensClasse },
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
  periodes: number[], filieres: ('FR' | 'AR' | 'EN')[] = ['FR', 'AR'],
): Promise<Map<string, number>> {
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return new Map();

  // Les matières d'une filière sont rattachées à la classe de cette filière (qui peut
  // être distincte pour un élève multi-filières). On résout donc les classes par
  // filière depuis le cohort — générique (FR, AR, EN…) — sinon les matières d'une
  // filière, cherchées sur la classe d'une autre, seraient ignorées.
  const classIdsByFiliere = new Map<string, Set<string>>();
  for (const f of filieres) classIdsByFiliere.set(f, new Set());
  for (const i of inscriptions) {
    for (const f of filieres) {
      const cid = classeIdParFiliere(i.classes, f);
      if (cid) classIdsByFiliere.get(f)!.add(cid);
    }
  }

  // Coeff/barème/évaluée par période (gère les coefficients qui changent de trimestre)
  const coefByP = new Map<number, Map<string, number>>();
  const nmByP = new Map<number, Map<string, number>>();
  const evByP = new Map<number, Map<string, boolean>>();
  const matIds = new Set<string>();
  for (const p of periodes) {
    const cM = new Map<string, number>(), nM = new Map<string, number>(), eM = new Map<string, boolean>();
    for (const f of filieres) for (const classId of classIdsByFiliere.get(f) ?? []) {
      for (const m of await getMatieresDeclasse(classId, f, p, baseNote)) {
        cM.set(m.id, Number(m.coeff_effectif)); nM.set(m.id, Number(m.note_max_effectif)); eM.set(m.id, m.evaluee_effectif); matIds.add(m.id);
      }
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
  classe_id: string, periodes: number[], filieres: ('FR' | 'AR' | 'EN')[] = ['FR', 'AR'],
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

/**
 * Comme getBaremesClasse, mais résout les barèmes sur les DEUX classes du cohort
 * (classe_fr_id ET classe_ar_id de l'élève), pas seulement le classe_id passé.
 * À utiliser pour tout rapport COMBINE/bilingue : les matières AR sont rattachées
 * à la classe AR, distincte de la classe FR — sinon leurs notes seraient
 * normalisées sur l'échelle établissement au lieu de leur vrai barème (ex: /60).
 */
export async function getBaremesClasseCohorte(
  classe_id: string, annee_scolaire_id: string, periodes: number[],
  filieres: ('FR' | 'AR' | 'EN')[] = ['FR', 'AR'], baseNote: number = DEFAULT_NOTE_MAX,
): Promise<Map<string, { coeff: number; note_max: number; evaluee: boolean }>> {
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const classIds = new Map<string, Set<string>>();
  for (const f of filieres) classIds.set(f, new Set());
  for (const i of inscriptions) {
    for (const f of filieres) {
      const cid = classeIdParFiliere(i.classes, f);
      if (cid) classIds.get(f)!.add(cid);
    }
  }
  const map = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
  for (const p of periodes) for (const f of filieres) for (const cid of classIds.get(f) ?? []) {
    for (const m of await getMatieresDeclasse(cid, f, p, baseNote)) {
      map.set(`${m.id}|${p}`, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif), evaluee: m.evaluee_effectif });
    }
  }
  return map;
}

type InscriptionClasses = { eleve_id: string; classes: LienClasseCode[] };

/**
 * Barème + coefficient EFFECTIFS par (élève → période → matière), en combinant les
 * DEUX classes de l'élève (classe_fr_id ET classe_ar_id). Indispensable aux
 * bulletins COMBINE : un élève bilingue a ses matières FR et AR dans deux classes
 * distinctes — n'utiliser qu'un seul classe_id n'en compterait qu'une (la moyenne
 * COMBINE ne refléterait alors qu'une filière).
 */
type Bareme = { coeff: number; note_max: number; evaluee: boolean };

async function baremesParElevePeriode(
  inscriptions: InscriptionClasses[], filieres: ('FR' | 'AR' | 'EN')[], periodes: number[], baseNote: number,
): Promise<Map<string, Map<number, Map<string, Bareme>>>> {
  const cache = new Map<string, Map<string, Bareme>>(); // `${classeId}|${f}|${p}`
  const getClasse = async (classeId: string, f: 'FR' | 'AR' | 'EN', p: number) => {
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
        const cid = classeIdParFiliere(insc.classes, f);
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
        classes: { some: { classe_id } },
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
  const matiere = await prisma.matiere.findUnique({
    where: { id: matiere_id },
    select: { filiere_ref: { select: { code: true } } },
  });
  if (!matiere) return { unsigned: [], signed: [] };
  // Une note d'une filière impacte le bulletin de SA filière + le COMBINE.
  const filieres = [matiere.filiere_ref.code, 'COMBINE'];
  const bulletins = await prisma.bulletin.findMany({
    where: {
      filiere: { in: filieres },
      periode: { in: periodes },
      eleve: { inscriptions: { some: { classes: { some: { classe_id } } } } },
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
  data: { classe_id: string; annee_scolaire_id: string; periode: number; filiere: 'FR' | 'AR' | 'EN' | 'COMBINE' },
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
        inscriptions: { some: { classes: { some: { classe_id: data.classe_id } } } },
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

export type PreflightWarning = { code: 'matieres_non_evaluees' | 'matieres_sans_notes' | 'eleves_sans_aucune_note' | 'periodes_vides'; message: string };

export type PreflightResult = {
  classe_id: string; periode: number; filiere: string;
  matieres_evaluees: { id: string; nom_fr: string; nom_ar: string | null; coeff: number; note_max: number; filiere: 'FR' | 'AR' | 'EN'; eleves_avec_notes: number }[];
  matieres_non_evaluees: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR' | 'EN'; source: 'periode' | 'classe' }[];
  matieres_sans_notes: { id: string; nom_fr: string; nom_ar: string | null; filiere: 'FR' | 'AR' | 'EN' }[];
  eleves_sans_aucune_note: { id: string; nom_fr: string; prenom_fr: string; matricule: string }[];
  // Bulletin annuel (periode 0) : périodes entièrement sans notes → exclues silencieusement
  // du calcul de la moyenne annuelle. Le front avertit mais laisse générer.
  periodes_vides: { periode: number; libelle: string }[];
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
  // COMBINE : mêmes filières que la génération (choix explicite sinon actives).
  const filieres: ('FR' | 'AR' | 'EN')[] = filiere === 'COMBINE'
    ? combineCodesChoisis(await filieresActivesCodes(etablissement_id), data.filieres_combine)
    : [filiere as 'FR' | 'AR' | 'EN'];

  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const elevesIds = inscriptions.map(i => i.eleve_id);
  const total_eleves = inscriptions.length;

  // Programme effectif PAR période, en distinguant la source du flag evaluee
  // (override période vs. flag classe) — utile pour expliciter dans la modale.
  type ProgPeriode = { id: string; nom_fr: string; nom_ar: string | null; coeff: number; note_max: number; evaluee: boolean; filiere: 'FR' | 'AR' | 'EN'; source: 'periode' | 'classe' };
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

  // Bulletin annuel (periode 0) : repérer les périodes entièrement sans notes.
  // Elles sont sinon exclues silencieusement de la moyenne annuelle (cf. genererBulletinsAnnuels).
  const periodes_vides: PreflightResult['periodes_vides'] = [];
  if (periode === 0 && periodes.length > 1) {
    const periodesAvecNotes = new Set(notes.map(n => n.periode));
    const labelsFr = Array.isArray((config?.noms_periodes as { fr?: unknown } | null)?.fr)
      ? ((config!.noms_periodes as { fr: string[] }).fr)
      : [];
    for (const p of periodes) {
      if (!periodesAvecNotes.has(p)) {
        periodes_vides.push({ periode: p, libelle: labelsFr[p - 1] ?? `Période ${p}` });
      }
    }
  }

  const warnings: PreflightWarning[] = [];
  if (periodes_vides.length > 0) {
    warnings.push({
      code: 'periodes_vides',
      message: `${periodes_vides.length} période(s) sans aucune note (${periodes_vides.map(p => p.libelle).join(', ')}) — exclue(s) de la moyenne annuelle, qui ne portera que sur les périodes saisies.`,
    });
  }
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
    eleves_sans_aucune_note, periodes_vides, total_eleves, warnings,
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
  // Mentions résolues pour la filière du bulletin (COMBINE → base canonique établissement).
  const mentions = await resolveMentions(etablissement_id, filiere === 'COMBINE' ? null : filiere, classe.niveau_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  // COMBINE = combinaison de filières CHOISIE (sous-ensemble des actives) ; sinon toutes.
  const combineCodes = filiere === 'COMBINE'
    ? combineCodesChoisis(await filieresActivesCodes(etablissement_id), data.filieres_combine)
    : [];
  const filieres: ('FR' | 'AR' | 'EN')[] = filiere === 'COMBINE' ? combineCodes : [filiere as 'FR' | 'AR' | 'EN'];
  // Barème/coeff/évaluée effectifs par élève en combinant SES classes de chaque filière
  // (un élève bilingue a plusieurs classes) — sinon une moyenne COMBINE ne refléterait
  // qu'une filière.
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

  const filieresCombineStr = filiere === 'COMBINE' ? combineCodes.join(',') : null;
  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode } },
      create: { eleve_id, annee_scolaire_id, filiere, filieres_combine: filieresCombineStr, periode, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
      update: { filieres_combine: filieresCombineStr, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
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
  // Mentions résolues pour la filière du bulletin (COMBINE → base canonique établissement).
  const mentions = await resolveMentions(etablissement_id, filiere === 'COMBINE' ? null : filiere, classe.niveau_id);

  // COMBINE = combinaison de filières CHOISIE (sous-ensemble des actives) ; sinon toutes.
  const combineCodes = filiere === 'COMBINE'
    ? combineCodesChoisis(await filieresActivesCodes(etablissement_id), data.filieres_combine)
    : [];
  const filieres: ('FR' | 'AR' | 'EN')[] = filiere === 'COMBINE' ? combineCodes : [filiere as 'FR' | 'AR' | 'EN'];
  // Barème/coeff/évaluée effectifs PAR ÉLÈVE et PAR PÉRIODE (les coeff peuvent changer d'un
  // trimestre à l'autre), en combinant les classes de chaque filière de l'élève.
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

  const filieresCombineStr = filiere === 'COMBINE' ? combineCodes.join(',') : null;
  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode: 0 } },
      create: { eleve_id, annee_scolaire_id, filiere, filieres_combine: filieresCombineStr, periode: 0, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
      update: { filieres_combine: filieresCombineStr, moyenne, rang: i + 1, appreciation: mentionPour(moyenne, mentions), generated_at: new Date() },
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
      // Variante « objet » : expose classe.nom_fr/nom_ar par lien pour que le
      // front affiche la classe de la filière du bulletin (générique FR/AR/EN).
      eleve: { include: { inscriptions: { include: { ...selectLiensClasseObjet } } } },
      annee_scolaire: true,
    },
  });
  if (!bulletin) throw new NotFoundError('Bulletin introuvable');

  // COMBINE : combinaison STOCKÉE à la génération (repli sur actives pour d'anciens bulletins).
  const filieres: ('FR' | 'AR' | 'EN')[] = bulletin.filiere === 'COMBINE'
    ? (bulletin.filieres_combine ? bulletin.filieres_combine.split(',') as ('FR' | 'AR' | 'EN')[] : await filieresActivesCodes(etablissement_id))
    : [bulletin.filiere as 'FR' | 'AR' | 'EN'];

  // Nb de périodes configurable (2=semestres, 3=trimestres, 6=bimestres). On
  // ne dépend plus de [1,2,3] hardcodé pour les bulletins annuels.
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  // Chercher la classe de l'élève pour l'année scolaire du bulletin
  const inscription = bulletin.eleve.inscriptions.find(
    i => i.annee_scolaire_id === bulletin.annee_scolaire_id
  ) as { classes?: LienClasseCode[] } | undefined;

  const notesByFiliere: Record<string, unknown[]> = {};
  for (const f of filieres) {
    // Classe de l'élève DANS cette filière (générique : FR, AR ou EN).
    const classeId = classeIdParFiliere(inscription?.classes, f);
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
  // Échelle d'affichage (niveau de la classe de l'élève) — pour la vue détail front.
  const anyClasseId = inscription?.classes?.[0]?.classe_id;
  const niveauId = anyClasseId
    ? (await prisma.classe.findUnique({ where: { id: anyClasseId }, select: { niveau_id: true } }))?.niveau_id
    : null;
  const echelle_affichage = await echelleNiveau(niveauId);
  return { ...bulletin, notesByFiliere, echelle_affichage };
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
      select: { ...selectLiensClasse },
    });
    // Classes candidates pour le contrôle d'accès prof : la classe de LA
    // filière du bulletin (FR/AR/EN), ou toutes les classes de l'élève pour
    // un COMBINE (générique — un bulletin EN était inaccessible avant).
    const liens = inscription?.classes ?? [];
    const candidateClasses = (
      bulletin.filiere === 'COMBINE'
        ? liens.map(l => l.classe_id)
        : [classeIdParFiliere(liens, bulletin.filiere)]
    ).filter((c): c is string => Boolean(c));
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

/** Extrait le contenu de <body> d'un HTML de bulletin complet. */
function bodyContent(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  return m ? m[1] : html;
}

/**
 * Assemble un (ou plusieurs) bulletins en un document HTML où chaque bulletin
 * occupe une page A4. Chaque page (`.a4-page`) contient un wrapper `.a4-fit`
 * que renderPdfHtml(..., { fitToA4:true }) réduit si le contenu dépasse une page
 * → garantit « 1 bulletin = 1 page A4 ».
 */
function wrapBulletinsA4(pageContents: string[], css: string, opts: { policeEchelle?: number } = {}): string {
  // Échelle de police configurable (Paramètres → Bulletins) appliquée via `zoom` :
  // agrandit tout le contenu. Sur un bulletin dense, fitToA4 recompresse ensuite
  // pour tenir sur une page ; sur un bulletin aéré, l'agrandissement est conservé.
  const zoom = Math.min(1.5, Math.max(0.7, (opts.policeEchelle ?? 100) / 100));
  const zoomCss = zoom !== 1 ? `zoom: ${zoom};` : '';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
${css}
body { padding: 0; margin: 0 }
.a4-page { page-break-after: always }
.a4-page:last-child { page-break-after: auto }
/* min-height ≈ hauteur imprimable (277mm ≈ 1046px @96dpi, marge de sécurité)
   + colonne flex : le bulletin remplit la page A4 au lieu de flotter en haut.
   Le pied de page (date + signatures) est poussé en bas via margin-top:auto. */
.a4-fit { transform-origin: top left; padding: 18px 28px; display: flex; flex-direction: column; min-height: 1040px; ${zoomCss} }
.a4-fit > .footer-date { margin-top: auto }
</style></head><body>
${pageContents.map(c => `<div class="a4-page"><div class="a4-fit">${c}</div></div>`).join('\n')}
</body></html>`;
}

// Maître(s) d'une classe = personnel affecté à la classe (affectation par classe).
// Retourne les noms distincts joints, ou null si aucun.
async function getMaitresClasse(classe_id: string | null | undefined, annee_scolaire_id: string): Promise<string | null> {
  if (!classe_id) return null;
  const liens = await prisma.personnelMatiereClasse.findMany({
    where: { classe_id, annee_scolaire_id },
    select: { personnel: { select: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } } },
  });
  const noms = new Set<string>();
  for (const l of liens) {
    const u = l.personnel.utilisateur;
    const nom = [u.prenom_fr, u.nom_fr].filter(Boolean).join(' ').trim();
    if (nom) noms.add(nom);
  }
  return noms.size ? [...noms].join(', ') : null;
}

// Absences cumulées de l'élève sur l'année (statut 'absent'), réparties justifiées/non.
async function getAbsences(eleve_id: string, annee_scolaire_id: string): Promise<{ j: number; nj: number }> {
  const rows = await prisma.absenceEleve.groupBy({
    by: ['justifiee'],
    where: { eleve_id, annee_scolaire_id, statut: 'absent' },
    _count: { _all: true },
  });
  let j = 0, nj = 0;
  for (const r of rows) { if (r.justifiee) j += r._count._all; else nj += r._count._all; }
  return { j, nj };
}

export async function genererPdfBulletin(id: string, etablissement_id: string): Promise<Buffer> {
  const data = await getBulletin(id, etablissement_id);
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new NotFoundError('Établissement introuvable');

  // Nb de périodes dynamique (cf. genererBulletinsAnnuels + getBulletin)
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  // Barème + coefficient EFFECTIFS par matière (override de classe/période prioritaire),
  // résolus depuis les classes FR et AR de l'élève. Sans ça, l'affichage retombe sur un
  // défaut plat (/20), avec des appréciations et des moyennes par filière fausses.
  const insc = data.eleve.inscriptions.find(
    i => i.annee_scolaire_id === data.annee_scolaire_id
  ) as { classes?: LienClasseCode[] } | undefined;
  const frId = classeIdParFiliere(insc?.classes, 'FR');
  const arId = classeIdParFiliere(insc?.classes, 'AR');
  const enId = classeIdParFiliere(insc?.classes, 'EN');

  // Mentions effectives : celles du niveau de la classe (FR prioritaire, sinon AR/EN),
  // sinon défauts établissement.
  const niveauId = await niveauPourBulletin(frId, arId ?? enId);
  const mentions = await resolveMentions(etablissement_id, data.filiere === 'COMBINE' ? null : data.filiere, niveauId);
  const periodeForBareme = data.periode === 0 ? undefined : data.periode;
  const effMap = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
  for (const [cid, f] of [
    [frId, 'FR'] as const,
    [arId, 'AR'] as const,
    [enId, 'EN'] as const,
  ]) {
    if (!cid) continue;
    for (const m of await getMatieresDeclasse(cid, f, periodeForBareme, baseNote)) {
      effMap.set(m.id, { coeff: Number(m.coeff_effectif), note_max: Number(m.note_max_effectif), evaluee: m.evaluee_effectif });
    }
  }

  const { generateBulletinHtml, generateBulletinAnnuelHtml, CSS: BULLETIN_CSS } = await import('./bulletin.template');

  // Maître(s) de la classe : FR + AR (les deux pour un bulletin combiné). Pour une
  // filière EN (LTR, un seul créneau), le maître EN occupe le créneau « maitre_fr ».
  const maitre_fr = data.filiere === 'EN'
    ? await getMaitresClasse(enId, data.annee_scolaire_id)
    : (data.filiere !== 'AR' ? await getMaitresClasse(frId, data.annee_scolaire_id) : null);
  const maitre_ar = data.filiere === 'EN'
    ? null
    : (data.filiere !== 'FR' ? await getMaitresClasse(arId, data.annee_scolaire_id) : null);
  const abs = await getAbsences(data.eleve_id, data.annee_scolaire_id);

  // Échelle d'affichage = celle du NIVEAU de la classe (repli établissement).
  const echelleAffichage = await echelleNiveau(niveauId);

  const base = {
    etablissement_nom_fr: etab.nom_fr,
    etablissement_logo_url: etab.logo_url,
    entete_bulletin_fr: etab.entete_bulletin_fr,
    entete_bulletin_ar: etab.entete_bulletin_ar,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_matricule: data.eleve.matricule,
    eleve_date_naissance: data.eleve.date_naissance ? new Date(data.eleve.date_naissance).toLocaleDateString('fr-FR') : null,
    eleve_lieu_naissance: data.eleve.lieu_naissance ?? null,
    annee_libelle: data.annee_scolaire.libelle,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null, rang: data.rang,
    appreciation: data.appreciation, devise: etab.devise,
    note_max_etab: baseNote, echelle_affichage: echelleAffichage, mentions,
    etablissement_telephone: etab.telephone,
    etablissement_email: etab.email,
    etablissement_autorisation: etab.numero_autorisation,
    maitre_fr, maitre_ar,
    absences_justifiees: abs.j, absences_non_justifiees: abs.nj,
    // Réglages de rendu (Paramètres → Bulletins).
    afficher_rang: config?.bulletin_afficher_rang ?? true,
    afficher_absences: config?.bulletin_afficher_absences ?? true,
    logo_echelle: config?.bulletin_logo_echelle ?? 100,
    nb_periodes: nbPeriodes,
    noms_periodes: (config?.noms_periodes as { fr?: string[] } | null) ?? undefined,
    template_html: (await prisma.bulletinTemplate.findUnique({ where: { etablissement_id_type: { etablissement_id, type: data.periode === 0 ? 'ANNUEL' : data.filiere } } }))?.contenu_html ?? null,
  };

  type NoteRaw = { matiere_id: string; valeur: unknown; periode: number; evaluee?: boolean; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };

  const toRows = (f: 'FR' | 'AR' | 'EN') =>
    ((data.notesByFiliere[f] ?? []) as NoteRaw[]).map(n => {
      const eff = effMap.get(n.matiere_id);
      return {
        nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
        coeff: eff?.coeff ?? Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
        note_max: eff?.note_max ?? baseNote,
        evaluee: n.evaluee ?? eff?.evaluee ?? true,
      };
    });

  const toAnnuelRows = (f: 'FR' | 'AR' | 'EN') => {
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

  // COMBINE : combinaison STOCKÉE (repli sur actives pour d'anciens bulletins).
  const combineCodes = data.filiere === 'COMBINE'
    ? (data.filieres_combine ? data.filieres_combine.split(',') as ('FR' | 'AR' | 'EN')[] : await filieresActivesCodes(etablissement_id))
    : [];
  const inFiliere = (c: string) => data.filiere === c || (data.filiere === 'COMBINE' && combineCodes.includes(c as 'FR' | 'AR' | 'EN'));

  let html: string;
  if (data.periode === 0) {
    const type = data.filiere === 'COMBINE' ? 'ANNUEL_COMBINE'
      : data.filiere === 'AR' ? 'ANNUEL_AR'
      : data.filiere === 'EN' ? 'ANNUEL_EN' : 'ANNUEL_FR';
    html = generateBulletinAnnuelHtml({
      ...base, type,
      filieres_combine: data.filiere === 'COMBINE' ? combineCodes : undefined,
      matieres_fr: inFiliere('FR') ? toAnnuelRows('FR') : undefined,
      matieres_ar: inFiliere('AR') ? toAnnuelRows('AR') : undefined,
      matieres_en: inFiliere('EN') ? toAnnuelRows('EN') : undefined,
    });
  } else {
    const type = data.filiere as 'FR' | 'AR' | 'EN' | 'COMBINE';
    html = generateBulletinHtml({
      ...base, type, periode: data.periode,
      filieres_combine: data.filiere === 'COMBINE' ? combineCodes : undefined,
      notes_fr: inFiliere('FR') ? toRows('FR') : undefined,
      notes_ar: inFiliere('AR') ? toRows('AR') : undefined,
      notes_en: inFiliere('EN') ? toRows('EN') : undefined,
    });
  }

  return renderPdfHtml(
    wrapBulletinsA4([bodyContent(html)], BULLETIN_CSS, { policeEchelle: config?.bulletin_police_echelle ?? 100 }),
    { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } },
    { fitToA4: true },
  );
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
  const templateHtml = (await prisma.bulletinTemplate.findUnique({ where: { etablissement_id_type: { etablissement_id, type: periode === 0 ? 'ANNUEL' : filiere } } }))?.contenu_html ?? null;
  // Mentions effectives = celles du niveau de la classe imprimée, sinon défauts établissement.
  const classeNiveau = await prisma.classe.findUnique({ where: { id: classe_id }, select: { niveau_id: true } });
  const mentions = await resolveMentions(etablissement_id, filiere === 'COMBINE' ? null : filiere, classeNiveau?.niveau_id);
  // Échelle d'affichage = celle du NIVEAU de la classe imprimée (repli établissement).
  const echelleAffichage = await echelleNiveau(classeNiveau?.niveau_id);

  const bulletins = await prisma.bulletin.findMany({
    where: {
      annee_scolaire_id, periode, filiere,
      eleve: { etablissement_id, inscriptions: { some: { annee_scolaire_id, classes: { some: { classe_id } } } } },
    },
    include: { eleve: true, annee_scolaire: true },
    orderBy: [{ rang: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
  if (bulletins.length === 0) throw new Error('Aucun bulletin trouvé');

  // Absences cumulées (année) par élève — une seule requête groupée.
  const absRows = await prisma.absenceEleve.groupBy({
    by: ['eleve_id', 'justifiee'],
    where: { eleve_id: { in: bulletins.map(b => b.eleve_id) }, annee_scolaire_id, statut: 'absent' },
    _count: { _all: true },
  });
  const absByEleve = new Map<string, { j: number; nj: number }>();
  for (const r of absRows) {
    const e = absByEleve.get(r.eleve_id) ?? { j: 0, nj: 0 };
    if (r.justifiee) e.j += r._count._all; else e.nj += r._count._all;
    absByEleve.set(r.eleve_id, e);
  }

  // COMBINE : combinaison STOCKÉE (partagée par la classe ; repli sur actives).
  const combineCodes = filiere === 'COMBINE'
    ? (bulletins[0]?.filieres_combine ? bulletins[0].filieres_combine.split(',') as ('FR' | 'AR' | 'EN')[] : await filieresActivesCodes(etablissement_id))
    : [];
  const filieres: ('FR' | 'AR' | 'EN')[] = filiere === 'COMBINE' ? combineCodes : [filiere as 'FR' | 'AR' | 'EN'];
  const inFiliere = (c: string) => filiere === c || (filiere === 'COMBINE' && combineCodes.includes(c as 'FR' | 'AR' | 'EN'));

  // Les matières/notes AR sont rattachées à la classe AR de l'élève (classe_ar_id),
  // distincte de la classe FR. Utiliser le classe_id passé (FR) pour les deux
  // filières masquait toutes les notes AR du bulletin COMBINE → on résout la
  // bonne classe par élève et par filière (comme le bulletin individuel).
  const inscriptions = await prisma.inscription.findMany({
    where: { annee_scolaire_id, eleve_id: { in: bulletins.map(b => b.eleve_id) } },
    select: { eleve_id: true, ...selectLiensClasse },
  });
  const inscByEleve = new Map(inscriptions.map(i => [i.eleve_id, i]));
  const maitreCache = new Map<string, string | null>();
  const maitrePour = async (classId: string | null | undefined) => {
    if (!classId) return null;
    if (!maitreCache.has(classId)) maitreCache.set(classId, await getMaitresClasse(classId, annee_scolaire_id));
    return maitreCache.get(classId)!;
  };
  const matCache = new Map<string, MatiereAvecCoeff[]>();
  const matieresPour = async (classId: string | null | undefined, f: 'FR' | 'AR' | 'EN') => {
    if (!classId) return [];
    const key = `${classId}|${f}`;
    let mats = matCache.get(key);
    if (!mats) { mats = await getMatieresDeclasse(classId, f, periode, baseNote); matCache.set(key, mats); }
    return mats;
  };

  // CSS partagée du template réutilisée pour le PDF classe (sinon rendu non stylé).
  const { generateBulletinHtml, CSS: BULLETIN_CSS } = await import('./bulletin.template');
  const pages: string[] = [];

  for (const bulletin of bulletins) {
    const insc = inscByEleve.get(bulletin.eleve_id);
    // Pour CHAQUE filière, on fusionne le programme (toutes matières) avec les notes
    // existantes — ainsi les matières non évaluées apparaissent quand même.
    const rowsByFiliere: Record<string, { nom_fr: string; nom_ar: string; coeff: number; valeur: number | null; note_max: number; evaluee: boolean }[]> = {};
    for (const f of filieres) {
      const mats = await matieresPour(classeIdParFiliere(insc?.classes, f), f);
      const notes = await prisma.note.findMany({
        where: { eleve_id: bulletin.eleve_id, annee_scolaire_id, periode, matiere_id: { in: mats.map(m => m.id) } },
        select: { matiere_id: true, valeur: true },
      });
      const noteByMat = new Map(notes.map(n => [n.matiere_id, Number(n.valeur)]));
      rowsByFiliere[f] = mats.map(m => ({
        nom_fr: m.nom_fr, nom_ar: m.nom_ar ?? m.nom_fr,
        coeff: Number(m.coeff_effectif),
        valeur: noteByMat.has(m.id) ? noteByMat.get(m.id)! : null,
        note_max: Number(m.note_max_effectif),
        evaluee: m.evaluee_effectif,
      }));
    }
    const toRows = (f: 'FR' | 'AR' | 'EN') => rowsByFiliere[f] ?? [];

    const maitre_fr = filiere === 'EN'
      ? await maitrePour(classeIdParFiliere(insc?.classes, 'EN'))
      : (filiere !== 'AR' ? await maitrePour(classeIdParFiliere(insc?.classes, 'FR')) : null);
    const maitre_ar = filiere === 'EN'
      ? null
      : (filiere !== 'FR' ? await maitrePour(classeIdParFiliere(insc?.classes, 'AR')) : null);
    const abs = absByEleve.get(bulletin.eleve_id) ?? { j: 0, nj: 0 };

    pages.push(generateBulletinHtml({
      type: filiere as 'FR' | 'AR' | 'EN' | 'COMBINE', periode: bulletin.periode,
      etablissement_nom_fr: etab.nom_fr,
      etablissement_logo_url: etab.logo_url,
      entete_bulletin_fr: etab.entete_bulletin_fr,
      entete_bulletin_ar: etab.entete_bulletin_ar,
      eleve_nom_fr: `${bulletin.eleve.prenom_fr} ${bulletin.eleve.nom_fr}`,
      eleve_matricule: bulletin.eleve.matricule,
      eleve_date_naissance: bulletin.eleve.date_naissance ? new Date(bulletin.eleve.date_naissance).toLocaleDateString('fr-FR') : null,
      eleve_lieu_naissance: bulletin.eleve.lieu_naissance ?? null,
      annee_libelle: bulletin.annee_scolaire.libelle,
      moyenne: bulletin.moyenne !== null ? Number(bulletin.moyenne) : null,
      rang: bulletin.rang, appreciation: bulletin.appreciation, devise: etab.devise,
      note_max_etab: baseNote, echelle_affichage: echelleAffichage, mentions,
      etablissement_telephone: etab.telephone,
      etablissement_email: etab.email,
      etablissement_autorisation: etab.numero_autorisation,
      maitre_fr, maitre_ar,
      absences_justifiees: abs.j, absences_non_justifiees: abs.nj,
      afficher_rang: config?.bulletin_afficher_rang ?? true,
      afficher_absences: config?.bulletin_afficher_absences ?? true,
      logo_echelle: config?.bulletin_logo_echelle ?? 100,
      nb_periodes: config?.nb_periodes ?? 3,
      noms_periodes: (config?.noms_periodes as { fr?: string[] } | null) ?? undefined,
      template_html: templateHtml,
      filieres_combine: filiere === 'COMBINE' ? combineCodes : undefined,
      notes_fr: inFiliere('FR') ? toRows('FR') : undefined,
      notes_ar: inFiliere('AR') ? toRows('AR') : undefined,
      notes_en: inFiliere('EN') ? toRows('EN') : undefined,
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
  return renderPdfHtml(
    wrapBulletinsA4(pageContents, BULLETIN_CSS, { policeEchelle: config?.bulletin_police_echelle ?? 100 }),
    { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } },
    { fitToA4: true },
  );
}

// ─── Modèle HTML du bulletin (Étape 2 : rendu éditable) ──────────────────────

export async function getBulletinTemplate(etablissement_id: string, type: TypeModeleBulletin) {
  const { DEFAULT_BULLETIN_TEMPLATES, BULLETIN_PLACEHOLDERS, BULLETIN_TYPES, BULLETIN_TYPE_LABELS } = await import('./bulletin.template');
  const tpl = await prisma.bulletinTemplate.findUnique({ where: { etablissement_id_type: { etablissement_id, type } } });
  const customs = await prisma.bulletinTemplate.findMany({ where: { etablissement_id }, select: { type: true } });
  const customSet = new Set(customs.map(c => c.type));
  return {
    type,
    contenu_html: tpl?.contenu_html ?? DEFAULT_BULLETIN_TEMPLATES[type],
    is_custom: !!tpl,
    placeholders: BULLETIN_PLACEHOLDERS,
    // Tous les types + lesquels sont personnalisés (pour le sélecteur de l'éditeur).
    types: BULLETIN_TYPES.map(t => ({ type: t, label: BULLETIN_TYPE_LABELS[t], is_custom: customSet.has(t) })),
  };
}

export async function upsertBulletinTemplate(etablissement_id: string, type: TypeModeleBulletin, contenu_html: string) {
  return prisma.bulletinTemplate.upsert({
    where: { etablissement_id_type: { etablissement_id, type } },
    create: { etablissement_id, type, contenu_html },
    update: { contenu_html },
  });
}

export async function resetBulletinTemplate(etablissement_id: string, type: TypeModeleBulletin) {
  await prisma.bulletinTemplate.deleteMany({ where: { etablissement_id, type } });
}

// Aperçu HTML d'un modèle (pour le type donné) avec des données d'exemple —
// en-tête / logo / échelle réels de l'établissement. Pour l'iframe de l'éditeur.
export async function apercuBulletinTemplate(etablissement_id: string, type: TypeModeleBulletin, contenu_html: string): Promise<{ html: string }> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new NotFoundError('Établissement introuvable');
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const mentions = await getMentionsEtab(etablissement_id);
  const nbPeriodes = config?.nb_periodes ?? 3;
  const { generateBulletinHtml, generateBulletinAnnuelHtml } = await import('./bulletin.template');

  const note = (nom_fr: string, nom_ar: string, coeff: number, pct: number) =>
    ({ nom_fr, nom_ar, coeff, valeur: Math.round(baseNote * pct * 100) / 100, note_max: baseNote, evaluee: true });
  const demoFR = [note('Mathématiques', 'الرياضيات', 4, 0.78), note('Français', 'الفرنسية', 4, 0.65), note('Histoire-Géographie', 'التاريخ والجغرافيا', 2, 0.57)];
  const demoAR = [note('Coran', 'القرآن', 3, 0.80), note('Langue arabe', 'اللغة العربية', 3, 0.70)];
  // Filière anglaise : non bilingue → nom_ar = nom_fr (aucune glose arabe affichée).
  const demoEN = [note('Mathematics', 'Mathematics', 4, 0.78), note('English', 'English', 4, 0.68), note('Science', 'Science', 2, 0.57)];

  const common = {
    etablissement_nom_fr: etab.nom_fr,
    etablissement_logo_url: etab.logo_url,
    entete_bulletin_fr: etab.entete_bulletin_fr,
    entete_bulletin_ar: etab.entete_bulletin_ar,
    eleve_nom_fr: 'Amadou FALL (exemple)',
    eleve_matricule: `${etab.code}-2026-014`,
    eleve_date_naissance: '15/05/2011',
    eleve_lieu_naissance: 'Touba',
    annee_libelle: '2025-2026',
    moyenne: Math.round(baseNote * 0.716 * 100) / 100,
    rang: 3,
    appreciation: mentions[1]?.libelle_fr ?? 'Bien',
    devise: etab.devise,
    note_max_etab: baseNote,
    // Aperçu éditeur : pas de niveau en contexte → échelle établissement (aucun re-scale).
    echelle_affichage: undefined as number | undefined,
    mentions,
    etablissement_telephone: etab.telephone,
    etablissement_email: etab.email,
    etablissement_autorisation: etab.numero_autorisation,
    maitre_fr: 'Mme Aïssatou NDIAYE',
    maitre_ar: 'الأستاذ سيسي',
    absences_justifiees: 2, absences_non_justifiees: 1,
    afficher_rang: config?.bulletin_afficher_rang ?? true,
    afficher_absences: config?.bulletin_afficher_absences ?? true,
    logo_echelle: config?.bulletin_logo_echelle ?? 100,
    nb_periodes: nbPeriodes,
    noms_periodes: (config?.noms_periodes as { fr?: string[] } | null) ?? undefined,
    template_html: contenu_html,
  };

  let html: string;
  if (type === 'ANNUEL') {
    const p = (pct: number) => Math.round(baseNote * pct * 100) / 100;
    const ann = (nom_fr: string, nom_ar: string, coeff: number, vals: number[]) =>
      ({ nom_fr, nom_ar, coeff, note_max: baseNote, valeurs: vals, moyenne_annuelle: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100, evaluee: true });
    html = generateBulletinAnnuelHtml({
      ...common, type: 'ANNUEL_COMBINE',
      matieres_fr: [ann('Mathématiques', 'الرياضيات', 4, [p(0.75), p(0.70), p(0.80)])],
      matieres_ar: [ann('Coran', 'القرآن', 3, [p(0.80), p(0.75), p(0.85)])],
    });
  } else {
    html = generateBulletinHtml({
      ...common, type, periode: 1,
      notes_fr: (type === 'FR' || type === 'COMBINE') ? demoFR : undefined,
      notes_ar: (type === 'AR' || type === 'COMBINE') ? demoAR : undefined,
      notes_en: type === 'EN' ? demoEN : undefined,
    });
  }
  return { html };
}
