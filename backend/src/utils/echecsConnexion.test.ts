import { describe, it, expect, beforeEach } from 'vitest';
import { ipBloquee, noterEchec, reinitialiserEchecs, MAX_ECHECS_PAR_IP } from './echecsConnexion';

describe('Plafond des échecs de connexion par IP', () => {
  const t0 = 1_000_000;
  beforeEach(() => reinitialiserEchecs());

  it('une IP sans échec n\'est pas bloquée', () => {
    expect(ipBloquee('1.1.1.1', t0)).toBe(false);
  });

  it('bloquée à partir de MAX_ECHECS_PAR_IP échecs, pas avant', () => {
    for (let i = 0; i < MAX_ECHECS_PAR_IP - 1; i++) noterEchec('1.1.1.1', t0);
    expect(ipBloquee('1.1.1.1', t0)).toBe(false);
    noterEchec('1.1.1.1', t0);
    expect(ipBloquee('1.1.1.1', t0)).toBe(true);
  });

  it('une autre IP n\'est pas affectée', () => {
    for (let i = 0; i < MAX_ECHECS_PAR_IP; i++) noterEchec('1.1.1.1', t0);
    expect(ipBloquee('2.2.2.2', t0)).toBe(false);
  });

  it('le blocage expire avec la fenêtre (10 min)', () => {
    for (let i = 0; i < MAX_ECHECS_PAR_IP; i++) noterEchec('1.1.1.1', t0);
    expect(ipBloquee('1.1.1.1', t0 + 9 * 60_000)).toBe(true);
    expect(ipBloquee('1.1.1.1', t0 + 10 * 60_000 + 1)).toBe(false);
  });
});
