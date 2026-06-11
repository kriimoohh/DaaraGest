/**
 * Phase 0 — Configuration de l'établissement pour l'import LGM.
 *
 *  1. Échelle de notation /10 (ConfigNotes.note_max + seuils de mention /10).
 *  2. Grille de mentions /10 (table Mention) reprise de ref_mentions LGM.
 *  3. Années scolaires 2024-2025 et 2025-2026.
 *  4. Niveaux CI→CM2 avec leur groupe_grille IEF (CI_CP / CE1_CE2 / CM1_CM2).
 *
 * Idempotent (upsert). DRY-RUN par défaut ; --apply pour écrire.
 */
import {
  prisma, APPLY, getEtab, header, done, NOTE_MAX, NIVEAU_GROUPE,
  loadMapping, saveMapping,
} from './lib';

// Grille /10 (échelle préscolaire/élémentaire LGM), seuil_min croissant.
const MENTIONS_10 = [
  { libelle_fr: 'Médiocre',     seuil_min: 0,  couleur: 'error',   ordre: 1 },
  { libelle_fr: 'Avertissement', seuil_min: 4, couleur: 'error',   ordre: 2 },
  { libelle_fr: 'Passable',     seuil_min: 5,  couleur: 'warning', ordre: 3 },
  { libelle_fr: 'Assez bien',   seuil_min: 6,  couleur: 'info',    ordre: 4 },
  { libelle_fr: 'Bien',         seuil_min: 8,  couleur: 'success', ordre: 5 },
  { libelle_fr: 'Très bien',    seuil_min: 10, couleur: 'success', ordre: 6 },
];

// Niveaux à garantir (avec groupe_grille). Ordre = progression scolaire.
const NIVEAUX = [
  { libelle: 'Petite Section', ordre: 1 }, { libelle: 'Moyenne Section', ordre: 2 },
  { libelle: 'Grande Section', ordre: 3 }, { libelle: 'CI', ordre: 4 },
  { libelle: 'CP', ordre: 5 }, { libelle: 'CE1', ordre: 6 }, { libelle: 'CE2', ordre: 7 },
  { libelle: 'CM1', ordre: 8 }, { libelle: 'CM2', ordre: 9 },
];

const ANNEES = [
  { libelle: '2024-2025', debut: '2024-09-01', fin: '2025-08-31' },
  { libelle: '2025-2026', debut: '2025-09-01', fin: '2026-08-31' },
];

async function main() {
  const etab = await getEtab();
  header(`Phase 0 — Config · ${etab.nom_fr}`);
  const mapping = loadMapping();

  // ── 1. Échelle /10 + seuils de mention /10 ────────────────────────────────
  const cfg = await prisma.configNotes.findUnique({ where: { etablissement_id: etab.id } });
  console.log(`\n[1] ConfigNotes : note_max ${cfg?.note_max} → ${NOTE_MAX}`);
  if (APPLY) {
    await prisma.configNotes.update({
      where: { etablissement_id: etab.id },
      data: {
        note_max: NOTE_MAX, note_min: 0,
        seuil_passable: 5, seuil_assez_bien: 6, seuil_bien: 8, seuil_tres_bien: 10,
        seuil_note_insuffisante: 5,
      },
    });
  }

  // ── 2. Mentions /10 ───────────────────────────────────────────────────────
  console.log(`[2] Mentions /10 : ${MENTIONS_10.length} (upsert par seuil_min)`);
  for (const m of MENTIONS_10) {
    console.log(`      ${m.seuil_min.toString().padStart(2)} → ${m.libelle_fr}`);
    if (APPLY) {
      await prisma.mention.upsert({
        where: { etablissement_id_seuil_min: { etablissement_id: etab.id, seuil_min: m.seuil_min } },
        update: { libelle_fr: m.libelle_fr, couleur: m.couleur, ordre: m.ordre, is_system: true },
        create: { etablissement_id: etab.id, ...m, is_system: true },
      });
    }
  }

  // ── 3. Années scolaires ───────────────────────────────────────────────────
  console.log('[3] Années scolaires :');
  for (const a of ANNEES) {
    let an = await prisma.anneeScolaire.findFirst({
      where: { etablissement_id: etab.id, libelle: a.libelle }, select: { id: true },
    });
    if (an) {
      console.log(`      ${a.libelle} — existe`);
    } else {
      console.log(`      ${a.libelle} — à créer`);
      if (APPLY) {
        an = await prisma.anneeScolaire.create({
          data: {
            etablissement_id: etab.id, libelle: a.libelle,
            date_debut: new Date(a.debut), date_fin: new Date(a.fin), active: false,
          },
          select: { id: true },
        });
      }
    }
    if (an) mapping.annees[a.libelle] = an.id;
  }

  // ── 4. Niveaux + groupe_grille ────────────────────────────────────────────
  console.log('[4] Niveaux (groupe_grille) :');
  for (const n of NIVEAUX) {
    const groupe = NIVEAU_GROUPE[n.libelle] ?? 'AUTRE';
    console.log(`      ${n.libelle.padEnd(16)} → ${groupe}`);
    if (APPLY) {
      await prisma.niveau.upsert({
        where: { etablissement_id_libelle: { etablissement_id: etab.id, libelle: n.libelle } },
        update: { ordre: n.ordre, groupe_grille: groupe },
        create: { etablissement_id: etab.id, libelle: n.libelle, ordre: n.ordre, groupe_grille: groupe },
      });
    }
  }

  saveMapping(mapping);
  console.log(`\n✅ Phase 0 ${APPLY ? 'appliquée' : 'simulée'}.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
