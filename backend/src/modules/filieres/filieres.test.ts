import { describe, it, expect } from 'vitest';
import { filiereCreateSchema, filiereUpdateSchema, FILIERE_CODES, FILIERE_DEFAULTS } from './filieres.schema';

describe('Filières — schéma', () => {
  it('accepte les 3 codes FR/AR/EN', () => {
    for (const c of FILIERE_CODES) {
      expect(filiereCreateSchema.safeParse({ code: c }).success).toBe(true);
    }
  });

  it('rejette un code hors liste', () => {
    expect(filiereCreateSchema.safeParse({ code: 'ES' }).success).toBe(false);
    expect(filiereCreateSchema.safeParse({}).success).toBe(false);
  });

  it('défauts cohérents par code (AR = ar/RTL, EN = en/LTR, FR = fr/LTR)', () => {
    expect(FILIERE_DEFAULTS.AR.langue).toBe('ar');
    expect(FILIERE_DEFAULTS.AR.sens_ecriture).toBe('RTL');
    expect(FILIERE_DEFAULTS.EN.langue).toBe('en');
    expect(FILIERE_DEFAULTS.EN.sens_ecriture).toBe('LTR');
    expect(FILIERE_DEFAULTS.FR.sens_ecriture).toBe('LTR');
  });

  it("l'update ignore le champ code (clé stable, non modifiable)", () => {
    const r = filiereUpdateSchema.safeParse({ code: 'FR', nom_fr: 'Renommée' });
    expect(r.success).toBe(true);
    if (r.success) expect('code' in r.data).toBe(false);
  });
});

// Garde-fous purs répliquant la logique du service (suppression / désactivation).
describe('Filières — garde-fous', () => {
  const peutSupprimer = (nbClasses: number, nbMatieres: number) => nbClasses + nbMatieres === 0;
  const peutDesactiver = (autresActives: number) => autresActives > 0;

  it('suppression interdite si des classes ou matières la référencent', () => {
    expect(peutSupprimer(2, 0)).toBe(false);
    expect(peutSupprimer(0, 3)).toBe(false);
    expect(peutSupprimer(0, 0)).toBe(true);
  });

  it('désactivation interdite si c\'est la dernière filière active', () => {
    expect(peutDesactiver(0)).toBe(false);
    expect(peutDesactiver(1)).toBe(true);
  });
});
