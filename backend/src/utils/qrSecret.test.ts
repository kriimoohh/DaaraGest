import { describe, it, expect } from 'vitest';
import { signerQr, verifierQr } from './qrSecret';
import { jetonDuQr } from '../modules/pointage/pointage.service';

const TOKEN = '3f2b8c1e-9d4a-4e6f-8a7b-1c2d3e4f5a6b';

describe('QR signés (signerQr / verifierQr)', () => {
  it('un QR signé se vérifie et rend son contenu', () => {
    expect(verifierQr(signerQr({ type: 'eleve', id: 'e1', ets: 'x' }))).toEqual({ type: 'eleve', id: 'e1', ets: 'x' });
  });
  it('un contenu modifié ou une signature fabriquée est rejeté', () => {
    const [b64, sig] = signerQr({ type: 'eleve', id: 'e1' }).split('.');
    const falsifie = Buffer.from(JSON.stringify({ type: 'eleve', id: 'e2' })).toString('base64url');
    expect(verifierQr(`${falsifie}.${sig}`)).toBeNull();
    expect(verifierQr(`${b64}.0000000000000000`)).toBeNull();
    expect(verifierQr(`${b64}.${sig}.x`)).toBeNull();
    expect(verifierQr('pas-un-qr')).toBeNull();
    expect(verifierQr('')).toBeNull();
  });
});

describe('Pointage — jeton lu dans un QR (jetonDuQr)', () => {
  it('accepte le jeton brut de la page Pointage', () => {
    expect(jetonDuQr(TOKEN)).toEqual({ token: TOKEN });
  });
  it('accepte une carte du personnel signée et en extrait le jeton et l\'établissement', () => {
    expect(jetonDuQr(signerQr({ type: 'professeur', id: 'p1', token: TOKEN, ets: 'etab-1' }))).toEqual({ token: TOKEN, ets: 'etab-1' });
  });
  it('refuse une carte élève, une carte falsifiée et un contenu quelconque', () => {
    expect(jetonDuQr(signerQr({ type: 'eleve', id: 'e1', token: TOKEN }))).toBeNull();
    const [, sig] = signerQr({ type: 'professeur', token: TOKEN }).split('.');
    const autre = Buffer.from(JSON.stringify({ type: 'professeur', token: '00000000-0000-4000-8000-000000000000' })).toString('base64url');
    expect(jetonDuQr(`${autre}.${sig}`)).toBeNull();
    expect(jetonDuQr('https://exemple.com')).toBeNull();
  });
});
