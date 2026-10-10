// File d'attente à capacité fixe avec délai maximal d'attente (utilisée par le pool de PDF).
//
// Audit SenInit (performance) : quand les rendus PDF lourds occupaient toutes les places, les suivants
// attendaient SANS LIMITE ; les requêtes s'empilaient et finissaient en timeout côté proxy. Ici, une
// attente trop longue échoue en 503 explicite. La place libérée est transmise directement au premier
// de la file (pas de fenêtre où un nouvel arrivant pourrait la prendre et dépasser la capacité).

import { HttpError } from './errors';

export class FileAttente {
  private actifs = 0;
  private file: Array<() => void> = [];

  constructor(private readonly capacite: number) {}

  /** Réserve une place, ou attend au plus `attenteMaxMs` (puis 503). */
  async acquerir(attenteMaxMs: number): Promise<void> {
    if (this.actifs < this.capacite) { this.actifs++; return; }
    await new Promise<void>((resolve, reject) => {
      const reveil = () => { clearTimeout(timer); resolve(); }; // la place nous est transmise
      const timer = setTimeout(() => {
        const i = this.file.indexOf(reveil);
        if (i >= 0) this.file.splice(i, 1);
        reject(new HttpError(503, 'La génération de PDF est très sollicitée. Réessayez dans un instant.'));
      }, attenteMaxMs);
      this.file.push(reveil);
    });
  }

  /** Libère une place : transmise au premier en attente, sinon rendue. */
  liberer(): void {
    const suivant = this.file.shift();
    if (suivant) suivant(); else this.actifs--;
  }

  get occupees(): number { return this.actifs; }
  get enAttente(): number { return this.file.length; }
}
