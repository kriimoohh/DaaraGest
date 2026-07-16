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

  it('COMBINE FR+AR (défaut) : sections FR + AR et résumé historique inchangé', () => {
    const html = generateBulletinHtml({ ...base, type: 'COMBINE', periode: 1, notes_fr: [noteFR], notes_ar: [noteAR] });
    expect(html).toContain('Filière Française');
    expect(html).toContain('Filière Arabe');
    expect(html).toContain('Moy. FR');
    expect(html).toContain('Moy. AR');
    expect(html).toContain('Résultats FR — AR'); // en-tête du résumé combiné historique
    expect(html).not.toContain('Filière Anglaise');
  });
});

describe('generateBulletinHtml — COMBINÉ générique (Phase 3-2)', () => {
  it('FR+EN : sections FR + EN, résumé Moy. FR / Moy. EN, aucune section AR', () => {
    const html = generateBulletinHtml({
      ...base, type: 'COMBINE', periode: 1,
      filieres_combine: ['FR', 'EN'],
      notes_fr: [noteFR], notes_en: [noteEN],
    });
    expect(html).toContain('Filière Française');
    expect(html).toContain('Filière Anglaise');
    expect(html).not.toContain('Filière Arabe');
    // Résumé générique : une sous-moyenne par filière du combiné.
    expect(html).toContain('Moy. FR');
    expect(html).toContain('Moy. EN');
    expect(html).not.toContain('Moy. AR');
    // Ce n'est PAS le résumé historique FR+AR.
    expect(html).not.toContain('Résultats FR — AR');
  });

  it('FR+AR+EN : les trois sections + trois sous-moyennes', () => {
    const html = generateBulletinHtml({
      ...base, type: 'COMBINE', periode: 1,
      filieres_combine: ['FR', 'AR', 'EN'],
      notes_fr: [noteFR], notes_ar: [noteAR], notes_en: [noteEN],
    });
    expect(html).toContain('Filière Française');
    expect(html).toContain('Filière Arabe');
    expect(html).toContain('Filière Anglaise');
    expect(html).toContain('Moy. FR');
    expect(html).toContain('Moy. AR');
    expect(html).toContain('Moy. EN');
  });

  it('annuel FR+EN : tableaux annuels FR + EN, pas de tableau AR', () => {
    const matFR = { nom_fr: 'Français', nom_ar: 'الفرنسية', coeff: 2, note_max: 10, valeurs: [7, 8, 6], moyenne_annuelle: 7, evaluee: true };
    const matEN = { nom_fr: 'English', nom_ar: 'English', coeff: 2, note_max: 10, valeurs: [8, 7, 9], moyenne_annuelle: 8, evaluee: true };
    const html = generateBulletinAnnuelHtml({
      ...base, type: 'ANNUEL_COMBINE', nb_periodes: 3,
      filieres_combine: ['FR', 'EN'],
      matieres_fr: [matFR], matieres_en: [matEN],
    });
    expect(html).toContain('Évaluation annuelle — Filière Française');
    expect(html).toContain('Évaluation annuelle — Filière Anglaise');
    expect(html).not.toContain('Évaluation annuelle — Filière Arabe');
    expect(html).toContain('Moy. FR');
    expect(html).toContain('Moy. EN');
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

describe('generateBulletinHtml — échelle par filière (re-scale, Phase 3)', () => {
  it('FR sur /20 alors que l\'établissement est /10 : moyenne + dénominateur re-scalés (facteur 2)', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, echelle_affichage: 20, notes_fr: [noteFR] });
    // base.moyenne = 7.16 (canonique /10) → affichée 14.32 / 20.
    expect(html).toContain('14.32 / 20');
    expect(html).not.toContain('7.16 / 10');
  });

  it('sans échelle de filière : inchangé (base établissement /10)', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, notes_fr: [noteFR] });
    expect(html).toContain('7.16 / 10');
  });

  it('COMBINE : reste sur la base canonique (pas de re-scale)', () => {
    const html = generateBulletinHtml({ ...base, type: 'COMBINE', periode: 1, notes_fr: [noteFR], notes_ar: [noteAR] });
    expect(html).toContain('/ 10');
  });
});

describe('noms de périodes (trimestre/semestre, complets, AR)', () => {
  it('trimestre (nb=3) : titre « 1er Trimestre »', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, nb_periodes: 3, notes_fr: [noteFR] });
    expect(html).toContain('1er Trimestre');
  });

  it('semestre (nb=2) : titre « 1er Semestre »', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, nb_periodes: 2, notes_fr: [noteFR] });
    expect(html).toContain('1er Semestre');
    expect(html).not.toContain('1er Trimestre');
  });

  it('arabe : « الاختبار الأول » (traduction établissement)', () => {
    const html = generateBulletinHtml({ ...base, type: 'AR', periode: 1, nb_periodes: 3, notes_ar: [noteAR] });
    expect(html).toContain('الاختبار الأول');
    expect(html).not.toContain('الفصل الأول');
  });

  it('nom de période personnalisé prioritaire', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, nb_periodes: 3, noms_periodes: { fr: ['Étape Un'] }, notes_fr: [noteFR] });
    expect(html).toContain('Étape Un');
  });

  it('annuel : colonnes en noms complets, plus de « T1/T2/T3 »', () => {
    const matFR = { nom_fr: 'Maths', nom_ar: 'Maths', coeff: 2, note_max: 10, valeurs: [8, 7, 9], moyenne_annuelle: 8, evaluee: true };
    const html = generateBulletinAnnuelHtml({ ...base, type: 'ANNUEL_FR', nb_periodes: 3, matieres_fr: [matFR] });
    expect(html).toContain('1er Trimestre');
    expect(html).toContain('3ème Trimestre');
    expect(html).not.toMatch(/>T1</);
  });
});

describe('en-tête : classe + sexe (tous types)', () => {
  it('affiche la classe et le sexe (libellé complet) dans l\'encadré identité', () => {
    const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, eleve_classe: 'CM2 B', eleve_sexe: 'M', notes_fr: [noteFR] });
    expect(html).toContain('Classe :');
    expect(html).toContain('CM2 B');
    expect(html).toContain('Sexe :');
    expect(html).toContain('Masculin');
  });
  it('sexe F → « Féminin »', () => {
    const html = generateBulletinHtml({ ...base, type: 'AR', periode: 1, eleve_sexe: 'F', notes_ar: [noteAR] });
    expect(html).toContain('Féminin');
  });
});

describe('bulletin trimestriel : coeffs retirés, total = somme simple', () => {
  const notes = [
    { nom_fr: 'Mathématiques', nom_ar: 'الرياضيات', coeff: 2, valeur: 8, note_max: 10, evaluee: true },
    { nom_fr: 'Français', nom_ar: 'الفرنسية', coeff: 4, valeur: 6, note_max: 10, evaluee: true },
  ];
  const html = generateBulletinHtml({ ...base, type: 'FR', periode: 1, notes_fr: notes });

  it('ne contient plus de colonne/label de coefficient', () => {
    expect(html).not.toContain('Coeff.');
    expect(html).not.toContain('Coef:');
  });
  it('total = somme simple des notes (8 + 6 = 14), pas la somme pondérée (40)', () => {
    expect(html).toContain('Total: 14.00');
    expect(html).not.toContain('Total: 40');
  });
  it('la moyenne reste pondérée/normalisée ((8·2 + 6·4)/6 = 6.67)', () => {
    expect(html).toContain('6.67');
  });
});

describe('bulletin annuel : note max + ligne « Moyennes »', () => {
  const matieres = [
    { nom_fr: 'Maths', nom_ar: 'Maths', coeff: 2, note_max: 10, valeurs: [8, 7, 9], moyenne_annuelle: 8, evaluee: true },
    { nom_fr: 'Français', nom_ar: 'Français', coeff: 4, note_max: 10, valeurs: [6, 6, 6], moyenne_annuelle: 6, evaluee: true },
  ];
  const html = generateBulletinAnnuelHtml({ ...base, type: 'ANNUEL_FR', nb_periodes: 3, matieres_fr: matieres });

  it('remplace la colonne Coeff par « Note max »', () => {
    expect(html).toContain('Note max');
    expect(html).not.toContain('Coeff.');
  });
  it('ajoute la ligne « Moyennes » (moyenne pondérée par trimestre : T2 = (7·2+6·4)/6 = 6.33)', () => {
    expect(html).toContain('Moyennes');
    expect(html).toContain('6.33');
  });
});

describe('bulletin annuel COMBINÉ FR+AR : moyennes (FR+AR)/2 par trimestre', () => {
  const matFR = { nom_fr: 'Maths', nom_ar: 'الرياضيات', coeff: 2, note_max: 10, valeurs: [8, 8, 8], moyenne_annuelle: 8, evaluee: true };
  const matAR = { nom_fr: 'Coran', nom_ar: 'القرآن', coeff: 2, note_max: 10, valeurs: [6, 6, 6], moyenne_annuelle: 6, evaluee: true };
  const html = generateBulletinAnnuelHtml({ ...base, type: 'ANNUEL_COMBINE', nb_periodes: 3, filieres_combine: ['FR', 'AR'], matieres_fr: [matFR], matieres_ar: [matAR] });

  it('remplace « Résultats FR — AR » par la ligne combinée (FR+AR)/2', () => {
    expect(html).toContain('Moyennes (FR + AR) / 2');
    expect(html).not.toContain('Résultats FR — AR');
  });
  it('chaque trimestre = (Moy. FR + Moy. AR)/2 = (8 + 6)/2 = 7.00', () => {
    expect(html).toContain('7.00');
  });
});
