/**
 * Import PROD — Étape 2 : historique 2024-2025 dans la base de PRODUCTION
 * (DATABASE_URL=<url prod>). NE CRÉE QUE l'année 2024-2025 ; ne touche jamais
 * à 2025-2026.
 *
 * ⚠️ INSERT GROUPÉ obligatoire (proxy public) : toutes les insertions de masse
 * passent par createMany (élèves, inscriptions, programme, notes) — jamais de
 * boucle de create/upsert ligne par ligne. Les IDs nécessaires sont relus par
 * requête après insertion.
 *
 * Idempotent : les élèves sont résolus en live (nom+prénom+date naissance) contre
 * prod — un ré-run retrouve ceux déjà créés au lieu d'en refaire. Les inscriptions
 * de l'année sont purgées puis réinsérées ; programme/notes en skipDuplicates.
 *
 * Prérequis : build-map.ts --apply (matières 112/113 + _prod_mapping.json).
 * DRY-RUN par défaut ; --apply pour écrire.
 */
import { prisma, APPLY, getEtab, loadCsv, actives, filiereDeNom, PERIODE_MAP } from '../lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const A24 = '1/2/24';
const lgmDate = (s: string): Date | null => {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return dt.getUTCMonth() === +m[2] - 1 ? dt : null;
};
const nname = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const mode = (a: number[]) => { const c = new Map<number, number>(); for (const v of a) c.set(v, (c.get(v) ?? 0) + 1); return [...c].sort((x, y) => y[1] - x[1])[0][0]; };
const prodClasseNom = (lgmNom: string, f: 'FR' | 'AR') => { const b = lgmNom.replace(/\s*-?\s*arabe\s*$/i, '').trim(); return f === 'AR' ? `${b} (AR)` : b; };
const niveauDeNom = (nom: string): string | null => {
  const b = nom.replace(/\s*-?\s*arabe\s*$/i, '').trim();
  if (/petite section/i.test(b)) return 'Petite Section';
  if (/moyenne section/i.test(b)) return 'Moyenne Section';
  if (/grande section/i.test(b)) return 'Grande Section';
  const m = b.match(/^(CI|CP|CE1|CE2|CM1|CM2)\b/i); return m ? m[1].toUpperCase() : null;
};

async function main() {
  const etab = await getEtab();
  console.log(`\n━━━ Import PROD 2024-2025 (INSERT groupé) · ${etab.code} ${APPLY ? '' : '(DRY-RUN)'} ━━━`);
  const mapping = JSON.parse(readFileSync(join(__dirname, '_prod_mapping.json'), 'utf-8')) as { matieres: Record<string, string> };

  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const notes24 = actives(await loadCsv('notes.csv')).filter(n => n.CT_CODE_ANNEE_SCOLAIRE === A24);
  const ce24 = actives(await loadCsv('classe_eleve.csv')).filter(r => r.CT_CODE_ANNEE_SCOLAIRE === A24);
  const lgmEleves = new Map(actives(await loadCsv('eleves.csv')).map(e => [e.CT_CODE_ELEVE, e]));

  // ── 1. Année 2024-2025 ────────────────────────────────────────────────────
  let annee = await prisma.anneeScolaire.findFirst({ where: { etablissement_id: etab.id, libelle: '2024-2025' }, select: { id: true } });
  console.log(`\n[1] Année 2024-2025 : ${annee ? 'existe' : (APPLY ? 'CRÉÉE' : 'à créer')}`);
  if (!annee && APPLY) annee = await prisma.anneeScolaire.create({ data: { etablissement_id: etab.id, libelle: '2024-2025', date_debut: new Date('2024-09-01'), date_fin: new Date('2025-08-31'), active: false }, select: { id: true } });
  const anneeId = annee?.id;

  // ── 2. Classes (création des manquantes en individuel — 26 max — puis reload) ─
  const niveaux = new Map((await prisma.niveau.findMany({ where: { etablissement_id: etab.id } })).map(n => [n.libelle, n.id]));
  const used = new Set<string>([...ce24.map(r => r.CT_CODE_CLASSE), ...notes24.map(n => n.CT_CODE_CLASSE)].filter(c => classes.has(c)));
  // spec par lgmClasse → {nom_fr, filiere, niveau_id}
  const classSpec = new Map<string, { nom_fr: string; filiere: 'FR' | 'AR'; niveau_id: string | null }>();
  for (const code of used) {
    const nom = classes.get(code)!; const f = filiereDeNom(nom);
    classSpec.set(code, { nom_fr: prodClasseNom(nom, f), filiere: f, niveau_id: niveaux.get(niveauDeNom(nom) ?? '') ?? null });
  }
  const classMap = new Map<string, string>();
  if (anneeId) {
    const existing = new Map((await prisma.classe.findMany({ where: { etablissement_id: etab.id, annee_scolaire_id: anneeId } })).map(c => [`${c.nom_fr}|${c.filiere}`, c.id]));
    const toCreate = [...classSpec.values()].filter(s => !existing.has(`${s.nom_fr}|${s.filiere}`));
    const uniq = new Map(toCreate.map(s => [`${s.nom_fr}|${s.filiere}`, s]));
    if (APPLY && uniq.size) { for (const s of uniq.values()) await prisma.classe.create({ data: { etablissement_id: etab.id, annee_scolaire_id: anneeId, nom_fr: s.nom_fr, filiere: s.filiere, niveau_id: s.niveau_id } }); }
    const all = new Map((await prisma.classe.findMany({ where: { etablissement_id: etab.id, annee_scolaire_id: anneeId } })).map(c => [`${c.nom_fr}|${c.filiere}`, c.id]));
    for (const [code, s] of classSpec) { const id = all.get(`${s.nom_fr}|${s.filiere}`); if (id) classMap.set(code, id); }
    console.log(`[2] Classes → existantes : ${existing.size} · créées : ${APPLY ? uniq.size : 0} · résolues : ${classMap.size}`);
  } else console.log(`[2] Classes → ${classSpec.size} à créer (dry-run, année non créée)`);

  // ── 3. Élèves : résolution live (nom+prénom+date) + création groupée ──────
  const concerned = [...new Set<string>([...ce24.map(r => r.CT_CODE_ELEVE), ...notes24.map(n => n.CT_CODE_ELEVE)])].filter(c => lgmEleves.has(c));
  const prodEleves = await prisma.eleve.findMany({ where: { etablissement_id: etab.id }, select: { id: true, nom_fr: true, prenom_fr: true, date_naissance: true } });
  // même logique que build-map : nom+prénom+date, sinon repli nom+prénom unique.
  const byKey = new Map<string, string[]>(), byNom = new Map<string, string[]>();
  for (const e of prodEleves) {
    const d = e.date_naissance ? e.date_naissance.toISOString().slice(0, 10) : '';
    const k = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}|${d}`, k2 = `${nname(e.nom_fr)}|${nname(e.prenom_fr)}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e.id);
    (byNom.get(k2) ?? byNom.set(k2, []).get(k2)!).push(e.id);
  }
  const eleveId = new Map<string, string>();
  const toCreateEl: { code: string; e: Record<string, string>; dn: Date }[] = [];
  let ghost = 0;
  for (const code of concerned) {
    const e = lgmEleves.get(code)!; const dn = lgmDate(e.CT_DATE_NAISSANCE);
    if (!dn) { ghost++; continue; }
    const k = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}|${dn.toISOString().slice(0, 10)}`, k2 = `${nname(e.CT_NOM)}|${nname(e.CT_PRENOM)}`;
    if (byKey.get(k)?.length === 1) eleveId.set(code, byKey.get(k)![0]);
    else if (byNom.get(k2)?.length === 1) eleveId.set(code, byNom.get(k2)![0]);
    else toCreateEl.push({ code, e, dn });
  }
  if (APPLY && toCreateEl.length) {
    // réserve N matricules atomiquement, puis createMany, puis relit par matricule
    const N = toCreateEl.length;
    const cnt = await prisma.matriculeCounter.upsert({ where: { etablissement_id_type_annee: { etablissement_id: etab.id, type: 'E', annee: '24' } }, create: { etablissement_id: etab.id, type: 'E', annee: '24', last_value: N }, update: { last_value: { increment: N } } });
    const start = cnt.last_value - N;
    const data = toCreateEl.map((x, i) => ({ etablissement_id: etab.id, matricule: `${etab.code}-E-24-${String(start + i + 1).padStart(3, '0')}`, nom_fr: x.e.CT_NOM.trim(), prenom_fr: x.e.CT_PRENOM.trim(), date_naissance: x.dn, lieu_naissance: x.e.CT_LIEU_NAISSANCE?.trim() || null, sexe: x.e.CT_SEXE === 'F' ? 'F' : 'M', actif: true }));
    await prisma.eleve.createMany({ data });
    const created = new Map((await prisma.eleve.findMany({ where: { matricule: { in: data.map(d => d.matricule) } }, select: { id: true, matricule: true } })).map(e => [e.matricule, e.id]));
    toCreateEl.forEach((x, i) => { const id = created.get(data[i].matricule); if (id) eleveId.set(x.code, id); });
  } else if (!APPLY) toCreateEl.forEach(x => eleveId.set(x.code, `dry-${x.code}`));
  console.log(`[3] Élèves → concernés : ${concerned.length} · déjà en prod : ${concerned.length - toCreateEl.length - ghost} · créés (groupé) : ${APPLY ? toCreateEl.length : '(dry ' + toCreateEl.length + ')'} · fantômes : ${ghost}`);

  // ── 4. Inscriptions (purge année puis createMany) ─────────────────────────
  const insc = new Map<string, { FR?: string; AR?: string }>();
  for (const r of ce24) { const cid = classMap.get(r.CT_CODE_CLASSE); if (!cid) continue; const f = filiereDeNom(classes.get(r.CT_CODE_CLASSE) ?? ''); const cur = insc.get(r.CT_CODE_ELEVE) ?? {}; cur[f] = cid; insc.set(r.CT_CODE_ELEVE, cur); }
  const inscData = [...insc].filter(([code]) => eleveId.has(code)).map(([code, c]) => ({ eleve_id: eleveId.get(code)!, annee_scolaire_id: anneeId!, classe_fr_id: c.FR ?? null, classe_ar_id: c.AR ?? null, statut: 'actif' }));
  if (APPLY && anneeId) { await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } }); await prisma.inscription.createMany({ data: inscData }); }
  console.log(`[4] Inscriptions (fusion FR+AR) → ${inscData.length} ${APPLY ? 'insérées (groupé)' : 'à insérer'}`);

  // ── 5. Programme (createMany skipDuplicates) ──────────────────────────────
  const coefs = new Map<string, number[]>(); const cmPairs = new Set<string>();
  for (const n of notes24) {
    const cid = classMap.get(n.CT_CODE_CLASSE); const mid = mapping.matieres[`${n.CT_CODE_MATIERE}@${filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '')}`];
    const per = PERIODE_MAP[n.CT_CODE_SEMESTRE]; const coef = Number(n.CT_COEF);
    if (!cid || !mid || !per || !(coef > 0)) continue;
    (coefs.get(`${cid}|${mid}|${per}`) ?? coefs.set(`${cid}|${mid}|${per}`, []).get(`${cid}|${mid}|${per}`)!).push(coef);
    cmPairs.add(`${cid}|${mid}`);
  }
  const cmData = [...cmPairs].map(pair => { const [classe_id, matiere_id] = pair.split('|'); let ref = 1; for (const p of [1, 2, 3]) { const a = coefs.get(`${pair}|${p}`); if (a) { ref = mode(a); break; } } return { classe_id, matiere_id, coeff_override: ref, note_max_override: 10 * ref, evaluee: true }; });
  const cmpData = [...coefs].map(([k, arr]) => { const [classe_id, matiere_id, p] = k.split('|'); const coeff = mode(arr); return { classe_id, matiere_id, periode: +p, coeff, note_max: 10 * coeff }; });
  if (APPLY) { await prisma.classeMatiere.createMany({ data: cmData, skipDuplicates: true }); await prisma.classeMatierePeriode.createMany({ data: cmpData, skipDuplicates: true }); }
  console.log(`[5] Programme → ClasseMatiere : ${cmData.length} · ClasseMatierePeriode : ${cmpData.length} ${APPLY ? '(groupé)' : ''}`);

  // ── 6. Notes (createMany skipDuplicates) ──────────────────────────────────
  const best = new Map<string, { d: number; row: { eleve_id: string; matiere_id: string; periode: number; annee_scolaire_id: string; valeur: number } }>(); let unresolved = 0;
  for (const n of notes24) {
    const total = Number(n.CT_TOTAL); const eid = eleveId.get(n.CT_CODE_ELEVE); const mid = mapping.matieres[`${n.CT_CODE_MATIERE}@${filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '')}`]; const per = PERIODE_MAP[n.CT_CODE_SEMESTRE];
    if (!Number.isFinite(total) || !eid || !mid || !per || !anneeId) { unresolved++; continue; }
    const k = `${eid}|${mid}|${per}`; const d = Number(n.CT_DATE_CREATION) || 0;
    if (!best.has(k) || d >= best.get(k)!.d) best.set(k, { d, row: { eleve_id: eid, matiere_id: mid, periode: per, annee_scolaire_id: anneeId, valeur: total } });
  }
  const rows = [...best.values()].map(x => x.row);
  let ins = 0;
  if (APPLY) { const chunk = 3000; for (let i = 0; i < rows.length; i += chunk) ins += (await prisma.note.createMany({ data: rows.slice(i, i + chunk), skipDuplicates: true })).count; }
  console.log(`[6] Notes → à importer : ${rows.length} · non résolues : ${unresolved} ${APPLY ? '· insérées (groupé) : ' + ins : ''}`);

  console.log(`\n✅ Import PROD 2024-2025 ${APPLY ? 'APPLIQUÉ' : 'simulé'}.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
