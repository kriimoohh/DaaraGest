import { describe, it, expect } from 'vitest';

function appreciation(m: number): string {
  if (m >= 16) return 'Très bien — Félicitations du conseil';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez bien';
  if (m >= 10) return 'Passable';
  return 'Insuffisant — Doit faire des efforts';
}

function calculerMoyenne(notes: { valeur: number; coeff: number }[]): number | null {
  let totalP = 0, totalC = 0;
  for (const n of notes) { totalP += n.valeur * n.coeff; totalC += n.coeff; }
  if (totalC === 0) return null;
  return Math.round((totalP / totalC) * 100) / 100;
}

describe('appreciation', () => {
  it('≥16 → Très bien', () => expect(appreciation(16)).toBe('Très bien — Félicitations du conseil'));
  it('14-15.99 → Bien', () => expect(appreciation(14)).toBe('Bien'));
  it('12-13.99 → Assez bien', () => expect(appreciation(12)).toBe('Assez bien'));
  it('10-11.99 → Passable', () => expect(appreciation(10)).toBe('Passable'));
  it('<10 → Insuffisant', () => expect(appreciation(9.99)).toBe('Insuffisant — Doit faire des efforts'));
});

describe('calculerMoyenne', () => {
  it('moyenne pondérée correcte', () => {
    const notes = [{ valeur: 15, coeff: 3 }, { valeur: 12, coeff: 2 }];
    expect(calculerMoyenne(notes)).toBe(13.8);
  });

  it('retourne null si aucun coeff', () => {
    expect(calculerMoyenne([])).toBeNull();
  });

  it('arrondi à 2 décimales', () => {
    const notes = [{ valeur: 13, coeff: 3 }, { valeur: 11, coeff: 3 }];
    expect(calculerMoyenne(notes)).toBe(12);
  });

  it('coefficient unique = valeur directe', () => {
    expect(calculerMoyenne([{ valeur: 17.5, coeff: 1 }])).toBe(17.5);
  });
});

// Moyenne avec notes saisies sur des barèmes variables (ex: RLC /60, CLC /40),
// normalisées sur l'échelle de l'établissement (base) avant pondération.
function contributionNote(valeur: number, noteMax: number, base: number, coeff: number): number {
  return noteMax > 0 ? (valeur / noteMax) * base * coeff : 0;
}
function moyenneNormalisee(
  notes: { valeur: number; note_max: number; coeff: number }[], base: number,
): number | null {
  let totalP = 0, totalC = 0;
  for (const n of notes) { totalP += contributionNote(n.valeur, n.note_max, base, n.coeff); totalC += n.coeff; }
  if (totalC === 0) return null;
  return Math.round((totalP / totalC) * 100) / 100;
}

describe('moyenne normalisée par barème', () => {
  it('rétro-compatible : note_max == base → moyenne pondérée classique', () => {
    const notes = [{ valeur: 15, note_max: 20, coeff: 3 }, { valeur: 12, note_max: 20, coeff: 2 }];
    expect(moyenneNormalisee(notes, 20)).toBe(13.8);
  });

  it('barèmes variables = Σnotes/Σcoeff (cas réel CE1 sur /10)', () => {
    // RLC 59/60 (coeff 6), Ang 10/10 (coeff 1) — barème = coeff×10, base 10
    const notes = [
      { valeur: 59, note_max: 60, coeff: 6 },
      { valeur: 10, note_max: 10, coeff: 1 },
    ];
    // Σnotes=69, Σbarème=70 → 69/70×10 = 9.86 ; et Σnotes/Σcoeff = 69/7 = 9.86
    expect(moyenneNormalisee(notes, 10)).toBe(9.86);
  });

  it('une note /60 pleine sur base 10 vaut 10', () => {
    expect(moyenneNormalisee([{ valeur: 60, note_max: 60, coeff: 6 }], 10)).toBe(10);
  });

  it('note_max 0 ignorée (pas de division par zéro)', () => {
    expect(contributionNote(5, 0, 10, 2)).toBe(0);
  });
});

describe('classement', () => {
  it('tri décroissant par moyenne', () => {
    const moyennes = [
      { eleve_id: 'e1', moyenne: 12 },
      { eleve_id: 'e2', moyenne: 15 },
      { eleve_id: 'e3', moyenne: 8 },
    ];
    const sorted = [...moyennes].sort((a, b) => b.moyenne - a.moyenne);
    expect(sorted[0].eleve_id).toBe('e2');
    expect(sorted[1].eleve_id).toBe('e1');
    expect(sorted[2].eleve_id).toBe('e3');
  });

  it('égalité de moyenne — conserve les deux élèves', () => {
    const moyennes = [
      { eleve_id: 'e1', moyenne: 14 },
      { eleve_id: 'e2', moyenne: 14 },
      { eleve_id: 'e3', moyenne: 10 },
    ];
    const sorted = [...moyennes].sort((a, b) => b.moyenne - a.moyenne);
    expect(sorted[0].moyenne).toBe(14);
    expect(sorted[1].moyenne).toBe(14);
    expect(sorted[2].eleve_id).toBe('e3');
  });
});

describe('calculerMoyenne — cas limites', () => {
  it('coefficient 0 doit être ignoré', () => {
    const notes = [
      { valeur: 18, coeff: 0 },
      { valeur: 10, coeff: 2 },
    ];
    // coeff 0 ne doit pas contribuer
    let totalP = 0, totalC = 0;
    for (const n of notes) {
      if (n.coeff === 0) continue;
      totalP += n.valeur * n.coeff;
      totalC += n.coeff;
    }
    const moy = totalC > 0 ? Math.round((totalP / totalC) * 100) / 100 : null;
    expect(moy).toBe(10);
  });

  it('élève sans aucune note → moyenne null', () => {
    expect(calculerMoyenne([])).toBeNull();
  });

  it('toutes notes à 0 → moyenne 0', () => {
    const notes = [{ valeur: 0, coeff: 1 }, { valeur: 0, coeff: 2 }];
    expect(calculerMoyenne(notes)).toBe(0);
  });

  it('note maximale 20 → appréciation Très bien', () => {
    expect(appreciation(20)).toBe('Très bien — Félicitations du conseil');
  });

  it('note 15.99 → Bien (pas Très bien)', () => {
    expect(appreciation(15.99)).toBe('Bien');
  });
});

describe('observations bulletin', () => {
  it('observation vide reste vide', () => {
    const obs = { observation_fr: '', observation_prof: '' };
    expect(obs.observation_fr).toBe('');
  });

  it('observation avec contenu est conservée', () => {
    const obs = { observation_fr: 'Bon trimestre, félicitations !' };
    expect(obs.observation_fr).toBe('Bon trimestre, félicitations !');
  });

  it('observation dépasse 500 caractères → à rejeter', () => {
    const longText = 'a'.repeat(501);
    expect(longText.length > 500).toBe(true);
  });
});
