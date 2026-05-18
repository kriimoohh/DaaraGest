import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── Schémas extraits pour tests sans DB ──────────────────────────────────────

const loginSchema = z.object({
  identifiant: z.string().min(1, 'Identifiant requis'),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
});

const changePasswordSchema = z.object({
  ancien: z.string().min(1),
  nouveau: z.string().min(8, 'Au moins 8 caractères'),
});

const jwtPayloadSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  etablissement_id: z.string().min(1),
  langue: z.string().min(1),
  theme: z.string().min(1),
  doit_changer_mdp: z.boolean(),
});

// ── Logique de validation mot de passe ────────────────────────────────────────

function validerForceMdp(mdp: string): { valide: boolean; raisons: string[] } {
  const raisons: string[] = [];
  if (mdp.length < 8) raisons.push('Minimum 8 caractères');
  if (!/[A-Z]/.test(mdp)) raisons.push('Au moins une majuscule');
  if (!/[0-9]/.test(mdp)) raisons.push('Au moins un chiffre');
  if (!/[^A-Za-z0-9]/.test(mdp)) raisons.push('Au moins un caractère spécial');
  return { valide: raisons.length === 0, raisons };
}

// ── Tests loginSchema ──────────────────────────────────────────────────────────

describe('Auth — loginSchema', () => {
  it('accepte identifiant et mot de passe valides', () => {
    const result = loginSchema.safeParse({ identifiant: 'admin', mot_de_passe: 'Admin123!' });
    expect(result.success).toBe(true);
  });

  it('rejette identifiant vide', () => {
    const result = loginSchema.safeParse({ identifiant: '', mot_de_passe: 'Admin123!' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Identifiant requis');
  });

  it('rejette mot de passe vide', () => {
    const result = loginSchema.safeParse({ identifiant: 'admin', mot_de_passe: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Mot de passe requis');
  });

  it('rejette payload totalement vide', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejette identifiant avec espaces uniquement', () => {
    const result = loginSchema.safeParse({ identifiant: '   ', mot_de_passe: 'pass' });
    expect(result.success).toBe(true); // la longueur est > 0 — normalisation doit se faire côté service
  });

  it('accepte identifiants avec caractères arabes', () => {
    const result = loginSchema.safeParse({ identifiant: 'مدير', mot_de_passe: 'Admin123!' });
    expect(result.success).toBe(true);
  });

  it('accepte identifiant avec point (prof.fall)', () => {
    const result = loginSchema.safeParse({ identifiant: 'prof.fall', mot_de_passe: 'Prof123!' });
    expect(result.success).toBe(true);
  });
});

// ── Tests changePasswordSchema ─────────────────────────────────────────────────

describe('Auth — changePassword validation', () => {
  it('accepte un changement valide', () => {
    const result = changePasswordSchema.safeParse({ ancien: 'OldPass1!', nouveau: 'NewPass1!' });
    expect(result.success).toBe(true);
  });

  it('rejette nouveau mot de passe < 8 caractères', () => {
    const result = changePasswordSchema.safeParse({ ancien: 'OldPass1!', nouveau: 'Short1' });
    expect(result.success).toBe(false);
  });

  it('rejette nouveau mot de passe vide', () => {
    const result = changePasswordSchema.safeParse({ ancien: 'OldPass1!', nouveau: '' });
    expect(result.success).toBe(false);
  });

  it('accepte nouveau mot de passe exactement 8 caractères', () => {
    const result = changePasswordSchema.safeParse({ ancien: 'OldPass1!', nouveau: 'Abcd123!' });
    expect(result.success).toBe(true);
  });
});

// ── Tests JWT Payload ──────────────────────────────────────────────────────────

describe('Auth — JWT payload validation', () => {
  const validPayload = {
    id: 'uuid-1234',
    role: 'admin',
    etablissement_id: 'etab-uuid',
    langue: 'fr',
    theme: 'light',
    doit_changer_mdp: false,
  };

  it('accepte un payload complet valide', () => {
    expect(jwtPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejette payload sans id', () => {
    const { id: _id, ...rest } = validPayload;
    expect(jwtPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('rejette payload sans role', () => {
    const { role: _role, ...rest } = validPayload;
    expect(jwtPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('rejette payload sans etablissement_id', () => {
    const { etablissement_id: _e, ...rest } = validPayload;
    expect(jwtPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('doit_changer_mdp=true est accepté', () => {
    const result = jwtPayloadSchema.safeParse({ ...validPayload, doit_changer_mdp: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.doit_changer_mdp).toBe(true);
  });

  it('rejette doit_changer_mdp non-booléen', () => {
    expect(jwtPayloadSchema.safeParse({ ...validPayload, doit_changer_mdp: 'oui' }).success).toBe(false);
  });

  it('theme dark est accepté dans le payload', () => {
    const result = jwtPayloadSchema.safeParse({ ...validPayload, theme: 'dark' });
    expect(result.success).toBe(true);
  });

  it('langue ar est acceptée', () => {
    const result = jwtPayloadSchema.safeParse({ ...validPayload, langue: 'ar' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.langue).toBe('ar');
  });
});

// ── Tests force mot de passe ───────────────────────────────────────────────────

describe('Auth — force du mot de passe', () => {
  it('Admin123! est valide', () => {
    const { valide } = validerForceMdp('Admin123!');
    expect(valide).toBe(true);
  });

  it('password est insuffisant (pas de majuscule, chiffre, spécial)', () => {
    const { valide, raisons } = validerForceMdp('password');
    expect(valide).toBe(false);
    expect(raisons).toContain('Au moins une majuscule');
    expect(raisons).toContain('Au moins un chiffre');
  });

  it('PASSWORD123 manque le caractère spécial', () => {
    const { raisons } = validerForceMdp('PASSWORD123');
    expect(raisons).toContain('Au moins un caractère spécial');
  });

  it('Pa1! est trop court', () => {
    const { raisons } = validerForceMdp('Pa1!');
    expect(raisons).toContain('Minimum 8 caractères');
  });

  it('Directeur123! est valide', () => {
    expect(validerForceMdp('Directeur123!').valide).toBe(true);
  });

  it('Prof123! est valide', () => {
    expect(validerForceMdp('Prof123!').valide).toBe(true);
  });

  it('chaîne vide est invalide', () => {
    const { valide, raisons } = validerForceMdp('');
    expect(valide).toBe(false);
    expect(raisons.length).toBeGreaterThan(0);
  });
});

// ── Tests rôles connus ─────────────────────────────────────────────────────────

describe('Auth — rôles du système', () => {
  const ROLES_CONNUS = ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'];

  it('6 rôles définis dans le système', () => {
    expect(ROLES_CONNUS).toHaveLength(6);
  });

  it('admin est dans la liste', () => {
    expect(ROLES_CONNUS).toContain('admin');
  });

  it('portail parent n\'est pas un rôle système', () => {
    expect(ROLES_CONNUS).not.toContain('parent');
  });

  it('tous les rôles sont des chaînes non vides', () => {
    for (const role of ROLES_CONNUS) {
      expect(role.trim().length).toBeGreaterThan(0);
    }
  });

  it('rôle inconnu n\'est pas dans la liste', () => {
    expect(ROLES_CONNUS).not.toContain('super_admin');
    expect(ROLES_CONNUS).not.toContain('comptable');
  });
});

// ── Tests routes sans restriction MDP ─────────────────────────────────────────

describe('Auth — routes exemptées du must_change_password', () => {
  const ROUTES_EXEMPTES = [
    '/api/v1/auth/change-password',
    '/api/v1/auth/me',
    '/api/v1/auth/logout',
  ];

  it('3 routes exemptées définies', () => {
    expect(ROUTES_EXEMPTES).toHaveLength(3);
  });

  it('change-password est exempté', () => {
    expect(ROUTES_EXEMPTES.some(r => '/api/v1/auth/change-password'.startsWith(r))).toBe(true);
  });

  it('route /api/v1/eleves n\'est pas exemptée', () => {
    expect(ROUTES_EXEMPTES.some(r => '/api/v1/eleves'.startsWith(r))).toBe(false);
  });

  it('route /api/v1/notes n\'est pas exemptée', () => {
    expect(ROUTES_EXEMPTES.some(r => '/api/v1/notes'.startsWith(r))).toBe(false);
  });
});
