import { describe, it, expect } from 'vitest';
import { construireHtmlCahier, jourDeLaDate, CahierExportData } from './cahier.service';

// Tests UNITAIRES du générateur HTML de l'export PDF (fonction pure — le rendu
// Puppeteer n'est pas exécuté ici). Vérifie le contenu ET l'échappement.

const base: CahierExportData = {
  etablissement: { nom_fr: 'École Cheikh Test', logo_url: null },
  classe: { nom_fr: 'CE1 A', nom_ar: 'السنة الثانية أ' },
  annee: '2025-2026',
  du: '2026-03-02',
  au: '2026-03-08',
  jours: [
    {
      date: '2026-03-02',
      seances: [
        { matiere: 'Lecture', enseignant: 'Awa Ndiaye', contenu: 'Texte « Le lion » + questions', objectif: 'Fluence 60 mots/min' },
      ],
      devoirs: [
        { matiere: 'Lecture', type: 'EXERCICE', consigne: 'Relire le texte', pour_le: '2026-03-04' },
      ],
    },
  ],
  visas: [
    { du: '2026-03-01', au: '2026-03-07', signataire: 'Le Directeur', vise_le: '2026-03-09', commentaire: 'RAS' },
  ],
};

describe('construireHtmlCahier', () => {
  it('rend l\'en-tête, les séances, les devoirs et les visas', () => {
    const html = construireHtmlCahier(base);
    expect(html).toContain('École Cheikh Test');
    expect(html).toContain('CE1 A');
    expect(html).toContain('السنة الثانية أ');
    expect(html).toContain('Lundi 02/03/2026');
    expect(html).toContain('Texte « Le lion » + questions');
    expect(html).toContain('Fluence 60 mots/min');
    expect(html).toContain('Relire le texte');
    expect(html).toContain('pour le Mercredi 04/03/2026');
    expect(html).toContain('visé par Le Directeur');
    expect(html).toContain('RAS');
  });

  it('échappe le HTML injecté dans les contenus saisis', () => {
    const html = construireHtmlCahier({
      ...base,
      jours: [{
        date: '2026-03-02',
        seances: [{ matiere: 'X', enseignant: 'Y', contenu: '<script>alert(1)</script>', objectif: null }],
        devoirs: [],
      }],
      visas: [],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('intervalle vide → mention explicite, pas de section visas superflue', () => {
    const html = construireHtmlCahier({ ...base, jours: [], visas: [] });
    expect(html).toContain('Aucune séance renseignée');
    expect(html).not.toContain('Visas de la direction');
  });

  it('jourDeLaDate reste cohérent avec la convention Creneau.jour', () => {
    expect(jourDeLaDate('2026-03-02')).toBe('lundi');
    expect(jourDeLaDate('2026-03-06')).toBe('vendredi');
  });
});
