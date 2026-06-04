import { describe, it, expect } from 'vitest';
import { estModeStrict, PolitiqueSaisieNotes } from './teachingPolicy';

// ── Logique pure de bascule insertOnly ────────────────────────────────────────
// `insertOnly` est levé dès qu'on sort du mode strict. Cette fonction
// reproduit la décision faite dans bulkUpsertNotes pour la couvrir en test.
function resoudreInsertOnly(hint: boolean, politique: PolitiqueSaisieNotes): boolean {
  if (!hint) return false;
  return estModeStrict(politique);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('teachingPolicy — estModeStrict', () => {
  it('strict si les deux booléens sont false', () => {
    expect(estModeStrict({ autoriser_toutes_matieres: false, autoriser_toutes_classes: false })).toBe(true);
  });

  it('non-strict si toutes_matieres uniquement', () => {
    expect(estModeStrict({ autoriser_toutes_matieres: true, autoriser_toutes_classes: false })).toBe(false);
  });

  it('non-strict si toutes_classes uniquement', () => {
    expect(estModeStrict({ autoriser_toutes_matieres: false, autoriser_toutes_classes: true })).toBe(false);
  });

  it('non-strict si les deux booléens sont true', () => {
    expect(estModeStrict({ autoriser_toutes_matieres: true, autoriser_toutes_classes: true })).toBe(false);
  });
});

describe('teachingPolicy — insertOnly couplé à la politique', () => {
  const strict: PolitiqueSaisieNotes = { autoriser_toutes_matieres: false, autoriser_toutes_classes: false };
  const crossMat: PolitiqueSaisieNotes = { autoriser_toutes_matieres: true, autoriser_toutes_classes: false };
  const crossCla: PolitiqueSaisieNotes = { autoriser_toutes_matieres: false, autoriser_toutes_classes: true };
  const total: PolitiqueSaisieNotes = { autoriser_toutes_matieres: true, autoriser_toutes_classes: true };

  it('strict : insertOnly conservé si demandé (comportement actuel)', () => {
    expect(resoudreInsertOnly(true, strict)).toBe(true);
  });

  it('strict : insertOnly reste false si pas demandé (admin)', () => {
    expect(resoudreInsertOnly(false, strict)).toBe(false);
  });

  it('cross-matières : insertOnly levé même si demandé', () => {
    expect(resoudreInsertOnly(true, crossMat)).toBe(false);
  });

  it('cross-classes : insertOnly levé même si demandé', () => {
    expect(resoudreInsertOnly(true, crossCla)).toBe(false);
  });

  it('total : insertOnly levé même si demandé', () => {
    expect(resoudreInsertOnly(true, total)).toBe(false);
  });
});
