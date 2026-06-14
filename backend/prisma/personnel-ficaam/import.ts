/**
 * Import PROD — Personnel FICAAM (roster Français + Arabe collecté via Google Forms).
 *
 * Source : prisma/data/personnel-ficaam.csv (32 lignes déjà nettoyées/mappées).
 * Cible  : l'établissement unique en base (DATABASE_URL=<url prod> pour la prod).
 *
 * Crée, pour chaque ligne, un Utilisateur (rôle de login « professeur ») + un
 * Personnel 1-1. La *fonction* (ENSEIGNANT / AGENT_ENTRETIEN) n'est qu'un attribut
 * descriptif — elle ne donne aucun droit ; tous les comptes ont le rôle professeur.
 *
 * DRY-RUN par défaut ; --apply pour écrire. Idempotent :
 *  - dédup sur les utilisateurs ACTIFS (nom_fr + prenom_fr, insensible casse/accents) ;
 *    un re-run ne recrée pas un personnel déjà actif.
 *  - les fiches soft-deletées (actif=false, identifiant suffixé `_deleted_…`) sont
 *    ignorées → un personnel supprimé puis re-listé est recréé en fiche neuve.
 *
 * Mot de passe commun temporaire + must_change_password=true (changement imposé à
 * la 1re connexion). Les identifiants générés sont exportés dans
 * `_credentials_ficaam.csv` (NON commité) à remettre à chaque agent.
 *
 *   tsx prisma/personnel-ficaam/import.ts             # dry-run
 *   DATABASE_URL=<url prod> tsx prisma/personnel-ficaam/import.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { parseFile } from 'fast-csv';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { genererMatricule } from '../../src/utils/matricule';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const CSV = join(__dirname, '..', 'data', 'personnel-ficaam.csv');
const CREDENTIALS_OUT = join(__dirname, '_credentials_ficaam.csv');

/** Mot de passe initial commun — respecte la policy (maj/min/chiffre/spécial/≥8). */
const MOT_DE_PASSE_INITIAL = 'Ficaam2026!';

interface Row {
  nom_fr: string; prenom_fr: string; sexe: string; fonction: string;
  specialite_fr: string; telephone: string; email: string; poste_fr: string;
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');

/** Clé de dédup : nom+prénom normalisés (insensible casse/accents/espaces). */
const personKey = (nom: string, prenom: string) => `${slug(nom)}|${slug(prenom)}`;

/** Identifiants forcés (cas où `premier-prénom.nom` n'est pas idéal), keyés personKey. */
const IDENTIFIANT_OVERRIDES: Record<string, string> = {
  'ndiaye|elhadjidame': 'elhadji.ndiaye', // « El Hadji Dame Ndiaye » → premier mot « El » trop court
};

function loadCsv(): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    parseFile(CSV, { headers: true, ignoreEmpty: true })
      .on('error', reject)
      .on('data', (r: Row) => rows.push(r))
      .on('end', () => resolve(rows));
  });
}

async function main() {
  console.log(`\n━━━ Import Personnel FICAAM ${APPLY ? '' : '(DRY-RUN — relancer avec --apply pour écrire)'} ━━━`);

  const etab = await prisma.etablissement.findFirst({ select: { id: true, code: true, nom_fr: true } });
  if (!etab) throw new Error('Aucun établissement en base.');

  const roleProf = await prisma.role.findFirst({ where: { libelle_fr: 'professeur' }, select: { id: true } });
  if (!roleProf) throw new Error('Rôle « professeur » introuvable.');

  const rows = await loadCsv();
  console.log(`Établissement : ${etab.nom_fr} (${etab.code}) · ${rows.length} lignes dans le CSV`);

  // ── Index des comptes ACTIFS pour la dédup (nom+prénom) ────────────────────
  const actifs = await prisma.utilisateur.findMany({
    where: { etablissement_id: etab.id, actif: true },
    select: { nom_fr: true, prenom_fr: true },
  });
  const actifsKeys = new Set(actifs.map(u => personKey(u.nom_fr, u.prenom_fr ?? '')));

  // ── Identifiants déjà pris (TOUS, actifs + supprimés) pour éviter collision ──
  const tousIdents = new Set(
    (await prisma.utilisateur.findMany({ where: { etablissement_id: etab.id }, select: { identifiant: true } }))
      .map(u => u.identifiant),
  );

  const hash = APPLY ? await bcrypt.hash(MOT_DE_PASSE_INITIAL, 10) : '';
  const credentials: { nom: string; prenom: string; identifiant: string; matricule: string }[] = [];
  let crees = 0, skipped = 0;

  for (const r of rows) {
    const key = personKey(r.nom_fr, r.prenom_fr);
    if (actifsKeys.has(key)) {
      console.log(`  ⏭️  SKIP  ${r.prenom_fr} ${r.nom_fr} — déjà actif en prod`);
      skipped++;
      continue;
    }

    // identifiant = <premier prénom>.<nom> (ou override), suffixe numérique si déjà pris
    const base = IDENTIFIANT_OVERRIDES[key] ?? `${slug(r.prenom_fr.split(' ')[0])}.${slug(r.nom_fr)}`;
    let identifiant = base, n = 2;
    while (tousIdents.has(identifiant)) identifiant = `${base}${n++}`;
    tousIdents.add(identifiant);

    const matricule = APPLY ? await genererMatricule(etab.id, 'P') : `CAAM-P-26-(auto)`;
    credentials.push({ nom: r.nom_fr, prenom: r.prenom_fr, identifiant, matricule });

    console.log(`  ✅ CRÉER ${r.prenom_fr} ${r.nom_fr} · ${r.fonction} · id=${identifiant} · mat=${matricule}`);

    if (APPLY) {
      const u = await prisma.utilisateur.create({
        data: {
          etablissement_id: etab.id,
          role_id: roleProf.id,
          nom_fr: r.nom_fr,
          prenom_fr: r.prenom_fr || null,
          sexe: r.sexe || null,
          identifiant,
          email: r.email || null,
          mot_de_passe: hash,
          must_change_password: true,
        },
      });
      await prisma.personnel.create({
        data: {
          utilisateur_id: u.id,
          matricule,
          fonction: r.fonction || 'ENSEIGNANT',
          specialite_fr: r.specialite_fr || null,
          telephone: r.telephone || null,
          poste_fr: r.poste_fr || null,
        },
      });
    }
    crees++;
  }

  console.log(`\nRésumé : ${crees} ${APPLY ? 'créés' : 'à créer'} · ${skipped} skippés (déjà actifs)`);

  if (APPLY && credentials.length) {
    const csv = ['nom,prenom,identifiant,matricule,mot_de_passe_initial']
      .concat(credentials.map(c => `${c.nom},${c.prenom},${c.identifiant},${c.matricule},${MOT_DE_PASSE_INITIAL}`))
      .join('\n');
    writeFileSync(CREDENTIALS_OUT, csv + '\n');
    console.log(`🔑 Identifiants exportés → ${CREDENTIALS_OUT} (mot de passe commun : ${MOT_DE_PASSE_INITIAL})`);
  } else if (!APPLY) {
    console.log(`(dry-run : aucune écriture · l'export des identifiants se fait avec --apply)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
