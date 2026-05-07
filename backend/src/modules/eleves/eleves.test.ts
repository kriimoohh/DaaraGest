import { describe, it, expect } from 'vitest';

function genererMatricule(annee: number, count: number): string {
  return `DG-${annee}-${String(count + 1).padStart(3, '0')}`;
}

describe('genererMatricule', () => {
  it('format DG-YYYY-NNN', () => expect(genererMatricule(2025, 0)).toBe('DG-2025-001'));
  it('padding sur 3 chiffres', () => expect(genererMatricule(2025, 9)).toBe('DG-2025-010'));
  it('matricule 100+', () => expect(genererMatricule(2025, 99)).toBe('DG-2025-100'));
  it('incrémente à partir du count', () => {
    expect(genererMatricule(2025, 5)).toBe('DG-2025-006');
    expect(genererMatricule(2025, 14)).toBe('DG-2025-015');
  });
});

describe('validation élève', () => {
  function validateEleve(data: Record<string, string>) {
    const errors: string[] = [];
    if (!data.nom_fr?.trim()) errors.push('nom_fr requis');
    if (!data.prenom_fr?.trim()) errors.push('prenom_fr requis');
    if (!['M', 'F'].includes(data.sexe)) errors.push('sexe invalide');
    return errors;
  }

  it('élève valide — aucune erreur', () => {
    expect(validateEleve({ nom_fr: 'Fall', prenom_fr: 'Amadou', sexe: 'M' })).toHaveLength(0);
  });

  it('nom_fr manquant → erreur', () => {
    const errors = validateEleve({ nom_fr: '', prenom_fr: 'Amadou', sexe: 'M' });
    expect(errors).toContain('nom_fr requis');
  });

  it('sexe invalide → erreur', () => {
    const errors = validateEleve({ nom_fr: 'Fall', prenom_fr: 'Amadou', sexe: 'X' });
    expect(errors).toContain('sexe invalide');
  });
});
