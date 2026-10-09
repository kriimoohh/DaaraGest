import { z } from 'zod';

export const jwtPayloadSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  etablissement_id: z.string().min(1),
  langue: z.string().min(1),
  theme: z.string().min(1),
  doit_changer_mdp: z.boolean(),
  // Version de session (Utilisateur.token_version). Absente des jetons émis avant son introduction : lue comme 0.
  tv: z.number().int().optional(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
