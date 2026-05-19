import { describe, it, expect } from 'vitest';
import { validatePhotoUrl, photoUrlSchema } from './photoUrl';

const validJpegBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(100);
const validPngBase64 = 'data:image/png;base64,' + 'B'.repeat(100) + '==';
const validWebpBase64 = 'data:image/webp;base64,' + 'C'.repeat(100);

describe('validatePhotoUrl — formats acceptés', () => {
  it('accepte une data URL JPEG base64', () => {
    expect(validatePhotoUrl(validJpegBase64).ok).toBe(true);
  });

  it('accepte une data URL PNG base64 avec padding', () => {
    expect(validatePhotoUrl(validPngBase64).ok).toBe(true);
  });

  it('accepte une data URL WebP base64', () => {
    expect(validatePhotoUrl(validWebpBase64).ok).toBe(true);
  });

  it('accepte une URL HTTPS', () => {
    expect(validatePhotoUrl('https://cdn.example.sn/photo.jpg').ok).toBe(true);
  });

  it('accepte une URL HTTPS avec query string', () => {
    expect(validatePhotoUrl('https://cdn.example.sn/photo.jpg?v=42').ok).toBe(true);
  });

  it('accepte une chaîne vide (équivalent à pas de photo)', () => {
    expect(validatePhotoUrl('').ok).toBe(true);
  });
});

describe('validatePhotoUrl — formats refusés (XSS / SSRF)', () => {
  it('refuse une URL javascript:', () => {
    expect(validatePhotoUrl('javascript:alert(1)').ok).toBe(false);
  });

  it('refuse une URL HTTP (non HTTPS)', () => {
    expect(validatePhotoUrl('http://attacker.com/x.jpg').ok).toBe(false);
  });

  it('refuse un data URL SVG (vecteur XSS)', () => {
    const svg = 'data:image/svg+xml;base64,' + 'D'.repeat(100);
    expect(validatePhotoUrl(svg).ok).toBe(false);
  });

  it('refuse un data URL HTML', () => {
    const html = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
    expect(validatePhotoUrl(html).ok).toBe(false);
  });

  it('refuse une chaîne avec injection HTML', () => {
    expect(validatePhotoUrl('x" onerror="alert(1)').ok).toBe(false);
  });

  it('refuse une chaîne avec balise', () => {
    expect(validatePhotoUrl('<script>alert(1)</script>').ok).toBe(false);
  });

  it('refuse un chemin file://', () => {
    expect(validatePhotoUrl('file:///etc/passwd').ok).toBe(false);
  });

  it('refuse une URL avec espaces (potentielle injection)', () => {
    expect(validatePhotoUrl('https://example.sn/a b.jpg').ok).toBe(false);
  });

  it('refuse une URL avec quote (potentielle injection)', () => {
    expect(validatePhotoUrl('https://example.sn/a".jpg').ok).toBe(false);
  });

  it('refuse une URL avec backslash', () => {
    expect(validatePhotoUrl('https://example.sn/a\\b.jpg').ok).toBe(false);
  });

  it('refuse un data URL avec MIME image inconnu', () => {
    const bmp = 'data:image/bmp;base64,' + 'E'.repeat(100);
    expect(validatePhotoUrl(bmp).ok).toBe(false);
  });

  it('refuse un data URL base64 avec caractères invalides', () => {
    expect(validatePhotoUrl('data:image/jpeg;base64,!!!INVALID!!!').ok).toBe(false);
  });

  it('refuse une chaîne aléatoire', () => {
    expect(validatePhotoUrl('/uploads/photo.jpg').ok).toBe(false);
  });
});

describe('validatePhotoUrl — limites de taille', () => {
  it('refuse une data URL > 2 Mo', () => {
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(2_000_001);
    const res = validatePhotoUrl(huge);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/volumineuse/);
  });

  it('accepte une data URL juste sous la limite (1.9 Mo)', () => {
    const data = 'data:image/jpeg;base64,' + 'A'.repeat(1_900_000);
    expect(validatePhotoUrl(data).ok).toBe(true);
  });
});

describe('photoUrlSchema (Zod)', () => {
  it('accepte undefined (champ optionnel)', () => {
    expect(photoUrlSchema.parse(undefined)).toBeUndefined();
  });

  it('accepte une chaîne vide', () => {
    expect(photoUrlSchema.parse('')).toBe('');
  });

  it('accepte un data URL JPEG valide', () => {
    expect(photoUrlSchema.parse(validJpegBase64)).toBe(validJpegBase64);
  });

  it('rejette un javascript:', () => {
    expect(() => photoUrlSchema.parse('javascript:alert(1)')).toThrow();
  });

  it('rejette un SVG', () => {
    expect(() => photoUrlSchema.parse('data:image/svg+xml;base64,PHN2Zw==')).toThrow();
  });

  it('rejette une URL HTTP', () => {
    expect(() => photoUrlSchema.parse('http://example.com/x.jpg')).toThrow();
  });
});

describe('validatePhotoUrl — bypass attempts', () => {
  it('refuse une casse mixte dans le MIME (attaque par variation)', () => {
    expect(validatePhotoUrl('data:Image/JPEG;base64,AAAA').ok).toBe(false);
  });

  it('refuse une casse mixte dans le scheme data', () => {
    expect(validatePhotoUrl('DATA:image/jpeg;base64,AAAA').ok).toBe(false);
  });

  it('refuse un double scheme', () => {
    expect(validatePhotoUrl('data:data:image/jpeg;base64,AAAA').ok).toBe(false);
  });

  it('refuse l\'ajout de paramètres au MIME', () => {
    expect(validatePhotoUrl('data:image/jpeg;charset=utf-8;base64,AAAA').ok).toBe(false);
  });

  it('refuse un type inconnu déguisé', () => {
    expect(validatePhotoUrl('data:image/jpegextra;base64,AAAA').ok).toBe(false);
  });

  it('refuse un null byte injection', () => {
    expect(validatePhotoUrl('https://example.sn/photo.jpg\x00.evil').ok).toBe(false);
  });
});
