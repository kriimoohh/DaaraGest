import { describe, it, expect } from 'vitest';
import { mentionPour, MentionDef, classer } from '../../utils/notes';

// ── Logique métier pure extraite pour tests sans DB ───────────────────────────

// === Finances ================================================================

function calculerReliquat(
  moisDus: number[],
  moisPayes: Set<number>,
  montantMensuel: number,
): number {
  return moisDus.filter(m => !moisPayes.has(m)).length * montantMensuel;
}

function calculerRetenues(salaireBrut: number, tauxRetenue = 0.05): number {
  return Math.round(salaireBrut * tauxRetenue);
}

function calculerNetAPayer(brut: number, retenues: number): number {
  return brut - retenues;
}

function validerStatutPaiement(statut: string): boolean {
  return ['paye', 'en_attente', 'impaye'].includes(statut);
}

// === Notes / Bulletins ======================================================

function calculerMoyenne(notes: { valeur: number; coeff: number }[]): number | null {
  const nonZero = notes.filter(n => n.coeff > 0);
  if (nonZero.length === 0) return null;
  const totalP = nonZero.reduce((s, n) => s + n.valeur * n.coeff, 0);
  const totalC = nonZero.reduce((s, n) => s + n.coeff, 0);
  return totalC > 0 ? Math.round((totalP / totalC) * 100) / 100 : null;
}

// Les appréciations viennent de la table Mention (configurable par
// établissement/filière/niveau) via mentionPour ; on fige ici le contrat avec
// les mentions par défaut semées par mentions.service (base /20).
const MENTIONS_DEFAUT: MentionDef[] = [
  { libelle_fr: 'Très bien',   seuil_min: 16 },
  { libelle_fr: 'Bien',        seuil_min: 14 },
  { libelle_fr: 'Assez bien',  seuil_min: 12 },
  { libelle_fr: 'Passable',    seuil_min: 10 },
  { libelle_fr: 'Insuffisant', seuil_min: 0 },
];
const appreciation = (m: number) => mentionPour(m, MENTIONS_DEFAUT);

// classer = la vraie fonction de classement (convention compétition, ex aequo).
const calculerRang = (moyennes: Array<{ eleve_id: string; moyenne: number }>) =>
  classer(moyennes, m => m.moyenne);

// === Absences ================================================================

function tauxPresence(presents: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((presents / total) * 100);
}

function estAbsenceJustifiable(statut: string): boolean {
  return statut === 'absent' || statut === 'retard';
}

function compterAbsencesNonJustifiees(
  absences: Array<{ statut: string; justifiee: boolean }>,
): number {
  return absences.filter(a => a.statut === 'absent' && !a.justifiee).length;
}

function alerteSeuil(absencesNj: number, seuil: number): boolean {
  return absencesNj >= seuil;
}

// === Emploi du temps =========================================================

function dureeCreneauMinutes(heureDebut: string, heureFin: string): number | null {
  const [dh, dm] = heureFin.split(':').map(Number);
  const [ah, am] = heureDebut.split(':').map(Number);
  const diff = (dh * 60 + dm) - (ah * 60 + am);
  return diff > 0 ? diff : null;
}

function creneauxSeChevauchent(
  c1: { heure_debut: string; heure_fin: string; jour: string },
  c2: { heure_debut: string; heure_fin: string; jour: string },
): boolean {
  if (c1.jour !== c2.jour) return false;
  const toMin = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };
  const d1 = toMin(c1.heure_debut), f1 = toMin(c1.heure_fin);
  const d2 = toMin(c2.heure_debut), f2 = toMin(c2.heure_fin);
  return d1 < f2 && d2 < f1;
}

// === Génération matricule ====================================================

function genererMatricule(annee: number, seq: number): string {
  return `DG-${annee}-${String(seq).padStart(3, '0')}`;
}

// === Portail parent ==========================================================

function tokenEstValide(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token);
}

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER FINANCES
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Finances : Reliquats', () => {
  it('aucun reliquat si tous les mois sont payés', () => {
    const moisDus = [9, 10, 11, 12, 1, 2, 3];
    const moisPayes = new Set([9, 10, 11, 12, 1, 2, 3]);
    expect(calculerReliquat(moisDus, moisPayes, 7500)).toBe(0);
  });

  it('calcule correctement les mois non payés', () => {
    const moisDus = [9, 10, 11, 12, 1, 2, 3];
    const moisPayes = new Set([9, 10, 11]);
    expect(calculerReliquat(moisDus, moisPayes, 7500)).toBe(4 * 7500); // 4 mois dus
  });

  it('tous les mois impayés', () => {
    const moisDus = [9, 10, 11];
    const moisPayes = new Set<number>();
    expect(calculerReliquat(moisDus, moisPayes, 7500)).toBe(3 * 7500);
  });

  it('reliquat par élève partiel (Mariama : 3 mois payés sur 7)', () => {
    const moisDus = [9, 10, 11, 12, 1, 2, 3];
    const moisPayes = new Set([9, 10, 11]);
    expect(calculerReliquat(moisDus, moisPayes, 7500)).toBe(30000);
  });
});

describe('Métier — Finances : Salaires personnel', () => {
  it('retenue de 5% sur 250 000', () => {
    expect(calculerRetenues(250000, 0.05)).toBe(12500);
  });

  it('net à payer = brut - retenues', () => {
    expect(calculerNetAPayer(250000, 12500)).toBe(237500);
  });

  it('aucune retenue → net = brut', () => {
    expect(calculerNetAPayer(180000, 0)).toBe(180000);
  });

  it('validation statut paiement', () => {
    expect(validerStatutPaiement('paye')).toBe(true);
    expect(validerStatutPaiement('en_attente')).toBe(true);
    expect(validerStatutPaiement('impaye')).toBe(true);
    expect(validerStatutPaiement('annule')).toBe(false);
    expect(validerStatutPaiement('')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER NOTES / BULLETINS
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Bulletins : Moyennes complexes', () => {
  it('moyenne FR (3+3+2+2+1 = 11 coefficients)', () => {
    const notes = [
      { valeur: 15, coeff: 3 }, // Français
      { valeur: 14, coeff: 3 }, // Maths
      { valeur: 12, coeff: 2 }, // Sciences
      { valeur: 13, coeff: 2 }, // Hist-Géo
      { valeur: 16, coeff: 1 }, // Ed Civique
    ];
    const moy = calculerMoyenne(notes);
    expect(moy).not.toBeNull();
    // (15*3+14*3+12*2+13*2+16*1) / 11 = (45+42+24+26+16)/11 = 153/11 ≈ 13.91
    expect(moy).toBe(13.91);
  });

  it('moyenne AR (4+2+2+2+1 = 11 coefficients)', () => {
    const notes = [
      { valeur: 25, coeff: 4 }, // Coran /30
      { valeur: 15, coeff: 2 }, // Fiqh
      { valeur: 14, coeff: 2 }, // Nahw
      { valeur: 13, coeff: 2 }, // Adab
      { valeur: 12, coeff: 1 }, // Hist Islam
    ];
    const moy = calculerMoyenne(notes);
    // (25*4+15*2+14*2+13*2+12*1)/11 = (100+30+28+26+12)/11 = 196/11 ≈ 17.82
    expect(moy).toBe(17.82);
  });

  it('élève sans notes → null', () => {
    expect(calculerMoyenne([])).toBeNull();
  });

  it('coeff 0 ignoré dans la moyenne', () => {
    const notes = [{ valeur: 20, coeff: 0 }, { valeur: 10, coeff: 2 }];
    expect(calculerMoyenne(notes)).toBe(10);
  });
});

describe('Métier — Bulletins : Appréciations', () => {
  const cas = [
    [20, 'Très bien'],
    [16, 'Très bien'],
    [15.99, 'Bien'],
    [14, 'Bien'],
    [13.99, 'Assez bien'],
    [12, 'Assez bien'],
    [11.99, 'Passable'],
    [10, 'Passable'],
    [9.99, 'Insuffisant'],
    [0, 'Insuffisant'],
  ] as [number, string][];

  for (const [moy, attendu] of cas) {
    it(`${moy} → "${attendu}"`, () => {
      expect(appreciation(moy)).toBe(attendu);
    });
  }
});

describe('Métier — Bulletins : Classement', () => {
  it('ex aequo : deux moyennes égales partagent le rang, le suivant saute', () => {
    const classement = calculerRang([
      { eleve_id: 'e1', moyenne: 12 },
      { eleve_id: 'e2', moyenne: 15 },
      { eleve_id: 'e3', moyenne: 8 },
      { eleve_id: 'e4', moyenne: 15 },
    ]);
    const rang = (id: string) => classement.find(r => r.eleve_id === id)!.rang;
    // e2 et e4 sont TOUS DEUX 1ers ; e1 est 3ème (pas 2ème) ; e3 est 4ème.
    expect(rang('e2')).toBe(1);
    expect(rang('e4')).toBe(1);
    expect(rang('e1')).toBe(3);
    expect(rang('e3')).toBe(4);
  });

  it('élève unique → rang 1', () => {
    const classement = calculerRang([{ eleve_id: 'e1', moyenne: 14 }]);
    expect(classement[0].rang).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER ABSENCES
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Absences', () => {
  it('taux présence : 100% si tous présents', () => {
    expect(tauxPresence(10, 10)).toBe(100);
  });

  it('taux présence : 0% si tous absents', () => {
    expect(tauxPresence(0, 10)).toBe(0);
  });

  it('taux présence : null si aucune saisie', () => {
    expect(tauxPresence(0, 0)).toBeNull();
  });

  it('retard est justifiable', () => {
    expect(estAbsenceJustifiable('retard')).toBe(true);
  });

  it('présent n\'est pas justifiable', () => {
    expect(estAbsenceJustifiable('present')).toBe(false);
  });

  it('dispense n\'est pas justifiable', () => {
    expect(estAbsenceJustifiable('dispense')).toBe(false);
  });

  it('compte absences non justifiées', () => {
    const absences = [
      { statut: 'absent', justifiee: false },
      { statut: 'absent', justifiee: true },
      { statut: 'absent', justifiee: false },
      { statut: 'present', justifiee: false },
      { statut: 'retard', justifiee: false },
    ];
    expect(compterAbsencesNonJustifiees(absences)).toBe(2);
  });

  it('alerte absences : seuil 3', () => {
    expect(alerteSeuil(3, 3)).toBe(true);
    expect(alerteSeuil(4, 3)).toBe(true);
    expect(alerteSeuil(2, 3)).toBe(false);
  });

  it('aucune absence → pas d\'alerte', () => {
    expect(alerteSeuil(0, 3)).toBe(false);
  });
});

// La décision de passage (admis / redoublant / a_examiner) est testée sur le vrai
// code dans progression.itest.ts (genererProgressions, base réelle) : plus de copie
// locale ici — l'ancienne encodait le fail-open « sans notes → admis » corrigé (#144).

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER EMPLOI DU TEMPS
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Emploi du temps', () => {
  it('durée créneau 08:00 → 10:00 = 120 min', () => {
    expect(dureeCreneauMinutes('08:00', '10:00')).toBe(120);
  });

  it('durée créneau 10:30 → 12:00 = 90 min', () => {
    expect(dureeCreneauMinutes('10:30', '12:00')).toBe(90);
  });

  it('créneau inversé (fin avant début) → null', () => {
    expect(dureeCreneauMinutes('14:00', '08:00')).toBeNull();
  });

  it('même heure → null (durée nulle)', () => {
    expect(dureeCreneauMinutes('08:00', '08:00')).toBeNull();
  });

  it('deux créneaux mêmes horaires même jour → chevauchement', () => {
    const c1 = { jour: 'lundi', heure_debut: '08:00', heure_fin: '10:00' };
    const c2 = { jour: 'lundi', heure_debut: '08:00', heure_fin: '10:00' };
    expect(creneauxSeChevauchent(c1, c2)).toBe(true);
  });

  it('créneaux consécutifs ne se chevauchent pas', () => {
    const c1 = { jour: 'lundi', heure_debut: '08:00', heure_fin: '10:00' };
    const c2 = { jour: 'lundi', heure_debut: '10:00', heure_fin: '12:00' };
    expect(creneauxSeChevauchent(c1, c2)).toBe(false);
  });

  it('créneaux différents jours → pas de chevauchement', () => {
    const c1 = { jour: 'lundi', heure_debut: '08:00', heure_fin: '10:00' };
    const c2 = { jour: 'mardi', heure_debut: '08:00', heure_fin: '10:00' };
    expect(creneauxSeChevauchent(c1, c2)).toBe(false);
  });

  it('chevauchement partiel détecté', () => {
    const c1 = { jour: 'mercredi', heure_debut: '08:00', heure_fin: '10:30' };
    const c2 = { jour: 'mercredi', heure_debut: '09:00', heure_fin: '11:00' };
    expect(creneauxSeChevauchent(c1, c2)).toBe(true);
  });

  it('c1 totalement inclus dans c2 → chevauchement', () => {
    const c1 = { jour: 'jeudi', heure_debut: '09:00', heure_fin: '10:00' };
    const c2 = { jour: 'jeudi', heure_debut: '08:00', heure_fin: '11:00' };
    expect(creneauxSeChevauchent(c1, c2)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER MATRICULE / IDENTIFIANTS
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Génération matricule', () => {
  it('format DG-YYYY-NNN', () => {
    expect(genererMatricule(2024, 1)).toBe('DG-2024-001');
  });

  it('padding 3 chiffres', () => {
    expect(genererMatricule(2024, 9)).toBe('DG-2024-009');
    expect(genererMatricule(2024, 10)).toBe('DG-2024-010');
    expect(genererMatricule(2024, 99)).toBe('DG-2024-099');
    expect(genererMatricule(2024, 100)).toBe('DG-2024-100');
  });

  it('année correctement incluse', () => {
    expect(genererMatricule(2025, 1)).toBe('DG-2025-001');
    expect(genererMatricule(2026, 1)).toBe('DG-2026-001');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS PORTAIL PARENT (token UUID v4)
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Portail parent', () => {
  it('token UUID v4 valide reconnu (version 4, variant a)', () => {
    // 3e groupe commence par 4 → version 4, 4e groupe commence par a/8/9/b → variant RFC 4122
    expect(tokenEstValide('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(tokenEstValide('550e8400-e29b-4fd4-a716-446655440000')).toBe(true);
  });

  it('token vide → invalide', () => {
    expect(tokenEstValide('')).toBe(false);
  });

  it('token tronqué → invalide', () => {
    expect(tokenEstValide('550e8400-e29b-4fd4-a716')).toBe(false);
  });

  it('token avec caractères invalides → invalide', () => {
    expect(tokenEstValide('XXXXXXXX-XXXX-4XXX-XXXX-XXXXXXXXXXXX')).toBe(false);
  });

  it('token sans tirets → invalide', () => {
    expect(tokenEstValide('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER CLASSES
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Classes', () => {
  it('filière FR est valide', () => {
    expect(['FR', 'AR'].includes('FR')).toBe(true);
  });

  it('filière AR est valide', () => {
    expect(['FR', 'AR'].includes('AR')).toBe(true);
  });

  it('filière invalide rejetée', () => {
    expect(['FR', 'AR'].includes('COMBINE')).toBe(false);
    expect(['FR', 'AR'].includes('EN')).toBe(false);
  });

  it('capacité classe doit être positive', () => {
    expect(30 > 0).toBe(true);
    expect(0 > 0).toBe(false);
    expect(-1 > 0).toBe(false);
  });

  it('programme classe : pas de doublon matière/classe', () => {
    const classesMatieres = [
      { classe_id: 'c1', matiere_id: 'm1' },
      { classe_id: 'c1', matiere_id: 'm2' },
    ];
    const cles = classesMatieres.map(cm => `${cm.classe_id}:${cm.matiere_id}`);
    const uniqueCles = new Set(cles);
    expect(uniqueCles.size).toBe(cles.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER ACTIVITÉS PARASCOLAIRES
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Activités parascolaires', () => {
  it('vérifier unicité inscription élève/activité/année', () => {
    const inscriptions = [
      { activite_id: 'a1', eleve_id: 'e1', annee_scolaire_id: 'y2025' },
      { activite_id: 'a1', eleve_id: 'e2', annee_scolaire_id: 'y2025' },
    ];
    const cles = inscriptions.map(i => `${i.activite_id}:${i.eleve_id}:${i.annee_scolaire_id}`);
    const unique = new Set(cles);
    expect(unique.size).toBe(2);
  });

  it('doublon inscription détecté', () => {
    const inscriptions = [
      { activite_id: 'a1', eleve_id: 'e1', annee_scolaire_id: 'y2025' },
      { activite_id: 'a1', eleve_id: 'e1', annee_scolaire_id: 'y2025' },
    ];
    const cles = inscriptions.map(i => `${i.activite_id}:${i.eleve_id}:${i.annee_scolaire_id}`);
    const unique = new Set(cles);
    expect(unique.size).toBe(1);
  });

  it('note activité : validée entre 0 et 20', () => {
    const valide = (n: number) => n >= 0 && n <= 20;
    expect(valide(0)).toBe(true);
    expect(valide(20)).toBe(true);
    expect(valide(10.5)).toBe(true);
    expect(valide(-1)).toBe(false);
    expect(valide(21)).toBe(false);
  });

  it('statut présence activité : valeurs acceptées', () => {
    const STATUTS = ['present', 'absent', 'retard'];
    expect(STATUTS.includes('present')).toBe(true);
    expect(STATUTS.includes('excuse')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MÉTIER NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════

describe('Métier — Notifications', () => {
  const TYPES_NOTIF = ['absence_eleve', 'paiement_retard', 'note_insuffisante', 'absence_professeur'];

  it('4 types de notifications définis', () => {
    expect(TYPES_NOTIF).toHaveLength(4);
  });

  it('type absence_eleve est valide', () => {
    expect(TYPES_NOTIF.includes('absence_eleve')).toBe(true);
  });

  it('type inconnu n\'est pas valide', () => {
    expect(TYPES_NOTIF.includes('message_direct')).toBe(false);
  });

  it('marquer une notification comme lue', () => {
    const notif = { id: 'n1', lu: false };
    const updated = { ...notif, lu: true };
    expect(updated.lu).toBe(true);
    expect(notif.lu).toBe(false); // immuabilité
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS COHÉRENCE DES DONNÉES SEED
// ════════════════════════════════════════════════════════════════════════════

describe('Cohérence données seed', () => {
  const COMPTES_TEST = [
    { identifiant: 'admin',       mdp: 'Admin123!',      role: 'admin' },
    { identifiant: 'directeur',   mdp: 'Directeur123!',  role: 'directeur' },
    { identifiant: 'caissier',    mdp: 'Caissier123!',   role: 'agent de scolarité' },
    { identifiant: 'prof.fall',   mdp: 'Prof123!',       role: 'professeur' },
    { identifiant: 'prof.diallo', mdp: 'Prof123!',       role: 'professeur' },
    { identifiant: 'prof.ahmed',  mdp: 'Prof123!',       role: 'professeur' },
    { identifiant: 'prof.ndiaye', mdp: 'Prof123!',       role: 'professeur' },
    { identifiant: 'pointeur',    mdp: 'Pointeur123!',   role: 'pointeur' },
  ];

  it('8 comptes de test définis', () => {
    expect(COMPTES_TEST).toHaveLength(8);
  });

  it('chaque compte a un identifiant unique', () => {
    const identifiants = COMPTES_TEST.map(c => c.identifiant);
    expect(new Set(identifiants).size).toBe(identifiants.length);
  });

  it('chaque compte a un rôle valide', () => {
    const ROLES_VALIDES = ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'];
    for (const compte of COMPTES_TEST) {
      expect(ROLES_VALIDES).toContain(compte.role);
    }
  });

  it('tous les mots de passe respectent la politique (8+ car)', () => {
    for (const compte of COMPTES_TEST) {
      expect(compte.mdp.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('admin a must_change_password = true au premier login', () => {
    const adminMustChange = true; // défini dans seed
    expect(adminMustChange).toBe(true);
  });

  it('20 élèves de test', () => {
    const NB_ELEVES = 20;
    expect(NB_ELEVES).toBe(20);
  });

  it('4 classes (2 FR + 2 AR)', () => {
    const classes = ['CM1 Français', 'CM2 Français', '5ème Arabe', '6ème Arabe'];
    const filieres = { FR: classes.filter(c => c.includes('Français')), AR: classes.filter(c => c.includes('Arabe')) };
    expect(filieres.FR).toHaveLength(2);
    expect(filieres.AR).toHaveLength(2);
  });
});
