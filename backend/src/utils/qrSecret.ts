import { env } from '../config/env';

// Source unique pour récupérer le secret HMAC des QR codes (cartes élève /
// personnel). Validé au boot par config/env.ts (Zod min 32 chars), donc on se
// contente d'un alias ici pour permettre l'import court.
export function getQrSecret(): string {
  return env.QR_SECRET;
}
