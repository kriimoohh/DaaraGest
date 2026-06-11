/**
 * Import PROD — Étape 3 : validation de l'historique 2024-2025.
 *
 * Recalcule chaque bulletin LGM 2024-2025 avec le moteur DaaraGest contre la
 * PRODUCTION et compare à la moyenne LGM (CT_MOYENNE). Lecture seule.
 *
 *   DATABASE_URL=<url prod> tsx prisma/lgm/prod/validate.ts
 */
import { prisma, getEtab, loadCsv, actives, filiereDeNom, PERIODE_MAP } from '../lib';
import { calculerMoyennesClasse } from '../../../src/modules/bulletins/bulletins.service';

const nname = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const lgmDate = (s: string) => { const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const prodClasseNom = (lgmNom: string, f: 'FR' | 'AR') => { const b = lgmNom.replace(/\s*-?\s*arabe\s*$/i, '').trim(); return f === 'AR' ? `${b} (AR)` : b; };

async function main() {
  const etab = await getEtab();
  console.log(`\n━━━ Validation PROD 2024-2025 · ${etab.code} ━━━`);
  const annee = await prisma.anneeScolaire.findFirst({ where: { etablissement_id: etab.id, libelle: '2024-2025' }, select: { id: true } });
  if (!annee) throw new Error('Année 2024-2025 absente — lancer import.ts --apply.');

  // classes prod 2024-2025 : (nom_fr|filiere) → id
  const prodClasses = new Map((await prisma.classe.findMany({ where: { etablissement_id: etab.id, annee_scolaire_id: annee.id } })).map(c => [`${c.nom_fr}|${c.filiere}`, c.id]));
  // élèves prod : nom+prénom+date → id (+ repli nom+prénom)
  const prodEleves = await prisma.eleve.findMany({ where: { etablissement_id: etab.id }, select: { id: true, nom_fr: true, prenom_fr: true, date_naissance: true } });
  const byKey = new Map<string, string[]>(), byNom = new Map<string, string[]>();
  for (const e of prodEleves) { const d = e.date_naissance ? e.date_naissance.toISOString().slice(0, 10) : ''; const k = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}|${d}`, k2 = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}`; (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e.id); (byNom.get(k2) ?? byNom.set(k2, []).get(k2)!).push(e.id); }

  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const lgmEleves = new Map(actives(await loadCsv('eleves.csv')).map(e => [e.CT_CODE_ELEVE, e]));
  const bulletins = actives(await loadCsv('bulletins.csv')).filter(b => b.CT_CODE_ANNEE_SCOLAIRE === '1/2/24');

  const eleveId = (code: string): string | null => {
    const e = lgmEleves.get(code); if (!e) return null;
    const k = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}|${lgmDate(e.CT_DATE_NAISSANCE)}`, k2 = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}`;
    if (byKey.get(k)?.length === 1) return byKey.get(k)![0];
    if (byNom.get(k2)?.length === 1) return byNom.get(k2)![0];
    return null;
  };

  const cache = new Map<string, Map<string, number>>();
  const moyennes = async (classeId: string, periode: number, filiere: 'FR' | 'AR') => {
    const k = `${classeId}|${periode}|${filiere}`;
    if (!cache.has(k)) cache.set(k, await calculerMoyennesClasse(etab.id, classeId, annee.id, [periode], [filiere]));
    return cache.get(k)!;
  };

  let ok = 0, mismatch = 0, skipped = 0; const pires: { d: number; info: string; lgm: number; calc: number }[] = [];
  for (const b of bulletins) {
    const lgmNom = classes.get(b.CT_CODE_CLASSE) ?? ''; const f = filiereDeNom(lgmNom);
    const classeId = prodClasses.get(`${prodClasseNom(lgmNom, f)}|${f}`);
    const eid = eleveId(b.CT_CODE_ELEVE); const per = PERIODE_MAP[b.CT_CODE_SEMESTRE];
    if (!classeId || !eid || !per) { skipped++; continue; }
    const calc = (await moyennes(classeId, per, f)).get(eid);
    if (calc == null) { skipped++; continue; }
    const lgm = Number(b.CT_MOYENNE); const d = Math.abs(calc - lgm);
    if (d <= 0.011) ok++; else { mismatch++; pires.push({ d, lgm, calc, info: `${lgmNom} P${per} élève ${b.CT_CODE_ELEVE}` }); }
  }
  pires.sort((a, b) => b.d - a.d);
  const total = ok + mismatch;
  console.log(`\n  Bulletins LGM 2024-2025 : ${bulletins.length} · comparés : ${total} · ignorés : ${skipped}`);
  console.log(`  ✅ Concordants (≤0,01) : ${ok} (${total ? (100 * ok / total).toFixed(2) : 0}%)`);
  console.log(`  ❌ Écarts (>0,01)      : ${mismatch}`);
  for (const p of pires.slice(0, 12)) console.log(`     LGM=${p.lgm} calc=${p.calc} Δ=${p.d.toFixed(2)} · ${p.info}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
