import { describe, it, expect } from 'vitest';
import {
  generateBulletinHtml,
  generateBulletinAnnuelHtml,
  DEFAULT_BULLETIN_TEMPLATES,
  BULLETIN_TYPES,
} from './bulletin.template';

// Base minimale partagée par les cas (les champs optionnels retombent sur leurs défauts).
const base = {
  etablissement_nom_fr: 'École Test',
  eleve_nom_fr: 'Amadou FALL',
  eleve_matricule: 'CAAM-E-26-014',
  annee_libelle: '2025-2026',
  moyenne: 7.16,
  rang: 3,
  appreciation: 'Bien',
  devise: 'FCFA',
  note_max_etab: 10,
  mentions: [
    { libelle_fr: 'Très bien', libelle_ar: 'ممتاز', seuil_min: 8 },
    { libelle_fr: 'Bien', libelle_ar: 'جيد', seuil_min: 6 },
    { libelle_fr: 'Passable', libelle_ar: 'مقبول', seuil_min: 5 },
  ],
};

const noteFR = { nom_fr: 'Mathématiques', nom_ar: 'الرياضيات', coeff: 2, valeur: 8, note_max: 10, evaluee: true };
const noteAR = { nom_fr: 'Langue arabe', nom_ar: 'اللغة العربية', coeff: 2, valeur: 7, note_max: 10, evaluee: true };
const noteEN = { nom_fr: 'Mathematics', nom_ar: 'Mathematics', coeff: 2, valeur: 8, note_max: 10, evaluee: true };

describe('templates par défaut', () => {
  it('un template existe pour chaque type déclaré', () => {
    for (const t of BULLETIN_TYPES) {
      expect(DEFAULT_BULLETIN_TEMPLATES[t], `template manquant pour ${t}`).toBeTruthy();
    }
  });
  it('la clé EN est présente', () => {
    expect(BULLETIN_TYPES).toContain('EN');
    expect(DEFAULT_BULLETIN_TEMPLATES.EN).toContain('{{#tableau_en}}');
  });
});

describe('generateBulletinHtml — filière anglaise (EN)', () => {
  const html = generateBulletinHtml({ ...base, type: 'EN', periode: 1, notes_en: [noteEN] });

  it('rend la section anglaise avec ses matières', () => {
    expect(html).toContain('Filière Anglaise');
    expect(html).toContain('English Section');
    expect(html).toContain('Mathematics');
    expect(html).toContain('8.00'); // note formatée
  });

  it('ne rend PAS les sections FR/AR (LTR, non bilingue)', () => {
    expect(html).not.toContain('Filière Française');
    expect(html).not.toContain('Filière Arabe');
    // Pas de gloses arabes du tableau AR (المجال = colonne « Matières » côté AR).
    expect(html).not.toContain('المجال');
  });

  it('affiche le résumé simple (moyenne + mention), pas le résumé combiné', () => {
    expect(html).toContain('Moyenne Générale');
    expect(html).not.toContain('Moy. FR');
  });
});

describe('generateBulletinHtml — non-régression FR / AR / COMBINE', () => {
  it('FR : section française uniquement', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, notes_fr: [noteFR] });
    expect(html).toContain('Filière Française');
    expect(html).not.toContain('Filière Anglaise');
    expect(html).not.toContain('Filière Arabe');
    expect(html).toContain('Mathématiques');
  });

  it('AR : section arabe (bilingue) uniquement', () => {
    const html = generateBulletinHtml({ ...base, type: 'AR', periode: 1, notes_ar: [noteAR] });
    expect(html).toContain('Filière Arabe');
    expect(html).toContain('المجال'); // glose arabe de l'en-tête de colonne
    expect(html).not.toContain('Filière Anglaise');
  });

  it('COMBINE : sections FR + AR et résumé combiné', () => {
    const html = generateBulletinHtml({ ...base, type: 'COMBINE', periode: 1, notes_fr: [noteFR], notes_ar: [noteAR] });
    expect(html).toContain('Filière Française');
    expect(html).toContain('Filière Arabe');
    expect(html).toContain('Moy. FR');
    expect(html).not.toContain('Filière Anglaise');
  });
});

describe('generateBulletinAnnuelHtml — annuel EN', () => {
  const matEN = { nom_fr: 'Mathematics', nom_ar: 'Mathematics', coeff: 2, note_max: 10, valeurs: [8, 7, 9], moyenne_annuelle: 8, evaluee: true };
  const html = generateBulletinAnnuelHtml({ ...base, type: 'ANNUEL_EN', nb_periodes: 3, matieres_en: [matEN] });

  it('rend le tableau annuel anglais', () => {
    expect(html).toContain('Évaluation annuelle — Filière Anglaise');
    expect(html).toContain('Mathematics');
  });
  it("ne rend pas les tableaux annuels FR/AR", () => {
    expect(html).not.toContain('Évaluation annuelle — Filière Française');
    expect(html).not.toContain('Évaluation annuelle — Filière Arabe');
  });
});
