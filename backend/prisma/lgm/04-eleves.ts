/**
 * Phase 3 — Élèves & inscriptions.
 *
 * Importe les élèves actifs (matricule DaaraGest généré — le CT_NUMERO LGM n'est
 * pas unique) puis crée une inscription par (élève, année) en FUSIONNANT la
 * classe française et la classe arabe de la cohorte (classe_fr_id + classe_ar_id).
 *
 * Idempotent via _mapping.json (eleves : code LGM → id) : un ré-run met à jour
 * l'élève existant sans régénérer de matricule. DRY-RUN par défaut ; --apply.
 */
import {
  prisma, APPLY, getEtab, header, done, loadCsv, actives, anneeLibelle,
  filiereDeNom, loadMapping, saveMapping,
} from './lib';

/** "JJ/MM/AAAA" → Date (UTC) ou null si invalide. */
function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number) as unknown as number[];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

/** Matricule séquentiel <CODE>-E-<YY>-<NNN> (année courante), via MatriculeCounter. */
async function genMatricule(etabId: string, code: string): Promise<string> {
  const annee = String(new Date().getFullYear()).slice(-2);
  const c = await prisma.matriculeCounter.upsert({
    where: { etablissement_id_type_annee: { etablissement_id: etabId, type: 'E', annee } },
    create: { etablissement_id: etabId, type: 'E', annee, last_value: 1 },
    update: { last_value: { increment: 1 } },
  });
  return `${code}-E-${annee}-${String(c.last_value).padStart(3, '0')}`;
}

async function main() {
  const etab = await getEtab();
  header(`Phase 3 — Élèves & inscriptions · ${etab.nom_fr}`);
  const mapping = loadMapping();

  const eleves = actives(await loadCsv('eleves.csv'));
  const annees = new Map((await prisma.anneeScolaire.findMany({ where: { etablissement_id: etab.id } }))
    .map(a => [a.libelle, a.id]));
  const annLib = new Map((await loadCsv('ref_annees_scolaires.csv')).map(a => [a.CT_CODE_ANNEE_SCOLAIRE, a.CT_ANNEE_SCOLAIRE]));

  // ── 1. Élèves ─────────────────────────────────────────────────────────────
  let created = 0, updated = 0, badDate = 0;
  for (const e of eleves) {
    const dn = parseDate(e.CT_DATE_NAISSANCE);
    if (!dn) { badDate++; if (badDate <= 5) console.log(`   ⚠ date invalide « ${e.CT_DATE_NAISSANCE} » — ${e.CT_NOM} ${e.CT_PRENOM} (ignoré)`); continue; }
    const data = {
      nom_fr: e.CT_NOM.trim(), prenom_fr: e.CT_PRENOM.trim(),
      date_naissance: dn, lieu_naissance: e.CT_LIEU_NAISSANCE?.trim() || null,
      sexe: e.CT_SEXE === 'F' ? 'F' : 'M', actif: true,
    };
    const existingId = mapping.eleves[e.CT_CODE_ELEVE];
    if (existingId) {
      if (APPLY) await prisma.eleve.update({ where: { id: existingId }, data });
      updated++;
    } else if (APPLY) {
      const matricule = await genMatricule(etab.id, etab.code);
      const created_ = await prisma.eleve.create({
        data: { etablissement_id: etab.id, matricule, ...data }, select: { id: true },
      });
      mapping.eleves[e.CT_CODE_ELEVE] = created_.id;
      created++;
    } else created++;
  }
  console.log(`\n[1] Élèves → créés : ${created} · mis à jour : ${updated} · dates invalides : ${badDate}`);

  // ── 2. Inscriptions (fusion FR + AR) ──────────────────────────────────────
  const ce = actives(await loadCsv('classe_eleve.csv'));
  // (eleveLGM, anneeLGM) → { FR?: classeId, AR?: classeId }
  const insc = new Map<string, { FR?: string; AR?: string; eleve: string; an: string }>();
  let unmappedClasse = 0;
  for (const r of ce) {
    const anLib = anneeLibelle(annLib.get(r.CT_CODE_ANNEE_SCOLAIRE) ?? '');
    const filiere = filiereDeNom((await classeNom(r.CT_CODE_CLASSE)));
    const classeId = mapping.classes[`${r.CT_CODE_CLASSE}@${anLib}`];
    if (!classeId) { unmappedClasse++; continue; }
    const k = `${r.CT_CODE_ELEVE}|${anLib}`;
    const cur = insc.get(k) ?? { eleve: r.CT_CODE_ELEVE, an: anLib };
    cur[filiere] = classeId;
    insc.set(k, cur);
  }

  let iCreated = 0, iUpdated = 0, iSkipped = 0;
  for (const { FR, AR, eleve, an } of insc.values()) {
    const eleveId = mapping.eleves[eleve];
    const anneeId = annees.get(an);
    if (!eleveId || !anneeId) { iSkipped++; continue; }
    if (APPLY) {
      const existing = await prisma.inscription.findFirst({
        where: { eleve_id: eleveId, annee_scolaire_id: anneeId }, select: { id: true },
      });
      if (existing) {
        await prisma.inscription.update({ where: { id: existing.id }, data: { classe_fr_id: FR ?? null, classe_ar_id: AR ?? null } });
        iUpdated++;
      } else {
        await prisma.inscription.create({
          data: { eleve_id: eleveId, annee_scolaire_id: anneeId, classe_fr_id: FR ?? null, classe_ar_id: AR ?? null, statut: 'actif' },
        });
        iCreated++;
      }
    } else iCreated++;
  }
  console.log(`[2] Inscriptions → créées : ${iCreated} · mises à jour : ${iUpdated} · ignorées : ${iSkipped} · classes non mappées : ${unmappedClasse}`);

  saveMapping(mapping);
  console.log(`\n✅ Phase 3 ${APPLY ? 'appliquée' : 'simulée'} · ${Object.keys(mapping.eleves).length} élèves mappés.`);
}

// Cache des noms de classe LGM
let _classes: Map<string, string> | null = null;
async function classeNom(code: string): Promise<string> {
  if (!_classes) _classes = new Map(actives(await loadCsv('ref_classes.csv')).map(c => [c.CT_CODE_CLASSE, c.CT_NOM]));
  return _classes.get(code) ?? '';
}

main().catch(e => { console.error(e); process.exit(1); }).finally(done);
