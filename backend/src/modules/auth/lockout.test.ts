import { describe, it, expect } from 'vitest';
import { estVerrouille, calculerVerrou, MAX_TENTATIVES, PALIERS_VERROU, CompteVerrouilleError } from './auth.service';

describe('Auth — verrouillage de compte (anti brute-force)', () => {
  const t0 = new Date('2026-06-05T12:00:00.000Z');

  describe('estVerrouille', () => {
    it('non verrouillé quand verrouille_jusqu est null', () => {
      expect(estVerrouille(null, t0)).toBe(false);
    });

    it('verrouillé quand la date de fin est dans le futur', () => {
      const futur = new Date(t0.getTime() + 60_000);
      expect(estVerrouille(futur, t0)).toBe(true);
    });

    it('déverrouillé quand la date de fin est passée', () => {
      const passe = new Date(t0.getTime() - 1);
      expect(estVerrouille(passe, t0)).toBe(false);
    });

    it('déverrouillé pile à l\'instant d\'expiration', () => {
      expect(estVerrouille(new Date(t0.getTime()), t0)).toBe(false);
    });
  });

  describe('calculerVerrou — verrouillage progressif', () => {
    const minutes = (n: number) => { const v = calculerVerrou(n, t0); return v ? (v.getTime() - t0.getTime()) / 60_000 : null; };

    it('pas de verrou sous le seuil', () => {
      for (let n = 1; n < MAX_TENTATIVES; n++) expect(calculerVerrou(n, t0)).toBeNull();
    });

    it('le délai croît avec les échecs consécutifs (1 → 5 → 15 → 60 min)', () => {
      expect([5, 6, 7].map(minutes)).toEqual([1, 1, 1]);
      expect([8, 9, 10].map(minutes)).toEqual([5, 5, 5]);
      expect([11, 12, 14].map(minutes)).toEqual([15, 15, 15]);
      expect([15, 20, 500].map(minutes)).toEqual([60, 60, 60]); // plafonné à 1 h
    });

    it('premier palier court : un tiers qui échoue 5 fois ne bloque l\'utilisateur qu\'1 minute', () => {
      expect(minutes(MAX_TENTATIVES)).toBe(1);
    });

    it('paliers strictement croissants', () => {
      const m = PALIERS_VERROU.map(p => p.minutes);
      expect([...m].sort((x, y) => x - y)).toEqual(m);
    });
  });

  describe('CompteVerrouilleError', () => {
    it('annonce la durée restante', () => {
      expect(new CompteVerrouilleError(1).message).toContain('1 minute.');
      expect(new CompteVerrouilleError(15).message).toContain('15 minutes.');
    });
  });
});
