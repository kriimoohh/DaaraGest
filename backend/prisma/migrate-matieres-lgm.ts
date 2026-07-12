/**
 * Migration de données : applique le référentiel LGM (6 domaines + 76 matières)
 * sur une base déjà déployée.
 *
 * Comportement :
 *  1. Crée/met à jour les 6 domaines pédagogiques par établissement.
 *  2. Upsert (par nom_fr+filiere) des 76 matières du référentiel — rattachées
 *     à leur domaine. Préserve les notes/évaluations des matières qui existent
 *     déjà sous le même nom_fr+filiere.
 *  3. Supprime les matières existantes qui ne figurent PAS dans le référentiel,
 *     avec cascade manuel des FK (NoteEvaluation, Evaluation, Note, Creneau,
 *     ClasseMatiere, PersonnelMatiereClasse).
 *
 * ⚠️  Étape 3 est destructive. Par défaut, le script tourne en DRY-RUN et
 *    affiche ce qu'il ferait. Lance avec `--apply` pour exécuter.
 *
 * Usage :
 *   tsx prisma/migrate-matieres-lgm.ts            # dry-run
 *   tsx prisma/migrate-matieres-lgm.ts --apply    # exécute
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { LGM_DOMAINES, LGM_MATIERES } from './data/lgm-matieres';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function header(s: string) {
  console.log(`\n━━━ ${s} ━━━`);
}

async function migrerEtablissement(etabId: string, etabNom: string) {
  header(`Établissement : ${etabNom} (${etabId})`);

  // ── 1. Domaines ────────────────────────────────────────────────────────────
  let domCreated = 0;
  let domUpdated = 0;
  for (const d of LGM_DOMAINES) {
    const existing = await prisma.domaine.findUnique({
      where: { etablissement_id_code: { etablissement_id: etabId, code: d.code } },
    });
    if (existing) {
      if (APPLY) {
        await prisma.domaine.update({
          where: { id: existing.id },
          data: { nom_fr: d.nom_fr, ordre: d.ordre, actif: true },
        });
      }
      domUpdated++;
    } else {
      if (APPLY) {
        await prisma.domaine.create({
          data: { etablissement_id: etabId, code: d.code, nom_fr: d.nom_fr, ordre: d.ordre, actif: true },
        });
      }
      domCreated++;
    }
  }
  console.log(`  Domaines  → créés : ${domCreated} · mis à jour : ${domUpdated}`);

  // Recharge les domaines (avec leurs nouveaux IDs si on a appliqué)
  const domaines = await prisma.domaine.findMany({ where: { etablissement_id: etabId } });
  const domaineByCode = new Map(domaines.map(d => [d.code, d.id]));

  // Filières (Phase 2d : la filière n'est portée que par filiere_id)
  const filiereByCode = new Map(
    (await prisma.filiere.findMany({ where: { etablissement_id: etabId } })).map(f => [f.code, f.id]),
  );

  // ── 2. Matières — UPSERT par (nom_fr, filiere) ─────────────────────────────
  let matCreated = 0;
  let matUpdated = 0;
  const lgmNames = new Set<string>(); // clé "nom_fr|filiere" du référentiel
  for (const m of LGM_MATIERES) {
    lgmNames.add(`${m.nom_fr}|${m.filiere}`);
    const filiereId = filiereByCode.get(m.filiere);
    if (!filiereId) throw new Error(`Filière ${m.filiere} non configurée pour cet établissement`);
    const existing = await prisma.matiere.findFirst({
      where: { etablissement_id: etabId, nom_fr: m.nom_fr, filiere_id: filiereId },
    });
    const data = {
      etablissement_id: etabId,
      nom_fr: m.nom_fr,
      nom_ar: m.nom_ar,
      filiere_id: filiereId,
      coeff_defaut: new Prisma.Decimal(1),
      note_min: new Prisma.Decimal(0),
      ordre_bulletin: m.ordre_bulletin,
      code_court: m.code_court,
      type_note: m.type_note,
      domaine_id: domaineByCode.get(m.domaine_code) ?? null,
      active: true,
    };
    if (existing) {
      if (APPLY) await prisma.matiere.update({ where: { id: existing.id }, data });
      matUpdated++;
    } else {
      if (APPLY) await prisma.matiere.create({ data });
      matCreated++;
    }
  }
  console.log(`  Matières  → créées : ${matCreated} · mises à jour : ${matUpdated}`);

  // ── 3. Matières hors référentiel → suppression cascade ─────────────────────
  const obsoletes = (await prisma.matiere.findMany({
    where: { etablissement_id: etabId },
    select: { id: true, nom_fr: true, filiere_ref: { select: { code: true } } },
  })).map(m => ({ id: m.id, nom_fr: m.nom_fr, filiere: m.filiere_ref.code }))
    .filter(m => !lgmNames.has(`${m.nom_fr}|${m.filiere}`));

  if (obsoletes.length === 0) {
    console.log('  Obsolètes → aucune');
    return;
  }

  const ids = obsoletes.map(m => m.id);
  const [nbNotesEval, nbEvals, nbNotes, nbCreneaux, nbClasseMat, nbProfMat] = await Promise.all([
    prisma.noteEvaluation.count({ where: { evaluation: { matiere_id: { in: ids } } } }),
    prisma.evaluation.count({ where: { matiere_id: { in: ids } } }),
    prisma.note.count({ where: { matiere_id: { in: ids } } }),
    prisma.creneau.count({ where: { matiere_id: { in: ids } } }),
    prisma.classeMatiere.count({ where: { matiere_id: { in: ids } } }),
    prisma.personnelMatiereClasse.count({ where: { matiere_id: { in: ids } } }),
  ]);

  console.log(`  Obsolètes → ${obsoletes.length} matière(s) à supprimer :`);
  for (const m of obsoletes) console.log(`              · ${m.nom_fr} (${m.filiere})`);
  console.log(`              Données liées :`);
  console.log(`              · NoteEvaluation        : ${nbNotesEval}`);
  console.log(`              · Evaluation            : ${nbEvals}`);
  console.log(`              · Note                  : ${nbNotes}`);
  console.log(`              · Creneau               : ${nbCreneaux}`);
  console.log(`              · ClasseMatiere         : ${nbClasseMat}`);
  console.log(`              · PersonnelMatiereClasse: ${nbProfMat}`);

  if (!APPLY) return;

  await prisma.$transaction(async tx => {
    await tx.noteEvaluation.deleteMany({ where: { evaluation: { matiere_id: { in: ids } } } });
    await tx.evaluation.deleteMany({ where: { matiere_id: { in: ids } } });
    await tx.note.deleteMany({ where: { matiere_id: { in: ids } } });
    await tx.creneau.deleteMany({ where: { matiere_id: { in: ids } } });
    await tx.classeMatiere.deleteMany({ where: { matiere_id: { in: ids } } });
    await tx.personnelMatiereClasse.deleteMany({ where: { matiere_id: { in: ids } } });
    await tx.matiere.deleteMany({ where: { id: { in: ids } } });
  });
  console.log(`              ✅ Supprimées (cascade appliqué)`);
}

async function main() {
  console.log(`\n🏫  DaaraGest — Migration référentiel LGM (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`);
  if (!APPLY) {
    console.log('ℹ️  Mode dry-run. Aucune écriture. Ajoute --apply pour exécuter.\n');
  }

  const etablissements = await prisma.etablissement.findMany({ select: { id: true, nom_fr: true } });
  if (etablissements.length === 0) {
    console.log('Aucun établissement trouvé. Rien à faire.\n');
    return;
  }

  for (const etab of etablissements) {
    await migrerEtablissement(etab.id, etab.nom_fr);
  }

  console.log(`\n✅ Migration ${APPLY ? 'appliquée' : '(simulation terminée — relance avec --apply)'}\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
