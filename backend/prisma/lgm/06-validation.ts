/**
 * Phase 5 — Validation (gate).
 *
 * Recalcule chaque bulletin LGM avec le moteur DaaraGest (calculerMoyennesClasse,
 * qui applique coef + barème PAR PÉRIODE) et compare la moyenne obtenue à la
 * moyenne LGM (CT_MOYENNE). Tout écart > 0,01 est listé.
 *
 * Lecture seule — aucune écriture. Usage : tsx prisma/lgm/06-validation.ts
 */
import { prisma, getEtab, header, done, loadCsv, actives, anneeLibelle, filiereDeNom, PERIODE_MAP, loadMapping } from './lib';
import { calculerMoyennesClasse } from '../../src/modules/bulletins/bulletins.service';

async function main() {
  const etab = await getEtab();
  header(`Phase 5 — Validation des moyennes · ${etab.nom_fr}`);
  const mapping = loadMapping();

  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const annLib = new Map((await loadCsv('ref_annees_scolaires.csv')).map(a => [a.CT_CODE_ANNEE_SCOLAIRE, a.CT_ANNEE_SCOLAIRE]));
  const annees = new Map((await prisma.anneeScolaire.findMany({ where: { etablissement_id: etab.id } })).map(a => [a.libelle, a.id]));
  const bulletins = actives(await loadCsv('bulletins.csv'));

  // Cache des moyennes recalculées par (classeDaara, anneeId, periode, filiere)
  const cache = new Map<string, Map<string, number>>();
  async function moyennes(classeId: string, anneeId: string, periode: number, filiere: 'FR' | 'AR') {
    const k = `${classeId}|${anneeId}|${periode}|${filiere}`;
    if (!cache.has(k)) cache.set(k, await calculerMoyennesClasse(etab.id, classeId, anneeId, [periode], [filiere]));
    return cache.get(k)!;
  }

  let ok = 0, mismatch = 0, skipped = 0;
  const ecarts: number[] = [];
  const pires: { lgm: number; calc: number; d: number; info: string }[] = [];

  for (const b of bulletins) {
    const anLib = anneeLibelle(annLib.get(b.CT_CODE_ANNEE_SCOLAIRE) ?? '');
    const classeId = mapping.classes[`${b.CT_CODE_CLASSE}@${anLib}`];
    const eleveId = mapping.eleves[b.CT_CODE_ELEVE];
    const anneeId = annees.get(anLib);
    const periode = PERIODE_MAP[b.CT_CODE_SEMESTRE];
    const filiere = filiereDeNom(classes.get(b.CT_CODE_CLASSE) ?? '');
    if (!classeId || !eleveId || !anneeId || !periode) { skipped++; continue; }

    const calc = (await moyennes(classeId, anneeId, periode, filiere)).get(eleveId);
    const lgm = Number(b.CT_MOYENNE);
    if (calc == null) { skipped++; continue; }
    const d = Math.abs(calc - lgm);
    ecarts.push(d);
    if (d <= 0.011) ok++;
    else {
      mismatch++;
      pires.push({ lgm, calc, d, info: `${classes.get(b.CT_CODE_CLASSE)} P${periode} élève ${b.CT_CODE_ELEVE}` });
    }
  }

  pires.sort((a, b) => b.d - a.d);
  const total = ok + mismatch;
  console.log(`\n  Bulletins LGM : ${bulletins.length} · comparés : ${total} · ignorés : ${skipped}`);
  console.log(`  ✅ Concordants (≤0,01) : ${ok} (${(100 * ok / total).toFixed(2)}%)`);
  console.log(`  ❌ Écarts (>0,01)      : ${mismatch} (${(100 * mismatch / total).toFixed(2)}%)`);
  if (mismatch) {
    console.log('\n  Plus gros écarts :');
    for (const p of pires.slice(0, 15)) console.log(`     LGM=${p.lgm} calc=${p.calc} Δ=${p.d.toFixed(2)} · ${p.info}`);
  }
  await done();
}

main().catch(e => { console.error(e); process.exit(1); });
