import { z } from 'zod';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
// Refuse aussi les caractères de contrôle (\x00-\x1f, \x7f) pour bloquer
// les attaques par null-byte injection et autres bypass.
// eslint-disable-next-line no-control-regex
const HTTPS_URL_RE = /^https:\/\/[^\s<>"'\\\x00-\x1f\x7f]+$/;
const MAX_PHOTO_BYTES = 2_000_000;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validatePhotoUrl(value: string): ValidationResult {
  if (typeof value !== 'string') return { ok: false, reason: 'Photo invalide' };
  if (value.length === 0) return { ok: true };
  if (value.length > MAX_PHOTO_BYTES) {
    return { ok: false, reason: 'Photo trop volumineuse (max ~1.5 Mo)' };
  }

  const dataMatch = DATA_URL_RE.exec(value);
  if (dataMatch) {
    const mime = dataMatch[1];
    if (!ALLOWED_MIME.includes(mime as typeof ALLOWED_MIME[number])) {
      return { ok: false, reason: 'Format image non supporté' };
    }
    return { ok: true };
  }

  if (HTTPS_URL_RE.test(value)) return { ok: true };

  return { ok: false, reason: 'Photo invalide (data:image/* base64 ou https:// uniquement)' };
}

export const photoUrlSchema = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || validatePhotoUrl(v).ok, {
    message: 'Photo invalide (formats acceptés : JPEG, PNG, WebP en data URL base64 ou URL HTTPS, max ~1.5 Mo)',
  });
