import { describe, it, expect } from 'vitest';
import { FileAttente } from './fileAttente';

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('FileAttente — capacité fixe et délai maximal', () => {
  it('jusqu\'à la capacité, les places sont accordées tout de suite', async () => {
    const f = new FileAttente(3);
    await Promise.all([f.acquerir(50), f.acquerir(50), f.acquerir(50)]);
    expect(f.occupees).toBe(3);
  });

  it('au-delà, le suivant attend puis reçoit un 503 explicite — plus d\'attente infinie', async () => {
    const f = new FileAttente(1);
    await f.acquerir(50);
    const t0 = Date.now();
    await expect(f.acquerir(40)).rejects.toMatchObject({ statusCode: 503 });
    expect(Date.now() - t0).toBeLessThan(400);
    expect(f.enAttente).toBe(0); // le délai retire l'attente de la file
    expect(f.occupees).toBe(1); // et ne consomme aucune place
  });

  it('une place libérée est transmise au premier de la file, avant le délai', async () => {
    const f = new FileAttente(1);
    await f.acquerir(50);
    let servi = false;
    const attente = f.acquerir(2000).then(() => { servi = true; });
    await pause(20);
    expect(servi).toBe(false);
    f.liberer();
    await attente;
    expect(servi).toBe(true);
    expect(f.occupees).toBe(1); // la place a changé de main, la capacité n'est jamais dépassée
  });

  it('ordre d\'arrivée respecté (FIFO)', async () => {
    const f = new FileAttente(1);
    await f.acquerir(50);
    const ordre: number[] = [];
    const a = f.acquerir(2000).then(() => ordre.push(1));
    const b = f.acquerir(2000).then(() => ordre.push(2));
    await pause(10);
    f.liberer(); await a;
    f.liberer(); await b;
    expect(ordre).toEqual([1, 2]);
  });

  it('après un échec par délai, la file reste saine : une place libérée sert le bon suivant', async () => {
    const f = new FileAttente(1);
    await f.acquerir(50);
    await expect(f.acquerir(20)).rejects.toMatchObject({ statusCode: 503 });
    const suivant = f.acquerir(2000);
    await pause(10);
    f.liberer();
    await expect(suivant).resolves.toBeUndefined();
    f.liberer();
    expect(f.occupees).toBe(0);
  });
});
