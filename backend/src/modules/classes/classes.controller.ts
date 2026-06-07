import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../../utils/jwt';
import { classeSchema, classeMatiereSchema, classeMatiereUpdateSchema, classeMatierePeriodeSchema, dupliquerArSchema } from './classes.schema';
import { listerClasses, getClasse, creerClasse, modifierClasse, supprimerClasse, listerElevesDeClasse, genererPdfListeClasse, genererPdfToutesClasses, listerMatieresDeclasse, ajouterMatiereClasse, modifierMatiereClasse, supprimerMatiereClasse, dupliquerClasseFrEnAr, upsertOverridePeriode, supprimerOverridePeriode } from './classes.service';

export async function listerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id, filiere } = request.query as Record<string, string | undefined>;
  const data = await listerClasses(etablissement_id, annee_scolaire_id, filiere);
  return reply.send(data);
}

export async function getHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await getClasse(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function creerHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const parsed = classeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await creerClasse(etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function modifierHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = classeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await modifierClasse(id, etablissement_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    await supprimerClasse(id, etablissement_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function listerElevesHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const data = await listerElevesDeClasse(id, etablissement_id, annee_scolaire_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function pdfListeClasseHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const { annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const pdf = await genererPdfListeClasse(id, etablissement_id, annee_scolaire_id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="liste-classe-${id}.pdf"`);
    return reply.send(pdf);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function pdfToutesClassesHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { annee_scolaire_id } = request.query as Record<string, string | undefined>;
  try {
    const pdf = await genererPdfToutesClasses(etablissement_id, annee_scolaire_id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="toutes-les-classes.pdf"');
    return reply.send(pdf);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

// ─── Duplication FR → AR ─────────────────────────────────────────────────────

export async function dupliquerArHandler(request: FastifyRequest, reply: FastifyReply) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = dupliquerArSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const result = await dupliquerClasseFrEnAr(id, etablissement_id, parsed.data);
    return reply.status(201).send(result);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('introuvable') ? 404 : 400;
    return reply.status(status).send({ error: msg });
  }
}

// ─── Programme de matières par classe ───────────────────────────────────────

export async function listerMatieresClasseHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  try {
    const data = await listerMatieresDeclasse(id, etablissement_id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function ajouterMatiereClasseHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = classeMatiereSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await ajouterMatiereClasse(id, etablissement_id, parsed.data);
    return reply.status(201).send(data);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('introuvable') ? 404 : 400;
    return reply.status(status).send({ error: msg });
  }
}

export async function modifierMatiereClasseHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, matiere_id } = request.params as { id: string; matiere_id: string };
  const parsed = classeMatiereUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }
  try {
    const data = await modifierMatiereClasse(id, etablissement_id, matiere_id, parsed.data);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerMatiereClasseHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, matiere_id } = request.params as { id: string; matiere_id: string };
  try {
    await supprimerMatiereClasse(id, etablissement_id, matiere_id);
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function upsertOverridePeriodeHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id } = request.params as { id: string };
  const parsed = classeMatierePeriodeSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
  try {
    return reply.send(await upsertOverridePeriode(id, etablissement_id, parsed.data));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function supprimerOverridePeriodeHandler(
  request: FastifyRequest, reply: FastifyReply
) {
  const { etablissement_id } = request.user as JwtPayload;
  const { id, matiere_id, periode } = request.params as { id: string; matiere_id: string; periode: string };
  try {
    await supprimerOverridePeriode(id, etablissement_id, matiere_id, parseInt(periode));
    return reply.status(204).send();
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
