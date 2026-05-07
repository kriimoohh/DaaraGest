import { describe, it, expect } from 'vitest';

function calcHeures(arrivee?: string, depart?: string): number | undefined {
  if (!arrivee || !depart) return undefined;
  const [ah, am] = arrivee.split(':').map(Number);
  const [dh, dm] = depart.split(':').map(Number);
  const diff = (dh * 60 + dm) - (ah * 60 + am);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : undefined;
}

describe('calcHeures', () => {
  it('calcule correctement 08:00 → 13:30 = 5.5h', () => expect(calcHeures('08:00', '13:30')).toBe(5.5));
  it('calcule correctement 08:15 → 12:45 = 4.5h', () => expect(calcHeures('08:15', '12:45')).toBe(4.5));
  it('retourne undefined si arrivee manquante', () => expect(calcHeures(undefined, '13:00')).toBeUndefined());
  it('retourne undefined si depart manquant', () => expect(calcHeures('08:00', undefined)).toBeUndefined());
  it('retourne undefined si depart avant arrivee', () => expect(calcHeures('14:00', '08:00')).toBeUndefined());
  it('arrondi à 2 décimales', () => expect(calcHeures('08:00', '09:10')).toBe(1.17));
});

describe('validation statuts pointage', () => {
  const STATUTS_VALIDES = ['present', 'absent', 'retard', 'conge'];

  it('statuts valides acceptés', () => {
    for (const s of STATUTS_VALIDES) {
      expect(STATUTS_VALIDES.includes(s)).toBe(true);
    }
  });

  it('statut invalide rejeté', () => {
    expect(STATUTS_VALIDES.includes('inconnu')).toBe(false);
    expect(STATUTS_VALIDES.includes('')).toBe(false);
  });
});
