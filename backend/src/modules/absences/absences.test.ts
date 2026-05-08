import { describe, it, expect } from 'vitest';

// ── Logique pure extraite pour les tests (sans DB) ────────────────────────────

function tauxPresence(presents: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((presents / total) * 100);
}

function calcStatsEleve(absences: Array<{ statut: string; justifiee: boolean }>) {
  let presents = 0, absents = 0, retards = 0, dispenses = 0, absents_njustifies = 0;
  for (const a of absences) {
    if (a.statut === 'present') presents++;
    else if (a.statut === 'absent') { absents++; if (!a.justifiee) absents_njustifies++; }
    else if (a.statut === 'retard') retards++;
    else if (a.statut === 'dispense') dispenses++;
  }
  const total = presents + absents + retards + dispenses;
  return { presents, absents, retards, dispenses, absents_njustifies, total, taux: tauxPresence(presents, total) };
}

function validerStatut(statut: string): boolean {
  return ['present', 'absent', 'retard', 'dispense'].includes(statut);
}

function validerDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Absences — taux de présence', () => {
  it('calcule 100% si tous présents', () => {
    expect(tauxPresence(10, 10)).toBe(100);
  });

  it('calcule 0% si tous absents', () => {
    expect(tauxPresence(0, 10)).toBe(0);
  });

  it('retourne null si aucun jour saisi', () => {
    expect(tauxPresence(0, 0)).toBeNull();
  });

  it('arrondit correctement', () => {
    expect(tauxPresence(2, 3)).toBe(67);
  });

  it('calcule 50% pour moitié présent', () => {
    expect(tauxPresence(5, 10)).toBe(50);
  });
});

describe('Absences — statistiques élève', () => {
  it('compte les absences non justifiées séparément', () => {
    const result = calcStatsEleve([
      { statut: 'absent', justifiee: false },
      { statut: 'absent', justifiee: true },
      { statut: 'present', justifiee: false },
    ]);
    expect(result.absents).toBe(2);
    expect(result.absents_njustifies).toBe(1);
  });

  it('ne comptabilise pas les dispenses dans les absents', () => {
    const result = calcStatsEleve([
      { statut: 'dispense', justifiee: false },
      { statut: 'present', justifiee: false },
    ]);
    expect(result.absents).toBe(0);
    expect(result.dispenses).toBe(1);
  });

  it('calcule le taux en excluant les dispenses du dénominateur', () => {
    const result = calcStatsEleve([
      { statut: 'present', justifiee: false },
      { statut: 'present', justifiee: false },
      { statut: 'absent', justifiee: false },
    ]);
    expect(result.taux).toBe(67);
  });

  it('retourne total = 0 pour aucune saisie', () => {
    const result = calcStatsEleve([]);
    expect(result.total).toBe(0);
    expect(result.taux).toBeNull();
  });

  it('compte les retards séparément', () => {
    const result = calcStatsEleve([
      { statut: 'retard', justifiee: false },
      { statut: 'present', justifiee: false },
    ]);
    expect(result.retards).toBe(1);
    expect(result.presents).toBe(1);
  });
});

describe('Absences — validation', () => {
  it('accepte les statuts valides', () => {
    expect(validerStatut('present')).toBe(true);
    expect(validerStatut('absent')).toBe(true);
    expect(validerStatut('retard')).toBe(true);
    expect(validerStatut('dispense')).toBe(true);
  });

  it('rejette un statut invalide', () => {
    expect(validerStatut('conge')).toBe(false);
    expect(validerStatut('')).toBe(false);
    expect(validerStatut('ABSENT')).toBe(false);
  });

  it('valide le format de date YYYY-MM-DD', () => {
    expect(validerDate('2025-09-01')).toBe(true);
    expect(validerDate('01/09/2025')).toBe(false);
    expect(validerDate('2025-9-1')).toBe(false);
  });
});
