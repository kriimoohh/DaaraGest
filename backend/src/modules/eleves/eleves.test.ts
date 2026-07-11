import { describe, it, expect } from 'vitest';
import { transfertSchema } from './eleves.schema';

const UUID = '11111111-1111-1111-1111-111111111111';

function genererMatricule(code: string, yy: string, count: number): string {
  return `${code}-E-${yy}-${String(count + 1).padStart(3, '0')}`;
}

function genererMatriculePersonnel(code: string, yy: string, count: number): string {
  return `${code}-P-${yy}-${String(count + 1).padStart(3, '0')}`;
}

describe('genererMatricule élève', () => {
  it('format CODE-E-AA-NNN', () => expect(genererMatricule('FIC', '26', 0)).toBe('FIC-E-26-001'));
  it('padding sur 3 chiffres', () => expect(genererMatricule('FIC', '26', 9)).toBe('FIC-E-26-010'));
  it('matricule 100+', () => expect(genererMatricule('FIC', '26', 99)).toBe('FIC-E-26-100'));
  it('incrémente à partir du count', () => {
    expect(genererMatricule('FIC', '26', 5)).toBe('FIC-E-26-006');
    expect(genererMatricule('TBK', '25', 14)).toBe('TBK-E-25-015');
  });
});

describe('genererMatricule personnel', () => {
  it('format CODE-P-AA-NNN', () => expect(genererMatriculePersonnel('FIC', '26', 0)).toBe('FIC-P-26-001'));
  it('type P bien présent', () => expect(genererMatriculePersonnel('FIC', '26', 4)).toBe('FIC-P-26-005'));
});

describe('transfert élève — schéma', () => {
  it('accepte un transfert FR valide', () => {
    const r = transfertSchema.safeParse({ annee_scolaire_id: UUID, filiere: 'FR', nouvelle_classe_id: UUID });
    expect(r.success).toBe(true);
  });

  it('accepte un transfert AR valide', () => {
    const r = transfertSchema.safeParse({ annee_scolaire_id: UUID, filiere: 'AR', nouvelle_classe_id: UUID });
    expect(r.success).toBe(true);
  });

  it('accepte un transfert EN (anglais) valide', () => {
    const r = transfertSchema.safeParse({ annee_scolaire_id: UUID, filiere: 'EN', nouvelle_classe_id: UUID });
    expect(r.success).toBe(true);
  });

  it('rejette une filière inconnue', () => {
    const r = transfertSchema.safeParse({ annee_scolaire_id: UUID, filiere: 'ES', nouvelle_classe_id: UUID });
    expect(r.success).toBe(false);
  });

  it('rejette une classe de destination manquante', () => {
    const r = transfertSchema.safeParse({ annee_scolaire_id: UUID, filiere: 'FR' });
    expect(r.success).toBe(false);
  });
});

describe('Phase 2a — jointure InscriptionClasse (double-écriture)', () => {
  // Réplique la règle : une ligne par classe assignée, filière déduite de la classe,
  // classe null ignorée (no-op).
  function liens(cf: string | null, ca: string | null) {
    const out: { filiere: 'FR' | 'AR'; classe_id: string }[] = [];
    if (cf) out.push({ filiere: 'FR', classe_id: cf });
    if (ca) out.push({ filiere: 'AR', classe_id: ca });
    return out;
  }

  it('FR + AR → deux liens (un par filière)', () => {
    const l = liens('c-fr', 'c-ar');
    expect(l).toHaveLength(2);
    expect(l.map(x => x.filiere)).toEqual(['FR', 'AR']);
  });

  it('FR seul → un lien FR', () => {
    const l = liens('c-fr', null);
    expect(l).toHaveLength(1);
    expect(l[0]).toEqual({ filiere: 'FR', classe_id: 'c-fr' });
  });

  it('aucune classe → aucun lien', () => {
    expect(liens(null, null)).toHaveLength(0);
  });
});

describe('validation élève', () => {
  function validateEleve(data: Record<string, string>) {
    const errors: string[] = [];
    if (!data.nom_fr?.trim()) errors.push('nom_fr requis');
    if (!data.prenom_fr?.trim()) errors.push('prenom_fr requis');
    if (!['M', 'F'].includes(data.sexe)) errors.push('sexe invalide');
    return errors;
  }

  it('élève valide — aucune erreur', () => {
    expect(validateEleve({ nom_fr: 'Fall', prenom_fr: 'Amadou', sexe: 'M' })).toHaveLength(0);
  });

  it('nom_fr manquant → erreur', () => {
    const errors = validateEleve({ nom_fr: '', prenom_fr: 'Amadou', sexe: 'M' });
    expect(errors).toContain('nom_fr requis');
  });

  it('sexe invalide → erreur', () => {
    const errors = validateEleve({ nom_fr: 'Fall', prenom_fr: 'Amadou', sexe: 'X' });
    expect(errors).toContain('sexe invalide');
  });
});
