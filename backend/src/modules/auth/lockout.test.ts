import { describe, it, expect } from 'vitest';
import { estVerrouille, calculerVerrou, MAX_TENTATIVES, DUREE_VERROU_MS } from './auth.service';

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

  describe('calculerVerrou', () => {
    it('pas de verrou en dessous du seuil', () => {
      for (let n = 1; n < MAX_TENTATIVES; n++) {
        expect(calculerVerrou(n, t0)).toBeNull();
      }
    });

    it('verrou exactement au seuil', () => {
      const verrou = calculerVerrou(MAX_TENTATIVES, t0);
      expect(verrou).not.toBeNull();
      expect(verrou!.getTime()).toBe(t0.getTime() + DUREE_VERROU_MS);
    });

    it('verrou au delà du seuil', () => {
      expect(calculerVerrou(MAX_TENTATIVES + 3, t0)).not.toBeNull();
    });

    it('durée de verrou de 15 minutes', () => {
      expect(DUREE_VERROU_MS).toBe(15 * 60 * 1000);
    });
  });
});
