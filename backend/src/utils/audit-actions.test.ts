import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AUDIT_ACTIONS, AUDIT_ENTITES, resolveAuditAction, describeAuditFr, resumeDetails } from './audit-actions';

// GARDE-FOU anti-dérive : le catalogue d'audit (source unique côté back) et les
// traductions du front doivent rester en phase. Si une action ou une entité du
// catalogue n'a pas ses libellés fr/ar/en, ce test échoue AVANT le déploiement —
// c'est ce qui rend soutenable le double stockage (description FR en base + rendu
// i18n au front, cf. l'arbitrage « les deux »).

const LOCALES = ['fr', 'ar', 'en'] as const;
const i18n = Object.fromEntries(
  LOCALES.map(l => [
    l,
    JSON.parse(readFileSync(resolve(__dirname, `../../../frontend/src/i18n/${l}/common.json`), 'utf-8')),
  ]),
) as Record<(typeof LOCALES)[number], { audit: { actions: Record<string, string>; entites: Record<string, string> } }>;

describe('Catalogue d’audit ↔ traductions front', () => {
  for (const locale of LOCALES) {
    it(`chaque action du catalogue a un libellé audit.actions.* en ${locale}`, () => {
      const labels = i18n[locale].audit.actions;
      const manquantes = AUDIT_ACTIONS.filter(a => !labels[a]?.trim());
      expect(manquantes, `actions sans libellé ${locale}`).toEqual([]);
    });

    it(`chaque entité du catalogue a un libellé audit.entites.* en ${locale}`, () => {
      const labels = i18n[locale].audit.entites;
      const manquantes = AUDIT_ENTITES.filter(e => !labels[e]?.trim());
      expect(manquantes, `entités sans libellé ${locale}`).toEqual([]);
    });
  }

  it('pas de libellé i18n orphelin (clé front absente du catalogue)', () => {
    // Sécurité inverse : une clé du front qui ne correspond à aucune action du
    // catalogue est probablement une action supprimée → à nettoyer.
    const orphelines = Object.keys(i18n.fr.audit.actions).filter(
      a => !(AUDIT_ACTIONS as readonly string[]).includes(a),
    );
    expect(orphelines).toEqual([]);
  });
});

describe('resolveAuditAction — normalisation des anciennes lignes', () => {
  it('garde une action déjà sémantique', () => {
    expect(resolveAuditAction('PASSWORD_RESET')).toBe('PASSWORD_RESET');
  });

  it('remonte une sous-action enfouie dans details.action', () => {
    expect(resolveAuditAction('UPDATE', 'user-1', { action: 'reset_password' })).toBe('PASSWORD_RESET');
    expect(resolveAuditAction('UPDATE', 'user-1', { action: 'reactivate' })).toBe('USER_REACTIVATE');
  });

  it('reconnaît le déverrouillage passé en entite_id', () => {
    expect(resolveAuditAction('UPDATE', 'deverrouillage_periode', {})).toBe('BULLETIN_DEVERROUILLAGE');
  });

  it('laisse un CRUD générique tel quel', () => {
    expect(resolveAuditAction('CREATE', 'eleve-1', { nom: 'X' })).toBe('CREATE');
  });
});

describe('describeAuditFr — description lisible', () => {
  it('CRUD générique : action · entité — résumé', () => {
    expect(describeAuditFr('CREATE', 'Eleve', 'e1', { nom: 'Fatou Diop', matricule: 'CAAM-E-25-001' }))
      .toBe('Création · Élève — Fatou Diop · CAAM-E-25-001');
  });

  it('action sémantique : ne répète pas l’entité', () => {
    expect(describeAuditFr('PASSWORD_RESET', 'Utilisateur', 'u1', { identifiant: 'fdiop' }))
      .toBe('Réinitialisation du mot de passe — fdiop');
  });

  it('remonte une ancienne ligne (details.action) en description sémantique', () => {
    expect(describeAuditFr('UPDATE', 'Utilisateur', 'u1', { action: 'reset_password', identifiant: 'fdiop' }))
      .toContain('Réinitialisation du mot de passe');
  });

  it('résumé vide → pas de tiret orphelin', () => {
    expect(describeAuditFr('DELETE', 'Bulletin', 'bulk', {})).toBe('Suppression · Bulletin');
  });
});

describe('resumeDetails', () => {
  it('compose nom + matricule', () => {
    expect(resumeDetails('Eleve', 'e1', { nom: 'Awa Ba', matricule: 'M-1' })).toBe('Awa Ba · M-1');
  });
  it('nombre en tête pour les lots', () => {
    expect(resumeDetails('Note', 'bulk', { count: 12 })).toBe('12');
  });
  it('repli sur entite_id si aucun champ connu et pas un lot', () => {
    expect(resumeDetails('Autre', 'xyz', {})).toBe('xyz');
    expect(resumeDetails('Autre', 'bulk', {})).toBe('');
  });
  it('periode 0 = « Annuel », pas « T0 » (déverrouillage d’une période annuelle)', () => {
    expect(resumeDetails('Bulletin', 'deverrouillage_periode', { periode: 0, filiere: 'FR', count: 5 })).toBe('5 · Annuel · FR');
    expect(resumeDetails('Bulletin', 'deverrouillage_periode', { periode: 2, filiere: 'FR', count: 5 })).toBe('5 · T2 · FR');
  });
});
