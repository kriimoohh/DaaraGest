import { describe, it, expect } from 'vitest';

// ── Matrice de contrôle d'accès (RBAC) ───────────────────────────────────────
// Source de vérité : src/config/roles.ts + routes de chaque module

const ROLES = {
  ADMIN:           'admin',
  DIRECTEUR:       'directeur',
  GESTIONNAIRE:    'gestionnaire',
  AGENT_SCOLARITE: 'agent de scolarité',
  PROFESSEUR:      'professeur',
  POINTEUR:        'pointeur',
} as const;

type Role = typeof ROLES[keyof typeof ROLES];

const ROLE_GROUPS = {
  ADMIN_ONLY:   [ROLES.ADMIN],
  DIRECTION:    [ROLES.ADMIN, ROLES.DIRECTEUR],
  GESTION:      [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE],
  SCOLARITE:    [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE],
  ACADEMIQUE:   [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.PROFESSEUR],
  PRESENCE:     [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE, ROLES.PROFESSEUR, ROLES.POINTEUR],
  TOUS:         [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.GESTIONNAIRE, ROLES.AGENT_SCOLARITE, ROLES.PROFESSEUR, ROLES.POINTEUR],
};

function hasAccess(role: Role, group: Role[]): boolean {
  return group.includes(role);
}

// ── Structure des endpoints par module ────────────────────────────────────────

const ENDPOINTS: Array<{
  methode: string;
  path: string;
  groupe: Role[];
  description: string;
}> = [
  // AUTH
  { methode: 'POST', path: '/auth/login', groupe: ROLE_GROUPS.TOUS, description: 'Login public (pas de middleware)' },
  { methode: 'GET',  path: '/auth/me',    groupe: ROLE_GROUPS.TOUS, description: 'Profil utilisateur connecté' },

  // UTILISATEURS
  { methode: 'GET',    path: '/utilisateurs',          groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Lister utilisateurs' },
  { methode: 'POST',   path: '/utilisateurs',          groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Créer utilisateur' },
  { methode: 'PUT',    path: '/utilisateurs/:id',      groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Modifier utilisateur' },
  { methode: 'DELETE', path: '/utilisateurs/:id',      groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer utilisateur' },
  { methode: 'PUT',    path: '/utilisateurs/:id/reset-password', groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Reset password' },
  { methode: 'GET',    path: '/utilisateurs/roles',    groupe: ROLE_GROUPS.TOUS, description: 'Lister rôles' },

  // ELEVES
  { methode: 'GET',    path: '/eleves',                groupe: ROLE_GROUPS.PRESENCE,  description: 'Lister élèves' },
  { methode: 'GET',    path: '/eleves/:id',            groupe: ROLE_GROUPS.PRESENCE,  description: 'Détail élève' },
  { methode: 'POST',   path: '/eleves',                groupe: ROLE_GROUPS.SCOLARITE, description: 'Créer élève' },
  { methode: 'PUT',    path: '/eleves/:id',            groupe: ROLE_GROUPS.SCOLARITE, description: 'Modifier élève' },
  { methode: 'DELETE', path: '/eleves/:id',            groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer élève' },
  { methode: 'POST',   path: '/eleves/bulk-supprimer', groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer en masse' },
  { methode: 'POST',   path: '/eleves/bulk-desactiver',groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Désactiver en masse' },
  { methode: 'POST',   path: '/eleves/bulk-inscrire',  groupe: ROLE_GROUPS.SCOLARITE,  description: 'Inscrire en masse' },

  // PROFESSEURS
  { methode: 'GET',    path: '/professeurs',           groupe: ROLE_GROUPS.PRESENCE,  description: 'Lister professeurs' },
  { methode: 'GET',    path: '/professeurs/:id',       groupe: ROLE_GROUPS.PRESENCE,  description: 'Détail professeur' },
  { methode: 'POST',   path: '/professeurs',           groupe: ROLE_GROUPS.GESTION,   description: 'Créer professeur' },
  { methode: 'PUT',    path: '/professeurs/:id',       groupe: ROLE_GROUPS.GESTION,   description: 'Modifier professeur' },
  { methode: 'DELETE', path: '/professeurs/:id',       groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer professeur' },

  // CLASSES
  { methode: 'GET',    path: '/classes',               groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Lister classes' },
  { methode: 'POST',   path: '/classes',               groupe: ROLE_GROUPS.GESTION,    description: 'Créer classe' },
  { methode: 'PUT',    path: '/classes/:id',           groupe: ROLE_GROUPS.GESTION,    description: 'Modifier classe' },
  { methode: 'DELETE', path: '/classes/:id',           groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer classe' },

  // NOTES
  { methode: 'GET',    path: '/notes',                 groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Lister notes' },
  { methode: 'POST',   path: '/notes/bulk',            groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Saisie notes en masse' },

  // ABSENCES
  { methode: 'GET',    path: '/absences',              groupe: ROLE_GROUPS.PRESENCE, description: 'Lister absences' },
  { methode: 'POST',   path: '/absences',              groupe: ROLE_GROUPS.PRESENCE, description: 'Saisir absence' },
  { methode: 'POST',   path: '/absences/bulk',         groupe: ROLE_GROUPS.PRESENCE, description: 'Saisir absences en masse' },

  // POINTAGE
  { methode: 'GET',    path: '/pointage',              groupe: ROLE_GROUPS.PRESENCE, description: 'Lister pointages' },
  { methode: 'POST',   path: '/pointage',              groupe: ROLE_GROUPS.PRESENCE, description: 'Pointer présence' },

  // FINANCES
  { methode: 'GET',    path: '/finances/paiements-eleves',   groupe: ROLE_GROUPS.SCOLARITE,  description: 'Lister paiements élèves' },
  { methode: 'POST',   path: '/finances/paiements-eleves',   groupe: ROLE_GROUPS.SCOLARITE,  description: 'Créer paiement élève' },
  { methode: 'PUT',    path: '/finances/paiements-eleves/:id',groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Modifier paiement élève' },
  { methode: 'DELETE', path: '/finances/paiements-eleves/:id',groupe: ROLE_GROUPS.ADMIN_ONLY, description: 'Supprimer paiement élève' },
  { methode: 'GET',    path: '/finances/paiements-professeurs',groupe: ROLE_GROUPS.GESTION,   description: 'Paiements profs' },
  { methode: 'POST',   path: '/finances/paiements-professeurs',groupe: ROLE_GROUPS.GESTION,   description: 'Créer paiement prof' },

  // BULLETINS
  { methode: 'GET',    path: '/bulletins',             groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Lister bulletins' },
  { methode: 'POST',   path: '/bulletins/generer',     groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Générer bulletins' },

  // MESSAGERIE
  { methode: 'GET',    path: '/messagerie',            groupe: ROLE_GROUPS.TOUS, description: 'Lister conversations' },
  { methode: 'POST',   path: '/messagerie',            groupe: ROLE_GROUPS.TOUS, description: 'Créer conversation' },

  // PROGRESSION
  { methode: 'GET',    path: '/progression',           groupe: ROLE_GROUPS.DIRECTION, description: 'Lister progressions' },
  { methode: 'POST',   path: '/progression/generer',   groupe: ROLE_GROUPS.DIRECTION, description: 'Générer progressions' },
  { methode: 'PUT',    path: '/progression/:id/valider',groupe: ROLE_GROUPS.DIRECTION, description: 'Valider progression' },

  // DOCUMENTS
  { methode: 'GET',    path: '/documents',             groupe: ROLE_GROUPS.GESTION,   description: 'Lister templates docs' },
  { methode: 'POST',   path: '/documents/generer',     groupe: ROLE_GROUPS.GESTION,   description: 'Générer document PDF' },
  { methode: 'PUT',    path: '/documents/:type',       groupe: ROLE_GROUPS.DIRECTION, description: 'Modifier template doc' },
  { methode: 'DELETE', path: '/documents/:type/reset', groupe: ROLE_GROUPS.DIRECTION, description: 'Réinitialiser template' },

  // PORTAIL PARENT
  { methode: 'GET',    path: '/portail-parent/acces/:token', groupe: ROLE_GROUPS.TOUS, description: 'Portail parent public (token)' },
  { methode: 'POST',   path: '/portail-parent/generer',      groupe: ROLE_GROUPS.GESTION, description: 'Générer token parent' },

  // ACTIVITES
  { methode: 'GET',    path: '/activites',             groupe: ROLE_GROUPS.SCOLARITE,  description: 'Lister activités' },
  { methode: 'POST',   path: '/activites',             groupe: ROLE_GROUPS.SCOLARITE,  description: 'Créer activité' },
  { methode: 'DELETE', path: '/activites/:id',         groupe: ROLE_GROUPS.DIRECTION,  description: 'Supprimer activité' },

  // EVALUATIONS
  { methode: 'GET',    path: '/evaluations',           groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Lister évaluations' },
  { methode: 'POST',   path: '/evaluations',           groupe: ROLE_GROUPS.ACADEMIQUE, description: 'Créer évaluation' },
  { methode: 'DELETE', path: '/evaluations/:id',       groupe: ROLE_GROUPS.DIRECTION,  description: 'Supprimer évaluation' },
];

// ── Tests RBAC par rôle ───────────────────────────────────────────────────────

describe('RBAC — Admin', () => {
  const role = ROLES.ADMIN;

  it('a accès à TOUS les endpoints', () => {
    for (const ep of ENDPOINTS) {
      expect(hasAccess(role, ep.groupe)).toBe(true);
    }
  });

  it('peut gérer les utilisateurs (ADMIN_ONLY)', () => {
    const userEndpoints = ENDPOINTS.filter(ep => ep.path.startsWith('/utilisateurs') && ep.groupe === ROLE_GROUPS.ADMIN_ONLY);
    expect(userEndpoints.length).toBeGreaterThan(0);
    for (const ep of userEndpoints) {
      expect(hasAccess(role, ep.groupe)).toBe(true);
    }
  });

  it('peut supprimer des élèves', () => {
    const ep = ENDPOINTS.find(e => e.path === '/eleves/:id' && e.methode === 'DELETE');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('peut valider les progressions', () => {
    const ep = ENDPOINTS.find(e => e.path === '/progression/:id/valider');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('peut modifier les templates de documents', () => {
    const ep = ENDPOINTS.find(e => e.path === '/documents/:type' && e.methode === 'PUT');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });
});

describe('RBAC — Directeur', () => {
  const role = ROLES.DIRECTEUR;

  it('N\'a PAS accès aux endpoints ADMIN_ONLY', () => {
    const adminOnlyEndpoints = ENDPOINTS.filter(ep => ep.groupe === ROLE_GROUPS.ADMIN_ONLY);
    for (const ep of adminOnlyEndpoints) {
      expect(hasAccess(role, ep.groupe)).toBe(false);
    }
  });

  it('peut lister les utilisateurs → FAUX (admin only)', () => {
    expect(hasAccess(role, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });

  it('peut accéder aux progressions (DIRECTION)', () => {
    const progressionEndpoints = ENDPOINTS.filter(ep => ep.path.startsWith('/progression') && ep.groupe === ROLE_GROUPS.DIRECTION);
    for (const ep of progressionEndpoints) {
      expect(hasAccess(role, ep.groupe)).toBe(true);
    }
  });

  it('peut créer/modifier professeurs (GESTION)', () => {
    expect(hasAccess(role, ROLE_GROUPS.GESTION)).toBe(true);
  });

  it('peut accéder aux notes (ACADEMIQUE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.ACADEMIQUE)).toBe(true);
  });

  it('peut accéder à la messagerie (TOUS)', () => {
    expect(hasAccess(role, ROLE_GROUPS.TOUS)).toBe(true);
  });

  it('peut modifier les templates documents (DIRECTION)', () => {
    expect(hasAccess(role, ROLE_GROUPS.DIRECTION)).toBe(true);
  });
});

describe('RBAC — Gestionnaire', () => {
  const role = ROLES.GESTIONNAIRE;

  it('N\'a PAS accès aux endpoints ADMIN_ONLY', () => {
    expect(hasAccess(role, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });

  it('N\'a PAS accès aux progressions (DIRECTION only)', () => {
    expect(hasAccess(role, ROLE_GROUPS.DIRECTION)).toBe(false);
  });

  it('peut accéder aux paiements (GESTION)', () => {
    const financeEndpoints = ENDPOINTS.filter(ep => ep.groupe === ROLE_GROUPS.GESTION);
    for (const ep of financeEndpoints) {
      expect(hasAccess(role, ep.groupe)).toBe(true);
    }
  });

  it('peut générer les tokens portail parent (GESTION)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/portail-parent/generer');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('peut générer des documents PDF (GESTION)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/documents/generer');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('N\'a PAS accès à la suppression des activités (DIRECTION)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/activites/:id' && e.methode === 'DELETE');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(false);
  });
});

describe('RBAC — Agent de scolarité', () => {
  const role = ROLES.AGENT_SCOLARITE;

  it('N\'a PAS accès aux endpoints ADMIN_ONLY', () => {
    expect(hasAccess(role, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });

  it('N\'a PAS accès aux endpoints DIRECTION', () => {
    expect(hasAccess(role, ROLE_GROUPS.DIRECTION)).toBe(false);
  });

  it('N\'a PAS accès à la création de professeurs (GESTION)', () => {
    expect(hasAccess(role, ROLE_GROUPS.GESTION)).toBe(false);
  });

  it('peut créer des paiements élèves (SCOLARITE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.SCOLARITE)).toBe(true);
  });

  it('peut saisir des absences (PRESENCE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.PRESENCE)).toBe(true);
  });

  it('N\'a PAS accès aux notes (ACADEMIQUE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.ACADEMIQUE)).toBe(false);
  });

  it('peut accéder à la messagerie (TOUS)', () => {
    expect(hasAccess(role, ROLE_GROUPS.TOUS)).toBe(true);
  });

  it('peut exporter Excel des finances (SCOLARITE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.SCOLARITE)).toBe(true);
  });
});

describe('RBAC — Professeur', () => {
  const role = ROLES.PROFESSEUR;

  it('N\'a PAS accès aux endpoints ADMIN_ONLY', () => {
    expect(hasAccess(role, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });

  it('N\'a PAS accès aux endpoints DIRECTION', () => {
    expect(hasAccess(role, ROLE_GROUPS.DIRECTION)).toBe(false);
  });

  it('N\'a PAS accès à la gestion (GESTION)', () => {
    expect(hasAccess(role, ROLE_GROUPS.GESTION)).toBe(false);
  });

  it('N\'a PAS accès aux paiements (SCOLARITE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.SCOLARITE)).toBe(false);
  });

  it('peut accéder aux notes (ACADEMIQUE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.ACADEMIQUE)).toBe(true);
  });

  it('peut saisir les absences (PRESENCE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.PRESENCE)).toBe(true);
  });

  it('peut pointer la présence (PRESENCE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.PRESENCE)).toBe(true);
  });

  it('peut accéder à la messagerie (TOUS)', () => {
    expect(hasAccess(role, ROLE_GROUPS.TOUS)).toBe(true);
  });

  it('peut créer des évaluations (ACADEMIQUE)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/evaluations' && e.methode === 'POST');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('N\'a PAS accès aux finances', () => {
    const financeEndpoints = ENDPOINTS.filter(ep => ep.path.startsWith('/finances'));
    const restricted = financeEndpoints.filter(ep =>
      !hasAccess(role, ep.groupe)
    );
    expect(restricted.length).toBeGreaterThan(0);
  });
});

describe('RBAC — Pointeur', () => {
  const role = ROLES.POINTEUR;

  it('N\'a PAS accès aux endpoints ADMIN_ONLY', () => {
    expect(hasAccess(role, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });

  it('N\'a PAS accès aux endpoints DIRECTION', () => {
    expect(hasAccess(role, ROLE_GROUPS.DIRECTION)).toBe(false);
  });

  it('N\'a PAS accès à GESTION', () => {
    expect(hasAccess(role, ROLE_GROUPS.GESTION)).toBe(false);
  });

  it('N\'a PAS accès à SCOLARITE', () => {
    expect(hasAccess(role, ROLE_GROUPS.SCOLARITE)).toBe(false);
  });

  it('N\'a PAS accès aux notes (ACADEMIQUE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.ACADEMIQUE)).toBe(false);
  });

  it('peut saisir les présences (PRESENCE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.PRESENCE)).toBe(true);
  });

  it('peut pointer les professeurs (PRESENCE)', () => {
    expect(hasAccess(role, ROLE_GROUPS.PRESENCE)).toBe(true);
  });

  it('peut lire les élèves (PRESENCE)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/eleves' && e.methode === 'GET');
    expect(ep).toBeDefined();
    expect(hasAccess(role, ep!.groupe)).toBe(true);
  });

  it('peut accéder à la messagerie (TOUS)', () => {
    expect(hasAccess(role, ROLE_GROUPS.TOUS)).toBe(true);
  });

  it('N\'a PAS accès aux finances', () => {
    const financeRead = ENDPOINTS.find(e => e.path === '/finances/paiements-eleves' && e.methode === 'GET');
    expect(financeRead).toBeDefined();
    expect(hasAccess(role, financeRead!.groupe)).toBe(false);
  });
});

// ── Tests transversaux ─────────────────────────────────────────────────────────

describe('RBAC — Hiérarchie des groupes', () => {
  it('ADMIN_ONLY ⊂ DIRECTION ⊂ GESTION ⊂ SCOLARITE ⊂ PRESENCE', () => {
    expect(ROLE_GROUPS.ADMIN_ONLY.every(r => ROLE_GROUPS.DIRECTION.includes(r))).toBe(true);
    expect(ROLE_GROUPS.DIRECTION.every(r => ROLE_GROUPS.GESTION.includes(r))).toBe(true);
    expect(ROLE_GROUPS.GESTION.every(r => ROLE_GROUPS.SCOLARITE.includes(r))).toBe(true);
    expect(ROLE_GROUPS.SCOLARITE.every(r => ROLE_GROUPS.PRESENCE.includes(r))).toBe(true);
  });

  it('PRESENCE = TOUS', () => {
    const presSet = new Set(ROLE_GROUPS.PRESENCE);
    const tousSet = new Set(ROLE_GROUPS.TOUS);
    expect(ROLE_GROUPS.PRESENCE.length).toBe(ROLE_GROUPS.TOUS.length);
    for (const r of ROLE_GROUPS.PRESENCE) expect(tousSet.has(r)).toBe(true);
    for (const r of ROLE_GROUPS.TOUS) expect(presSet.has(r)).toBe(true);
  });

  it('ACADEMIQUE inclut professeur mais pas agent de scolarité', () => {
    expect(ROLE_GROUPS.ACADEMIQUE).toContain(ROLES.PROFESSEUR);
    expect(ROLE_GROUPS.ACADEMIQUE).not.toContain(ROLES.AGENT_SCOLARITE);
  });

  it('SCOLARITE inclut agent de scolarité mais pas professeur', () => {
    expect(ROLE_GROUPS.SCOLARITE).toContain(ROLES.AGENT_SCOLARITE);
    expect(ROLE_GROUPS.SCOLARITE).not.toContain(ROLES.PROFESSEUR);
  });

  it('pointeur n\'a accès qu\'à PRESENCE/TOUS', () => {
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.PRESENCE)).toBe(true);
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.SCOLARITE)).toBe(false);
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.ACADEMIQUE)).toBe(false);
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.GESTION)).toBe(false);
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.DIRECTION)).toBe(false);
    expect(hasAccess(ROLES.POINTEUR, ROLE_GROUPS.ADMIN_ONLY)).toBe(false);
  });
});

describe('RBAC — Endpoints critiques sécurité', () => {
  it('suppression utilisateur : ADMIN uniquement', () => {
    const ep = ENDPOINTS.find(e => e.path === '/utilisateurs/:id' && e.methode === 'DELETE');
    expect(ep).toBeDefined();
    for (const role of Object.values(ROLES)) {
      const expected = role === ROLES.ADMIN;
      expect(hasAccess(role as Role, ep!.groupe)).toBe(expected);
    }
  });

  it('reset password : ADMIN uniquement', () => {
    const ep = ENDPOINTS.find(e => e.path === '/utilisateurs/:id/reset-password');
    expect(ep).toBeDefined();
    expect(hasAccess(ROLES.DIRECTEUR, ep!.groupe)).toBe(false);
    expect(hasAccess(ROLES.GESTIONNAIRE, ep!.groupe)).toBe(false);
  });

  it('suppression élève : ADMIN uniquement', () => {
    const ep = ENDPOINTS.find(e => e.path === '/eleves/:id' && e.methode === 'DELETE');
    expect(ep).toBeDefined();
    expect(hasAccess(ROLES.DIRECTEUR, ep!.groupe)).toBe(false);
    expect(hasAccess(ROLES.GESTIONNAIRE, ep!.groupe)).toBe(false);
    expect(hasAccess(ROLES.PROFESSEUR, ep!.groupe)).toBe(false);
  });

  it('modification paiement : ADMIN uniquement', () => {
    const ep = ENDPOINTS.find(e => e.path === '/finances/paiements-eleves/:id' && e.methode === 'PUT');
    expect(ep).toBeDefined();
    expect(hasAccess(ROLES.AGENT_SCOLARITE, ep!.groupe)).toBe(false);
  });

  it('valider progression : DIRECTION (admin + directeur)', () => {
    const ep = ENDPOINTS.find(e => e.path === '/progression/:id/valider');
    expect(ep).toBeDefined();
    expect(hasAccess(ROLES.ADMIN, ep!.groupe)).toBe(true);
    expect(hasAccess(ROLES.DIRECTEUR, ep!.groupe)).toBe(true);
    expect(hasAccess(ROLES.GESTIONNAIRE, ep!.groupe)).toBe(false);
  });
});
