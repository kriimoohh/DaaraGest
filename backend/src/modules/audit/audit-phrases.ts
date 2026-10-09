// Phrases lisibles du journal d'audit.
//
// Le journal stockait des « détails » techniques (identifiants UUID, drapeaux, listes
// d'ids). Ce module les transforme en une PHRASE compréhensible par quelqu'un qui ne
// connaît pas l'informatique : « a enregistré un paiement de 25 000 FCFA pour Sira Sow ».
//
// Séparation voulue (comme pour les libellés d'actions) :
//   - le back résout les NOMS (élève, classe, matière…) à partir des identifiants et
//     choisit la clé de phrase + ses paramètres ;
//   - le front met les mots dans la langue de l'utilisateur (audit.phrases.<clé>).
// Un nom introuvable (donnée supprimée depuis) vaut `null` : le front affiche alors
// « (élément supprimé) » plutôt qu'un identifiant illisible.

export type Params = Record<string, string | number | boolean | null>;
export interface PhraseAudit { cle: string; params: Params }

export interface EntreeAudit {
  action: string; // action SÉMANTIQUE (déjà normalisée)
  entite: string;
  entite_id: string;
  details: Record<string, unknown> | null;
}

export interface ContexteNoms {
  eleves: Map<string, { nom: string; matricule: string }>;
  classes: Map<string, string>;
  matieres: Map<string, string>;
  annees: Map<string, string>;
  roles: Map<string, string>;
  personnels: Map<string, string>;
  utilisateurs: Map<string, { nom: string; identifiant: string }>;
  inscriptions: Map<string, string>; // inscription_id -> eleve_id
  paiements: Map<string, { eleve_id: string; recu: string | null; type: string; montant: string }>;
  bulletins: Map<string, { eleve_id: string; periode: number }>;
}

export function contexteVide(): ContexteNoms {
  return {
    eleves: new Map(), classes: new Map(), matieres: new Map(), annees: new Map(), roles: new Map(),
    personnels: new Map(), utilisateurs: new Map(), inscriptions: new Map(), paiements: new Map(), bulletins: new Map(),
  };
}

/** Toutes les clés de phrase possibles — sert au test garde-fou des traductions. */
export const CLES_PHRASES = [
  'defaut',
  'CREATE.Eleve', 'CREATE.Eleve.lot', 'UPDATE.Eleve', 'DELETE.Eleve', 'DELETE.Eleve.lot',
  'UPDATE.Inscription', 'UPDATE.Inscription.transfert',
  'CREATE.Utilisateur', 'UPDATE.Utilisateur', 'DELETE.Utilisateur', 'DELETE.Utilisateur.definitif',
  'PASSWORD_RESET', 'USER_REACTIVATE',
  'CREATE.Filiere', 'UPDATE.Filiere', 'DELETE.Filiere',
  'CREATE.PaiementEleve', 'CREATE.PaiementEleve.lot', 'UPDATE.PaiementEleve', 'DELETE.PaiementEleve',
  'CREATE.PaiementPersonnel',
  'CREATE.Note', 'UPDATE.Note', 'DELETE.Note',
  'UPDATE.Bulletin', 'UPDATE.Bulletin.observation', 'BULLETIN_DEVERROUILLAGE',
  'UPDATE.ClasseMatiere.evaluee_oui', 'UPDATE.ClasseMatiere.evaluee_non',
  'UPDATE.ClasseMatierePeriode.evaluee_oui', 'UPDATE.ClasseMatierePeriode.evaluee_non',
  'DELETE.ClasseMatierePeriode', 'CREATE.Classe.reconduction',
  'CREATE.CahierSeance', 'UPDATE.CahierSeance', 'DELETE.CahierSeance',
  'CREATE.Devoir', 'UPDATE.Devoir', 'DELETE.Devoir',
  'CREATE.CahierVisa', 'DELETE.CahierVisa',
  'PORTAIL_GENERATE', 'PORTAIL_GENERATE.rotation', 'PORTAIL_REVOKE',
  'PROGRESSION_VALIDATE',
] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Références (ids) à résoudre pour une page de lignes — évite une requête par ligne. */
export function collecterReferences(entrees: EntreeAudit[]) {
  const r = {
    eleves: new Set<string>(), classes: new Set<string>(), matieres: new Set<string>(), annees: new Set<string>(),
    personnels: new Set<string>(), utilisateurs: new Set<string>(), inscriptions: new Set<string>(),
    paiements: new Set<string>(), bulletins: new Set<string>(), aRoles: false,
  };
  for (const e of entrees) {
    const d = e.details ?? {};
    const ajout = (s: Set<string>, v: unknown) => { const x = str(v); if (x) s.add(x); };
    ajout(r.eleves, d.eleve_id);
    ajout(r.classes, d.classe_id); ajout(r.classes, d.ancienne_classe_id); ajout(r.classes, d.nouvelle_classe_id);
    ajout(r.matieres, d.matiere_id);
    if (Array.isArray(d.matiere_ids)) d.matiere_ids.forEach(m => ajout(r.matieres, m));
    ajout(r.annees, d.source); ajout(r.annees, d.cible);
    ajout(r.personnels, d.personnel_id);
    if (e.entite === 'Inscription') ajout(r.inscriptions, e.entite_id);
    if (e.entite === 'PaiementEleve' && e.entite_id !== 'bulk') ajout(r.paiements, e.entite_id);
    if (e.entite === 'Bulletin' && e.entite_id !== 'deverrouillage_periode') ajout(r.bulletins, e.entite_id);
    if (e.entite === 'Utilisateur') ajout(r.utilisateurs, e.entite_id);
    if (e.entite === 'Utilisateur') r.aRoles = true;
  }
  return r;
}

/**
 * Construit la phrase d'une entrée. Pure (aucune requête) : testable sans base.
 * Toute combinaison inconnue retombe sur `defaut` (le front affiche alors
 * « <action> — <type> » sans jamais montrer de JSON ni d'identifiant).
 */
export function construirePhrase(e: EntreeAudit, c: ContexteNoms): PhraseAudit {
  const d = e.details ?? {};
  const sub = str(d.action);
  const eleveNom = (id: unknown) => { const x = str(id); return x ? (c.eleves.get(x)?.nom ?? null) : null; };
  const classeNom = (id: unknown) => { const x = str(id); return x ? (c.classes.get(x) ?? null) : null; };
  const matiereNom = (id: unknown) => { const x = str(id); return x ? (c.matieres.get(x) ?? null) : null; };
  const ph = (cle: string, params: Params = {}): PhraseAudit => ({ cle, params });
  const bulk = e.entite_id === 'bulk';

  switch (`${e.action}.${e.entite}`) {
    case 'CREATE.Eleve':
      return bulk ? ph('CREATE.Eleve.lot', { count: num(d.count) })
        : ph('CREATE.Eleve', { nom: str(d.nom), matricule: str(d.matricule) });
    case 'UPDATE.Eleve': return ph('UPDATE.Eleve', { nom: str(d.nom) });
    case 'DELETE.Eleve':
      return bulk ? ph('DELETE.Eleve.lot', { count: num(d.count) }) : ph('DELETE.Eleve', { matricule: str(d.matricule) });

    case 'UPDATE.Inscription': {
      if (sub !== 'transfert') return ph('UPDATE.Inscription');
      const eleveId = c.inscriptions.get(e.entite_id);
      return ph('UPDATE.Inscription.transfert', {
        eleve: eleveId ? eleveNom(eleveId) : null,
        ancienne: classeNom(d.ancienne_classe_id), nouvelle: classeNom(d.nouvelle_classe_id), filiere: str(d.filiere),
      });
    }

    case 'CREATE.Utilisateur':
      return ph('CREATE.Utilisateur', { identifiant: str(d.identifiant), role: str(d.role) });
    case 'UPDATE.Utilisateur': {
      const ch = (d.changes && typeof d.changes === 'object' ? d.changes : {}) as Record<string, unknown>;
      const u = c.utilisateurs.get(e.entite_id);
      return ph('UPDATE.Utilisateur', {
        identifiant: str(ch.identifiant) ?? u?.identifiant ?? null,
        nom: [str(ch.prenom_fr), str(ch.nom_fr)].filter(Boolean).join(' ') || u?.nom || null,
      });
    }
    case 'DELETE.Utilisateur':
      return ph(sub === 'hard_delete' ? 'DELETE.Utilisateur.definitif' : 'DELETE.Utilisateur', { identifiant: str(d.identifiant) });
    case 'PASSWORD_RESET.Utilisateur': return ph('PASSWORD_RESET', { identifiant: str(d.identifiant) });
    case 'USER_REACTIVATE.Utilisateur': return ph('USER_REACTIVATE', { identifiant: str(d.identifiant) });

    case 'CREATE.Filiere': case 'UPDATE.Filiere': case 'DELETE.Filiere':
      return ph(`${e.action}.Filiere`, { code: str(d.code) });

    case 'CREATE.PaiementEleve':
      return bulk ? ph('CREATE.PaiementEleve.lot', { count: num(d.count), montant: num(d.montant), type: str(d.type) })
        : ph('CREATE.PaiementEleve', { eleve: eleveNom(d.eleve_id), montant: num(d.montant), type: str(d.type), recu: str(d.recu) });
    case 'UPDATE.PaiementEleve': {
      const p = c.paiements.get(e.entite_id);
      const ch = (d.changes && typeof d.changes === 'object' ? d.changes : {}) as Record<string, unknown>;
      return ph('UPDATE.PaiementEleve', {
        eleve: p ? eleveNom(p.eleve_id) : null, recu: p?.recu ?? null,
        montant: num(ch.montant) ?? (p ? num(p.montant) : null), type: str(ch.type) ?? p?.type ?? null,
      });
    }
    case 'DELETE.PaiementEleve':
      return ph('DELETE.PaiementEleve', { eleve: eleveNom(d.eleve_id), montant: num(d.montant), recu: str(d.recu) });
    case 'CREATE.PaiementPersonnel': {
      const pid = str(d.personnel_id);
      return ph('CREATE.PaiementPersonnel', {
        personnel: pid ? (c.personnels.get(pid) ?? null) : null, mois: num(d.mois), annee: num(d.annee), net: num(d.net),
      });
    }

    case 'CREATE.Note': case 'UPDATE.Note': {
      const ids = Array.isArray(d.matiere_ids) ? d.matiere_ids : [];
      const noms = [...new Set(ids.map(matiereNom).filter((x): x is string => !!x))];
      return ph(`${e.action}.Note`, {
        count: num(d.count), created: num(d.created), updated: num(d.updated),
        matieres: noms.length ? (noms.length > 3 ? `${noms.slice(0, 3).join(', ')}…` : noms.join(', ')) : null,
      });
    }
    case 'DELETE.Note': return ph('DELETE.Note', { count: num(d.count) });

    case 'UPDATE.Bulletin': {
      const b = c.bulletins.get(e.entite_id);
      return ph(sub === 'observation' ? 'UPDATE.Bulletin.observation' : 'UPDATE.Bulletin', {
        eleve: b ? eleveNom(b.eleve_id) : null, periode: b ? b.periode : null,
      });
    }
    case 'BULLETIN_DEVERROUILLAGE.Bulletin':
      return ph('BULLETIN_DEVERROUILLAGE', { classe: classeNom(d.classe_id), periode: num(d.periode), filiere: str(d.filiere), count: num(d.count) });

    case 'UPDATE.ClasseMatiere':
      return ph(`UPDATE.ClasseMatiere.${d.nouveau === false ? 'evaluee_non' : 'evaluee_oui'}`,
        { classe: classeNom(d.classe_id), matiere: matiereNom(d.matiere_id) });
    case 'UPDATE.ClasseMatierePeriode':
      return ph(`UPDATE.ClasseMatierePeriode.${d.nouveau === false ? 'evaluee_non' : 'evaluee_oui'}`,
        { classe: classeNom(d.classe_id), matiere: matiereNom(d.matiere_id), periode: num(d.periode) });
    case 'DELETE.ClasseMatierePeriode':
      return ph('DELETE.ClasseMatierePeriode', { classe: classeNom(d.classe_id), matiere: matiereNom(d.matiere_id), periode: num(d.periode) });

    case 'CREATE.Classe':
      if (e.entite_id !== 'reconduction') return ph('defaut');
      return ph('CREATE.Classe.reconduction', {
        count: num(d.count), source: str(d.source) ? (c.annees.get(String(d.source)) ?? null) : null,
        cible: str(d.cible) ? (c.annees.get(String(d.cible)) ?? null) : null, avec_matieres: d.matieres !== 'aucune',
      });

    case 'CREATE.CahierSeance': case 'UPDATE.CahierSeance': case 'DELETE.CahierSeance':
      return ph(`${e.action}.CahierSeance`, { classe: classeNom(d.classe_id), matiere: matiereNom(d.matiere_id), date: str(d.date) });
    case 'CREATE.Devoir': case 'UPDATE.Devoir': case 'DELETE.Devoir':
      return ph(`${e.action}.Devoir`, { classe: classeNom(d.classe_id), matiere: matiereNom(d.matiere_id), pour_le: str(d.pour_le) });
    case 'CREATE.CahierVisa': case 'DELETE.CahierVisa':
      return ph(`${e.action}.CahierVisa`, { classe: classeNom(d.classe_id), du: str(d.du), au: str(d.au) });

    case 'PORTAIL_GENERATE.PortailParentToken':
      return ph(d.code === 'rotation' ? 'PORTAIL_GENERATE.rotation' : 'PORTAIL_GENERATE', { nom: str(d.nom), matricule: str(d.matricule) });
    case 'PORTAIL_REVOKE.PortailParentToken':
      return ph('PORTAIL_REVOKE', { nom: str(d.nom), matricule: str(d.matricule) });

    case 'PROGRESSION_VALIDATE.ProgressionEleve':
      return ph('PROGRESSION_VALIDATE', { nom: str(d.nom), matricule: str(d.matricule), decision: str(d.code) });

    default:
      return ph('defaut');
  }
}
