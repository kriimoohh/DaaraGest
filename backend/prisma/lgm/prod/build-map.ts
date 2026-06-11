/**
 * Import PROD — Étape 1 : correspondances LGM → prod (matières + élèves).
 *
 * Cible la base de PRODUCTION (DATABASE_URL=<url prod>). Lecture seule SAUF
 * création de 2 matières absentes (113 Arabe FR, 112 Compétence L&C arabe),
 * uniquement avec --apply.
 *
 * Mapping matières — stratégie hybride robuste :
 *  1. Appariement par NOM normalisé (filière de la classe), en départageant les
 *     doublons du référentiel prod par la PRÉSENCE de notes 2025-2026 (les
 *     variantes capitalisées/vides sont écartées).
 *  2. Repli EMPIRIQUE (recouvrement des triplets élève/période/valeur des notes
 *     2025-2026) quand le nom ne pointe que sur des matières vides — ex. LGM
 *     « Art plastique /Dessin » → prod « Art plastique ».
 *  3. Création explicite pour 112/113 (absents du référentiel pour leur filière).
 * Le nom reste prioritaire car l'empirique seul confond les matières « simples »
 * à petites valeurs (Copie↔Auto Dictée…).
 *
 * Élèves : match nom+prénom+date naissance, sinon nom+prénom unique. Les autres
 * (homonymes/typos) seront créés à l'étape import.
 *
 * Écrit prisma/lgm/prod/_prod_mapping.json. Refuse d'écrire si collision matière.
 */
import { prisma, APPLY, getEtab, loadCsv, actives, filiereDeNom } from '../lib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const nname = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const lgmDate = (s: string) => { const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

const ALIAS: Record<string, string> = {
  '1/2/92': 'Langue et Communication : Ressources',
  '1/2/93': 'Langue et Communication : Compétence',
  '1/2/100': "Production d'écrits", // 100 ne co-occurre jamais avec 76 en 2024-25
  '1/2/109': 'Ressource : Langue et Communication (Arabe)',
};
const CREATE: Record<string, { nom_fr: string; filiere: 'FR' | 'AR'; ref: string }> = {
  '1/2/113@FR': { nom_fr: 'Arabe', filiere: 'FR', ref: 'Arabe' },
  '1/2/112@AR': { nom_fr: 'Compétence : Langue et Communication (Arabe)', filiere: 'AR', ref: 'Ressource : Langue et Communication (Arabe)' },
};
const A24 = '1/2/24', A25 = '1/2/25';
const TRI: Record<string, number> = { '1/2/4': 1, '1/2/5': 2, '1/2/6': 3 };

async function main() {
  const etab = await getEtab();
  console.log(`\n━━━ Import PROD · build-map · ${etab.code} ${APPLY ? '' : '(DRY-RUN)'} ━━━`);

  // ── Données prod ──────────────────────────────────────────────────────────
  const mats = await prisma.matiere.findMany({ where: { etablissement_id: etab.id }, select: { id: true, nom_fr: true, filiere: true, domaine_id: true, type_note: true, ordre_bulletin: true } });
  const prodEleves = await prisma.eleve.findMany({ where: { etablissement_id: etab.id }, select: { id: true, nom_fr: true, prenom_fr: true, date_naissance: true } });
  const annee25 = await prisma.anneeScolaire.findFirst({ where: { etablissement_id: etab.id, libelle: '2025-2026' }, select: { id: true } });
  const prodNotes = annee25 ? await prisma.note.findMany({ where: { annee_scolaire_id: annee25.id }, select: { eleve_id: true, matiere_id: true, periode: true, valeur: true } }) : [];

  const notesPerMat = new Map<string, number>();
  const triplesByMat = new Map<string, Set<string>>(); // matId → set "eleve|periode|valeur"
  for (const n of prodNotes) {
    notesPerMat.set(n.matiere_id, (notesPerMat.get(n.matiere_id) ?? 0) + 1);
    const t = `${n.eleve_id}|${n.periode}|${Number(n.valeur).toFixed(2)}`;
    (triplesByMat.get(n.matiere_id) ?? triplesByMat.set(n.matiere_id, new Set()).get(n.matiere_id)!).add(t);
  }

  // ── Données LGM ───────────────────────────────────────────────────────────
  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const refmat = new Map(actives(await loadCsv('ref_matieres.csv')).map(m => [m.CT_CODE_MATIERE, m.CT_LIBELLE.trim()]));
  const allNotes = actives(await loadCsv('notes.csv'));

  // Match élèves LGM → prod
  const byNomDate = new Map<string, string[]>(), byNom = new Map<string, string[]>();
  for (const e of prodEleves) {
    const d = e.date_naissance ? e.date_naissance.toISOString().slice(0, 10) : '';
    const k3 = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}|${d}`, k2 = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}`;
    (byNomDate.get(k3) ?? byNomDate.set(k3, []).get(k3)!).push(e.id);
    (byNom.get(k2) ?? byNom.set(k2, []).get(k2)!).push(e.id);
  }
  const lgmEleves = new Map(actives(await loadCsv('eleves.csv')).map(e => [e.CT_CODE_ELEVE, e]));
  const e2p = new Map<string, string>();
  for (const [code, e] of lgmEleves) {
    const k3 = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}|${lgmDate(e.CT_DATE_NAISSANCE)}`, k2 = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}`;
    if (byNomDate.get(k3)?.length === 1) e2p.set(code, byNomDate.get(k3)![0]);
    else if (byNom.get(k2)?.length === 1) e2p.set(code, byNom.get(k2)![0]);
  }

  // Triplets LGM 2025-2026 par code@filiere (pour le repli empirique)
  const lgmTriples = new Map<string, Set<string>>();
  for (const n of allNotes) {
    if (n.CT_CODE_ANNEE_SCOLAIRE !== A25) continue;
    const pe = e2p.get(n.CT_CODE_ELEVE), per = TRI[n.CT_CODE_SEMESTRE];
    if (!pe || !per) continue;
    const key = `${n.CT_CODE_MATIERE}@${filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '')}`;
    const t = `${pe}|${per}|${Number(n.CT_TOTAL).toFixed(2)}`;
    (lgmTriples.get(key) ?? lgmTriples.set(key, new Set()).get(key)!).add(t);
  }

  // ── Résolution matières ───────────────────────────────────────────────────
  const byNorm = new Map<string, typeof mats>();
  for (const m of mats) (byNorm.get(norm(m.nom_fr)) ?? byNorm.set(norm(m.nom_fr), []).get(norm(m.nom_fr))!).push(m);
  const hasNotes = (id: string) => (notesPerMat.get(id) ?? 0) > 0;

  /** Meilleure matière prod (filière f) par recouvrement de triplets. */
  function empirical(key: string, f: 'FR' | 'AR', pool: typeof mats): { m: (typeof mats)[number]; cov: number } | null {
    const trips = lgmTriples.get(key); if (!trips || trips.size === 0) return null;
    let best: (typeof mats)[number] | null = null, bestCov = 0;
    for (const m of pool) {
      if (m.filiere !== f) continue;
      const pt = triplesByMat.get(m.id); if (!pt) continue;
      let inter = 0; for (const t of trips) if (pt.has(t)) inter++;
      const cov = inter / trips.size;
      if (cov > bestCov) { bestCov = cov; best = m; }
    }
    return best ? { m: best, cov: bestCov } : null;
  }

  // Création 112/113
  const created = new Map<string, string>();
  console.log('\n[matières créées]');
  for (const [key, spec] of Object.entries(CREATE)) {
    const ref = (byNorm.get(norm(spec.ref)) ?? []).find(m => m.filiere === spec.filiere) ?? null;
    const existing = mats.find(m => m.nom_fr === spec.nom_fr && m.filiere === spec.filiere);
    if (existing) { created.set(key, existing.id); console.log(`   ${spec.nom_fr} [${spec.filiere}] — existe`); continue; }
    console.log(`   ${spec.nom_fr} [${spec.filiere}] — ${APPLY ? 'CRÉÉE' : 'à créer'}`);
    if (APPLY) {
      const m = await prisma.matiere.create({ data: { etablissement_id: etab.id, nom_fr: spec.nom_fr, filiere: spec.filiere, domaine_id: ref?.domaine_id ?? null, type_note: ref?.type_note ?? 'SIMPLE', coeff_defaut: 1, ordre_bulletin: ref?.ordre_bulletin ?? 0, active: true }, select: { id: true } });
      created.set(key, m.id);
    }
  }

  const usage24 = new Map<string, Set<'FR' | 'AR'>>();
  for (const n of allNotes) if (n.CT_CODE_ANNEE_SCOLAIRE === A24) (usage24.get(n.CT_CODE_MATIERE) ?? usage24.set(n.CT_CODE_MATIERE, new Set()).get(n.CT_CODE_MATIERE)!).add(filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? ''));

  const matMap: Record<string, string> = {};
  const problems: string[] = [];
  console.log('\n[matières résolues]');
  for (const [code, fils] of [...usage24].sort()) {
    for (const f of fils) {
      const key = `${code}@${f}`;
      if (CREATE[key]) { const id = created.get(key); if (id) matMap[key] = id; console.log(`   ${key} → (créée) ${CREATE[key].nom_fr}`); continue; }
      const target = ALIAS[code] ?? refmat.get(code) ?? '';
      const cands = (byNorm.get(norm(target)) ?? []).filter(m => m.filiere === f);
      const withNotes = cands.filter(m => hasNotes(m.id));
      let chosen: (typeof mats)[number] | null = null, how = '';
      if (withNotes.length === 1) { chosen = withNotes[0]; how = 'nom+notes'; }
      else if (withNotes.length > 1) { const e = empirical(key, f, withNotes); chosen = e?.m ?? withNotes[0]; how = `nom×${withNotes.length}→empirique`; }
      else if (cands.length >= 1) { const e = empirical(key, f, mats); chosen = e && e.cov >= 0.5 ? e.m : cands[0]; how = e && e.cov >= 0.5 ? `repli empirique ${(e.cov * 100).toFixed(0)}%` : 'nom (vide)'; }
      else { const e = empirical(key, f, mats); if (e && e.cov >= 0.5) { chosen = e.m; how = `empirique ${(e.cov * 100).toFixed(0)}%`; } }
      if (chosen) { matMap[key] = chosen.id; console.log(`   ${key.padEnd(11)} → ${chosen.nom_fr} [${chosen.filiere}]  (${how})`); }
      else problems.push(`${key} « ${refmat.get(code)} » non résolu [${f}]`);
    }
  }

  // Garde-fou collisions en 2024-2025
  const prog = new Map<string, Map<string, Set<string>>>();
  for (const n of allNotes) {
    if (n.CT_CODE_ANNEE_SCOLAIRE !== A24) continue;
    const id = matMap[`${n.CT_CODE_MATIERE}@${filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '')}`]; if (!id) continue;
    const mm = prog.get(n.CT_CODE_CLASSE) ?? prog.set(n.CT_CODE_CLASSE, new Map()).get(n.CT_CODE_CLASSE)!;
    (mm.get(id) ?? mm.set(id, new Set()).get(id)!).add(n.CT_CODE_MATIERE);
  }
  for (const [c, mm] of prog) for (const [, codes] of mm) if (codes.size > 1) problems.push(`COLLISION ${classes.get(c)} : ${[...codes].join(', ')}`);

  console.log(`\n[bilan] matières résolues : ${Object.keys(matMap).length} · problèmes : ${problems.length}`);
  problems.forEach(p => console.log(`   ⚠ ${p}`));
  if (problems.length) throw new Error('Mapping matières incomplet/collision.');

  // Élèves concernés par 2024-2025
  const concerned = new Set<string>();
  for (const r of actives(await loadCsv('classe_eleve.csv'))) if (r.CT_CODE_ANNEE_SCOLAIRE === A24) concerned.add(r.CT_CODE_ELEVE);
  for (const n of allNotes) if (n.CT_CODE_ANNEE_SCOLAIRE === A24) concerned.add(n.CT_CODE_ELEVE);
  const eleveMap: Record<string, string> = {};
  let matched = 0, toCreate = 0, ghost = 0;
  for (const code of concerned) {
    if (!lgmEleves.has(code)) { ghost++; continue; }
    const id = e2p.get(code);
    if (id) { eleveMap[code] = id; matched++; } else toCreate++;
  }
  console.log(`[élèves 2024-25] concernés : ${concerned.size} · matchés prod : ${matched} · à créer : ${toCreate} · fantômes : ${ghost}`);

  // _prod_mapping.json est un artefact LOCAL — écrit dans les deux modes pour
  // permettre de construire/dry-runner les étapes suivantes. En dry-run, 112/113
  // (matières non encore créées) sont absents du mapping → notes ignorées en
  // aperçu seulement ; --apply les crée et complète le mapping.
  writeFileSync(join(__dirname, '_prod_mapping.json'), JSON.stringify({ matieres: matMap, eleves: eleveMap }, null, 2));
  console.log(`\n✅ _prod_mapping.json écrit ${APPLY ? '' : '(DRY-RUN : matières 112/113 absentes tant que --apply non lancé)'}.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
