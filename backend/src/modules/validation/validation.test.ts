import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── Schémas Zod re-importés ici pour tests sans DB ────────────────────────────

const eleveSchema = z.object({
  matricule: z.string().optional(),
  nom_fr: z.string().min(1),
  prenom_fr: z.string().min(1),
  date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lieu_naissance: z.string().optional(),
  sexe: z.enum(['M', 'F']),
  photo_url: z.string().optional(),
});

const parentSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().optional(),
  lien: z.enum(['pere', 'mere', 'tuteur']),
  telephone: z.string().min(1),
  email: z.string().email().optional(),
  adresse: z.string().optional(),
});

const paiementEleveSchema = z.object({
  eleve_id: z.string().min(1),
  type: z.string().min(1),
  montant: z.number().positive(),
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
});

const paiementProfesseurSchema = z.object({
  professeur_id: z.string().min(1),
  mois: z.number().int().min(1).max(12),
  annee: z.number().int(),
  montant_brut: z.number().positive(),
  retenues: z.number().min(0).optional(),
  net_a_payer: z.number().positive(),
});

const evaluationSchema = z.object({
  classe_id: z.string().min(1),
  matiere_id: z.string().min(1),
  annee_scolaire_id: z.string().min(1),
  periode: z.number().int().min(1),
  titre: z.string().min(1).max(200),
  type: z.enum(['DS', 'INTERRO', 'DM', 'EXAMEN']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide'),
  coefficient: z.number().min(0.5).max(10).default(1),
  note_max: z.number().min(1).max(100).default(20),
});

const activiteSchema = z.object({
  nom_fr: z.string().min(1).max(200),
  nom_ar: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  capacite_max: z.number().int().min(1).optional(),
  actif: z.boolean().optional().default(true),
});

const evenementSchema = z.object({
  titre_fr: z.string().min(1).max(200),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['vacances', 'examen', 'evenement', 'fermeture', 'reunion']),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const creneauSchema = z.object({
  annee_scolaire_id: z.string().min(1),
  classe_id: z.string().min(1),
  matiere_id: z.string().min(1),
  professeur_id: z.string().min(1),
  jour: z.enum(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']),
  heure_debut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  heure_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  salle: z.string().max(100).optional(),
});

const decisionEnum = z.enum(['admis', 'redoublant', 'transfere', 'exclu']);

const validerProgressionSchema = z.object({
  decision: decisionEnum,
  note_directeur: z.string().max(500).optional(),
});

const messagerieSchema = z.object({
  sujet: z.string().min(1).max(200),
  corps: z.string().min(1).max(5000),
  destinataire_ids: z.array(z.string().min(1)).optional(),
  cibles_roles: z.array(z.string().min(1)).optional(),
}).refine(d =>
  (d.destinataire_ids && d.destinataire_ids.length > 0) ||
  (d.cibles_roles && d.cibles_roles.length > 0),
  { message: 'Au moins un destinataire ou un rôle cible requis' }
);

const configNotesSchema = z.object({
  note_max: z.number().positive().optional(),
  note_min: z.number().min(0).optional(),
  nb_periodes: z.number().int().positive().optional(),
  montant_mensualite: z.number().positive().optional(),
  jours_cours: z.array(z.enum(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])).min(1).optional(),
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS ÉLÈVES
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Élève', () => {
  const eleveValide = {
    nom_fr: 'Diallo',
    prenom_fr: 'Oumar',
    date_naissance: '2013-03-15',
    sexe: 'M' as const,
  };

  it('accepte un élève valide complet', () => {
    expect(eleveSchema.safeParse(eleveValide).success).toBe(true);
  });

  it('rejette un nom_fr vide', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, nom_fr: '' }).success).toBe(false);
  });

  it('rejette un prenom_fr vide', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, prenom_fr: '' }).success).toBe(false);
  });

  it('rejette un sexe invalide', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, sexe: 'X' }).success).toBe(false);
  });

  it('accepte sexe F', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, sexe: 'F' }).success).toBe(true);
  });

  it('rejette date naissance au mauvais format', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, date_naissance: '15/03/2013' }).success).toBe(false);
    expect(eleveSchema.safeParse({ ...eleveValide, date_naissance: '2013-3-5' }).success).toBe(false);
    expect(eleveSchema.safeParse({ ...eleveValide, date_naissance: '' }).success).toBe(false);
  });

  it('accepte date naissance au format YYYY-MM-DD', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, date_naissance: '2010-12-31' }).success).toBe(true);
  });

  it('accepte matricule optionnel', () => {
    expect(eleveSchema.safeParse(eleveValide).success).toBe(true);
    expect(eleveSchema.safeParse({ ...eleveValide, matricule: 'DG-2024-001' }).success).toBe(true);
  });

  it('accepte photo_url optionnel', () => {
    expect(eleveSchema.safeParse({ ...eleveValide, photo_url: 'https://example.com/photo.jpg' }).success).toBe(true);
  });
});

describe('Validation — Parent', () => {
  const parentValide = {
    nom_fr: 'Mamadou Diallo',
    lien: 'pere' as const,
    telephone: '+221 77 123 45 67',
  };

  it('accepte un parent valide', () => {
    expect(parentSchema.safeParse(parentValide).success).toBe(true);
  });

  it('rejette nom_fr vide', () => {
    expect(parentSchema.safeParse({ ...parentValide, nom_fr: '' }).success).toBe(false);
  });

  it('rejette lien invalide', () => {
    expect(parentSchema.safeParse({ ...parentValide, lien: 'cousin' }).success).toBe(false);
  });

  it('accepte lien mere et tuteur', () => {
    expect(parentSchema.safeParse({ ...parentValide, lien: 'mere' }).success).toBe(true);
    expect(parentSchema.safeParse({ ...parentValide, lien: 'tuteur' }).success).toBe(true);
  });

  it('rejette email invalide', () => {
    expect(parentSchema.safeParse({ ...parentValide, email: 'pas-un-email' }).success).toBe(false);
  });

  it('accepte email valide', () => {
    expect(parentSchema.safeParse({ ...parentValide, email: 'parent@example.com' }).success).toBe(true);
  });

  it('rejette téléphone vide', () => {
    expect(parentSchema.safeParse({ ...parentValide, telephone: '' }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS FINANCES
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Paiement Élève', () => {
  const paiValide = {
    eleve_id: 'uuid-eleve',
    type: 'mensualite',
    montant: 7500,
  };

  it('accepte un paiement valide', () => {
    expect(paiementEleveSchema.safeParse(paiValide).success).toBe(true);
  });

  it('rejette montant négatif', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, montant: -100 }).success).toBe(false);
  });

  it('rejette montant zéro', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, montant: 0 }).success).toBe(false);
  });

  it('accepte montant décimal', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, montant: 7500.50 }).success).toBe(true);
  });

  it('rejette mois invalide (0, 13)', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, mois: 0 }).success).toBe(false);
    expect(paiementEleveSchema.safeParse({ ...paiValide, mois: 13 }).success).toBe(false);
  });

  it('accepte mois 1-12', () => {
    for (let m = 1; m <= 12; m++) {
      expect(paiementEleveSchema.safeParse({ ...paiValide, mois: m }).success).toBe(true);
    }
  });

  it('rejette eleve_id vide', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, eleve_id: '' }).success).toBe(false);
  });

  it('accepte type inscription', () => {
    expect(paiementEleveSchema.safeParse({ ...paiValide, type: 'inscription', montant: 15000 }).success).toBe(true);
  });
});

describe('Validation — Paiement Professeur', () => {
  const profPaiValide = {
    professeur_id: 'uuid-prof',
    mois: 9,
    annee: 2024,
    montant_brut: 250000,
    net_a_payer: 237500,
  };

  it('accepte un paiement prof valide', () => {
    expect(paiementProfesseurSchema.safeParse(profPaiValide).success).toBe(true);
  });

  it('rejette montant_brut négatif', () => {
    expect(paiementProfesseurSchema.safeParse({ ...profPaiValide, montant_brut: -1000 }).success).toBe(false);
  });

  it('rejette net_a_payer zéro', () => {
    expect(paiementProfesseurSchema.safeParse({ ...profPaiValide, net_a_payer: 0 }).success).toBe(false);
  });

  it('rejette mois invalide', () => {
    expect(paiementProfesseurSchema.safeParse({ ...profPaiValide, mois: 13 }).success).toBe(false);
    expect(paiementProfesseurSchema.safeParse({ ...profPaiValide, mois: 0 }).success).toBe(false);
  });

  it('accepte retenues = 0 (pas de retenues)', () => {
    expect(paiementProfesseurSchema.safeParse({ ...profPaiValide, retenues: 0 }).success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS ÉVALUATIONS
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Évaluation', () => {
  const evalValide = {
    classe_id: 'uuid-classe',
    matiere_id: 'uuid-matiere',
    annee_scolaire_id: 'uuid-annee',
    periode: 1,
    titre: 'DS Mathématiques T1',
    type: 'DS' as const,
    date: '2024-11-15',
  };

  it('accepte une évaluation valide', () => {
    expect(evaluationSchema.safeParse(evalValide).success).toBe(true);
  });

  it('rejette type invalide', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, type: 'CONTROLE' }).success).toBe(false);
  });

  it('accepte tous les types valides', () => {
    for (const type of ['DS', 'INTERRO', 'DM', 'EXAMEN']) {
      expect(evaluationSchema.safeParse({ ...evalValide, type }).success).toBe(true);
    }
  });

  it('rejette titre vide', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, titre: '' }).success).toBe(false);
  });

  it('rejette titre > 200 caractères', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, titre: 'a'.repeat(201) }).success).toBe(false);
  });

  it('rejette coefficient hors plage (0.1, 11)', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, coefficient: 0.1 }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...evalValide, coefficient: 11 }).success).toBe(false);
  });

  it('accepte coefficient entre 0.5 et 10', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, coefficient: 0.5 }).success).toBe(true);
    expect(evaluationSchema.safeParse({ ...evalValide, coefficient: 10 }).success).toBe(true);
    expect(evaluationSchema.safeParse({ ...evalValide, coefficient: 3 }).success).toBe(true);
  });

  it('rejette note_max hors plage', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, note_max: 0 }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...evalValide, note_max: 101 }).success).toBe(false);
  });

  it('accepte note_max jusqu\'à 100 (ex: points)', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, note_max: 100 }).success).toBe(true);
  });

  it('rejette date au mauvais format', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, date: '15-11-2024' }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...evalValide, date: '2024/11/15' }).success).toBe(false);
  });

  it('rejette période 0', () => {
    expect(evaluationSchema.safeParse({ ...evalValide, periode: 0 }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS ACTIVITÉS
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Activité', () => {
  const activiteValide = {
    nom_fr: 'Club de football',
  };

  it('accepte une activité minimale (nom_fr seul)', () => {
    expect(activiteSchema.safeParse(activiteValide).success).toBe(true);
  });

  it('rejette nom_fr vide', () => {
    expect(activiteSchema.safeParse({ ...activiteValide, nom_fr: '' }).success).toBe(false);
  });

  it('rejette nom_fr > 200 caractères', () => {
    expect(activiteSchema.safeParse({ nom_fr: 'a'.repeat(201) }).success).toBe(false);
  });

  it('rejette capacite_max = 0', () => {
    expect(activiteSchema.safeParse({ ...activiteValide, capacite_max: 0 }).success).toBe(false);
  });

  it('accepte capacite_max = 1', () => {
    expect(activiteSchema.safeParse({ ...activiteValide, capacite_max: 1 }).success).toBe(true);
  });

  it('accepte capacite_max grand', () => {
    expect(activiteSchema.safeParse({ ...activiteValide, capacite_max: 200 }).success).toBe(true);
  });

  it('rejette description > 1000 caractères', () => {
    expect(activiteSchema.safeParse({ ...activiteValide, description: 'x'.repeat(1001) }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS CALENDRIER
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Événement calendrier', () => {
  const evtValide = {
    titre_fr: 'Vacances de Noël',
    date_debut: '2024-12-21',
    date_fin: '2025-01-05',
    type: 'vacances' as const,
  };

  it('accepte un événement valide', () => {
    expect(evenementSchema.safeParse(evtValide).success).toBe(true);
  });

  it('rejette titre vide', () => {
    expect(evenementSchema.safeParse({ ...evtValide, titre_fr: '' }).success).toBe(false);
  });

  it('rejette titre > 200 caractères', () => {
    expect(evenementSchema.safeParse({ ...evtValide, titre_fr: 'x'.repeat(201) }).success).toBe(false);
  });

  it('rejette type invalide', () => {
    expect(evenementSchema.safeParse({ ...evtValide, type: 'sortie' }).success).toBe(false);
  });

  it('accepte tous les types valides', () => {
    for (const type of ['vacances', 'examen', 'evenement', 'fermeture', 'reunion']) {
      expect(evenementSchema.safeParse({ ...evtValide, type }).success).toBe(true);
    }
  });

  it('rejette couleur au mauvais format', () => {
    expect(evenementSchema.safeParse({ ...evtValide, couleur: 'rouge' }).success).toBe(false);
    expect(evenementSchema.safeParse({ ...evtValide, couleur: '#GGG' }).success).toBe(false);
    expect(evenementSchema.safeParse({ ...evtValide, couleur: '3B82F6' }).success).toBe(false);
  });

  it('accepte couleur hexadécimale valide', () => {
    expect(evenementSchema.safeParse({ ...evtValide, couleur: '#3B82F6' }).success).toBe(true);
    expect(evenementSchema.safeParse({ ...evtValide, couleur: '#ffffff' }).success).toBe(true);
    expect(evenementSchema.safeParse({ ...evtValide, couleur: '#000000' }).success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS EMPLOI DU TEMPS
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Créneau emploi du temps', () => {
  const creneauValide = {
    annee_scolaire_id: 'uuid-annee',
    classe_id: 'uuid-classe',
    matiere_id: 'uuid-matiere',
    professeur_id: 'uuid-prof',
    jour: 'lundi' as const,
    heure_debut: '08:00',
    heure_fin: '10:00',
  };

  it('accepte un créneau valide', () => {
    expect(creneauSchema.safeParse(creneauValide).success).toBe(true);
  });

  it('rejette jour invalide', () => {
    expect(creneauSchema.safeParse({ ...creneauValide, jour: 'dimanche' }).success).toBe(false);
  });

  it('accepte tous les jours valides', () => {
    for (const jour of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']) {
      expect(creneauSchema.safeParse({ ...creneauValide, jour }).success).toBe(true);
    }
  });

  it('rejette heure_debut au mauvais format', () => {
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '8:00' }).success).toBe(false);
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '08h00' }).success).toBe(false);
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '8' }).success).toBe(false);
  });

  it('accepte horaires limites valides', () => {
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '00:00', heure_fin: '23:59' }).success).toBe(true);
  });

  it('rejette heure invalide (25:00)', () => {
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '25:00' }).success).toBe(false);
  });

  it('rejette minutes invalides (:60)', () => {
    expect(creneauSchema.safeParse({ ...creneauValide, heure_debut: '08:60' }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS PROGRESSION
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Progression élève', () => {
  it('accepte toutes les décisions valides', () => {
    for (const decision of ['admis', 'redoublant', 'transfere', 'exclu']) {
      expect(validerProgressionSchema.safeParse({ decision }).success).toBe(true);
    }
  });

  it('rejette décision invalide', () => {
    expect(validerProgressionSchema.safeParse({ decision: 'refuse' }).success).toBe(false);
    expect(validerProgressionSchema.safeParse({ decision: '' }).success).toBe(false);
    expect(validerProgressionSchema.safeParse({ decision: 'ADMIS' }).success).toBe(false);
  });

  it('accepte note_directeur optionnelle', () => {
    const result = validerProgressionSchema.safeParse({
      decision: 'redoublant',
      note_directeur: 'Élève à surveiller — résultats en baisse',
    });
    expect(result.success).toBe(true);
  });

  it('rejette note_directeur > 500 caractères', () => {
    expect(validerProgressionSchema.safeParse({
      decision: 'admis',
      note_directeur: 'x'.repeat(501),
    }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS MESSAGERIE
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Messagerie', () => {
  it('accepte message avec destinataire_ids', () => {
    expect(messagerieSchema.safeParse({
      sujet: 'Convocation',
      corps: 'Bonjour, vous êtes convoqué.',
      destinataire_ids: ['uuid-user-1'],
    }).success).toBe(true);
  });

  it('accepte message broadcast avec cibles_roles', () => {
    expect(messagerieSchema.safeParse({
      sujet: 'Annonce générale',
      corps: 'Réunion vendredi.',
      cibles_roles: ['professeur'],
    }).success).toBe(true);
  });

  it('rejette message sans destinataire ni rôle', () => {
    const result = messagerieSchema.safeParse({
      sujet: 'Test',
      corps: 'Contenu',
    });
    expect(result.success).toBe(false);
  });

  it('rejette sujet vide', () => {
    expect(messagerieSchema.safeParse({
      sujet: '',
      corps: 'Contenu',
      destinataire_ids: ['uuid'],
    }).success).toBe(false);
  });

  it('rejette corps vide', () => {
    expect(messagerieSchema.safeParse({
      sujet: 'Sujet',
      corps: '',
      destinataire_ids: ['uuid'],
    }).success).toBe(false);
  });

  it('rejette sujet > 200 caractères', () => {
    expect(messagerieSchema.safeParse({
      sujet: 'x'.repeat(201),
      corps: 'Contenu',
      destinataire_ids: ['uuid'],
    }).success).toBe(false);
  });

  it('rejette corps > 5000 caractères', () => {
    expect(messagerieSchema.safeParse({
      sujet: 'Sujet',
      corps: 'x'.repeat(5001),
      destinataire_ids: ['uuid'],
    }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS PARAMÈTRES
// ════════════════════════════════════════════════════════════════════════════

describe('Validation — Paramètres / ConfigNotes', () => {
  it('accepte note_max positive', () => {
    expect(configNotesSchema.safeParse({ note_max: 20 }).success).toBe(true);
  });

  it('accepte note_min = 0', () => {
    expect(configNotesSchema.safeParse({ note_min: 0 }).success).toBe(true);
  });

  it('rejette note_max = 0', () => {
    expect(configNotesSchema.safeParse({ note_max: 0 }).success).toBe(false);
  });

  it('rejette note_min négative', () => {
    expect(configNotesSchema.safeParse({ note_min: -1 }).success).toBe(false);
  });

  it('accepte plusieurs jours de cours', () => {
    expect(configNotesSchema.safeParse({
      jours_cours: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
    }).success).toBe(true);
  });

  it('rejette jours_cours vide', () => {
    expect(configNotesSchema.safeParse({ jours_cours: [] }).success).toBe(false);
  });

  it('rejette jour invalide dans jours_cours', () => {
    expect(configNotesSchema.safeParse({ jours_cours: ['dimanche'] }).success).toBe(false);
  });

  it('accepte samedi dans jours_cours', () => {
    expect(configNotesSchema.safeParse({ jours_cours: ['samedi'] }).success).toBe(true);
  });

  it('accepte nb_periodes positif', () => {
    expect(configNotesSchema.safeParse({ nb_periodes: 3 }).success).toBe(true);
    expect(configNotesSchema.safeParse({ nb_periodes: 2 }).success).toBe(true);
  });

  it('rejette nb_periodes = 0', () => {
    expect(configNotesSchema.safeParse({ nb_periodes: 0 }).success).toBe(false);
  });
});
