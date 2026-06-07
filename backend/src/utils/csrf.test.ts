import { describe, it, expect } from 'vitest';
import { isOriginBlocked } from './csrf';

const allowed = new Set(['https://dg.sakai.sn', 'http://localhost:5173']);

describe('isOriginBlocked (protection CSRF par Origin)', () => {
  it('laisse passer les méthodes sûres quel que soit l\'Origin', () => {
    expect(isOriginBlocked('GET', '/api/v1/eleves', 'https://evil.com', allowed)).toBe(false);
    expect(isOriginBlocked('HEAD', '/api/v1/eleves', 'https://evil.com', allowed)).toBe(false);
    expect(isOriginBlocked('OPTIONS', '/api/v1/eleves', 'https://evil.com', allowed)).toBe(false);
  });

  it('bloque une mutation avec un Origin non autorisé', () => {
    expect(isOriginBlocked('POST', '/api/v1/eleves', 'https://evil.com', allowed)).toBe(true);
    expect(isOriginBlocked('DELETE', '/api/v1/eleves/x', 'https://evil.com', allowed)).toBe(true);
  });

  it('laisse passer une mutation avec un Origin autorisé', () => {
    expect(isOriginBlocked('POST', '/api/v1/eleves', 'https://dg.sakai.sn', allowed)).toBe(false);
    expect(isOriginBlocked('PUT', '/api/v1/eleves/x', 'http://localhost:5173', allowed)).toBe(false);
  });

  it('laisse passer une mutation sans Origin (client non-navigateur)', () => {
    expect(isOriginBlocked('POST', '/api/v1/eleves', undefined, allowed)).toBe(false);
  });

  it('ne concerne pas les routes hors /api/v1/', () => {
    expect(isOriginBlocked('POST', '/health', 'https://evil.com', allowed)).toBe(false);
  });
});
