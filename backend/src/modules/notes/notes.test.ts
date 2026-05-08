import { describe, it, expect } from 'vitest';

// ── Logique pure extraite pour tests sans DB ──────────────────────────────────

function validerNote(valeur: number, noteMin: number, noteMax: number): boolean {
  return valeur >= noteMin && valeur <= noteMax;
}

function estPeriodeValide(periode: number): boolean {
  return Number.isInteger(periode) && periode >= 1 && periode <= 3;
}

type NoteInput = { eleve_id: string; matiere_id: string; periode: number; valeur: number };

function filtrerInsertOnly(
  notes: NoteInput[],
  existants: Set<string>,
): { aInserer: NoteInput[]; aIgnorer: NoteInput[] } {
  const aInserer: NoteInput[] = [];
  const aIgnorer: NoteInput[] = [];
  for (const n of notes) {
    const key = `${n.eleve_id}:${n.matiere_id}:${n.periode}`;
    if (existants.has(key)) aIgnorer.push(n);
    else aInserer.push(n);
  }
  return { aInserer, aIgnorer };
}

function genererCleUnique(eleve_id: string, matiere_id: string, periode: number, annee_scolaire_id: string): string {
  return `${eleve_id}:${matiere_id}:${periode}:${annee_scolaire_id}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Notes — validation valeur', () => {
  it('accepte une note dans la plage 0-20', () => {
    expect(validerNote(15, 0, 20)).toBe(true);
  });

  it('accepte 0 (borne inférieure)', () => {
    expect(validerNote(0, 0, 20)).toBe(true);
  });

  it('accepte 20 (borne supérieure)', () => {
    expect(validerNote(20, 0, 20)).toBe(true);
  });

  it('rejette une note supérieure à note_max', () => {
    expect(validerNote(21, 0, 20)).toBe(false);
  });

  it('rejette une note inférieure à note_min', () => {
    expect(validerNote(-1, 0, 20)).toBe(false);
  });

  it('accepte une note pour matière arabe (plage 0-10)', () => {
    expect(validerNote(8.5, 0, 10)).toBe(true);
  });

  it('rejette 11 dans une plage 0-10', () => {
    expect(validerNote(11, 0, 10)).toBe(false);
  });
});

describe('Notes — validation période', () => {
  it('accepte périodes 1, 2, 3', () => {
    expect(estPeriodeValide(1)).toBe(true);
    expect(estPeriodeValide(2)).toBe(true);
    expect(estPeriodeValide(3)).toBe(true);
  });

  it('rejette période 0', () => {
    expect(estPeriodeValide(0)).toBe(false);
  });

  it('rejette période 4', () => {
    expect(estPeriodeValide(4)).toBe(false);
  });

  it('rejette valeur non entière', () => {
    expect(estPeriodeValide(1.5)).toBe(false);
  });
});

describe('Notes — mode insertOnly (professeur)', () => {
  it('bloque la modification des notes existantes', () => {
    const existants = new Set(['e1:m1:1', 'e2:m1:1']);
    const notes: NoteInput[] = [
      { eleve_id: 'e1', matiere_id: 'm1', periode: 1, valeur: 18 },
      { eleve_id: 'e3', matiere_id: 'm1', periode: 1, valeur: 14 },
    ];
    const { aInserer, aIgnorer } = filtrerInsertOnly(notes, existants);
    expect(aInserer).toHaveLength(1);
    expect(aInserer[0].eleve_id).toBe('e3');
    expect(aIgnorer).toHaveLength(1);
    expect(aIgnorer[0].eleve_id).toBe('e1');
  });

  it('insère toutes les notes si aucune existante', () => {
    const existants = new Set<string>();
    const notes: NoteInput[] = [
      { eleve_id: 'e1', matiere_id: 'm1', periode: 1, valeur: 15 },
      { eleve_id: 'e2', matiere_id: 'm1', periode: 1, valeur: 12 },
    ];
    const { aInserer } = filtrerInsertOnly(notes, existants);
    expect(aInserer).toHaveLength(2);
  });

  it('ignore toutes les notes si toutes existantes', () => {
    const existants = new Set(['e1:m1:1', 'e2:m1:1']);
    const notes: NoteInput[] = [
      { eleve_id: 'e1', matiere_id: 'm1', periode: 1, valeur: 18 },
      { eleve_id: 'e2', matiere_id: 'm1', periode: 1, valeur: 14 },
    ];
    const { aInserer, aIgnorer } = filtrerInsertOnly(notes, existants);
    expect(aInserer).toHaveLength(0);
    expect(aIgnorer).toHaveLength(2);
  });
});

describe('Notes — clé d\'unicité', () => {
  it('génère la clé correcte', () => {
    const key = genererCleUnique('e1', 'm1', 1, 'a2025');
    expect(key).toBe('e1:m1:1:a2025');
  });

  it('deux notes différentes par période → clés différentes', () => {
    const k1 = genererCleUnique('e1', 'm1', 1, 'a2025');
    const k2 = genererCleUnique('e1', 'm1', 2, 'a2025');
    expect(k1).not.toBe(k2);
  });

  it('deux élèves mêmes matière+période → clés différentes', () => {
    const k1 = genererCleUnique('e1', 'm1', 1, 'a2025');
    const k2 = genererCleUnique('e2', 'm1', 1, 'a2025');
    expect(k1).not.toBe(k2);
  });
});
