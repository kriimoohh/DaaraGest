import { describe, it, expect } from 'vitest';
import { calculerPeriode, construireHtmlRapport, RapportData } from './cahier.rapport';

describe('calculerPeriode', () => {
  it('jour : du = au = la date', () => {
    expect(calculerPeriode('jour', '2026-03-04')).toEqual({ du: '2026-03-04', au: '2026-03-04' });
  });
  it('semaine : lundi → dimanche, quel que soit le jour donné', () => {
    for (const d of ['2026-03-02', '2026-03-04', '2026-03-08']) {
      expect(calculerPeriode('semaine', d)).toEqual({ du: '2026-03-02', au: '2026-03-08' });
    }
  });
  it('semaine à cheval sur deux mois', () => {
    expect(calculerPeriode('semaine', '2026-04-01')).toEqual({ du: '2026-03-30', au: '2026-04-05' });
  });
});

const base: RapportData = {
  etablissement: { nom_fr: 'École Test' }, annee: '2025-2026', periode: 'jour', du: '2026-03-02', au: '2026-03-02',
  totaux: { prevus: 2, renseignes: 1, manquantes: 1, taux: 50 },
  classes: [{
    classe: { id: 'c1', nom_fr: 'CE1 A', nom_ar: null }, prevus: 2, renseignes: 1, taux: 50, hors_edt: 0,
    jours: [{
      date: '2026-03-02',
      seances: [{ matiere: 'Lecture', enseignant: 'Awa Ndiaye', contenu: '<script>alert(1)</script>', objectif: null, hors_edt: false }],
      devoirs: [{ matiere: 'Lecture', type: 'EXERCICE', consigne: 'Relire', pour_le: '2026-03-04' }],
      manquantes: [{ matiere: 'Maths', enseignant: 'Moussa Sy', debut: '10:00', fin: '11:00' }],
    }],
  }],
};

describe('construireHtmlRapport', () => {
  it('affiche titre, synthèse, séances, devoirs et séances non renseignées', () => {
    const h = construireHtmlRapport(base);
    expect(h).toContain('Rapport journalier');
    expect(h).toContain('CE1 A');
    expect(h).toContain('1/2 séances renseignées (50 %)');
    expect(h).toContain('Non renseignée : Maths');
    expect(h).toContain('pour le Mercredi 04/03/2026');
  });
  it('échappe le contenu saisi', () => {
    const h = construireHtmlRapport(base);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;');
  });
  it('hebdomadaire : titre de semaine et entête par jour ; message si vide', () => {
    expect(construireHtmlRapport({ ...base, periode: 'semaine', du: '2026-03-02', au: '2026-03-08' })).toContain('Rapport hebdomadaire');
    expect(construireHtmlRapport({ ...base, classes: [] })).toContain('Aucune séance prévue');
  });
});
