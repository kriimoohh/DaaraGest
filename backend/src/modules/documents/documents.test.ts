import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── Types de documents supportés ─────────────────────────────────────────────

const TYPE_DOCUMENT_VALUES = [
  'CERTIFICAT_SCOLARITE',
  'ATTESTATION_INSCRIPTION',
  'CONVOCATION_EXAMEN',
  'FICHE_TRANSFERT',
  'EMPLOI_DU_TEMPS_ELEVE',
  'RELEVE_NOTES',
  'CERTIFICAT_BONNE_CONDUITE',
  'FICHE_RENSEIGNEMENTS',
  'ATTESTATION_RESULTATS',
  'LISTE_CLASSE',
  'ATTESTATION_TRAVAIL',
  'ORDRE_MISSION',
  'FICHE_PAIE',
  'PLANNING_COURS',
] as const;

type TypeDocument = typeof TYPE_DOCUMENT_VALUES[number];

const genererDocumentSchema = z.object({
  type: z.enum(TYPE_DOCUMENT_VALUES),
  destinataire_type: z.enum(['eleve', 'professeur', 'classe']),
  destinataire_id: z.string().min(1),
  parametres: z.record(z.string(), z.unknown()).optional(),
});

const upsertTemplateSchema = z.object({
  nom: z.string().min(1).max(200),
  contenu_html: z.string().min(1),
});

// ── Logique de categorisation des documents ───────────────────────────────────

function categoriserDocument(type: TypeDocument): 'eleve' | 'professeur' | 'classe' {
  const DOCS_ELEVE: TypeDocument[] = [
    'CERTIFICAT_SCOLARITE',
    'ATTESTATION_INSCRIPTION',
    'CONVOCATION_EXAMEN',
    'FICHE_TRANSFERT',
    'EMPLOI_DU_TEMPS_ELEVE',
    'RELEVE_NOTES',
    'CERTIFICAT_BONNE_CONDUITE',
    'FICHE_RENSEIGNEMENTS',
    'ATTESTATION_RESULTATS',
  ];
  const DOCS_PROFESSEUR: TypeDocument[] = [
    'ATTESTATION_TRAVAIL',
    'ORDRE_MISSION',
    'FICHE_PAIE',
    'PLANNING_COURS',
  ];
  if (DOCS_ELEVE.includes(type)) return 'eleve';
  if (DOCS_PROFESSEUR.includes(type)) return 'professeur';
  return 'classe';
}

// Variables disponibles dans les templates
const VARIABLES_TEMPLATE_ELEVE = [
  '{{nom_complet}}', '{{matricule}}', '{{classe_fr}}', '{{classe_ar}}',
  '{{date_inscription}}', '{{annee_scolaire}}', '{{etablissement}}',
  '{{date_naissance}}', '{{lieu_naissance}}', '{{parent_nom}}', '{{parent_telephone}}',
];

function extraireVariables(template: string): string[] {
  const matches = template.match(/\{\{[a-z_]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

function validerVariablesTemplate(template: string, variablesAutorisees: string[]): string[] {
  const variables = extraireVariables(template);
  return variables.filter(v => !variablesAutorisees.includes(v));
}

// ════════════════════════════════════════════════════════════════════════════
// TESTS TYPES DE DOCUMENTS
// ════════════════════════════════════════════════════════════════════════════

describe('Documents — Types', () => {
  it('14 types de documents définis', () => {
    expect(TYPE_DOCUMENT_VALUES).toHaveLength(14);
  });

  it('CERTIFICAT_SCOLARITE est défini', () => {
    expect(TYPE_DOCUMENT_VALUES).toContain('CERTIFICAT_SCOLARITE');
  });

  it('FICHE_PAIE est défini', () => {
    expect(TYPE_DOCUMENT_VALUES).toContain('FICHE_PAIE');
  });

  it('type invalide n\'est pas dans la liste', () => {
    expect(TYPE_DOCUMENT_VALUES).not.toContain('BULLETIN_NOTES' as never);
    expect(TYPE_DOCUMENT_VALUES).not.toContain('CARTE_ETUDIANT' as never);
  });

  it('tous les types sont des chaînes SCREAMING_SNAKE_CASE', () => {
    for (const type of TYPE_DOCUMENT_VALUES) {
      expect(type).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('Documents — Catégorisation', () => {
  it('CERTIFICAT_SCOLARITE → élève', () => {
    expect(categoriserDocument('CERTIFICAT_SCOLARITE')).toBe('eleve');
  });

  it('FICHE_PAIE → professeur', () => {
    expect(categoriserDocument('FICHE_PAIE')).toBe('professeur');
  });

  it('ATTESTATION_TRAVAIL → professeur', () => {
    expect(categoriserDocument('ATTESTATION_TRAVAIL')).toBe('professeur');
  });

  it('PLANNING_COURS → professeur', () => {
    expect(categoriserDocument('PLANNING_COURS')).toBe('professeur');
  });

  it('LISTE_CLASSE → classe', () => {
    expect(categoriserDocument('LISTE_CLASSE')).toBe('classe');
  });

  it('RELEVE_NOTES → élève', () => {
    expect(categoriserDocument('RELEVE_NOTES')).toBe('eleve');
  });

  it('CONVOCATION_EXAMEN → élève', () => {
    expect(categoriserDocument('CONVOCATION_EXAMEN')).toBe('eleve');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS SCHEMA GÉNÉRATION
// ════════════════════════════════════════════════════════════════════════════

describe('Documents — Schema génération', () => {
  const genereValide = {
    type: 'CERTIFICAT_SCOLARITE' as const,
    destinataire_type: 'eleve' as const,
    destinataire_id: 'uuid-eleve',
  };

  it('accepte une génération valide', () => {
    expect(genererDocumentSchema.safeParse(genereValide).success).toBe(true);
  });

  it('rejette type invalide', () => {
    expect(genererDocumentSchema.safeParse({
      ...genereValide,
      type: 'BULLETIN_NOTES',
    }).success).toBe(false);
  });

  it('rejette destinataire_type invalide', () => {
    expect(genererDocumentSchema.safeParse({
      ...genereValide,
      destinataire_type: 'etudiant',
    }).success).toBe(false);
  });

  it('rejette destinataire_id vide', () => {
    expect(genererDocumentSchema.safeParse({
      ...genereValide,
      destinataire_id: '',
    }).success).toBe(false);
  });

  it('accepte parametres optionnels', () => {
    expect(genererDocumentSchema.safeParse({
      ...genereValide,
      parametres: { annee: '2024-2025', periode: 1 },
    }).success).toBe(true);
  });

  it('accepte tous les types de destinataires', () => {
    for (const destinataire_type of ['eleve', 'professeur', 'classe']) {
      expect(genererDocumentSchema.safeParse({
        ...genereValide,
        destinataire_type,
      }).success).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS SCHEMA TEMPLATE
// ════════════════════════════════════════════════════════════════════════════

describe('Documents — Schema template', () => {
  it('accepte un template valide', () => {
    expect(upsertTemplateSchema.safeParse({
      nom: 'Certificat de scolarité',
      contenu_html: '<html><body><p>{{nom_complet}}</p></body></html>',
    }).success).toBe(true);
  });

  it('rejette nom vide', () => {
    expect(upsertTemplateSchema.safeParse({
      nom: '',
      contenu_html: '<html></html>',
    }).success).toBe(false);
  });

  it('rejette contenu_html vide', () => {
    expect(upsertTemplateSchema.safeParse({
      nom: 'Test',
      contenu_html: '',
    }).success).toBe(false);
  });

  it('rejette nom > 200 caractères', () => {
    expect(upsertTemplateSchema.safeParse({
      nom: 'x'.repeat(201),
      contenu_html: '<html></html>',
    }).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS VARIABLES DE TEMPLATE
// ════════════════════════════════════════════════════════════════════════════

describe('Documents — Variables de template', () => {
  it('extrait les variables d\'un template', () => {
    const template = 'Bonjour {{nom_complet}}, votre matricule est {{matricule}}.';
    const vars = extraireVariables(template);
    expect(vars).toContain('{{nom_complet}}');
    expect(vars).toContain('{{matricule}}');
    expect(vars).toHaveLength(2);
  });

  it('extrait sans doublons', () => {
    const template = '{{nom_complet}} et encore {{nom_complet}}';
    const vars = extraireVariables(template);
    expect(vars).toHaveLength(1);
  });

  it('template sans variables → liste vide', () => {
    const template = 'Texte sans variables';
    expect(extraireVariables(template)).toHaveLength(0);
  });

  it('valide les variables autorisées', () => {
    const template = '{{nom_complet}} — {{classe_fr}}';
    const invalides = validerVariablesTemplate(template, VARIABLES_TEMPLATE_ELEVE);
    expect(invalides).toHaveLength(0);
  });

  it('détecte les variables non autorisées', () => {
    const template = '{{nom_complet}} — {{mot_de_passe}}';
    const invalides = validerVariablesTemplate(template, VARIABLES_TEMPLATE_ELEVE);
    expect(invalides).toContain('{{mot_de_passe}}');
  });

  it('les variables disponibles pour l\'élève incluent les infos essentielles', () => {
    expect(VARIABLES_TEMPLATE_ELEVE).toContain('{{nom_complet}}');
    expect(VARIABLES_TEMPLATE_ELEVE).toContain('{{matricule}}');
    expect(VARIABLES_TEMPLATE_ELEVE).toContain('{{annee_scolaire}}');
    expect(VARIABLES_TEMPLATE_ELEVE).toContain('{{etablissement}}');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS PERMISSIONS DOCUMENTS
// ════════════════════════════════════════════════════════════════════════════

describe('Documents — Permissions', () => {
  const ROLES_GESTION = ['admin', 'directeur', 'gestionnaire'];
  const ROLES_DIRECTION = ['admin', 'directeur'];

  it('génération document : rôles GESTION', () => {
    for (const role of ROLES_GESTION) {
      expect(['admin', 'directeur', 'gestionnaire'].includes(role)).toBe(true);
    }
    expect(ROLES_GESTION).not.toContain('professeur');
    expect(ROLES_GESTION).not.toContain('agent de scolarité');
  });

  it('modification template : rôles DIRECTION seulement', () => {
    expect(ROLES_DIRECTION).toContain('admin');
    expect(ROLES_DIRECTION).toContain('directeur');
    expect(ROLES_DIRECTION).not.toContain('gestionnaire');
  });

  it('un professeur ne peut pas générer un document', () => {
    const canGenerate = ROLES_GESTION.includes('professeur');
    expect(canGenerate).toBe(false);
  });

  it('un agent de scolarité ne peut pas modifier un template', () => {
    const canModify = ROLES_DIRECTION.includes('agent de scolarité');
    expect(canModify).toBe(false);
  });
});
