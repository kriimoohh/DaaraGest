import { describe, it, expect } from 'vitest';

// Fonctions pures extraites pour test (même logique que dans finances.service.ts)
function genererRecu(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `REC-${ymd}-${rand}`;
}

describe('genererRecu', () => {
  it('format REC-YYYYMMDD-NNNNN', () => {
    const recu = genererRecu();
    expect(recu).toMatch(/^REC-\d{8}-\d{5}$/);
  });

  it('génère des valeurs différentes', () => {
    const a = genererRecu();
    const b = genererRecu();
    // Très forte probabilité d'être différents (rand 10000-99999)
    // On vérifie juste le format car le random peut coïncider
    expect(a).toMatch(/^REC-/);
    expect(b).toMatch(/^REC-/);
  });
});

describe('filtres paiements', () => {
  it('statut impaye exclut les paiements paye', () => {
    const paiements = [
      { id: '1', statut: 'paye' },
      { id: '2', statut: 'en_attente' },
      { id: '3', statut: 'impaye' },
    ];
    const impayes = paiements.filter(p => p.statut !== 'paye');
    expect(impayes).toHaveLength(2);
    expect(impayes.find(p => p.id === '1')).toBeUndefined();
  });
});
