import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { reponseErreur, messageZod } from './errorHandler';
import { NotFoundError, ValidationError, ConflictError } from './errors';

describe('reponseErreur — traduction des erreurs en réponses HTTP', () => {
  it('erreur métier typée : son code et son message', () => {
    expect(reponseErreur(new NotFoundError('Bulletin introuvable'))).toEqual({ status: 404, error: 'Bulletin introuvable', loguer: false });
    expect(reponseErreur(new ValidationError('Aperçu indisponible'))).toMatchObject({ status: 400 });
    expect(reponseErreur(new ConflictError('Doublon'))).toMatchObject({ status: 409 });
  });

  it('ZodError (schema.parse dans une route) : 400 avec champ et raison, jamais 500', () => {
    const r = z.object({ nom: z.string().min(1), n: z.number() }).safeParse({ nom: '', n: 'x' });
    if (r.success) throw new Error('inattendu');
    const rep = reponseErreur(r.error);
    expect(rep.status).toBe(400);
    expect(rep.loguer).toBe(false);
    expect(rep.error).toBe(messageZod(r.error));
    expect(rep.error).toMatch(/^nom : /);
    expect(rep.error).not.toContain('[\n'); // plus de JSON brut de l'exception
  });

  it('erreur Prisma : P2025 → 404, autres → 400, sans détail interne', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found: secret SQL', { code: 'P2025', clientVersion: '5' });
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`x`)', { code: 'P2002', clientVersion: '5' });
    expect(reponseErreur(p2025)).toEqual({ status: 404, error: 'Ressource introuvable', loguer: false });
    expect(reponseErreur(p2002)).toEqual({ status: 400, error: 'Données invalides', loguer: false });
  });

  it('erreur inattendue : 500 générique, message interne jamais renvoyé, à journaliser', () => {
    const r = reponseErreur(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'));
    expect(r).toEqual({ status: 500, error: 'Erreur interne du serveur', loguer: true });
  });

  it('erreur portant un statusCode < 500 (ex. 429 du rate-limit) : conservée', () => {
    const e = Object.assign(new Error('Trop de requêtes.'), { statusCode: 429 });
    expect(reponseErreur(e)).toEqual({ status: 429, error: 'Trop de requêtes.', loguer: false });
  });
});
