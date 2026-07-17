import { describe, it, expect } from 'vitest';
import { contexteAffichage, mentionPour, MentionDef } from './notes';

// Importe le code de PRODUCTION (jamais de copie locale) : un test qui valide sa
// propre réimplémentation laisserait passer toutes les régressions.

const MENTIONS_20: MentionDef[] = [
  { libelle_fr: 'Très bien', seuil_min: 16 },
  { libelle_fr: 'Bien', seuil_min: 14 },
  { libelle_fr: 'Assez bien', seuil_min: 12 },
  { libelle_fr: 'Passable', seuil_min: 10 },
  { libelle_fr: 'Insuffisant', seuil_min: 0 },
];

describe('contexteAffichage — sans échelle de niveau', () => {
  it('sans échelle → aucun re-scale, base = celle de l’établissement', () => {
    const ctx = contexteAffichage(20, null);
    expect(ctx.base).toBe(20);
    expect(ctx.reScale).toBe(false);
    expect(ctx.moyenne(15.25)).toBe(15.25);
  });

  it('undefined équivaut à null (pas de niveau renseigné)', () => {
    expect(contexteAffichage(20, undefined).base).toBe(20);
    expect(contexteAffichage(20, undefined).moyenne(12)).toBe(12);
  });

  it('échelle identique à l’établissement → pas de re-scale', () => {
    const ctx = contexteAffichage(10, 10);
    expect(ctx.reScale).toBe(false);
    expect(ctx.moyenne(7.5)).toBe(7.5);
  });
});

describe('contexteAffichage — re-scale vers l’échelle du niveau', () => {
  it('primaire /10 dans un établissement /20 : la moyenne est divisée par deux', () => {
    const ctx = contexteAffichage(20, 10);
    expect(ctx.base).toBe(10);
    expect(ctx.reScale).toBe(true);
    expect(ctx.moyenne(16)).toBe(8);
    expect(ctx.moyenne(15.25)).toBe(7.63); // arrondi au centième
  });

  it('secondaire /20 dans un établissement /10 : la moyenne est doublée', () => {
    const ctx = contexteAffichage(10, 20);
    expect(ctx.base).toBe(20);
    expect(ctx.moyenne(8)).toBe(16);
  });

  it('null reste null (élève sans moyenne)', () => {
    expect(contexteAffichage(20, 10).moyenne(null)).toBeNull();
  });

  it('établissement à 0 (donnée aberrante) → facteur neutre, pas de division par zéro', () => {
    const ctx = contexteAffichage(0, 10);
    expect(ctx.moyenne(5)).toBe(5);
    expect(Number.isFinite(ctx.moyenne(5)!)).toBe(true);
  });
});

describe('contexteAffichage — seuils de mention', () => {
  it('re-scale les seuils sur l’échelle d’affichage', () => {
    const ctx = contexteAffichage(20, 10);
    const m = ctx.mentions(MENTIONS_20);
    expect(m.map(x => x.seuil_min)).toEqual([8, 7, 6, 5, 0]);
  });

  it('la mention obtenue est la MÊME qu’en base canonique (tout est proportionnel)', () => {
    const ctx = contexteAffichage(20, 10);
    const m10 = ctx.mentions(MENTIONS_20);
    // 15/20 canonique = 7.5/10 affiché → « Bien » dans les deux référentiels.
    expect(mentionPour(15, MENTIONS_20)).toBe('Bien');
    expect(mentionPour(ctx.moyenne(15)!, m10)).toBe('Bien');
  });

  it('trie par seuil décroissant (précondition de mentionDefPour)', () => {
    const desordre: MentionDef[] = [
      { libelle_fr: 'Passable', seuil_min: 10 },
      { libelle_fr: 'Très bien', seuil_min: 16 },
      { libelle_fr: 'Bien', seuil_min: 14 },
    ];
    const m = contexteAffichage(20, 20).mentions(desordre);
    expect(m.map(x => x.libelle_fr)).toEqual(['Très bien', 'Bien', 'Passable']);
  });

  it('ne mute pas les mentions d’entrée', () => {
    const source: MentionDef[] = [{ libelle_fr: 'Bien', seuil_min: 14 }];
    contexteAffichage(20, 10).mentions(source);
    expect(source[0].seuil_min).toBe(14);
  });

  it('liste de mentions vide → liste vide', () => {
    expect(contexteAffichage(20, 10).mentions([])).toEqual([]);
  });
});
