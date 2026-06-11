/**
 * Phase 2b — Programme des classes (coefficients & barèmes par trimestre).
 *
 * Pour chaque (classe LGM, année, matière, trimestre) réellement noté, on pose
 * le coefficient et le barème côté DaaraGest. Le coef LGM varie par trimestre :
 * il est porté par ClasseMatierePeriode (prioritaire au calcul du bulletin).
 *
 * Règle de barème (cf. équivalence des moyennes LGM↔DaaraGest) :
 *   ConfigNotes.note_max = 10 (base) · note brute saisie sur 10×coef
 *   → ClasseMatierePeriode.note_max = 10 × coef  ⇒ contribution = note brute
 *   ⇒ moyenne DaaraGest = Σ(note)/Σ(coef) = moyenne LGM.
 *
 * Le coefficient retenu par (classe, matière, trimestre) est le coef MAJORITAIRE
 * des notes (robuste aux ~6 incohérences inter-élèves déjà auditées).
 *
 * Crée ClasseMatiere (membre du programme + repli) et ClasseMatierePeriode (coef
 * /barème par période). Idempotent. DRY-RUN par défaut ; --apply pour écrire.
 */
import {
  prisma, APPLY, getEtab, header, done, loadCsv, actives, anneeLibelle,
  filiereDeNom, PERIODE_MAP, loadMapping,
} from './lib';

/** Coefficient majoritaire d'un multiset. */
function mode(values: number[]): number {
  const c = new Map<number, number>();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function main() {
  const etab = await getEtab();
  header(`Phase 2b — Programme · ${etab.nom_fr}`);
  const mapping = loadMapping();

  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const annLib = new Map((await loadCsv('ref_annees_scolaires.csv')).map(a => [a.CT_CODE_ANNEE_SCOLAIRE, a.CT_ANNEE_SCOLAIRE]));
  const notes = actives(await loadCsv('notes.csv'));

  // Regroupe les coefs par (classeDaara, matiereDaara, periode)
  type Key = string; // `${classeId}|${matiereId}|${periode}`
  const coefs = new Map<Key, number[]>();
  const cmPairs = new Set<string>(); // `${classeId}|${matiereId}`
  let skipped = 0;

  for (const n of notes) {
    const anLib = anneeLibelle(annLib.get(n.CT_CODE_ANNEE_SCOLAIRE) ?? '');
    const filiere = filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '');
    const classeId = mapping.classes[`${n.CT_CODE_CLASSE}@${anLib}`];
    const matiereId = mapping.matieres[`${n.CT_CODE_MATIERE}@${filiere}`];
    const periode = PERIODE_MAP[n.CT_CODE_SEMESTRE];
    if (!classeId || !matiereId || !periode) { skipped++; continue; }
    const coef = Number(n.CT_COEF);
    if (!Number.isFinite(coef) || coef <= 0) { skipped++; continue; }
    const k = `${classeId}|${matiereId}|${periode}`;
    (coefs.get(k) ?? coefs.set(k, []).get(k)!).push(coef);
    cmPairs.add(`${classeId}|${matiereId}`);
  }

  console.log(`\n  Couples (classe,matière) : ${cmPairs.size} · (classe,matière,période) : ${coefs.size} · notes ignorées : ${skipped}`);

  // 1) ClasseMatiere — coef de repli = coef de la plus petite période disponible
  for (const pair of cmPairs) {
    const [classe_id, matiere_id] = pair.split('|');
    let refCoef = 1;
    for (const periode of [1, 2, 3]) {
      const arr = coefs.get(`${pair}|${periode}`);
      if (arr) { refCoef = mode(arr); break; }
    }
    if (APPLY) {
      await prisma.classeMatiere.upsert({
        where: { classe_id_matiere_id: { classe_id, matiere_id } },
        update: { coeff_override: refCoef, note_max_override: 10 * refCoef },
        create: { classe_id, matiere_id, coeff_override: refCoef, note_max_override: 10 * refCoef, evaluee: true },
      });
    }
  }

  // 2) ClasseMatierePeriode — coef/barème par trimestre
  let cmpCount = 0;
  for (const [k, arr] of coefs) {
    const [classe_id, matiere_id, p] = k.split('|');
    const periode = Number(p);
    const coeff = mode(arr);
    if (APPLY) {
      await prisma.classeMatierePeriode.upsert({
        where: { classe_id_matiere_id_periode: { classe_id, matiere_id, periode } },
        update: { coeff, note_max: 10 * coeff },
        create: { classe_id, matiere_id, periode, coeff, note_max: 10 * coeff },
      });
    }
    cmpCount++;
  }

  console.log(`  ClasseMatiere : ${cmPairs.size} · ClasseMatierePeriode : ${cmpCount}`);
  console.log(`\n✅ Phase 2b ${APPLY ? 'appliquée' : 'simulée'}.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
