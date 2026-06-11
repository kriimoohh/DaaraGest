/**
 * Phase 2a — Correspondance des matières LGM → DaaraGest.
 *
 * Résout chaque couple (code matière LGM, filière de la classe) vers une matière
 * DaaraGest, par appariement normalisé (accents/espaces/ponctuation) + alias
 * explicites pour les typos et abréviations LGM.
 *
 * Trois matières (42 Récitation/Chant, 92/93 Langue & Communication) sont
 * évaluées SÉPARÉMENT en FR et en AR avec des notes différentes : on crée pour
 * elles une variante AR dédiée (sinon la note arabe écraserait la note française,
 * la clé Note étant élève+matière+période+année). Idem pour 112 (Compétence
 * Langue & Communication arabe) qui n'a pas d'équivalent au référentiel.
 *
 * Écrit `matieres["<codeLGM>@<FR|AR>"] → id` dans _mapping.json.
 * Abandonne si une collision est détectée (2 codes LGM → même matière dans une
 * même classe). Idempotent. DRY-RUN par défaut ; --apply pour écrire.
 */
import {
  prisma, APPLY, getEtab, header, done, loadCsv, actives, filiereDeNom,
  loadMapping, saveMapping,
} from './lib';

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Alias LGM code → nom_fr cible DaaraGest (typos / abréviations / cas spéciaux). */
const ALIAS: Record<string, string> = {
  '1/2/92': 'Langue et Communication : Ressources',
  '1/2/93': 'Langue et Communication : Compétence',
  '1/2/100': "Production d'écrit (Religion)", // "Prduct° d'écrit" (abrégé P.d'ecrit, religion) — distinct de 76
  '1/2/109': 'Ressource : Langue et Communication (Arabe)',
  '1/2/113': 'Arabe',
};

/**
 * Variantes à créer : la filière d'une matière DaaraGest doit égaler celle de la
 * classe (sinon getMatieresDeclasse l'exclut du bulletin). On crée donc une
 * variante quand une matière LGM est utilisée dans une filière où le référentiel
 * n'a pas d'équivalent :
 *  - AR : matières évaluées séparément en FR et AR (42/92/93) + CLC arabe (112).
 *  - FR : matières utilisées en classe FR mais seulement AR au référentiel
 *    (46 Histoire, 100 Production d'écrit, 113 Arabe).
 * Clé = `<codeLGM>@<filière cible>`.
 */
type VarSpec = { nom_fr: string; filiere: 'FR' | 'AR'; refNomFr: string; refFiliere: 'FR' | 'AR' };
const CREATE_VARIANT: Record<string, VarSpec> = {
  '1/2/42@AR': { nom_fr: 'Récitation/Chant (Arabe)', filiere: 'AR', refNomFr: 'Récitation/Chant', refFiliere: 'FR' },
  '1/2/92@AR': { nom_fr: 'Langue et Communication : Ressources (Arabe)', filiere: 'AR', refNomFr: 'Langue et Communication : Ressources', refFiliere: 'FR' },
  '1/2/93@AR': { nom_fr: 'Langue et Communication : Compétence (Arabe)', filiere: 'AR', refNomFr: 'Langue et Communication : Compétence', refFiliere: 'FR' },
  '1/2/112@AR': { nom_fr: 'Compétence : Langue et Communication (Arabe)', filiere: 'AR', refNomFr: 'Ressource : Langue et Communication (Arabe)', refFiliere: 'AR' },
  '1/2/46@FR': { nom_fr: 'Histoire', filiere: 'FR', refNomFr: 'Histoire', refFiliere: 'AR' },
  '1/2/100@FR': { nom_fr: "Production d'écrit", filiere: 'FR', refNomFr: "Production d'écrit (Religion)", refFiliere: 'AR' },
  '1/2/113@FR': { nom_fr: 'Arabe', filiere: 'FR', refNomFr: 'Arabe', refFiliere: 'AR' },
};

async function main() {
  const etab = await getEtab();
  header(`Phase 2a — Matières · ${etab.nom_fr}`);
  const mapping = loadMapping();

  const mats = await prisma.matiere.findMany({
    where: { etablissement_id: etab.id },
    select: { id: true, nom_fr: true, filiere: true, domaine_id: true, type_note: true, ordre_bulletin: true },
  });
  const byNorm = new Map<string, typeof mats>();
  for (const m of mats) {
    const k = norm(m.nom_fr);
    (byNorm.get(k) ?? byNorm.set(k, []).get(k)!).push(m);
  }
  const findByNomFiliere = (nom: string, f: 'FR' | 'AR') => {
    const c = byNorm.get(norm(nom)) ?? [];
    return c.find(m => m.filiere === f) ?? c[0] ?? null;
  };

  const refmat = new Map(actives(await loadCsv('ref_matieres.csv')).map(m => [m.CT_CODE_MATIERE, m.CT_LIBELLE.trim()]));
  const classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  const notes = actives(await loadCsv('notes.csv'));

  // Filières d'usage par code matière
  const usage = new Map<string, Set<'FR' | 'AR'>>();
  for (const n of notes) {
    const f = filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '');
    (usage.get(n.CT_CODE_MATIERE) ?? usage.set(n.CT_CODE_MATIERE, new Set()).get(n.CT_CODE_MATIERE)!).add(f);
  }

  // 1) Création des variantes (filière matière = filière classe)
  console.log('\n[1] Variantes de matières (alignement filière classe ↔ matière) :');
  const createdVar = new Map<string, string>(); // `${code}@${filiere}` → matId
  for (const [key, spec] of Object.entries(CREATE_VARIANT)) {
    const ref = findByNomFiliere(spec.refNomFr, spec.refFiliere);
    const existing = mats.find(m => m.nom_fr === spec.nom_fr && m.filiere === spec.filiere);
    if (existing) {
      console.log(`      ${spec.nom_fr} [${spec.filiere}] — existe`);
      createdVar.set(key, existing.id);
    } else {
      console.log(`      ${spec.nom_fr} [${spec.filiere}] — à créer (d'après « ${spec.refNomFr} »)`);
      if (APPLY) {
        const m = await prisma.matiere.create({
          data: {
            etablissement_id: etab.id, nom_fr: spec.nom_fr, filiere: spec.filiere,
            domaine_id: ref?.domaine_id ?? null, type_note: ref?.type_note ?? 'SIMPLE',
            coeff_defaut: 1, ordre_bulletin: ref?.ordre_bulletin ?? 0, active: true,
          },
          select: { id: true },
        });
        createdVar.set(key, m.id);
      }
    }
  }

  // 2) Résolution (code, filière) → matière
  console.log('\n[2] Résolution des matières utilisées :');
  let ok = 0, miss = 0;
  for (const [code, fils] of [...usage.entries()].sort()) {
    const lib = refmat.get(code) ?? '';
    for (const f of fils) {
      const key = `${code}@${f}`;
      let id: string | undefined;
      if (CREATE_VARIANT[key]) id = createdVar.get(key);
      else id = findByNomFiliere(ALIAS[code] ?? lib, f)?.id;
      if (id) { mapping.matieres[key] = id; ok++; }
      else { console.log(`      ❌ ${key} « ${lib} » introuvable`); miss++; }
    }
  }
  console.log(`      résolues : ${ok} · manquantes : ${miss}`);

  // 3) Garde-fou : pas deux codes LGM → même matière dans une classe
  const prog = new Map<string, Map<string, Set<string>>>();
  for (const n of notes) {
    const f = filiereDeNom(classes.get(n.CT_CODE_CLASSE) ?? '');
    const id = mapping.matieres[`${n.CT_CODE_MATIERE}@${f}`];
    if (!id) continue;
    const mm = prog.get(n.CT_CODE_CLASSE) ?? prog.set(n.CT_CODE_CLASSE, new Map()).get(n.CT_CODE_CLASSE)!;
    (mm.get(id) ?? mm.set(id, new Set()).get(id)!).add(n.CT_CODE_MATIERE);
  }
  let coll = 0;
  for (const [c, mm] of prog) for (const [, codes] of mm) if (codes.size > 1) {
    coll++; console.log(`      ⚠ COLLISION ${classes.get(c)} : ${[...codes].join(', ')}`);
  }
  if (coll) throw new Error(`${coll} collision(s) matière — corriger ALIAS/CREATE_AR avant d'appliquer.`);

  saveMapping(mapping);
  console.log(`\n✅ Phase 2a ${APPLY ? 'appliquée' : 'simulée'} · aucune collision · ${ok} correspondances.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
