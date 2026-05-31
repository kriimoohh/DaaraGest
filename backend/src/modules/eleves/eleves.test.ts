import { describe, it, expect } from 'vitest';

function genererMatricule(code: string, yy: string, count: number): string {
  return `${code}-E-${yy}-${String(count + 1).padStart(3, '0')}`;
}

function genererMatriculePersonnel(code: string, yy: string, count: number): string {
  return `${code}-P-${yy}-${String(count + 1).padStart(3, '0')}`;
}

describe('genererMatricule élève', () => {
  it('format CODE-E-AA-NNN', () => expect(genererMatricule('FIC', '26', 0)).toBe('FIC-E-26-001'));
  it('padding sur 3 chiffres', () => expect(genererMatricule('FIC', '26', 9)).toBe('FIC-E-26-010'));
  it('matricule 100+', () => expect(genererMatricule('FIC', '26', 99)).toBe('FIC-E-26-100'));
  it('incrémente à partir du count', () => {
    expect(genererMatricule('FIC', '26', 5)).toBe('FIC-E-26-006');
    expect(genererMatricule('TBK', '25', 14)).toBe('TBK-E-25-015');
  });
});

describe('genererMatricule personnel', () => {
  it('format CODE-P-AA-NNN', () => expect(genererMatriculePersonnel('FIC', '26', 0)).toBe('FIC-P-26-001'));
  it('type P bien présent', () => expect(genererMatriculePersonnel('FIC', '26', 4)).toBe('FIC-P-26-005'));
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
