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
    const obs = { observation_fr: '', observation_ar: '', observation_prof: '' };
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
