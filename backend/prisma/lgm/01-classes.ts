/**
 * Phase 1 — Classes.
 *
 * Crée une Classe DaaraGest par couple (classe LGM, année scolaire) réellement
 * utilisé (présent dans classe_eleve ou notes). La filière (FR/AR) vient du nom
 * LGM ("… - Arabe" → AR) ; le suffixe "- Arabe" est retiré du nom_fr pour que la
 * classe FR et la classe AR d'une même cohorte partagent le même nom (Phase 3
 * fusionnera les inscriptions FR+AR sur cette base).
 *
 * Produit la correspondance `classes["<codeClasseLGM>@<année>"] → id` dans
 * _mapping.json, consommée par les phases programme / inscriptions / notes.
 *
 * Idempotent. DRY-RUN par défaut ; --apply pour écrire.
 */
import {
  prisma, APPLY, getEtab, header, done, loadCsv, actives, anneeLibelle,
  filiereDeNom, loadMapping, saveMapping,
} from './lib';

/** Niveau DaaraGest déduit du nom de classe LGM. */
function niveauDeNom(nom: string): string | null {
  const base = nom.replace(/\s*-?\s*arabe\s*$/i, '').trim();
  if (/petite section/i.test(base)) return 'Petite Section';
  if (/moyenne section/i.test(base)) return 'Moyenne Section';
  if (/grande section/i.test(base)) return 'Grande Section';
  const m = base.match(/^(CI|CP|CE1|CE2|CM1|CM2)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** nom_fr DaaraGest = nom LGM sans le suffixe "- Arabe". */
const nomClasse = (nom: string) => nom.replace(/\s*-?\s*arabe\s*$/i, '').trim();

async function main() {
  const etab = await getEtab();
  header(`Phase 1 — Classes · ${etab.nom_fr}`);
  const mapping = loadMapping();

  // Référentiels LGM
  const refClasses = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c]));
  const annLib = new Map((await loadCsv('ref_annees_scolaires.csv')).map(a => [a.CT_CODE_ANNEE_SCOLAIRE, a.CT_ANNEE_SCOLAIRE]));

  // Couples (classe, année) réellement utilisés
  const used = new Set<string>();
  for (const r of actives(await loadCsv('classe_eleve.csv'))) used.add(`${r.CT_CODE_CLASSE}|${r.CT_CODE_ANNEE_SCOLAIRE}`);
  for (const r of actives(await loadCsv('notes.csv'))) used.add(`${r.CT_CODE_CLASSE}|${r.CT_CODE_ANNEE_SCOLAIRE}`);

  // Niveaux + années existants en base (résolus par libellé)
  const niveaux = new Map((await prisma.niveau.findMany({ where: { etablissement_id: etab.id } }))
    .map(n => [n.libelle, n.id]));
  const annees = new Map((await prisma.anneeScolaire.findMany({ where: { etablissement_id: etab.id } }))
    .map(a => [a.libelle, a.id]));

  let created = 0, reused = 0, skipped = 0;
  const rows = [...used].map(k => {
    const [code, anCode] = k.split('|');
    return { code, anCode, classe: refClasses.get(code) };
  }).filter(r => r.classe)
    .sort((a, b) => (a.classe!.CT_NOM).localeCompare(b.classe!.CT_NOM));

  for (const { code, anCode, classe } of rows) {
    const nomLgm = classe!.CT_NOM;
    const nom_fr = nomClasse(nomLgm);
    const filiere = filiereDeNom(nomLgm);
    const niveauLib = niveauDeNom(nomLgm);
    const anLib = anneeLibelle(annLib.get(anCode) ?? '');
    const niveau_id = niveauLib ? niveaux.get(niveauLib) ?? null : null;
    const annee_id = annees.get(anLib) ?? null;

    const flags = [
      niveauLib ? '' : '⚠ niveau inconnu',
      niveau_id || !APPLY ? '' : '⚠ niveau absent (Phase 0 ?)',
      annee_id || !APPLY ? '' : '⚠ année absente (Phase 0 ?)',
    ].filter(Boolean).join(' ');
    console.log(`  ${nomLgm.padEnd(22)} → ${nom_fr.padEnd(12)} [${filiere}] niv=${(niveauLib ?? '?').padEnd(15)} ${anLib} ${flags}`);

    if (!annee_id) { skipped++; continue; }

    // Idempotence : (nom_fr, filiere, année) unique de fait
    let existing = await prisma.classe.findFirst({
      where: { etablissement_id: etab.id, annee_scolaire_id: annee_id, nom_fr, filiere },
      select: { id: true },
    });
    if (existing) {
      reused++;
      if (APPLY && niveau_id) await prisma.classe.update({ where: { id: existing.id }, data: { niveau_id } });
    } else if (APPLY) {
      existing = await prisma.classe.create({
        data: { etablissement_id: etab.id, annee_scolaire_id: annee_id, nom_fr, filiere, niveau_id },
        select: { id: true },
      });
      created++;
    } else {
      created++; // simulation
    }
    if (existing) mapping.classes[`${code}@${anLib}`] = existing.id;
  }

  saveMapping(mapping);
  console.log(`\n  Classes → créées : ${created} · réutilisées : ${reused} · ignorées : ${skipped}`);
  console.log(`✅ Phase 1 ${APPLY ? 'appliquée' : 'simulée'} · ${Object.keys(mapping.classes).length} entrées de mapping.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
