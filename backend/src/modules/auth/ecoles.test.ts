import { describe, it, expect } from 'vitest';
import { filtrerEcoles, normaliser } from './ecoles';

const ECOLES = [
  { code: 'CAAM', nom_fr: 'École Privée Sociale Franco-Arabe Cheikh Abdoul Ahad Mbacké - F.I.C.A.A.M' },
  { code: 'DIOP2', nom_fr: 'Institut Diop de Thiès' },
  { code: 'ECM', nom_fr: 'École Coranique Moderne' },
];
const codes = (q: string) => filtrerEcoles(ECOLES, q).map(e => e.code);

describe('Recherche d\'école à la connexion', () => {
  it('normalise accents, casse et ponctuation', () => {
    expect(normaliser('  F.I.C.A.A.M. — École ')).toBe('f i c a a m ecole');
  });
  it('rien en dessous de 3 caractères : la liste complète n\'est jamais publiée', () => {
    expect(codes('')).toEqual([]);
    expect(codes('éc')).toEqual([]);
    expect(codes(' . ')).toEqual([]);
  });
  it('trouve par mots du nom, sans accents ni ordre imposé', () => {
    expect(codes('cheikh mbacke')).toEqual(['CAAM']);
    expect(codes('thies diop')).toEqual(['DIOP2']);
    expect(codes('Ecole').sort()).toEqual(['CAAM', 'ECM']);
  });
  it('trouve un sigle écrit avec ou sans points, et le code', () => {
    expect(codes('ficaam')).toEqual(['CAAM']);
    expect(codes('caam')).toEqual(['CAAM']);
    expect(codes('dio')).toEqual(['DIOP2']);
  });
  it('le code exact passe en tête', () => {
    expect(codes('ECM')[0]).toBe('ECM');
  });
  it('limite le nombre de résultats', () => {
    const beaucoup = Array.from({ length: 20 }, (_, i) => ({ code: `E${i}`, nom_fr: `École ${i}` }));
    expect(filtrerEcoles(beaucoup, 'ecole')).toHaveLength(8);
  });
  it('aucune correspondance → liste vide', () => {
    expect(codes('lycée inexistant')).toEqual([]);
  });
});
