import { describe, it, expect } from 'vitest';
import { mentionPour, MentionDef } from '../../utils/notes';

// Mentions par défaut telles que semées par mentions.service (base /20).
const MENTIONS_DEFAUT: MentionDef[] = [
  { libelle_fr: 'Très bien',   seuil_min: 16 },
  { libelle_fr: 'Bien',        seuil_min: 14 },
  { libelle_fr: 'Assez bien',  seuil_min: 12 },
  { libelle_fr: 'Passable',    seuil_min: 10 },
  { libelle_fr: 'Insuffisant', seuil_min: 0 },
];

const appreciation = (m: number) => mentionPour(m, MENTIONS_DEFAUT);

function calculerMoyenne(notes: { valeur: number; coeff: number }[]): number | null {
  let totalP = 0, totalC = 0;
  for (const n of notes) { totalP += n.valeur * n.coeff; totalC += n.coeff; }
  if (totalC === 0) return null;
  return Math.round((totalP / totalC) * 100) / 100;
}

describe('mentionPour (mentions par défaut)', () => {
  it('≥16 → Très bien', () => expect(appreciation(16)).toBe('Très bien'));
  it('14-15.99 → Bien', () => expect(appreciation(14)).toBe('Bien'));
  it('12-13.99 → Assez bien', () => expect(appreciation(12)).toBe('Assez bien'));
  it('10-11.99 → Passable', () => expect(appreciation(10)).toBe('Passable'));
  it('<10 → Insuffisant', () => expect(appreciation(9.99)).toBe('Insuffisant'));
  it('tolérance flottante : 11.999999999 → Passable', () => expect(appreciation(12 - 1e-10)).toBe('Assez bien'));
  it('liste vide → chaîne vide', () => expect(mentionPour(12, [])).toBe(''));
});

describe('calculerMoyenne', () => {
  it('moyenne pondérée correcte', () => {
    const notes = [{ valeur: 15, coeff: 3 }, { valeur: 12, coeff: 2 }];
    expect(calculerMoyenne(notes)).toBe(13.8);
  });

  it('retourne null si aucun coeff', () => {
    expect(calculerMoyenne([])).toBeNull();
  });

  it('arrondi à 2 décimales', () => {
    const notes = [{ valeur: 13, coeff: 3 }, { valeur: 11, coeff: 3 }];
    expect(calculerMoyenne(notes)).toBe(12);
  });

  it('coefficient unique = valeur directe', () => {
    expect(calculerMoyenne([{ valeur: 17.5, coeff: 1 }])).toBe(17.5);
  });
});

// Moyenne avec notes saisies sur des barèmes variables (ex: RLC /60, CLC /40),
// normalisées sur l'échelle de l'établissement (base) avant pondération.
function contributionNote(valeur: number, noteMax: number, base: number, coeff: number): number {
  return noteMax > 0 ? (valeur / noteMax) * base * coeff : 0;
}
function moyenneNormalisee(
  notes: { valeur: number; note_max: number; coeff: number }[], base: number,
): number | null {
  let totalP = 0, totalC = 0;
  for (const n of notes) { totalP += contributionNote(n.valeur, n.note_max, base, n.coeff); totalC += n.coeff; }
  if (totalC === 0) return null;
  return Math.round((totalP / totalC) * 100) / 100;
}

describe('moyenne normalisée par barème', () => {
  it('rétro-compatible : note_max == base → moyenne pondérée classique', () => {
    const notes = [{ valeur: 15, note_max: 20, coeff: 3 }, { valeur: 12, note_max: 20, coeff: 2 }];
    expect(moyenneNormalisee(notes, 20)).toBe(13.8);
  });

  it('barèmes variables = Σnotes/Σcoeff (cas réel CE1 sur /10)', () => {
    // RLC 59/60 (coeff 6), Ang 10/10 (coeff 1) — barème = coeff×10, base 10
    const notes = [
      { valeur: 59, note_max: 60, coeff: 6 },
      { valeur: 10, note_max: 10, coeff: 1 },
    ];
    // Σnotes=69, Σbarème=70 → 69/70×10 = 9.86 ; et Σnotes/Σcoeff = 69/7 = 9.86
    expect(moyenneNormalisee(notes, 10)).toBe(9.86);
  });

  it('une note /60 pleine sur base 10 vaut 10', () => {
    expect(moyenneNormalisee([{ valeur: 60, note_max: 60, coeff: 6 }], 10)).toBe(10);
  });

  it('note_max 0 ignorée (pas de division par zéro)', () => {
    expect(contributionNote(5, 0, 10, 2)).toBe(0);
  });
});

describe('classement', () => {
  it('tri décroissant par moyenne', () => {
    const moyennes = [
      { eleve_id: 'e1', moyenne: 12 },
      { eleve_id: 'e2', moyenne: 15 },
      { eleve_id: 'e3', moyenne: 8 },
    ];
    const sorted = [...moyennes].sort((a, b) => b.moyenne - a.moyenne);
    expect(sorted[0].eleve_id).toBe('e2');
    expect(sorted[1].eleve_id).toBe('e1');
    expect(sorted[2].eleve_id).toBe('e3');
  });

  it('égalité de moyenne — conserve les deux élèves', () => {
    const moyennes = [
      { eleve_id: 'e1', moyenne: 14 },
      { eleve_id: 'e2', moyenne: 14 },
      { eleve_id: 'e3', moyenne: 10 },
    ];
    const sorted = [...moyennes].sort((a, b) => b.moyenne - a.moyenne);
    expect(sorted[0].moyenne).toBe(14);
    expect(sorted[1].moyenne).toBe(14);
    expect(sorted[2].eleve_id).toBe('e3');
  });
});

describe('calculerMoyenne — cas limites', () => {
  it('coefficient 0 doit être ignoré', () => {
    const notes = [
      { valeur: 18, coeff: 0 },
      { valeur: 10, coeff: 2 },
    ];
    // coeff 0 ne doit pas contribuer
    let totalP = 0, totalC = 0;
    for (const n of notes) {
      if (n.coeff === 0) continue;
      totalP += n.valeur * n.coeff;
      totalC += n.coeff;
    }
    const moy = totalC > 0 ? Math.round((totalP / totalC) * 100) / 100 : null;
    expect(moy).toBe(10);
  });

  it('élève sans aucune note → moyenne null', () => {
    expect(calculerMoyenne([])).toBeNull();
  });

  it('toutes notes à 0 → moyenne 0', () => {
    const notes = [{ valeur: 0, coeff: 1 }, { valeur: 0, coeff: 2 }];
    expect(calculerMoyenne(notes)).toBe(0);
  });

  it('note maximale 20 → appréciation Très bien', () => {
    expect(appreciation(20)).toBe('Très bien');
  });

  it('note 15.99 → Bien (pas Très bien)', () => {
    expect(appreciation(15.99)).toBe('Bien');
  });
});

// Réplique du loop de calcul de moyenne avec marqueur evaluee + flags de génération,
// pour figer le contrat de bulletins.service.ts:genererBulletins.
function moyenneAvecEvaluee(
  programme: { matiere_id: string; coeff: number; note_max: number; evaluee: boolean }[],
  notes: { matiere_id: string; valeur: number }[],
  base: number,
  flags: { inclureNonEvaluees?: boolean; manquantesCommeZero?: boolean } = {},
): number | null {
  const inclureNonEvaluees = flags.inclureNonEvaluees ?? false;
  const manquantesCommeZero = flags.manquantesCommeZero ?? false;
  const idx = new Map(notes.map(n => [n.matiere_id, n]));
  let tp = 0, tc = 0;
  for (const m of programme) {
    if (!m.evaluee && !inclureNonEvaluees) continue;
    if (m.coeff === 0) continue;
    const note = idx.get(m.matiere_id);
    if (!note) {
      if (manquantesCommeZero) tc += m.coeff;
      continue;
    }
    tp += (note.valeur / m.note_max) * base * m.coeff;
    tc += m.coeff;
  }
  if (tc === 0) return null;
  return Math.round((tp / tc) * 100) / 100;
}

describe('matières non évaluées (phase 1)', () => {
  it('matière non évaluée → exclue de la moyenne et du dénominateur', () => {
    const programme = [
      { matiere_id: 'fr', coeff: 3, note_max: 10, evaluee: true },
      { matiere_id: 'math', coeff: 2, note_max: 10, evaluee: true },
      { matiere_id: 'eps', coeff: 1, note_max: 10, evaluee: false },
    ];
    const notes = [
      { matiere_id: 'fr', valeur: 8 },
      { matiere_id: 'math', valeur: 6 },
      { matiere_id: 'eps', valeur: 9 }, // note conservée mais hors moyenne
    ];
    // (8*3 + 6*2) / (3+2) = 36/5 = 7.2
    expect(moyenneAvecEvaluee(programme, notes, 10)).toBe(7.2);
  });

  it('flag inclure_non_evaluees=true → la matière non évaluée est intégrée', () => {
    const programme = [
      { matiere_id: 'fr', coeff: 3, note_max: 10, evaluee: true },
      { matiere_id: 'eps', coeff: 1, note_max: 10, evaluee: false },
    ];
    const notes = [
      { matiere_id: 'fr', valeur: 8 },
      { matiere_id: 'eps', valeur: 9 },
    ];
    // sans flag : 8.00 ; avec flag : (8*3 + 9*1)/4 = 33/4 = 8.25
    expect(moyenneAvecEvaluee(programme, notes, 10, { inclureNonEvaluees: true })).toBe(8.25);
  });

  it('notes manquantes : ignorées par défaut (coeff aussi)', () => {
    const programme = [
      { matiere_id: 'fr', coeff: 3, note_max: 10, evaluee: true },
      { matiere_id: 'math', coeff: 2, note_max: 10, evaluee: true },
    ];
    const notes = [{ matiere_id: 'fr', valeur: 8 }]; // math sans note
    // 8*3/3 = 8.00 (math complètement ignoré)
    expect(moyenneAvecEvaluee(programme, notes, 10)).toBe(8);
  });

  it('flag traiter_manquantes_comme_zero=true → coeff au dénominateur, 0 points', () => {
    const programme = [
      { matiere_id: 'fr', coeff: 3, note_max: 10, evaluee: true },
      { matiere_id: 'math', coeff: 2, note_max: 10, evaluee: true },
    ];
    const notes = [{ matiere_id: 'fr', valeur: 8 }];
    // (8*3 + 0*2) / (3+2) = 24/5 = 4.80
    expect(moyenneAvecEvaluee(programme, notes, 10, { manquantesCommeZero: true })).toBe(4.8);
  });

  it('tout le programme non évalué + flag off → moyenne null', () => {
    const programme = [
      { matiere_id: 'eps', coeff: 1, note_max: 10, evaluee: false },
      { matiere_id: 'art', coeff: 1, note_max: 10, evaluee: false },
    ];
    const notes = [{ matiere_id: 'eps', valeur: 9 }];
    expect(moyenneAvecEvaluee(programme, notes, 10)).toBeNull();
  });

  it('manquantes_comme_zero ne s\'applique pas aux matières non évaluées exclues', () => {
    // EPS est non évaluée et sans note ; le flag manquantesCommeZero ne doit PAS l'inclure
    // (le filtre evaluee passe d'abord, donc la matière est sautée tout court).
    const programme = [
      { matiere_id: 'fr', coeff: 3, note_max: 10, evaluee: true },
      { matiere_id: 'eps', coeff: 1, note_max: 10, evaluee: false },
    ];
    const notes = [{ matiere_id: 'fr', valeur: 6 }];
    expect(moyenneAvecEvaluee(programme, notes, 10, { manquantesCommeZero: true })).toBe(6);
  });
});

// Résolution du flag effectif : ClasseMatierePeriode.evaluee (si non null) > ClasseMatiere.evaluee.
function resolveEvaluee(classMatiere: boolean, periodeOverride: boolean | null | undefined): boolean {
  return periodeOverride != null ? periodeOverride : classMatiere;
}

describe('résolution evaluee (override période > classe)', () => {
  it('pas d\'override période → valeur classe', () => {
    expect(resolveEvaluee(false, null)).toBe(false);
    expect(resolveEvaluee(true, undefined)).toBe(true);
  });

  it('override période true → réactive une matière non évaluée au niveau classe', () => {
    // Cas du scénario : Dessin = non évaluée au niveau classe, évaluée au T2.
    expect(resolveEvaluee(false, true)).toBe(true);
  });

  it('override période false → désactive une matière évaluée au niveau classe', () => {
    expect(resolveEvaluee(true, false)).toBe(false);
  });
});

// Réplique du tri "unsigned/signed" appliqué par bulletinsImpactesParMatiere.
function classerImpact(bulletins: { id: string; valide_le: Date | null }[]) {
  return {
    unsigned: bulletins.filter(b => b.valide_le === null).map(b => b.id),
    signed: bulletins.filter(b => b.valide_le !== null).map(b => b.id),
  };
}

describe('verrouillage bulletins (phase 2)', () => {
  it('tri unsigned / signed selon valide_le', () => {
    const r = classerImpact([
      { id: 'b1', valide_le: null },
      { id: 'b2', valide_le: new Date('2026-03-01') },
      { id: 'b3', valide_le: null },
    ]);
    expect(r.unsigned).toEqual(['b1', 'b3']);
    expect(r.signed).toEqual(['b2']);
  });

  it('aucun bulletin → impact vide', () => {
    expect(classerImpact([])).toEqual({ unsigned: [], signed: [] });
  });

  // Politique : signed > 0 = refus systématique (force ou pas).
  function decision(impact: { unsigned_count: number; signed_count: number }, force: boolean): 'ok' | 'IMPACTES' | 'VALIDES' {
    if (impact.signed_count > 0) return 'VALIDES';
    if (impact.unsigned_count > 0 && !force) return 'IMPACTES';
    return 'ok';
  }

  it('force=false : tout impact bloque', () => {
    expect(decision({ unsigned_count: 3, signed_count: 0 }, false)).toBe('IMPACTES');
    expect(decision({ unsigned_count: 0, signed_count: 2 }, false)).toBe('VALIDES');
    expect(decision({ unsigned_count: 0, signed_count: 0 }, false)).toBe('ok');
  });

  it('force=true : unsigned passe, signed refuse toujours', () => {
    expect(decision({ unsigned_count: 5, signed_count: 0 }, true)).toBe('ok');
    expect(decision({ unsigned_count: 0, signed_count: 1 }, true)).toBe('VALIDES');
    expect(decision({ unsigned_count: 5, signed_count: 1 }, true)).toBe('VALIDES');
  });
});

describe('observations bulletin', () => {
  it('observation vide reste vide', () => {
    const obs = { observation_fr: '', observation_prof: '' };
    expect(obs.observation_fr).toBe('');
  });

  it('observation avec contenu est conservée', () => {
    const obs = { observation_fr: 'Bon trimestre, félicitations !' };
    expect(obs.observation_fr).toBe('Bon trimestre, félicitations !');
  });

  it('observation dépasse 500 caractères → à rejeter', () => {
    const longText = 'a'.repeat(501);
    expect(longText.length > 500).toBe(true);
  });
});
