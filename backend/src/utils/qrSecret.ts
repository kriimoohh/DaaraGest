import crypto from 'crypto';
import { env } from '../config/env';

// QR codes des cartes (élève / personnel) : contenu JSON encodé en base64url + signature HMAC-SHA256
// (QR_SECRET) tronquée à 16 caractères hexadécimaux. La signature garantit que le contenu a bien été
// émis par l'établissement : un QR fabriqué ou modifié est rejeté par verifierQr.

export function getQrSecret(): string {
  return env.QR_SECRET;
}

const signature = (data: string) => crypto.createHmac('sha256', getQrSecret()).update(data).digest('hex').slice(0, 16);

/** Contenu signé à encoder dans le QR : `<json base64url>.<signature>`. */
export function signerQr(payload: object): string {
  const data = JSON.stringify(payload);
  return `${Buffer.from(data).toString('base64url')}.${signature(data)}`;
}

/**
 * Vérifie un contenu de QR signé et renvoie son contenu, ou null s'il est mal formé ou si la signature
 * ne correspond pas (comparaison à temps constant).
 */
export function verifierQr(chaine: string): Record<string, unknown> | null {
  const [b64, sig, reste] = chaine.trim().split('.');
  if (!b64 || !sig || reste !== undefined || !/^[0-9a-f]{16}$/.test(sig)) return null;
  let data: string;
  try { data = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const attendue = Buffer.from(signature(data));
  const recue = Buffer.from(sig);
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return null;
  try {
    const payload = JSON.parse(data);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch { return null; }
}
