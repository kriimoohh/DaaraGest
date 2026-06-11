/**
 * Phase 4 — Notes.
 *
 * Importe la note de chaque (élève, matière, période, année). La valeur DaaraGest
 * est la note brute LGM (CT_TOTAL = contrôles + composition, ici = composition),
 * saisie sur le barème 10×coef porté par ClasseMatierePeriode — la moyenne du
 * bulletin se recalcule alors à l'identique (cf. Phase 2b / validation Phase 5).
 *
 * - Les notes à 0 sont IMPORTÉES (valeur 0) : LGM compte leur coefficient au
 *   dénominateur de la moyenne, il faut donc les conserver pour reproduire le
 *   calcul à l'identique.
 * - Doublons éventuels sur la clé DaaraGest : on conserve la note la plus récente.
 * - Notes hors barème (valeur > 10×coef) importées telles quelles ET listées
 *   dans _rapport_hors_bareme.csv pour correction ultérieure côté école.
 *
 * Idempotent (createMany skipDuplicates sur la clé unique). DRY-RUN par défaut.
 */
import {
  prisma, APPLY, getEtab, header, done, loadCsv, actives, anneeLibelle,
  filiereDeNom, PERIODE_MAP, loadMapping, DATA_DIR,
} from './lib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const etab = await getEtab();
  header(`Phase 4 — Notes · ${etab.nom_fr}`);
  const mapping = loadMapping();

  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const annLib = new Map((await loadCsv('ref_annees_scolaires.csv')).map(a => [a.CT_CODE_ANNEE_SCOLAIRE, a.CT_ANNEE_SCOLAIRE]));
  const annees = new Map((await prisma.anneeScolaire.findMany({ where: { etablissement_id: etab.id } })).map(a => [a.libelle, a.id]));
  const notes = actives(await loadCsv('notes.csv'));

  // Dédup par clé DaaraGest (élève, matière, période, année) → note la plus récente
  type Row = { eleve_id: string; matiere_id: string; periode: number; annee_scolaire_id: string; valeur: number };
  const best = new Map<string, { date: number; row: Row; coef: number; lgm: Record<string, string> }>();
  let zero = 0, unresolved = 0;

  for (const n of notes) {
    const total = Number(n.CT_TOTAL);
    if (!Number.isFinite(total)) { unresolved++; continue; }
    if (total === 0) zero++; // note à 0 — conservée (son coef compte au dénominateur LGM)

    const filiere = filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '');
    const eleve_id = mapping.eleves[n.CT_CODE_ELEVE];
    const matiere_id = mapping.matieres[`${n.CT_CODE_MATIERE}@${filiere}`];
    const annee_scolaire_id = annees.get(anneeLibelle(annLib.get(n.CT_CODE_ANNEE_SCOLAIRE) ?? ''));
    const periode = PERIODE_MAP[n.CT_CODE_SEMESTRE];
    if (!eleve_id || !matiere_id || !annee_scolaire_id || !periode) { unresolved++; continue; }

    const k = `${eleve_id}|${matiere_id}|${periode}|${annee_scolaire_id}`;
    const date = Number(n.CT_DATE_CREATION) || 0;
    const prev = best.get(k);
    if (!prev || date >= prev.date) {
      best.set(k, {
        date, coef: Number(n.CT_COEF),
        row: { eleve_id, matiere_id, periode, annee_scolaire_id, valeur: total },
        lgm: { classe: classes.get(n.CT_CODE_CLASSE) ?? '', matiere: n.CT_CODE_MATIERE, eleve: n.CT_CODE_ELEVE },
      });
    }
  }

  const rows = [...best.values()];
  const dups = notes.length - unresolved - rows.length;

  // Rapport hors-barème (valeur > 10×coef)
  const hb = rows.filter(r => r.coef > 0 && r.row.valeur > 10 * r.coef + 1e-9);
  const rapport = [
    'eleve_lgm,classe,matiere_lgm,periode,valeur,coef,max_attendu',
    ...hb.map(r => `${r.lgm.eleve},${r.lgm.classe},${r.lgm.matiere},${r.row.periode},${r.row.valeur},${r.coef},${10 * r.coef}`),
  ].join('\n');
  if (APPLY) writeFileSync(join(DATA_DIR, '_rapport_hors_bareme.csv'), rapport);

  console.log(`\n  Notes LGM : ${notes.length} · dont à 0 (conservées) : ${zero} · non résolues : ${unresolved} · doublons fusionnés : ${dups}`);
  console.log(`  À importer : ${rows.length} · dont hors barème (importées + listées) : ${hb.length}`);

  if (APPLY) {
    const chunk = 2000;
    let ins = 0;
    for (let i = 0; i < rows.length; i += chunk) {
      const r = await prisma.note.createMany({ data: rows.slice(i, i + chunk).map(x => x.row), skipDuplicates: true });
      ins += r.count;
    }
    console.log(`  Insérées : ${ins} (skipDuplicates — ré-run n'insère que les nouvelles)`);
  }

  console.log(`\n✅ Phase 4 ${APPLY ? 'appliquée' : 'simulée'}.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
