import { describe, it, expect } from 'vitest';
import { classer } from './notes';

// NB : ces tests importent `classer` depuis le code de PRODUCTION (../utils/notes).
// Ne jamais recopier l'implémentation ici : un test qui valide sa propre copie
// laisse passer toutes les régressions du vrai code.

type Eleve = { eleve_id: string; moyenne: number | null };
const rangs = (rows: Array<Eleve & { rang: number | null }>) =>
  rows.map(r => [r.eleve_id, r.rang] as const);

describe('classer — convention compétition (1, 1, 3)', () => {
  it('attribue le même rang aux ex aequo et saute le rang suivant', () => {
    const res = classer(
      [
        { eleve_id: 'e1', moyenne: 12 },
        { eleve_id: 'e2', moyenne: 15 },
        { eleve_id: 'e3', moyenne: 8 },
        { eleve_id: 'e4', moyenne: 15 },
      ] as Eleve[],
      e => e.moyenne,
    );
    // e2 et e4 sont TOUS DEUX premiers ; e1 est 3ème (pas 2ème) ; e3 est 4ème.
    expect(rangs(res)).toEqual([['e2', 1], ['e4', 1], ['e1', 3], ['e3', 4]]);
  });

  it('trie lui-même : l’ordre d’entrée n’influence pas les rangs', () => {
    const attendu = [['a', 1], ['b', 1], ['c', 3]];
    const asc = classer([{ eleve_id: 'c', moyenne: 9 }, { eleve_id: 'a', moyenne: 14 }, { eleve_id: 'b', moyenne: 14 }] as Eleve[], e => e.moyenne);
    const desc = classer([{ eleve_id: 'b', moyenne: 14 }, { eleve_id: 'a', moyenne: 14 }, { eleve_id: 'c', moyenne: 9 }] as Eleve[], e => e.moyenne);
    expect(rangs(asc).map(([, r]) => r)).toEqual(attendu.map(([, r]) => r));
    expect(rangs(desc).map(([, r]) => r)).toEqual(attendu.map(([, r]) => r));
  });

  it('trois ex aequo en tête → 1, 1, 1, 4', () => {
    const res = classer(
      [
        { eleve_id: 'e1', moyenne: 10 },
        { eleve_id: 'e2', moyenne: 10 },
        { eleve_id: 'e3', moyenne: 10 },
        { eleve_id: 'e4', moyenne: 5 },
      ] as Eleve[],
      e => e.moyenne,
    );
    expect(res.map(r => r.rang)).toEqual([1, 1, 1, 4]);
  });

  it('ex aequo en milieu de classement', () => {
    const res = classer(
      [
        { eleve_id: 'e1', moyenne: 18 },
        { eleve_id: 'e2', moyenne: 12 },
        { eleve_id: 'e3', moyenne: 12 },
        { eleve_id: 'e4', moyenne: 4 },
      ] as Eleve[],
      e => e.moyenne,
    );
    expect(res.map(r => r.rang)).toEqual([1, 2, 2, 4]);
  });

  it('aucun ex aequo → classement strict', () => {
    const res = classer([{ eleve_id: 'e1', moyenne: 9 }, { eleve_id: 'e2', moyenne: 15 }] as Eleve[], e => e.moyenne);
    expect(rangs(res)).toEqual([['e2', 1], ['e1', 2]]);
  });

  it('élève unique → rang 1', () => {
    expect(classer([{ eleve_id: 'e1', moyenne: 11 }] as Eleve[], e => e.moyenne).map(r => r.rang)).toEqual([1]);
  });

  it('liste vide → liste vide', () => {
    expect(classer([] as Eleve[], e => e.moyenne)).toEqual([]);
  });
});

describe('classer — élèves sans moyenne', () => {
  it('une moyenne null ne reçoit aucun rang et part en fin de liste', () => {
    const res = classer(
      [
        { eleve_id: 'sansNote', moyenne: null },
        { eleve_id: 'e1', moyenne: 13 },
        { eleve_id: 'e2', moyenne: 13 },
      ] as Eleve[],
      e => e.moyenne,
    );
    expect(rangs(res)).toEqual([['e1', 1], ['e2', 1], ['sansNote', null]]);
  });

  it('les null ne consomment pas de rang', () => {
    const res = classer(
      [
        { eleve_id: 'e1', moyenne: 16 },
        { eleve_id: 'x', moyenne: null },
        { eleve_id: 'e2', moyenne: 11 },
      ] as Eleve[],
      e => e.moyenne,
    );
    // e2 est 2ème, pas 3ème : l'élève non évalué n'occupe pas de place.
    expect(rangs(res)).toEqual([['e1', 1], ['e2', 2], ['x', null]]);
  });

  it('que des null → aucun rang', () => {
    const res = classer([{ eleve_id: 'a', moyenne: null }, { eleve_id: 'b', moyenne: null }] as Eleve[], e => e.moyenne);
    expect(res.map(r => r.rang)).toEqual([null, null]);
  });
});

describe('classer — robustesse', () => {
  it('des moyennes égales issues de calculs différents restent ex aequo', () => {
    // 0.1 + 0.2 = 0.30000000000000004 : sans tolérance, ces deux élèves
    // seraient départagés par un artefact de virgule flottante.
    const res = classer(
      [{ eleve_id: 'a', moyenne: 0.1 + 0.2 }, { eleve_id: 'b', moyenne: 0.3 }] as Eleve[],
      e => e.moyenne,
    );
    expect(res.map(r => r.rang)).toEqual([1, 1]);
  });

  it('ne mute pas le tableau d’entrée', () => {
    const source: Eleve[] = [{ eleve_id: 'e1', moyenne: 5 }, { eleve_id: 'e2', moyenne: 20 }];
    classer(source, e => e.moyenne);
    expect(source.map(e => e.eleve_id)).toEqual(['e1', 'e2']);
  });

  it('conserve les autres champs de l’objet', () => {
    const res = classer([{ eleve_id: 'e1', moyenne: 12, matricule: 'M-1' }], e => e.moyenne);
    expect(res[0]).toMatchObject({ eleve_id: 'e1', moyenne: 12, matricule: 'M-1', rang: 1 });
  });
});
