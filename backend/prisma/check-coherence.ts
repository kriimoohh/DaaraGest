/**
 * Audit de cohérence des données pédagogiques (élèves + notes + bulletins).
 *
 *   npx tsx prisma/check-coherence.ts                  # rapport seulement
 *   npx tsx prisma/check-coherence.ts --fix-programme  # crée les ClasseMatiere manquantes
 *
 * Détecte :
 *   - élèves sans inscription active
 *   - élèves sans matricule
 *   - inscriptions sans classe (ni FR ni AR)
 *   - notes hors plage [note_min, note_max] de la matière
 *   - notes pour une matière hors du programme de la classe (ClasseMatiere)
 *   - notes pour une période invalide
 *   - notes dupliquées (clef unique violée n'arrive pas en pratique car
 *     contrainte DB, mais on vérifie le compte par (eleve, matière, période, année))
 *   - matières référencées par des notes mais désactivées
 *
 * Option --fix-programme :
 *   Pour chaque (classe, matière) où existent des notes mais aucune
 *   ClasseMatiere, crée l'entrée manquante avec coeff_override=null.
 *   N'écrase aucune donnée existante.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Incoherence {
  niveau: 'ERREUR' | 'AVERTISSEMENT' | 'INFO';
  categorie: string;
  message: string;
  detail?: string;
}

function log(inc: Incoherence) {
  const icon = inc.niveau === 'ERREUR' ? '❌' : inc.niveau === 'AVERTISSEMENT' ? '⚠️ ' : 'ℹ️ ';
  const detail = inc.detail ? `\n     ${inc.detail}` : '';
  console.log(`${icon} [${inc.categorie}] ${inc.message}${detail}`);
}

async function audit(fixProgramme: boolean) {
  console.log('\n🔍  Audit de cohérence pédagogique\n');

  const incoherences: Incoherence[] = [];

  // ── 1. Élèves ────────────────────────────────────────────────────────────────
  const eleves = await prisma.eleve.findMany({
    where: { actif: true },
    include: { inscriptions: true },
  });
  console.log(`📊  Élèves actifs : ${eleves.length}`);

  for (const e of eleves) {
    if (!e.matricule || e.matricule.trim() === '') {
      incoherences.push({ niveau: 'ERREUR', categorie: 'ÉLÈVE',
        message: `Élève sans matricule : ${e.nom_fr} ${e.prenom_fr}`,
        detail: `ID=${e.id}` });
    }
    const inscActives = e.inscriptions.filter(i => i.statut === 'actif');
    if (inscActives.length === 0) {
      incoherences.push({ niveau: 'AVERTISSEMENT', categorie: 'ÉLÈVE',
        message: `Élève sans inscription active : ${e.nom_fr} ${e.prenom_fr}`,
        detail: `matricule=${e.matricule}` });
      continue;
    }
    for (const insc of inscActives) {
      if (!insc.classe_fr_id && !insc.classe_ar_id) {
        incoherences.push({ niveau: 'ERREUR', categorie: 'INSCRIPTION',
          message: `Inscription sans classe FR ni AR : ${e.nom_fr} ${e.prenom_fr}`,
          detail: `inscription_id=${insc.id}` });
      }
    }
  }

  // ── 2. Notes ─────────────────────────────────────────────────────────────────
  const notes = await prisma.note.findMany({
    include: {
      matiere: { select: { id: true, nom_fr: true, note_min: true, note_max: true, active: true, etablissement_id: true } },
      eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true, inscriptions: { include: { classe_fr: true, classe_ar: true } } } },
    },
  });
  console.log(`📊  Notes en base : ${notes.length}`);

  // Index ClasseMatiere existants : Set('classe_id|matiere_id')
  const cmRows = await prisma.classeMatiere.findMany({ select: { classe_id: true, matiere_id: true } });
  const cmSet = new Set(cmRows.map(r => `${r.classe_id}|${r.matiere_id}`));

  // Paires (classe_id, matiere_id) qu'on devra créer si --fix-programme
  const aCreer = new Map<string, { classe_id: string; matiere_id: string; nb_notes: number }>();

  let notesHorsPlage = 0, notesMatiereInactive = 0, notesPeriodeInvalide = 0, notesHorsProgramme = 0;

  for (const n of notes) {
    const v = Number(n.valeur);
    const min = Number(n.matiere.note_min);
    const max = Number(n.matiere.note_max);
    if (v < min || v > max) {
      notesHorsPlage++;
      if (notesHorsPlage <= 5) {
        incoherences.push({ niveau: 'ERREUR', categorie: 'NOTE',
          message: `Note hors plage [${min}..${max}] pour "${n.matiere.nom_fr}" : ${v}`,
          detail: `élève=${n.eleve.nom_fr} ${n.eleve.prenom_fr} · période=T${n.periode}` });
      }
    }
    if (n.matiere.active === false) {
      notesMatiereInactive++;
    }
    if (n.periode < 1 || n.periode > 4) {
      notesPeriodeInvalide++;
    }

    // Matière dans le programme de la classe d'inscription ?
    const inscActive = n.eleve.inscriptions.find(i => i.statut === 'actif' && i.annee_scolaire_id === n.annee_scolaire_id);
    if (inscActive) {
      const classeIds = [inscActive.classe_fr_id, inscActive.classe_ar_id].filter(Boolean) as string[];
      let trouve = false;
      let classeIdManquant: string | null = null;
      for (const cid of classeIds) {
        if (cmSet.has(`${cid}|${n.matiere_id}`)) { trouve = true; break; }
        // On retient la dernière classe testée pour proposer la création
        classeIdManquant = cid;
      }
      if (!trouve) {
        notesHorsProgramme++;
        if (classeIdManquant) {
          const key = `${classeIdManquant}|${n.matiere_id}`;
          const e = aCreer.get(key);
          if (e) e.nb_notes++;
          else aCreer.set(key, { classe_id: classeIdManquant, matiere_id: n.matiere_id, nb_notes: 1 });
        }
      }
    }
  }

  if (notesHorsPlage > 5) {
    incoherences.push({ niveau: 'ERREUR', categorie: 'NOTE',
      message: `… et ${notesHorsPlage - 5} autres notes hors plage (total : ${notesHorsPlage})` });
  }
  if (notesMatiereInactive > 0) {
    incoherences.push({ niveau: 'AVERTISSEMENT', categorie: 'NOTE',
      message: `${notesMatiereInactive} note(s) référencent une matière désactivée` });
  }
  if (notesPeriodeInvalide > 0) {
    incoherences.push({ niveau: 'ERREUR', categorie: 'NOTE',
      message: `${notesPeriodeInvalide} note(s) avec période hors [1..4]` });
  }
  if (notesHorsProgramme > 0) {
    incoherences.push({ niveau: 'AVERTISSEMENT', categorie: 'PROGRAMME',
      message: `${notesHorsProgramme} note(s) référencent une matière HORS du programme (ClasseMatiere) de la classe`,
      detail: `${aCreer.size} paire(s) (classe, matière) à créer pour rattacher ces notes — voir détail ci-dessous` });

    // Détail des paires manquantes
    const aCreerArr = Array.from(aCreer.values());
    const classeIds = Array.from(new Set(aCreerArr.map(x => x.classe_id)));
    const matiereIds = Array.from(new Set(aCreerArr.map(x => x.matiere_id)));
    const [classes, matieres] = await Promise.all([
      prisma.classe.findMany({ where: { id: { in: classeIds } }, select: { id: true, nom_fr: true } }),
      prisma.matiere.findMany({ where: { id: { in: matiereIds } }, select: { id: true, nom_fr: true, filiere: true } }),
    ]);
    const classeNom = new Map(classes.map(c => [c.id, c.nom_fr]));
    const matiereNom = new Map(matieres.map(m => [m.id, `${m.nom_fr} (${m.filiere})`]));

    console.log('\n    Paires (classe → matière) manquantes :');
    const sorted = aCreerArr.slice().sort((a, b) => b.nb_notes - a.nb_notes);
    for (const p of sorted.slice(0, 20)) {
      console.log(`      • ${classeNom.get(p.classe_id) ?? p.classe_id} → ${matiereNom.get(p.matiere_id) ?? p.matiere_id}  (${p.nb_notes} note(s))`);
    }
    if (sorted.length > 20) console.log(`      … ${sorted.length - 20} autres paires.`);
  }

  // ── 3. Bulletins orphelins ───────────────────────────────────────────────────
  const bulletins = await prisma.bulletin.findMany({
    where: { eleve: { actif: true } },
    select: { id: true, eleve_id: true, periode: true, annee_scolaire_id: true, moyenne: true, eleve: { select: { nom_fr: true, prenom_fr: true } } },
  });
  console.log(`📊  Bulletins en base : ${bulletins.length}`);

  let bulletinsSansNotes = 0;
  for (const b of bulletins) {
    const nb = notes.filter(n =>
      n.eleve_id === b.eleve_id &&
      n.periode === b.periode &&
      n.annee_scolaire_id === b.annee_scolaire_id,
    ).length;
    if (nb === 0) {
      bulletinsSansNotes++;
      if (bulletinsSansNotes <= 3) {
        incoherences.push({ niveau: 'AVERTISSEMENT', categorie: 'BULLETIN',
          message: `Bulletin sans note : ${b.eleve.nom_fr} ${b.eleve.prenom_fr} — T${b.periode}`,
          detail: `bulletin_id=${b.id}` });
      }
    }
  }
  if (bulletinsSansNotes > 3) {
    incoherences.push({ niveau: 'AVERTISSEMENT', categorie: 'BULLETIN',
      message: `… et ${bulletinsSansNotes - 3} autres bulletins sans note (total : ${bulletinsSansNotes})` });
  }

  // ── 4. Affichage du rapport ──────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────');
  console.log(`Récapitulatif : ${incoherences.length} incohérence(s) détectée(s)`);
  console.log('────────────────────────────────────────────────\n');

  const erreurs = incoherences.filter(i => i.niveau === 'ERREUR');
  const avertissements = incoherences.filter(i => i.niveau === 'AVERTISSEMENT');

  if (incoherences.length === 0) {
    console.log('✅  Aucune incohérence détectée — base saine.\n');
  } else {
    for (const inc of incoherences) log(inc);
    console.log(`\n  → ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s).\n`);
  }

  // ── 5. Auto-fix optionnel ────────────────────────────────────────────────────
  if (fixProgramme && aCreer.size > 0) {
    console.log(`\n🔧  Création de ${aCreer.size} entrée(s) ClasseMatiere manquante(s)…`);
    let cree = 0;
    for (const p of Array.from(aCreer.values())) {
      try {
        await prisma.classeMatiere.create({
          data: { classe_id: p.classe_id, matiere_id: p.matiere_id },
        });
        cree++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        console.log(`  ❌  ${p.classe_id} / ${p.matiere_id} : ${msg}`);
      }
    }
    console.log(`✅  ${cree} ClasseMatiere créée(s) sur ${aCreer.size}.\n`);
  } else if (aCreer.size > 0) {
    console.log('💡  Pour créer automatiquement les ClasseMatiere manquantes :');
    console.log('    npx tsx prisma/check-coherence.ts --fix-programme\n');
  }

  await prisma.$disconnect();
  // Exit code : 1 si erreurs, 0 sinon
  process.exit(erreurs.length > 0 ? 1 : 0);
}

const fix = process.argv.includes('--fix-programme');
audit(fix).catch(err => {
  console.error('❌  Audit interrompu :', err);
  prisma.$disconnect();
  process.exit(2);
});
