import { z } from 'zod';

export const jwtPayloadSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  etablissement_id: z.string().uuid(),
  langue: z.string().min(1),
  theme: z.string().min(1),
  doit_changer_mdp: z.boolean(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
