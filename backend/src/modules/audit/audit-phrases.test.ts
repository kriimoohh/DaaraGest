import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { construirePhrase, contexteVide, collecterReferences, CLES_PHRASES, type ContexteNoms, type EntreeAudit } from './audit-phrases';

// Les phrases du journal sont ce que lit une personne non technicienne : ces tests
// vérifient (1) que les noms sont bien résolus, (2) qu'aucune combinaison ne produit
// un identifiant technique, (3) que chaque clé a sa traduction fr/ar/en.

const ctx = (): ContexteNoms => {
  const c = contexteVide();
  c.eleves.set('e1', { nom: 'Sira Sow', matricule: 'CAAM-E-26-001' });
  c.classes.set('c1', 'CM2 A'); c.classes.set('c2', 'CM1 B');
  c.matieres.set('m1', 'Mathématiques'); c.matieres.set('m2', 'Dictée');
  c.annees.set('a1', '2025-2026'); c.annees.set('a2', '2026-2027');
  c.personnels.set('p1', 'Awa Ndiaye');
  c.inscriptions.set('i1', 'e1');
  c.paiements.set('pay1', { eleve_id: 'e1', recu: 'REC-1', type: 'mensualite', montant: '15000' });
  c.bulletins.set('b1', { eleve_id: 'e1', periode: 2 });
  c.utilisateurs.set('u1', { nom: 'Moussa Diop', identifiant: 'mdiop' });
  return c;
};
const e = (action: string, entite: string, entite_id: string, details: Record<string, unknown> | null): EntreeAudit => ({ action, entite, entite_id, details });

describe('construirePhrase — noms résolus, jamais d’identifiant technique', () => {
  it('paiement créé : élève, montant, reçu', () => {
    expect(construirePhrase(e('CREATE', 'PaiementEleve', 'pay1', { eleve_id: 'e1', type: 'inscription', montant: '25000', recu: 'REC-9' }), ctx()))
      .toEqual({ cle: 'CREATE.PaiementEleve', params: { eleve: 'Sira Sow', montant: 25000, type: 'inscription', recu: 'REC-9' } });
  });
  it('paiement modifié : retrouve l’élève et le reçu par l’id du paiement', () => {
    const p = construirePhrase(e('UPDATE', 'PaiementEleve', 'pay1', { changes: { montant: 20000 } }), ctx());
    expect(p.params).toMatchObject({ eleve: 'Sira Sow', recu: 'REC-1', montant: 20000, type: 'mensualite' });
  });
  it('paiement supprimé : nom de l’élève depuis les détails', () => {
    expect(construirePhrase(e('DELETE', 'PaiementEleve', 'pay1', { eleve_id: 'e1', montant: '10000', recu: 'REC-1' }), ctx()).params)
      .toMatchObject({ eleve: 'Sira Sow', montant: 10000, recu: 'REC-1' });
  });
  it('transfert : nom de l’élève et des deux classes', () => {
    const p = construirePhrase(e('UPDATE', 'Inscription', 'i1', { action: 'transfert', filiere: 'FR', ancienne_classe_id: 'c1', nouvelle_classe_id: 'c2' }), ctx());
    expect(p).toEqual({ cle: 'UPDATE.Inscription.transfert', params: { eleve: 'Sira Sow', ancienne: 'CM2 A', nouvelle: 'CM1 B', filiere: 'FR' } });
  });
  it('notes saisies : matières par leur nom, résumées au-delà de 3', () => {
    const p = construirePhrase(e('UPDATE', 'Note', 'bulk', { count: 5, created: 3, updated: 2, matiere_ids: ['m1', 'm2', 'm1'] }), ctx());
    expect(p.params).toMatchObject({ count: 5, created: 3, updated: 2, matieres: 'Mathématiques, Dictée' });
  });
  it('observation de bulletin : élève et période', () => {
    expect(construirePhrase(e('UPDATE', 'Bulletin', 'b1', { action: 'observation' }), ctx()))
      .toEqual({ cle: 'UPDATE.Bulletin.observation', params: { eleve: 'Sira Sow', periode: 2 } });
  });
  it('matière retirée du calcul de la moyenne : variante selon la valeur', () => {
    expect(construirePhrase(e('UPDATE', 'ClasseMatiere', 'x', { action: 'toggle_evaluee', classe_id: 'c1', matiere_id: 'm1', nouveau: false }), ctx()))
      .toEqual({ cle: 'UPDATE.ClasseMatiere.evaluee_non', params: { classe: 'CM2 A', matiere: 'Mathématiques' } });
    expect(construirePhrase(e('UPDATE', 'ClasseMatiere', 'x', { classe_id: 'c1', matiere_id: 'm1', nouveau: true }), ctx()).cle).toBe('UPDATE.ClasseMatiere.evaluee_oui');
  });
  it('reconduction des classes : années par leur libellé', () => {
    expect(construirePhrase(e('CREATE', 'Classe', 'reconduction', { count: 30, source: 'a1', cible: 'a2', matieres: 'copier' }), ctx()))
      .toEqual({ cle: 'CREATE.Classe.reconduction', params: { count: 30, source: '2025-2026', cible: '2026-2027', avec_matieres: true } });
  });
  it('compte utilisateur modifié : nom et identifiant (changes ou compte courant)', () => {
    expect(construirePhrase(e('UPDATE', 'Utilisateur', 'u1', { changes: { langue: 'fr' } }), ctx()).params).toEqual({ identifiant: 'mdiop', nom: 'Moussa Diop' });
  });
  it('désactivation vs suppression définitive d’un compte', () => {
    expect(construirePhrase(e('DELETE', 'Utilisateur', 'u1', { identifiant: 'x' }), ctx()).cle).toBe('DELETE.Utilisateur');
    expect(construirePhrase(e('DELETE', 'Utilisateur', 'u1', { action: 'hard_delete', identifiant: 'x' }), ctx()).cle).toBe('DELETE.Utilisateur.definitif');
  });
  it('mot de passe réinitialisé', () => {
    expect(construirePhrase(e('PASSWORD_RESET', 'Utilisateur', 'u1', { identifiant: 'mdiop' }), ctx()))
      .toEqual({ cle: 'PASSWORD_RESET', params: { identifiant: 'mdiop' } });
  });
  it('donnée supprimée depuis : nom `null` (le front affiche « supprimé depuis »), pas d’identifiant', () => {
    const p = construirePhrase(e('DELETE', 'PaiementEleve', 'z', { eleve_id: 'disparu', montant: '5', recu: null }), ctx());
    expect(p.params.eleve).toBeNull();
    expect(JSON.stringify(p)).not.toContain('disparu');
  });
  it('combinaison inconnue : phrase générique, sans détail technique', () => {
    expect(construirePhrase(e('UPDATE', 'Machin', 'q', { secret: 'x' }), ctx())).toEqual({ cle: 'defaut', params: {} });
  });
  it('portail parent et décision de passage', () => {
    expect(construirePhrase(e('PORTAIL_GENERATE', 'PortailParentToken', 't', { nom: 'Fatou Gueye', matricule: 'M1', code: 'rotation' }), ctx()).cle).toBe('PORTAIL_GENERATE.rotation');
    expect(construirePhrase(e('PROGRESSION_VALIDATE', 'ProgressionEleve', 'p', { nom: 'Fatou', matricule: 'M1', code: 'admis' }), ctx()).params)
      .toMatchObject({ nom: 'Fatou', decision: 'admis' });
  });
});

describe('collecterReferences', () => {
  it('rassemble les ids à résoudre sans doublons', () => {
    const r = collecterReferences([
      e('CREATE', 'PaiementEleve', 'pay1', { eleve_id: 'e1' }),
      e('UPDATE', 'Note', 'bulk', { matiere_ids: ['m1', 'm2'] }),
      e('UPDATE', 'Inscription', 'i1', { ancienne_classe_id: 'c1', nouvelle_classe_id: 'c2' }),
      e('DELETE', 'PaiementEleve', 'bulk', null),
    ]);
    expect([...r.eleves]).toEqual(['e1']);
    expect([...r.matieres].sort()).toEqual(['m1', 'm2']);
    expect([...r.classes].sort()).toEqual(['c1', 'c2']);
    expect([...r.inscriptions]).toEqual(['i1']);
    expect([...r.paiements]).toEqual(['pay1']);
  });
});

describe('Phrases ↔ traductions front', () => {
  const LOCALES = ['fr', 'ar', 'en'] as const;
  const PARAMS_CONNUS = new Set(['nom', 'matricule', 'count', 'identifiant', 'role', 'code', 'eleve', 'montant', 'type', 'recu', 'personnel', 'mois', 'annee', 'net',
    'created', 'updated', 'matieres', 'periode', 'classe', 'matiere', 'source', 'cible', 'contenu', 'date', 'pour_le', 'du', 'au', 'decision', 'ancienne', 'nouvelle', 'filiere', 'action', 'entite', 'n']);
  for (const l of LOCALES) {
    const phrases = JSON.parse(readFileSync(resolve(__dirname, `../../../../frontend/src/i18n/${l}/common.json`), 'utf-8')).audit.phrases as Record<string, string>;
    it(`chaque clé de phrase est traduite en ${l}`, () => {
      expect(CLES_PHRASES.filter(k => !phrases[k]?.trim())).toEqual([]);
    });
    it(`aucune phrase ${l} n’utilise un paramètre inexistant (faute de frappe)`, () => {
      const inconnus: string[] = [];
      for (const [k, v] of Object.entries(phrases)) for (const m of v.matchAll(/\{\{(\w+)\}\}/g)) if (!PARAMS_CONNUS.has(m[1])) inconnus.push(`${k}:${m[1]}`);
      expect(inconnus).toEqual([]);
    });
    it(`aucune phrase ${l} orpheline (clé absente du code)`, () => {
      expect(Object.keys(phrases).filter(k => !(CLES_PHRASES as readonly string[]).includes(k))).toEqual([]);
    });
  }
});
