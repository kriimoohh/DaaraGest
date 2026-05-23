import prisma from '../../config/database';
import { GenererBulletinInput, GenererBulletinAnnuelInput, ObservationInput } from './bulletins.schema';
import { renderPdfHtml } from '../../utils/browserPool';
import { assertProfPeutAccederClasse } from '../../utils/teachingPolicy';
import { logAction } from '../../utils/audit';

type Filiere = 'FR' | 'AR' | 'COMBINE';

export type SeuilsMentions = {
  tres_bien: number;
  bien: number;
  assez_bien: number;
  passable: number;
};

const SEUILS_DEFAUT: SeuilsMentions = { tres_bien: 16, bien: 14, assez_bien: 12, passable: 10 };

const LIBELLES: Record<'FR' | 'AR', { tres_bien: string; bien: string; assez_bien: string; passable: string; insuffisant: string }> = {
  FR: {
    tres_bien:   'Très bien — Félicitations du conseil',
    bien:        'Bien',
    assez_bien:  'Assez bien',
    passable:    'Passable',
    insuffisant: 'Insuffisant — Doit faire des efforts',
  },
  AR: {
    tres_bien:   'ممتاز — تهنئة المجلس',
    bien:        'جيد جدا',
    assez_bien:  'جيد',
    passable:    'مقبول',
    insuffisant: 'ضعيف — يجب بذل المزيد من الجهد',
  },
};

/** Extrait les seuils de ConfigNotes (ou applique les valeurs par défaut). */
export function extractSeuilsMentions(config: { seuil_tres_bien?: unknown; seuil_bien?: unknown; seuil_assez_bien?: unknown; seuil_passable?: unknown } | null): SeuilsMentions {
  if (!config) return SEUILS_DEFAUT;
  return {
    tres_bien:  Number(config.seuil_tres_bien)  || SEUILS_DEFAUT.tres_bien,
    bien:       Number(config.seuil_bien)       || SEUILS_DEFAUT.bien,
    assez_bien: Number(config.seuil_assez_bien) || SEUILS_DEFAUT.assez_bien,
    passable:   Number(config.seuil_passable)   || SEUILS_DEFAUT.passable,
  };
}

export function appreciation(m: number, filiere: Filiere = 'FR', seuils: SeuilsMentions = SEUILS_DEFAUT): string {
  // COMBINE renvoie les deux versions séparées par un retour à la ligne
  // pour préserver les deux entêtes du bulletin bilingue.
  if (filiere === 'COMBINE') {
    return `${appreciation(m, 'FR', seuils)}\n${appreciation(m, 'AR', seuils)}`;
  }
  const l = LIBELLES[filiere];
  if (m >= seuils.tres_bien)  return l.tres_bien;
  if (m >= seuils.bien)       return l.bien;
  if (m >= seuils.assez_bien) return l.assez_bien;
  if (m >= seuils.passable)   return l.passable;
  return l.insuffisant;
}

type MatiereAvecCoeff = {
  id: string; nom_fr: string; nom_ar: string | null; filiere: string;
  coeff_defaut: unknown; coeff_effectif: unknown;
  note_max: unknown; note_min: unknown; ordre_bulletin: number;
};

async function getMatieresDeclasse(classe_id: string, filiere: 'FR' | 'AR'): Promise<MatiereAvecCoeff[]> {
  const rows = await prisma.classeMatiere.findMany({
    where: { classe_id, matiere: { filiere, active: true } },
    include: { matiere: true },
    orderBy: [{ ordre_override: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
  });
  return rows.map(r => ({
    ...r.matiere,
    coeff_effectif: r.coeff_override ?? r.matiere.coeff_defaut,
    ordre_bulletin: r.ordre_override ?? r.matiere.ordre_bulletin,
  }));
}

async function getMatieres(etablissement_id: string, filiere: 'FR' | 'AR') {
  return prisma.matiere.findMany({
    where: { etablissement_id, filiere, active: true },
    orderBy: { ordre_bulletin: 'asc' },
  });
}

async function getElevesClasse(classe_id: string, annee_scolaire_id: string) {
  return prisma.inscription.findMany({
    where: { annee_scolaire_id, statut: 'actif', OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] },
    include: { eleve: true },
  });
}

// ─── Lister ─────────────────────────────────────────────────────────────────

export async function listerBulletins(
  etablissement_id: string, annee_scolaire_id?: string, periode?: number,
  eleve_id?: string, filiere?: string,
) {
  const where: Record<string, unknown> = { eleve: { etablissement_id } };
  if (annee_scolaire_id) where.annee_scolaire_id = annee_scolaire_id;
  if (periode !== undefined) where.periode = periode;
  if (eleve_id) where.eleve_id = eleve_id;
  if (filiere) where.filiere = filiere;
  return prisma.bulletin.findMany({
    where,
    include: {
      eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
      annee_scolaire: true,
    },
    orderBy: [{ periode: 'asc' }, { rang: 'asc' }],
  });
}

// ─── Générer bulletins trimestriels (FR | AR | COMBINE) ──────────────────────

export async function genererBulletins(etablissement_id: string, data: GenererBulletinInput) {
  const { classe_id, annee_scolaire_id, periode, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  const seuils = extractSeuilsMentions(await prisma.configNotes.findUnique({ where: { etablissement_id } }));
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMap[f] = await getMatieresDeclasse(classe_id, f);

  // Fetch toutes les notes d'un coup (évite N+1)
  const tousMatIds = filieres.flatMap(f => matMap[f].map(m => m.id));
  const elevesIds = inscriptions.map(i => i.eleve_id);
  const toutesLesNotes = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIds }, annee_scolaire_id, periode, matiere_id: { in: tousMatIds } },
    include: { matiere: true },
  });
  const notesByEleve = new Map<string, typeof toutesLesNotes>();
  for (const n of toutesLesNotes) {
    if (!notesByEleve.has(n.eleve_id)) notesByEleve.set(n.eleve_id, []);
    notesByEleve.get(n.eleve_id)!.push(n);
  }

  // Map matiere_id → coeff_effectif (override prioritaire)
  const coeffMap = new Map<string, number>(
    filieres.flatMap(f => matMap[f].map(m => [m.id, Number(m.coeff_effectif)]))
  );

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const n of notesByEleve.get(eleve_id) ?? []) {
      const c = coeffMap.get(n.matiere_id) ?? Number(n.matiere.coeff_defaut);
      totalP += Number(n.valeur) * c;
      totalC += c;
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode } },
      create: { eleve_id, annee_scolaire_id, filiere, periode, moyenne, rang: i + 1, appreciation: appreciation(moyenne, filiere as Filiere, seuils), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: appreciation(moyenne, filiere as Filiere, seuils), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) généré(s)`, bulletins };
}

// ─── Générer bulletins annuels (periode=0) ───────────────────────────────────

export async function genererBulletinsAnnuels(etablissement_id: string, data: GenererBulletinAnnuelInput) {
  const { classe_id, annee_scolaire_id, filiere } = data;
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  const inscriptions = await getElevesClasse(classe_id, annee_scolaire_id);
  if (inscriptions.length === 0) return { message: 'Aucun élève inscrit', bulletins: [] };

  // Nombre de périodes configurable par établissement (2 = semestres,
  // 3 = trimestres, 6 = bimestres). Par défaut 3 si non défini.
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;
  const periodesAnnuelles = Array.from({ length: nbPeriodes }, (_, i) => i + 1);
  const seuils = extractSeuilsMentions(config);

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMapAnnuel: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMapAnnuel[f] = await getMatieresDeclasse(classe_id, f);

  // Fetch toutes les notes annuelles d'un coup (évite N+1)
  const tousMatIdsAnnuel = filieres.flatMap(f => matMapAnnuel[f].map(m => m.id));
  const elevesIdsAnnuel = inscriptions.map(i => i.eleve_id);
  const toutesLesNotesAnnuel = await prisma.note.findMany({
    where: { eleve_id: { in: elevesIdsAnnuel }, annee_scolaire_id, periode: { in: periodesAnnuelles }, matiere_id: { in: tousMatIdsAnnuel } },
    include: { matiere: true },
  });
  const notesByEleveAnnuel = new Map<string, typeof toutesLesNotesAnnuel>();
  for (const n of toutesLesNotesAnnuel) {
    if (!notesByEleveAnnuel.has(n.eleve_id)) notesByEleveAnnuel.set(n.eleve_id, []);
    notesByEleveAnnuel.get(n.eleve_id)!.push(n);
  }

  const coeffMapAnnuel = new Map<string, number>(
    filieres.flatMap(f => matMapAnnuel[f].map(m => [m.id, Number(m.coeff_effectif)]))
  );

  const moyennes: { eleve_id: string; moyenne: number }[] = [];
  for (const { eleve_id } of inscriptions) {
    let totalP = 0, totalC = 0;
    for (const n of notesByEleveAnnuel.get(eleve_id) ?? []) {
      const c = coeffMapAnnuel.get(n.matiere_id) ?? Number(n.matiere.coeff_defaut);
      totalP += Number(n.valeur) * c;
      totalC += c;
    }
    if (totalC === 0) continue;
    moyennes.push({ eleve_id, moyenne: Math.round((totalP / totalC) * 100) / 100 });
  }
  moyennes.sort((a, b) => b.moyenne - a.moyenne);

  const bulletins: unknown[] = [];
  for (let i = 0; i < moyennes.length; i++) {
    const { eleve_id, moyenne } = moyennes[i];
    const b = await prisma.bulletin.upsert({
      where: { eleve_id_annee_scolaire_id_filiere_periode: { eleve_id, annee_scolaire_id, filiere, periode: 0 } },
      create: { eleve_id, annee_scolaire_id, filiere, periode: 0, moyenne, rang: i + 1, appreciation: appreciation(moyenne, filiere as Filiere, seuils), generated_at: new Date() },
      update: { moyenne, rang: i + 1, appreciation: appreciation(moyenne, filiere as Filiere, seuils), generated_at: new Date() },
    });
    bulletins.push(b);
  }
  return { message: `${bulletins.length} bulletin(s) annuel(s) généré(s)`, bulletins };
}

// ─── Détail bulletin ─────────────────────────────────────────────────────────

export async function getBulletin(id: string, etablissement_id: string) {
  const bulletin = await prisma.bulletin.findFirst({
    where: { id, eleve: { etablissement_id } },
    include: {
      eleve: { include: { inscriptions: { include: { classe_fr: true, classe_ar: true } } } },
      annee_scolaire: true,
    },
  });
  if (!bulletin) throw new Error('Bulletin introuvable');

  const filieres: ('FR' | 'AR')[] = bulletin.filiere === 'COMBINE' ? ['FR', 'AR'] : [bulletin.filiere as 'FR' | 'AR'];

  // Nb de périodes configurable (2=semestres, 3=trimestres, 6=bimestres). On
  // ne dépend plus de [1,2,3] hardcodé pour les bulletins annuels.
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;

  // Chercher la classe de l'élève pour l'année scolaire du bulletin
  const inscription = bulletin.eleve.inscriptions.find(
    i => i.annee_scolaire_id === bulletin.annee_scolaire_id
  ) as { classe_fr_id?: string | null; classe_ar_id?: string | null } | undefined;
  const classeIdFR = inscription?.classe_fr_id ?? null;
  const classeIdAR = inscription?.classe_ar_id ?? null;

  const notesByFiliere: Record<string, unknown[]> = {};
  for (const f of filieres) {
    const classeId = f === 'FR' ? classeIdFR : classeIdAR;
    const matieres = classeId
      ? await getMatieresDeclasse(classeId, f)
      : await getMatieres(etablissement_id, f);
    const periodes = bulletin.periode === 0
      ? Array.from({ length: nbPeriodes }, (_, i) => i + 1)
      : [bulletin.periode];
    notesByFiliere[f] = await prisma.note.findMany({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id, periode: { in: periodes }, matiere_id: { in: matieres.map(m => m.id) } },
      include: { matiere: true },
      orderBy: { matiere: { ordre_bulletin: 'asc' } },
    });
  }
  return { ...bulletin, notesByFiliere };
}

// ─── Mettre à jour les observations ─────────────────────────────────────────

export async function mettreAJourObservation(
  id: string,
  etablissement_id: string,
  data: ObservationInput,
  valide_par: string,
  role?: string,
) {
  const bulletin = await prisma.bulletin.findFirst({ where: { id, eleve: { etablissement_id } } });
  if (!bulletin) throw new Error('Bulletin introuvable');

  if (role) {
    const inscription = await prisma.inscription.findFirst({
      where: { eleve_id: bulletin.eleve_id, annee_scolaire_id: bulletin.annee_scolaire_id },
      select: { classe_fr_id: true, classe_ar_id: true },
    });
    const candidateClasses = [
      bulletin.filiere === 'AR' ? null : inscription?.classe_fr_id,
      bulletin.filiere === 'FR' ? null : inscription?.classe_ar_id,
    ].filter((c): c is string => Boolean(c));
    if (candidateClasses.length === 0) {
      throw new Error('Inscription introuvable pour ce bulletin');
    }
    let acces = false;
    for (const classe_id of candidateClasses) {
      try {
        await assertProfPeutAccederClasse(role, valide_par, classe_id);
        acces = true;
        break;
      } catch {
        // essai suivant
      }
    }
    if (!acces) {
      const err = new Error('Vous n\'enseignez pas dans la classe de cet élève');
      (err as { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  const updated = await prisma.bulletin.update({
    where: { id },
    data: {
      observation_fr: data.observation_fr ?? bulletin.observation_fr,
      observation_prof: data.observation_prof ?? bulletin.observation_prof,
      valide_par,
      valide_le: new Date(),
    },
  });

  await logAction(etablissement_id, valide_par, 'UPDATE', 'Bulletin', id, {
    action: 'observation',
    has_fr: data.observation_fr !== undefined,
    has_prof: data.observation_prof !== undefined,
  });

  return updated;
}

// ─── PDF individuel ──────────────────────────────────────────────────────────

export async function genererPdfBulletin(id: string, etablissement_id: string): Promise<Buffer> {
  const data = await getBulletin(id, etablissement_id);
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  // Nb de périodes dynamique (cf. genererBulletinsAnnuels + getBulletin)
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const nbPeriodes = config?.nb_periodes ?? 3;

  const { generateBulletinHtml, generateBulletinAnnuelHtml } = await import('./bulletin.template');

  const base = {
    etablissement_nom_fr: etab.nom_fr,
    eleve_nom_fr: `${data.eleve.prenom_fr} ${data.eleve.nom_fr}`,
    eleve_matricule: data.eleve.matricule, annee_libelle: data.annee_scolaire.libelle,
    moyenne: data.moyenne !== null ? Number(data.moyenne) : null, rang: data.rang,
    appreciation: data.appreciation, devise: etab.devise,
  };

  type NoteRaw = { valeur: unknown; periode: number; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };

  const toRows = (f: 'FR' | 'AR') =>
    ((data.notesByFiliere[f] ?? []) as NoteRaw[]).map(n => ({
      nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
      coeff: Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
    }));

  const toAnnuelRows = (f: 'FR' | 'AR') => {
    const map = new Map<string, { nom_fr: string; nom_ar: string; coeff: number; vals: Record<number, number | null> }>();
    for (const n of (data.notesByFiliere[f] ?? []) as NoteRaw[]) {
      if (!map.has(n.matiere.nom_fr)) map.set(n.matiere.nom_fr, { nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr, coeff: Number(n.matiere.coeff_defaut), vals: {} });
      map.get(n.matiere.nom_fr)!.vals[n.periode] = n.valeur !== null ? Number(n.valeur) : null;
    }
    return Array.from(map.values()).map(m => {
      const vals = Array.from({ length: nbPeriodes }, (_, i) => m.vals[i + 1] ?? null);
      const nums = vals.filter(v => v !== null) as number[];
      return { ...m, valeurs: vals, moyenne_annuelle: nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : null };
    });
  };

  let html: string;
  if (data.periode === 0) {
    const type = data.filiere === 'COMBINE' ? 'ANNUEL_COMBINE' : data.filiere === 'AR' ? 'ANNUEL_AR' : 'ANNUEL_FR';
    html = generateBulletinAnnuelHtml({
      ...base, type,
      matieres_fr: data.filiere !== 'AR' ? toAnnuelRows('FR') : undefined,
      matieres_ar: data.filiere !== 'FR' ? toAnnuelRows('AR') : undefined,
    });
  } else {
    const type = data.filiere as 'FR' | 'AR' | 'COMBINE';
    html = generateBulletinHtml({
      ...base, type, periode: data.periode,
      notes_fr: data.filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: data.filiere !== 'FR' ? toRows('AR') : undefined,
    });
  }

  return renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
}

// ─── PDF toute la classe ─────────────────────────────────────────────────────

export async function genererPdfClasse(
  classe_id: string, annee_scolaire_id: string, periode: number,
  filiere: string, etablissement_id: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });
  if (!etab) throw new Error('Établissement introuvable');

  const bulletins = await prisma.bulletin.findMany({
    where: {
      annee_scolaire_id, periode, filiere,
      eleve: { etablissement_id, inscriptions: { some: { annee_scolaire_id, OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }] } } },
    },
    include: { eleve: true, annee_scolaire: true },
    orderBy: [{ rang: 'asc' }, { eleve: { nom_fr: 'asc' } }],
  });
  if (bulletins.length === 0) throw new Error('Aucun bulletin trouvé');

  const filieres: ('FR' | 'AR')[] = filiere === 'COMBINE' ? ['FR', 'AR'] : [filiere as 'FR' | 'AR'];
  const matMap: Record<string, MatiereAvecCoeff[]> = {};
  for (const f of filieres) matMap[f] = await getMatieresDeclasse(classe_id, f);

  const { generateBulletinHtml } = await import('./bulletin.template');
  const pages: string[] = [];

  for (const bulletin of bulletins) {
    const notesByFiliere: Record<string, unknown[]> = {};
    for (const f of filieres) {
      notesByFiliere[f] = await prisma.note.findMany({
        where: { eleve_id: bulletin.eleve_id, annee_scolaire_id, periode, matiere_id: { in: matMap[f].map(m => m.id) } },
        include: { matiere: true }, orderBy: { matiere: { ordre_bulletin: 'asc' } },
      });
    }
    type NoteRaw = { valeur: unknown; matiere: { nom_fr: string; nom_ar: string | null; coeff_defaut: unknown } };
    const toRows = (f: 'FR' | 'AR') =>
      ((notesByFiliere[f] ?? []) as NoteRaw[]).map(n => ({
        nom_fr: n.matiere.nom_fr, nom_ar: n.matiere.nom_ar ?? n.matiere.nom_fr,
        coeff: Number(n.matiere.coeff_defaut), valeur: n.valeur !== null ? Number(n.valeur) : null,
        note_max: Number((n.matiere as {note_max?: unknown}).note_max ?? 20),
      }));

    pages.push(generateBulletinHtml({
      type: filiere as 'FR' | 'AR' | 'COMBINE', periode: bulletin.periode,
      etablissement_nom_fr: etab.nom_fr,
      eleve_nom_fr: `${bulletin.eleve.prenom_fr} ${bulletin.eleve.nom_fr}`,
      eleve_matricule: bulletin.eleve.matricule, annee_libelle: bulletin.annee_scolaire.libelle,
      moyenne: bulletin.moyenne !== null ? Number(bulletin.moyenne) : null,
      rang: bulletin.rang, appreciation: bulletin.appreciation, devise: etab.devise,
      notes_fr: filiere !== 'AR' ? toRows('FR') : undefined,
      notes_ar: filiere !== 'FR' ? toRows('AR') : undefined,
    }));
  }

  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>.pb{page-break-after:always}body{margin:0;padding:0}</style></head><body>
    ${pages.map((p, i) => { const m = p.match(/<body>([\s\S]*)<\/body>/); const c = m ? m[1] : p; return i < pages.length - 1 ? `<div class="pb" style="padding:28px 36px">${c}</div>` : `<div style="padding:28px 36px">${c}</div>`; }).join('\n')}
  </body></html>`;

  return renderPdfHtml(combined, { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}
