/**
 * Boîte à outils partagée des scripts d'import LGM → DaaraGest.
 *
 * Chaque script d'import (00-config, 01-classes, …) tourne en DRY-RUN par défaut
 * et n'écrit en base qu'avec `--apply`. Les scripts sont idempotents (upsert) et
 * échangent leurs correspondances de clés via `_mapping.json`.
 *
 *   tsx prisma/lgm/00-config.ts            # dry-run
 *   tsx prisma/lgm/00-config.ts --apply    # exécute
 */
import { PrismaClient } from '@prisma/client';
import { parseFile } from 'fast-csv';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const prisma = new PrismaClient();
export const APPLY = process.argv.includes('--apply');

export const DATA_DIR = join(__dirname, '..', 'data', 'lgm');
const MAPPING_FILE = join(DATA_DIR, '_mapping.json');

// ── Constantes de correspondance LGM → DaaraGest ────────────────────────────

/** Année scolaire LGM ("2024/2025") → libellé DaaraGest ("2024-2025"). */
export const anneeLibelle = (lgm: string) => lgm.replace('/', '-');

/** Code semestre LGM → numéro de période DaaraGest (1|2|3). */
export const PERIODE_MAP: Record<string, number> = {
  '1/2/4': 1, // 1er Trimestre
  '1/2/5': 2, // 2éme Trimestre
  '1/2/6': 3, // 3éme Trimestre
};

/** Échelle de notation de l'établissement pour le préscolaire/élémentaire. */
export const NOTE_MAX = 10;

/** Niveau (libellé) → groupe de grille IEF. */
export const NIVEAU_GROUPE: Record<string, string> = {
  CI: 'CI_CP', CP: 'CI_CP',
  CE1: 'CE1_CE2', CE2: 'CE1_CE2',
  CM1: 'CM1_CM2', CM2: 'CM1_CM2',
  'Petite Section': 'AUTRE', 'Moyenne Section': 'AUTRE', 'Grande Section': 'AUTRE',
};

/** Filière déduite du nom de classe LGM ("CE1 A - Arabe" → AR). */
export const filiereDeNom = (nom: string): 'FR' | 'AR' =>
  /arabe/i.test(nom) ? 'AR' : 'FR';

// ── Chargement CSV (fast-csv, robuste aux champs quotés) ─────────────────────

export function loadCsv(name: string): Promise<Record<string, string>[]> {
  const file = join(DATA_DIR, name);
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    parseFile(file, { headers: true, ignoreEmpty: true })
      .on('error', reject)
      .on('data', (r: Record<string, string>) => rows.push(r))
      .on('end', () => resolve(rows));
  });
}

/** Lignes non supprimées (CT_SUPPRIMER = '0'). */
export const actives = (rows: Record<string, string>[]) =>
  rows.filter(r => r.CT_SUPPRIMER === '0');

// ── Établissement cible ─────────────────────────────────────────────────────

export async function getEtab() {
  const etab = await prisma.etablissement.findFirst({ select: { id: true, nom_fr: true, code: true } });
  if (!etab) throw new Error('Aucun établissement en base — lancer le seed d’abord.');
  return etab;
}

// ── Table de correspondance partagée entre phases ───────────────────────────

export interface LgmMapping {
  /** code classe LGM + "@" + libellé année DaaraGest → id Classe DaaraGest */
  classes: Record<string, string>;
  /** code matière LGM → id Matiere DaaraGest */
  matieres: Record<string, string>;
  /** code élève LGM → id Eleve DaaraGest */
  eleves: Record<string, string>;
  /** libellé année DaaraGest → id AnneeScolaire */
  annees: Record<string, string>;
}

export function loadMapping(): LgmMapping {
  if (existsSync(MAPPING_FILE)) return JSON.parse(readFileSync(MAPPING_FILE, 'utf-8'));
  return { classes: {}, matieres: {}, eleves: {}, annees: {} };
}

export function saveMapping(m: LgmMapping) {
  if (APPLY) writeFileSync(MAPPING_FILE, JSON.stringify(m, null, 2));
}

// ── Logs ────────────────────────────────────────────────────────────────────

export const header = (s: string) =>
  console.log(`\n━━━ ${s} ${APPLY ? '' : '(DRY-RUN — relancer avec --apply pour écrire)'} ━━━`);

export const done = async () => { await prisma.$disconnect(); };
