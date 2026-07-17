import crypto from 'crypto';
import QRCode from 'qrcode';
import prisma from '../../config/database';
import { getQrSecret } from '../../utils/qrSecret';
import { escapeHtml } from '../../utils/escapeHtml';
import { TypeDocument, GenererDocumentInput, GenererCartesLotInput, UpsertTemplateInput, TYPE_DOCUMENT_VALUES, CARD_TYPES } from './documents.schema';
import { getDefaultTemplate, TYPE_DOCUMENT_LABELS, getCardTemplate } from './templates/defaults';
import { calculerMoyennesClasse, getBaremesClasse } from '../bulletins/bulletins.service';
import { selectLiensClasse, selectLiensClasseObjet, classeIdParFiliere, classeParFiliere } from '../../utils/inscriptionClasse';
import { DEFAULT_NOTE_MAX, classer } from '../../utils/notes';
import { NotFoundError } from '../../utils/errors';

function signQrPayload(payload: object): string {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', getQrSecret()).update(data).digest('hex').slice(0, 16);
  return Buffer.from(data).toString('base64url') + '.' + sig;
}

async function generateQrDataUrl(payload: object): Promise<string> {
  const signed = signQrPayload(payload);
  return QRCode.toDataURL(signed, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
}

async function ensureEleveQrToken(eleveId: string): Promise<string> {
  const eleve = await prisma.eleve.findUniqueOrThrow({ where: { id: eleveId } });
  if (eleve.qr_token) return eleve.qr_token;
  const token = crypto.randomUUID();
  await prisma.eleve.update({ where: { id: eleveId }, data: { qr_token: token } });
  return token;
}

async function ensureProfQrToken(profId: string): Promise<string> {
  const prof = await prisma.personnel.findFirstOrThrow({
    where: { OR: [{ id: profId }, { utilisateur_id: profId }] },
  });
  if (prof.qr_token) return prof.qr_token;
  const token = crypto.randomUUID();
  await prisma.personnel.update({ where: { id: prof.id }, data: { qr_token: token } });
  return token;
}

// ─── Helper: format date ──────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-SN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Build common vars ────────────────────────────────────────────────────────

async function buildCommonVars(etablissement_id: string): Promise<Record<string, string>> {
  const etab = await prisma.etablissement.findUniqueOrThrow({
    where: { id: etablissement_id },
    include: { directeur: { include: { utilisateur: true } } },
  });

  // Le directeur vient de la fiche Personnel liée (Etablissement.directeur_id),
  // sélectionnée dans Paramètres → Établissement. Vide tant que rien n'est choisi.
  const nomDirecteur = etab.directeur
    ? `${etab.directeur.utilisateur.nom_fr}${etab.directeur.utilisateur.prenom_fr ? ' ' + etab.directeur.utilisateur.prenom_fr : ''}`.trim()
    : '';

  const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const logoHtml = etab.logo_url
    ? `<img src="${escapeAttr(etab.logo_url)}" alt="Logo" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';
  const signatureHtml = etab.signature_url
    ? `<img src="${escapeAttr(etab.signature_url)}" alt="Signature" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';
  const cachetHtml = etab.cachet_url
    ? `<img src="${escapeAttr(etab.cachet_url)}" alt="Cachet" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';

  // Active school year
  const annee = await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
  });

  // Échelle de notation de l'établissement (ex: 10) — pour ne pas afficher « /20 »
  // en dur dans les documents alors que les moyennes sont sur cette échelle.
  const cfgNotes = await prisma.configNotes.findUnique({
    where: { etablissement_id }, select: { note_max: true },
  });
  const noteMaxBase = Number(cfgNotes?.note_max ?? DEFAULT_NOTE_MAX);

  const today = new Date();
  const refDoc = `REF-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;

  // Accord en genre des documents : sexe (M/F) de l'Utilisateur du directeur
  // lié ; sans directeur ou sans sexe renseigné → forme inclusive
  // ("Directeur(trice)", "soussigné(e)").
  const directeurSexe = etab.directeur?.utilisateur?.sexe ?? null;
  const isFemme = directeurSexe === 'F';
  const hasCivilite = directeurSexe === 'M' || directeurSexe === 'F';
  const CIVILITE_DIRECTEUR  = hasCivilite ? (isFemme ? 'Mme'         : 'M.')          : '';
  const TITRE_DIRECTEUR     = hasCivilite ? (isFemme ? 'Directrice'  : 'Directeur')   : 'Directeur(trice)';
  const DIRECTEUR_QUALITE   = hasCivilite ? (isFemme ? 'La Directrice' : 'Le Directeur') : 'Le/La Directeur(trice)';
  const SOUSSIGNE           = hasCivilite ? (isFemme ? 'soussignée'  : 'soussigné')   : 'soussigné(e)';
  const NOM_COMPLET_DIRECTEUR = [CIVILITE_DIRECTEUR, nomDirecteur].filter(Boolean).join(' ');

  // Tente d'extraire la ville depuis l'adresse de l'établissement (dernière virgule)
  const adresse = etab.adresse ?? '';
  const ville = adresse.includes(',')
    ? adresse.split(',').pop()!.trim()
    : adresse.trim();

  return {
    NOM_ETABLISSEMENT: etab.nom_fr,
    ADRESSE_ETABLISSEMENT: adresse,
    VILLE_ETABLISSEMENT: ville,
    TEL_ETABLISSEMENT: etab.telephone ?? '',
    ANNEE_SCOLAIRE: annee?.libelle ?? '',
    LOGO: logoHtml,
    SIGNATURE: signatureHtml,
    CACHET: cachetHtml,
    DATE_AUJOURD_HUI: fmtDate(today),
    REF_DOCUMENT: refDoc,
    NOM_DIRECTEUR: nomDirecteur,
    CIVILITE_DIRECTEUR,
    NOM_COMPLET_DIRECTEUR,
    TITRE_DIRECTEUR,
    DIRECTEUR_QUALITE,
    SOUSSIGNE,
    NOTE_MAX_BASE: String(noteMaxBase),
  };
}

// ─── Build eleve vars ─────────────────────────────────────────────────────────

async function buildEleveVars(eleve_id: string, _etablissement_id: string): Promise<Record<string, string>> {
  const eleve = await prisma.eleve.findUniqueOrThrow({
    where: { id: eleve_id },
    include: {
      parents: true,
      inscriptions: {
        where: { statut: 'actif' },
        include: {
          ...selectLiensClasseObjet,
          annee_scolaire: true,
        },
        orderBy: { date_inscription: 'desc' },
        take: 1,
      },
    },
  });

  const inscription = eleve.inscriptions[0];
  const classe_fr = classeParFiliere(inscription?.classes, 'FR')?.nom_fr ?? '';
  const classe_ar = classeParFiliere(inscription?.classes, 'AR')?.nom_fr ?? '';
  const annee_scolaire = inscription?.annee_scolaire?.libelle ?? '';
  const dateInscription = inscription?.date_inscription ? fmtDate(inscription.date_inscription) : '';
  const statutInscription = inscription?.statut ?? '';

  const parent = eleve.parents[0];

  return {
    NOM_PRENOM_ELEVE: `${eleve.nom_fr} ${eleve.prenom_fr ?? ''}`.trim(),
    NOM_ELEVE: eleve.nom_fr,
    PRENOM_ELEVE: eleve.prenom_fr ?? '',
    DATE_NAISSANCE: fmtDate(eleve.date_naissance),
    LIEU_NAISSANCE: eleve.lieu_naissance ?? '',
    MATRICULE: eleve.matricule,
    SEXE: eleve.sexe,
    CLASSE_FR: classe_fr,
    CLASSE_AR: classe_ar,
    ANNEE_SCOLAIRE: annee_scolaire,
    DATE_INSCRIPTION: dateInscription,
    STATUT_INSCRIPTION: statutInscription,
    NOM_TUTEUR: parent ? `${parent.nom_fr}` : '',
    LIEN_PARENTE: parent?.lien ?? '',
    TEL_TUTEUR: parent?.telephone ?? '',
    ADRESSE_TUTEUR: parent?.adresse ?? '',
    // defaults for parametrized fields
    ETABLISSEMENT_DESTINATION: '',
    MOTIF: '',
    DATE_TRANSFERT: '',
    DATE_EXAMEN: '',
    SALLE: '',
    HEURE_CONVOCATION: '',
    LISTE_MATIERES: '',
    TABLEAU_EMPLOI_DU_TEMPS: '',
    TABLEAU_NOTES: '',
    MOYENNE_ANNUELLE: '',
    DECISION: '',
    PHOTO_ELEVE: eleve.photo_url
      ? `<img src="${eleve.photo_url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : '',
    QR_CODE_ELEVE: '',
    MOTIF_ABSENCE: '',
    DATE_DEBUT_ABSENCE: '',
    DATE_FIN_ABSENCE: '',
    DATE_RETOUR_ABSENCE: '',
    HEURE_RETOUR: '',
    HEURE_RETARD: '',
    DATE_CONVOCATION: '',
    DATE_RDV_CONVOCATION: '',
    HEURE_RDV_CONVOCATION: '',
  };
}

// ─── Build prof vars ──────────────────────────────────────────────────────────

async function buildProfVars(prof_id: string, _etablissement_id: string): Promise<Record<string, string>> {
  const prof = await prisma.personnel.findFirstOrThrow({
    where: { OR: [{ id: prof_id }, { utilisateur_id: prof_id }] },
    include: { utilisateur: true },
  });

  return {
    NOM_PRENOM_PROF: `${prof.utilisateur.nom_fr} ${prof.utilisateur.prenom_fr ?? ''}`.trim(),
    NOM_PROF: prof.utilisateur.nom_fr,
    PRENOM_PROF: prof.utilisateur.prenom_fr ?? '',
    SPECIALITE: prof.specialite_fr ?? '',
    TYPE_CONTRAT: prof.type_contrat,
    DATE_EMBAUCHE: fmtDate(prof.date_embauche),
    FONCTIONS_PERSONNEL:  prof.poste_fr ?? prof.fonction,
    // defaults for parametrized fields
    DESTINATION: '',
    OBJET_MISSION: '',
    DATE_DEBUT_MISSION: '',
    DATE_FIN_MISSION: '',
    MOIS_ANNEE: '',
    SALAIRE_BRUT: '0',
    RETENUES: '0',
    NET_A_PAYER: '0',
    HEURES_THEORIQUES: '0',
    HEURES_REELLES: '0',
    TABLEAU_PLANNING: '',
    PHOTO_PROF: prof.photo_url
      ? `<img src="${prof.photo_url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : '',
    QR_CODE_PROF: '',
    POSTE_OCCUPE:        prof.poste_fr ?? '',
    PERIODE_STAGE_DEBUT: fmtDate(prof.date_debut_stage),
    PERIODE_STAGE_FIN:   fmtDate(prof.date_fin_stage),
    DATE_FIN_CONTRAT:    fmtDate(prof.date_fin_contrat),
    // Demande d'autorisation d'absence (personnel)
    CLASSE_SERVICE:        '',
    DATE_DEBUT_ABSENCE:    '',
    DATE_FIN_ABSENCE:      '',
    DUREE_JOURS:           '',
    RATTRAPAGE_1_DATE:        '',
    RATTRAPAGE_1_HEURE_DEBUT: '',
    RATTRAPAGE_1_HEURE_FIN:   '',
    RATTRAPAGE_2_DATE:        '',
    RATTRAPAGE_2_HEURE_DEBUT: '',
    RATTRAPAGE_2_HEURE_FIN:   '',
    AUTRE_MOTIF:           '',
    DECISION_DATE_DEBUT:   '',
    DECISION_DATE_FIN:     '',
    DECISION_DUREE_JOURS:  '',
  };
}

// ─── Build notes table ────────────────────────────────────────────────────────

type ReleveNote = {
  periode: number;
  matiere: { nom_fr: string };
  valeur: { toNumber(): number };
  note_max_effectif: number; // barème de saisie (ex: /60), pour afficher valeur/barème
  coeff_effectif: number;    // pondération pour la moyenne de période
};

function buildNotesTable(notes: ReleveNote[], baseNote: number = DEFAULT_NOTE_MAX): string {
  if (!notes.length) return '<p style="font-size:13px;color:#777">Aucune note enregistrée.</p>';

  // Group by period
  const byPeriode = new Map<number, ReleveNote[]>();
  for (const n of notes) {
    const arr = byPeriode.get(n.periode) ?? [];
    arr.push(n);
    byPeriode.set(n.periode, arr);
  }

  let html = '';
  for (const [periode, pNotes] of Array.from(byPeriode.entries()).sort((a, b) => a[0] - b[0])) {
    // Moyenne de période NORMALISÉE et pondérée : chaque note est ramenée sur
    // l'échelle de l'établissement via son barème, puis pondérée par son coefficient
    // (cohérent avec les bulletins). Une moyenne brute mélangerait /10../60.
    let tp = 0, tc = 0;
    for (const n of pNotes) {
      const nm = n.note_max_effectif || baseNote;
      const c = n.coeff_effectif || 1;
      if (nm > 0 && c > 0) { tp += (n.valeur.toNumber() / nm) * baseNote * c; tc += c; }
    }
    const moy = tc > 0 ? (tp / tc).toFixed(2) : '—';
    html += `
    <p style="font-size:13px;font-weight:bold;color:#1a5276;margin:16px 0 6px;">Période ${periode}</p>
    <table class="data-table">
      <thead><tr><th>Matière</th><th style="text-align:right">Note</th></tr></thead>
      <tbody>
        ${pNotes.map(n => `<tr><td>${n.matiere.nom_fr}</td><td style="text-align:right">${n.valeur.toNumber().toFixed(2)} / ${n.note_max_effectif}</td></tr>`).join('')}
        <tr style="background:#e8f4f8"><td style="font-weight:bold">Moyenne période ${periode}</td><td style="text-align:right;font-weight:bold">${moy} / ${baseNote}</td></tr>
      </tbody>
    </table>`;
  }
  return html;
}

// ─── Build emploi du temps ────────────────────────────────────────────────────

async function buildEmploiDuTemps(classe_id: string): Promise<string> {
  const creneaux = await prisma.creneau.findMany({
    where: { classe_id },
    include: { matiere: true, personnel: { include: { utilisateur: true } } },
    orderBy: [{ jour: 'asc' }, { heure_debut: 'asc' }],
  });

  if (!creneaux.length) {
    return '<p style="font-size:13px;color:#777">Emploi du temps non disponible.</p>';
  }

  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

  // Collect all unique time slots
  const heuresSet = new Set<string>();
  for (const c of creneaux) {
    heuresSet.add(`${c.heure_debut}-${c.heure_fin}`);
  }
  const heures = Array.from(heuresSet).sort();

  let html = `
  <table class="data-table" style="margin:12px 0">
    <thead>
      <tr>
        <th>Horaire</th>
        ${JOURS.map(j => `<th>${j.charAt(0).toUpperCase() + j.slice(1)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  for (const slot of heures) {
    const [debut, fin] = slot.split('-');
    html += `<tr><td style="font-weight:bold;white-space:nowrap">${debut} – ${fin}</td>`;
    for (const jour of JOURS) {
      const creneau = creneaux.find(c => c.jour === jour && c.heure_debut === debut && c.heure_fin === fin);
      if (creneau) {
        html += `<td style="font-size:11px">${creneau.matiere.nom_fr}<br><span style="color:#777">${creneau.salle ?? ''}</span></td>`;
      } else {
        html += '<td></td>';
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// ─── Build planning cours (pour prof) ────────────────────────────────────────

async function buildPlanningCours(prof_id: string): Promise<string> {
  const creneaux = await prisma.creneau.findMany({
    where: { personnel_id: prof_id },
    include: { matiere: true, classe: true },
    orderBy: [{ jour: 'asc' }, { heure_debut: 'asc' }],
  });

  if (!creneaux.length) {
    return '<p style="font-size:13px;color:#777">Aucun créneau planifié.</p>';
  }

  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const heuresSet = new Set<string>();
  for (const c of creneaux) heuresSet.add(`${c.heure_debut}-${c.heure_fin}`);
  const heures = Array.from(heuresSet).sort();

  let html = `
  <table class="data-table" style="margin:12px 0">
    <thead>
      <tr>
        <th>Horaire</th>
        ${JOURS.map(j => `<th>${j.charAt(0).toUpperCase() + j.slice(1)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  for (const slot of heures) {
    const [debut, fin] = slot.split('-');
    html += `<tr><td style="font-weight:bold;white-space:nowrap">${debut} – ${fin}</td>`;
    for (const jour of JOURS) {
      const c = creneaux.find(x => x.jour === jour && x.heure_debut === debut && x.heure_fin === fin);
      if (c) {
        html += `<td style="font-size:11px">${c.matiere.nom_fr}<br><span style="color:#777">${c.classe.nom_fr}</span>${c.salle ? `<br><span style="color:#aaa">${c.salle}</span>` : ''}</td>`;
      } else {
        html += '<td></td>';
      }
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// ─── Build relevé de notes classe (rempli ou vierge) ────────────────────────
//
// Construit le bloc {{TABLEAU_NOTES_CLASSE}} pour les deux types :
//   - RELEVE_NOTES_CLASSE : pré-remplie depuis la base, avec stats par matière
//   - RELEVE_NOTES_VIERGE : grille vide, mêmes en-têtes de matières,
//                          lignes des élèves laissées blanches pour remplir.
async function buildTableauNotesClasse(
  classe_id: string,
  annee_scolaire_id: string,
  periode: number | null,
  vierge: boolean,
): Promise<{
  html: string;
  effectif: number;
  titulaire: string;
  classeNom: string;
  anneeLabel: string;
}> {
  const [classeRaw, classeMatieres, inscriptions] = await Promise.all([
    prisma.classe.findUnique({
      where: { id: classe_id },
      include: { annee_scolaire: { select: { libelle: true } } },
    }),
    prisma.classeMatiere.findMany({
      where: { classe_id },
      include: {
        matiere: {
          select: { id: true, nom_fr: true, code_court: true, ordre_bulletin: true, active: true, note_max: true, coeff_defaut: true },
        },
      },
      orderBy: [{ ordre_override: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
    }),
    prisma.inscription.findMany({
      where: {
        annee_scolaire_id,
        statut: 'actif',
        classes: { some: { classe_id } },
      },
      include: { eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } } },
      orderBy: { eleve: { nom_fr: 'asc' } },
    }),
  ]);

  if (!classeRaw) throw Object.assign(new NotFoundError('Classe introuvable'), { statusCode: 404 });

  // Échelle de l'établissement (ConfigNotes.note_max) : sert de barème par défaut
  // quand une matière de la classe n'a pas d'override, et d'échelle d'affichage.
  const cfg = await prisma.configNotes.findUnique({
    where: { etablissement_id: classeRaw.etablissement_id },
    select: { note_max: true },
  });
  const baseNote = Number(cfg?.note_max ?? DEFAULT_NOTE_MAX);

  const matieres = classeMatieres
    .map(cm => ({
      id: cm.matiere.id,
      nom_fr: cm.matiere.nom_fr,
      code_court: cm.matiere.code_court,
      note_max: Number(cm.note_max_override ?? cm.matiere.note_max ?? baseNote),
      // Coefficient et « évaluée » effectifs, pour une moyenne PONDÉRÉE identique
      // au bulletin (une moyenne arithmétique simple ignorait les coefficients et
      // divergeait de la moyenne officielle, surtout en arabe où « L&C Ressources »
      // pèse coeff 6).
      coeff: Number(cm.coeff_override ?? cm.matiere.coeff_defaut ?? 1),
      evaluee: cm.evaluee !== false,
    }))
    .filter(m => classeMatieres.find(cm => cm.matiere.id === m.id)?.matiere.active !== false);

  // Barème / coeff / évaluée par trimestre prioritaires : certaines matières changent
  // d'échelle ou de pondération entre T1 et T2 (CLC arabe, RER…). Pour un relevé d'un
  // trimestre donné, utiliser les valeurs de CE trimestre, pas celles par défaut.
  if (periode && periode > 0) {
    const cmps = await prisma.classeMatierePeriode.findMany({
      where: { classe_id, periode, matiere_id: { in: matieres.map(m => m.id) } },
      select: { matiere_id: true, note_max: true, coeff: true, evaluee: true },
    });
    const ovr = new Map(cmps.map(c => [c.matiere_id, c]));
    for (const m of matieres) {
      const o = ovr.get(m.id);
      if (!o) continue;
      if (o.note_max != null) m.note_max = Number(o.note_max);
      if (o.coeff != null) m.coeff = Number(o.coeff);
      if (o.evaluee != null) m.evaluee = o.evaluee;
    }
  }

  // Récupérer un éventuel titulaire (premier prof de la classe)
  const titulaireRow = await prisma.personnelMatiereClasse.findFirst({
    where: { classe_id, annee_scolaire_id },
    include: { personnel: { include: { utilisateur: { select: { nom_fr: true, prenom_fr: true } } } } },
  });
  const titulaire = titulaireRow
    ? `${titulaireRow.personnel.utilisateur.prenom_fr ?? ''} ${titulaireRow.personnel.utilisateur.nom_fr}`.trim()
    : '—';

  const effectif = inscriptions.length;

  if (matieres.length === 0) {
    return {
      html: `<p style="font-size:11px;color:#777;text-align:center;margin:14px 0;">
        Aucune matière n'est rattachée au programme de cette classe.
        Configurez le programme dans <strong>Classes → Programme</strong>.
      </p>`,
      effectif, titulaire,
      classeNom: classeRaw.nom_fr,
      anneeLabel: classeRaw.annee_scolaire.libelle,
    };
  }

  // Pour RELEVE_NOTES_CLASSE : charger les notes
  const notesByEleve = new Map<string, Map<string, number>>();
  if (!vierge) {
    const noteWhere: Record<string, unknown> = {
      eleve_id: { in: inscriptions.map(i => i.eleve_id) },
      annee_scolaire_id,
      matiere_id: { in: matieres.map(m => m.id) },
    };
    if (periode && periode > 0) noteWhere.periode = periode;
    const notes = await prisma.note.findMany({
      where: noteWhere,
      select: { eleve_id: true, matiere_id: true, valeur: true },
    });
    for (const n of notes as { eleve_id: string; matiere_id: string; valeur: unknown }[]) {
      const v = Number(n.valeur);
      if (!notesByEleve.has(n.eleve_id)) notesByEleve.set(n.eleve_id, new Map());
      // Si plusieurs périodes confondues (periode = 0 → annuel), on moyenne
      const prev = notesByEleve.get(n.eleve_id)!.get(n.matiere_id);
      notesByEleve.get(n.eleve_id)!.set(n.matiere_id, prev !== undefined ? (prev + v) / 2 : v);
    }
  }

  // Calcul rangs + moyennes (normalisation sur l'échelle établissement — chaque
  // note est ramenée sur l'échelle de sa propre matière avant la moyenne arithmétique).
  const rowsRaw = inscriptions.map(insc => {
    const nm = notesByEleve.get(insc.eleve_id);
    const vals: (number | null)[] = matieres.map(m => {
      const v = nm?.get(m.id);
      return v === undefined ? null : v;
    });
    // Moyenne PONDÉRÉE par coefficient (cohérente avec le bulletin) : chaque note
    // ramenée sur l'échelle établissement via son barème, puis pondérée par son
    // coefficient. Les matières non évaluées sont exclues.
    let totalNorm = 0, totalCoeff = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v === null || !matieres[i].evaluee) continue;
      const max = matieres[i].note_max || baseNote;
      const c = matieres[i].coeff;
      if (max <= 0 || c <= 0) continue;
      totalNorm += (v / max) * baseNote * c;
      totalCoeff += c;
    }
    const moy = totalCoeff > 0 ? totalNorm / totalCoeff : null;
    return { eleve: insc.eleve, vals, moy };
  });

  // Relevé vierge : aucune note, donc aucun classement — on garde l'ordre
  // d'origine (alphabétique). Sinon : tri + rang, ex aequo au même rang.
  const rowsRanked = vierge
    ? rowsRaw.map(r => ({ ...r, rang: null as number | null }))
    : classer(rowsRaw, r => r.moy);

  const fmt = (v: number | null) => v === null ? '' : v.toFixed(2);
  const cellEmpty = '&nbsp;';

  // Stats par matière (uniquement pour RELEVE_NOTES_CLASSE)
  const matStats = vierge ? null : matieres.map((m, mi) => {
    const vals = rowsRaw.map(r => r.vals[mi]).filter((v): v is number => v !== null);
    if (!vals.length) return { comp: 0, ontMoy: 0, max: null, min: null, moy: null, txR: 0 };
    const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
    const demi = m.note_max / 2;
    const ontMoy = vals.filter(v => v >= demi).length;
    return {
      comp: vals.length,
      ontMoy,
      max: Math.max(...vals),
      min: Math.min(...vals),
      moy,
      txR: Math.round((ontMoy / vals.length) * 1000) / 10,
    };
  });

  const htmlHeader = `
    <table class="notes">
      <thead>
        <tr>
          <th style="width:22px;">N°</th>
          <th style="min-width:130px;">Prénom &amp; Nom</th>
          ${matieres.map(m => {
            const titre = m.code_court ?? m.nom_fr.slice(0, 12);
            return `<th title="${escapeHtml(m.nom_fr)}">${escapeHtml(titre)}<br><span style="font-weight:400;font-size:8px;">/${m.note_max}</span></th>`;
          }).join('')}
          ${vierge
            ? '<th style="width:42px;">Moy</th><th style="width:42px;">Rang</th><th style="min-width:90px;">Observations</th>'
            : `<th style="width:42px;">Moy/${baseNote}</th><th style="width:38px;">Rang</th>`}
        </tr>
      </thead>
      <tbody>
  `;

  const htmlRows = rowsRanked.map((r, i) => {
    const cellNotes = r.vals.map(v => `<td>${vierge ? cellEmpty : fmt(v)}</td>`).join('');
    const cellMoy   = vierge ? `<td>${cellEmpty}</td>` : `<td>${r.moy === null ? '' : r.moy.toFixed(2)}</td>`;
    const cellRang  = vierge ? `<td>${cellEmpty}</td>` : `<td>${r.rang ?? '—'}</td>`;
    const cellObs   = vierge ? `<td>${cellEmpty}</td>` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td class="lbl">${escapeHtml(r.eleve.prenom_fr ?? '')} ${escapeHtml(r.eleve.nom_fr)}</td>
      ${cellNotes}
      ${cellMoy}
      ${cellRang}
      ${cellObs}
    </tr>`;
  }).join('');

  const htmlStats = !vierge && matStats ? `
    <tr class="stat-row"><td colspan="2" class="lbl">Ont composé</td>${matStats.map(s => `<td>${s.comp}</td>`).join('')}<td colspan="2"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Ont la moyenne</td>${matStats.map(s => `<td>${s.ontMoy}</td>`).join('')}<td colspan="2"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Plus forte note</td>${matStats.map(s => `<td>${fmt(s.max)}</td>`).join('')}<td colspan="2"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Plus faible note</td>${matStats.map(s => `<td>${fmt(s.min)}</td>`).join('')}<td colspan="2"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Moyenne classe</td>${matStats.map(s => `<td>${fmt(s.moy)}</td>`).join('')}<td colspan="2"></td></tr>
    <tr class="stat-row"><td colspan="2" class="lbl">Taux réussite</td>${matStats.map(s => `<td>${s.txR}%</td>`).join('')}<td colspan="2"></td></tr>
  ` : '';

  return {
    html: htmlHeader + htmlRows + htmlStats + '</tbody></table>',
    effectif,
    titulaire,
    classeNom: classeRaw.nom_fr,
    anneeLabel: classeRaw.annee_scolaire.libelle,
  };
}

// ─── Build liste classe ───────────────────────────────────────────────────────

async function buildListeClasse(classe_id: string, annee_scolaire_id: string, _etablissement_id: string): Promise<string> {
  const inscriptions = await prisma.inscription.findMany({
    where: {
      classes: { some: { classe_id } },
      annee_scolaire_id: annee_scolaire_id || undefined,
      statut: 'actif',
    },
    include: { eleve: true },
    orderBy: { eleve: { nom_fr: 'asc' } },
  });

  if (!inscriptions.length) {
    return '<p style="font-size:13px;color:#777">Aucun élève inscrit dans cette classe.</p>';
  }

  let html = `
  <table class="data-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Matricule</th>
        <th>Nom et prénom</th>
        <th>Date de naissance</th>
        <th>Sexe</th>
      </tr>
    </thead>
    <tbody>`;

  inscriptions.forEach((insc, idx) => {
    const e = insc.eleve;
    html += `
    <tr>
      <td>${idx + 1}</td>
      <td>${e.matricule}</td>
      <td>${e.nom_fr} ${e.prenom_fr ?? ''}</td>
      <td>${fmtDate(e.date_naissance)}</td>
      <td>${e.sexe}</td>
    </tr>`;
  });

  html += `</tbody></table>
  <p style="font-size:12px;color:#555;margin-top:8px;">Total : <strong>${inscriptions.length}</strong> élève(s)</p>`;

  return html;
}

// ─── Replace vars ─────────────────────────────────────────────────────────────

// Vars dont la valeur est du HTML construit côté serveur (img, tables) —
// on les passe telles quelles. Tout le reste est échappé pour bloquer
// l'injection de scripts via des champs utilisateurs (nom, motif, etc.).
const HTML_KEYS = new Set([
  'LOGO', 'SIGNATURE', 'CACHET',
  'PHOTO_ELEVE', 'PHOTO_PROF',
  'QR_CODE_ELEVE', 'QR_CODE_PROF',
  'TABLEAU_NOTES', 'TABLEAU_EMPLOI_DU_TEMPS',
  'TABLEAU_PLANNING', 'TABLEAU_ELEVES',
  'TABLEAU_NOTES_CLASSE',
  'LISTE_MATIERES',
]);

function replaceVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, HTML_KEYS.has(k) ? (v ?? '') : escapeHtml(v ?? '')),
    html,
  );
}

// Toutes les cases à cocher utilisées par les templates avec checkboxes.
// Les clés ici doivent matcher les {{COCHE_xxx}} déclarées dans les templates.
const CHECKBOX_KEYS = [
  // AUTORISATION_ABSENCE_PERSONNEL — motifs
  'BAPTEME', 'HOSPIT_CONJOINT', 'HOSPIT_ENFANT', 'CONCOURS',
  'MARIAGE_TRAV', 'MARIAGE_ENFANT', 'MARIAGE_FRERE_SOEUR',
  'DECES_CONJOINT', 'DECES_DESC', 'DECES_ASC', 'DECES_FRERE_SOEUR', 'DECES_BEAU_PARENT',
  'PIECE_ADMIN', 'FETE_RELIG', 'PELERINAGE', 'RDV_MEDICAL', 'RDV_MEDICAL_ENFANT',
  // Décision
  'AUTORISATION_OUI', 'AUTORISATION_NON',
] as const;

// Convertit les paramètres "MOTIFS_COCHES" (CSV) et "DECISION_AUTORISATION" en
// variables COCHE_xxx avec ☐ (vide) ou ☒ (coché). Initialise toutes les cases
// à ☐ pour éviter les {{COCHE_xxx}} non remplacés dans le rendu final.
function applyCheckboxes(vars: Record<string, string>): void {
  const cochees = new Set(
    (vars.MOTIFS_COCHES ?? '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean),
  );

  const decision = (vars.DECISION_AUTORISATION ?? '').trim().toUpperCase();
  if (decision === 'OUI' || decision === 'ACCORDEE' || decision === 'ACCORDÉE') {
    cochees.add('AUTORISATION_OUI');
  } else if (decision === 'NON' || decision === 'REFUSEE' || decision === 'REFUSÉE') {
    cochees.add('AUTORISATION_NON');
  }

  for (const key of CHECKBOX_KEYS) {
    const target = `COCHE_${key}`;
    if (vars[target] === undefined || vars[target] === '') {
      vars[target] = cochees.has(key) ? '☒' : '☐';
    }
  }
}

// ─── Public service functions ─────────────────────────────────────────────────

export async function listerTemplates(etablissement_id: string) {
  const custom = await prisma.documentTemplate.findMany({
    where: { etablissement_id },
    orderBy: { type: 'asc' },
  });

  return TYPE_DOCUMENT_VALUES.map(type => {
    const found = custom.find(t => t.type === type);
    return {
      type,
      nom: TYPE_DOCUMENT_LABELS[type],
      has_custom: !!found,
      template: found ?? null,
    };
  });
}

export async function getTemplate(etablissement_id: string, type: TypeDocument) {
  const custom = await prisma.documentTemplate.findUnique({
    where: { etablissement_id_type: { etablissement_id, type } },
  });
  return {
    type,
    nom: TYPE_DOCUMENT_LABELS[type],
    has_custom: !!custom,
    contenu_html: custom?.contenu_html ?? getDefaultTemplate(type),
  };
}

export async function upsertTemplate(
  etablissement_id: string,
  type: TypeDocument,
  data: UpsertTemplateInput,
) {
  return prisma.documentTemplate.upsert({
    where: { etablissement_id_type: { etablissement_id, type } },
    create: { etablissement_id, type, ...data },
    update: data,
  });
}

export async function resetTemplate(etablissement_id: string, type: TypeDocument) {
  await prisma.documentTemplate.deleteMany({ where: { etablissement_id, type } });
}

const PHOTO_PLACEHOLDER = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" style="width:55%;height:55%;"><path d="M12 12c2.7 0 4-1.3 4-4s-1.3-4-4-4-4 1.3-4 4 1.3 4 4 4zm0 2c-2.7 0-8 1.35-8 4v2h16v-2c0-2.65-5.3-4-8-4z"/></svg>`;

async function genererCarteEleve(
  eleveId: string,
  etablissement_id: string,
  previewMode = false,
): Promise<{ html: string; eleve: { nom_fr: string; prenom_fr: string; photo_url: string | null } }> {
  const eleve = await prisma.eleve.findUniqueOrThrow({
    where: { id: eleveId },
    include: {
      inscriptions: {
        where: { statut: 'actif' },
        include: { ...selectLiensClasseObjet, annee_scolaire: true },
        orderBy: { date_inscription: 'desc' },
        take: 1,
      },
    },
  });

  if (!eleve.photo_url && !previewMode) {
    throw Object.assign(new Error(`Photo manquante pour ${eleve.nom_fr} ${eleve.prenom_fr}`), { statusCode: 400 });
  }

  const token = await ensureEleveQrToken(eleveId);
  const etab = await prisma.etablissement.findUniqueOrThrow({ where: { id: etablissement_id } });
  const qrPayload = { type: 'eleve', id: eleveId, matricule: eleve.matricule, ets: etablissement_id };
  const qrDataUrl = await generateQrDataUrl(qrPayload);

  const inscription = eleve.inscriptions[0];
  const vars: Record<string, string> = {
    NOM_PRENOM_ELEVE: `${eleve.nom_fr} ${eleve.prenom_fr ?? ''}`.trim(),
    NOM_ELEVE: eleve.nom_fr,
    PRENOM_ELEVE: eleve.prenom_fr ?? '',
    MATRICULE: eleve.matricule,
    CLASSE_FR: classeParFiliere(inscription?.classes, 'FR')?.nom_fr ?? '',
    CLASSE_AR: classeParFiliere(inscription?.classes, 'AR')?.nom_fr ?? '',
    ANNEE_SCOLAIRE: inscription?.annee_scolaire?.libelle ?? '',
    PHOTO_ELEVE: eleve.photo_url
      ? `<img src="${eleve.photo_url}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : PHOTO_PLACEHOLDER,
    QR_CODE_ELEVE: `<img src="${qrDataUrl}" alt="QR" style="width:100%;height:100%;">`,
    NOM_ETABLISSEMENT: etab.nom_fr,
    LOGO: etab.logo_url ? `<img src="${etab.logo_url}" alt="Logo" style="height:28px;object-fit:contain;">` : '',
    DATE_AUJOURD_HUI: fmtDate(new Date()),
    QR_TOKEN: token,
  };

  const tplHtml = getCardTemplate('CARTE_ELEVE');
  const html = replaceVars(tplHtml, vars);
  return { html, eleve: { nom_fr: eleve.nom_fr, prenom_fr: eleve.prenom_fr ?? '', photo_url: eleve.photo_url } };
}

async function genererCarteProfesseur(
  profId: string,
  etablissement_id: string,
  previewMode = false,
): Promise<{ html: string }> {
  const prof = await prisma.personnel.findFirstOrThrow({
    where: { OR: [{ id: profId }, { utilisateur_id: profId }], utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });

  if (!prof.photo_url && !previewMode) {
    const nom = `${prof.utilisateur.nom_fr} ${prof.utilisateur.prenom_fr ?? ''}`.trim();
    throw Object.assign(new Error(`Photo manquante pour ${nom}`), { statusCode: 400 });
  }

  const token = await ensureProfQrToken(profId);
  const etab = await prisma.etablissement.findUniqueOrThrow({ where: { id: etablissement_id } });
  const qrPayload = { type: 'professeur', id: profId, token, ets: etablissement_id };
  const qrDataUrl = await generateQrDataUrl(qrPayload);

  const vars: Record<string, string> = {
    NOM_PRENOM_PROF: `${prof.utilisateur.nom_fr} ${prof.utilisateur.prenom_fr ?? ''}`.trim(),
    NOM_PROF: prof.utilisateur.nom_fr,
    PRENOM_PROF: prof.utilisateur.prenom_fr ?? '',
    SPECIALITE: prof.specialite_fr ?? '',
    TYPE_CONTRAT: prof.type_contrat === 'permanent' ? 'Permanent' : 'Contractuel',
    PHOTO_PROF: prof.photo_url
      ? `<img src="${prof.photo_url}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : PHOTO_PLACEHOLDER,
    QR_CODE_PROF: `<img src="${qrDataUrl}" alt="QR" style="width:100%;height:100%;">`,
    NOM_ETABLISSEMENT: etab.nom_fr,
    LOGO: etab.logo_url ? `<img src="${etab.logo_url}" alt="Logo" style="height:28px;object-fit:contain;">` : '',
    DATE_AUJOURD_HUI: fmtDate(new Date()),
  };

  const tplHtml = getCardTemplate('CARTE_PROFESSEUR');
  const html = replaceVars(tplHtml, vars);
  return { html };
}

async function renderCard(html: string): Promise<Buffer> {
  const { renderPdfHtml } = await import('../../utils/browserPool');
  return renderPdfHtml(html, {
    width: '85.6mm',
    height: '54mm',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
}

async function buildA4DocumentHtml(
  etablissement_id: string,
  body: GenererDocumentInput,
): Promise<{ html: string; customTplId: string | null }> {
  const { type, destinataire_type, destinataire_id, parametres } = body;

  const customTpl = await prisma.documentTemplate.findUnique({
    where: { etablissement_id_type: { etablissement_id, type } },
  });
  let html = customTpl?.contenu_html ?? getDefaultTemplate(type);

  const vars: Record<string, string> = {
    ...(await buildCommonVars(etablissement_id)),
    ...(parametres ?? {}),
  };

  if (destinataire_type === 'eleve') {
    Object.assign(vars, await buildEleveVars(destinataire_id, etablissement_id));
    if (parametres) Object.assign(vars, parametres);

    if (type === 'RELEVE_NOTES') {
      const inscription = await prisma.inscription.findFirst({
        where: { eleve_id: destinataire_id, statut: 'actif' },
        include: { annee_scolaire: true, ...selectLiensClasse },
        orderBy: { date_inscription: 'desc' },
      });
      if (inscription) {
        const notes = await prisma.note.findMany({
          where: { eleve_id: destinataire_id, annee_scolaire_id: inscription.annee_scolaire_id },
          include: { matiere: true },
          orderBy: [{ periode: 'asc' }, { matiere: { nom_fr: 'asc' } }],
        });
        const cfgNotes = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { note_max: true } });
        const baseNote = Number(cfgNotes?.note_max ?? DEFAULT_NOTE_MAX);

        // Barème + coeff EFFECTIFS par (matière, période), en combinant les classes
        // FR et AR de l'élève (filière selon la matière) — pour afficher chaque note
        // sur son barème et pondérer correctement la moyenne de période.
        const periodes = [1, 2, 3];
        const baremes = new Map<string, { coeff: number; note_max: number; evaluee: boolean }>();
        for (const [cid, fil] of [
          [classeIdParFiliere(inscription.classes, 'FR'), 'FR'] as const,
          [classeIdParFiliere(inscription.classes, 'AR'), 'AR'] as const,
          [classeIdParFiliere(inscription.classes, 'EN'), 'EN'] as const,
        ]) {
          if (!cid) continue;
          // baseNote est OBLIGATOIRE : c'est le repli ultime de la chaîne de barèmes
          // (période > classe > matière > échelle établissement). L'omettre laisserait
          // le défaut /20 s'appliquer et diviserait les moyennes d'un établissement /10.
          for (const [k, v] of await getBaremesClasse(cid, periodes, [fil], baseNote)) baremes.set(k, v);
        }
        const notesEnrichies = notes.map(n => {
          const b = baremes.get(`${n.matiere_id}|${n.periode}`);
          return {
            periode: n.periode,
            matiere: { nom_fr: n.matiere.nom_fr },
            valeur: n.valeur,
            note_max_effectif: b?.note_max ?? baseNote,
            coeff_effectif: b?.coeff ?? 1,
          };
        });
        vars.TABLEAU_NOTES = buildNotesTable(notesEnrichies, baseNote);
        if (!vars.MOYENNE_ANNUELLE && notes.length > 0) {
          // Moyenne annuelle NORMALISÉE et pondérée (barèmes/coeff effectifs), comme
          // les bulletins — et non une moyenne brute des notes (barèmes variables).
          let somme = 0, n = 0;
          for (const [cid, fil] of [
            [classeIdParFiliere(inscription.classes, 'FR'), 'FR'] as const,
            [classeIdParFiliere(inscription.classes, 'AR'), 'AR'] as const,
            [classeIdParFiliere(inscription.classes, 'EN'), 'EN'] as const,
          ]) {
            if (!cid) continue;
            const moys = await calculerMoyennesClasse(etablissement_id, cid, inscription.annee_scolaire_id, periodes, [fil]);
            const v = moys.get(destinataire_id);
            if (v != null) { somme += v; n++; }
          }
          if (n > 0) vars.MOYENNE_ANNUELLE = (somme / n).toFixed(2);
        }
      }
    }

    if (type === 'EMPLOI_DU_TEMPS_ELEVE') {
      const inscription = await prisma.inscription.findFirst({
        where: { eleve_id: destinataire_id, statut: 'actif' },
        include: { ...selectLiensClasse },
        orderBy: { date_inscription: 'desc' },
      });
      const classeEmploi = classeIdParFiliere(inscription?.classes, 'FR');
      if (classeEmploi) {
        vars.TABLEAU_EMPLOI_DU_TEMPS = await buildEmploiDuTemps(classeEmploi);
      }
    }
  } else if (destinataire_type === 'professeur') {
    Object.assign(vars, await buildProfVars(destinataire_id, etablissement_id));
    if (parametres) Object.assign(vars, parametres);

    if (type === 'PLANNING_COURS') {
      vars.TABLEAU_PLANNING = await buildPlanningCours(destinataire_id);
    }

    if (type === 'FICHE_PAIE') {
      const paiement = await prisma.paiementPersonnel.findFirst({
        where: { personnel_id: destinataire_id },
        orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
      });
      if (paiement) {
        const MOIS_FR = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        vars.MOIS_ANNEE = vars.MOIS_ANNEE || `${MOIS_FR[paiement.mois] ?? paiement.mois} ${paiement.annee}`;
        vars.SALAIRE_BRUT = vars.SALAIRE_BRUT !== '0' ? vars.SALAIRE_BRUT : (paiement.montant_brut as unknown as { toNumber(): number }).toNumber().toLocaleString('fr-SN');
        vars.RETENUES = vars.RETENUES !== '0' ? vars.RETENUES : (paiement.retenues as unknown as { toNumber(): number }).toNumber().toLocaleString('fr-SN');
        vars.NET_A_PAYER = vars.NET_A_PAYER !== '0' ? vars.NET_A_PAYER : (paiement.net_a_payer as unknown as { toNumber(): number }).toNumber().toLocaleString('fr-SN');
        vars.HEURES_THEORIQUES = vars.HEURES_THEORIQUES !== '0' ? vars.HEURES_THEORIQUES : (paiement.heures_theoriques ? (paiement.heures_theoriques as unknown as { toNumber(): number }).toNumber().toString() : '0');
        vars.HEURES_REELLES = vars.HEURES_REELLES !== '0' ? vars.HEURES_REELLES : (paiement.heures_reelles ? (paiement.heures_reelles as unknown as { toNumber(): number }).toNumber().toString() : '0');
      }
    }
  } else if (destinataire_type === 'classe') {
    if (parametres) Object.assign(vars, parametres);

    if (type === 'LISTE_CLASSE') {
      const annee_scolaire_id = parametres?.annee_scolaire_id ?? '';
      vars.TABLEAU_ELEVES = await buildListeClasse(destinataire_id, annee_scolaire_id, etablissement_id);

      const classe = await prisma.classe.findUnique({
        where: { id: destinataire_id },
        include: { annee_scolaire: true },
      });
      if (classe) {
        vars.CLASSE_FR = classe.nom_fr;
        vars.ANNEE_SCOLAIRE = vars.ANNEE_SCOLAIRE || classe.annee_scolaire.libelle;
      }
    }

    if (type === 'RELEVE_NOTES_CLASSE' || type === 'RELEVE_NOTES_VIERGE') {
      // L'année scolaire utilisée pour récupérer les inscriptions :
      // 1) parametres.annee_scolaire_id si fourni ;
      // 2) sinon l'année scolaire associée à la classe (relation Classe.annee_scolaire).
      let annee_scolaire_id = parametres?.annee_scolaire_id ?? '';
      if (!annee_scolaire_id) {
        const cl = await prisma.classe.findUnique({
          where: { id: destinataire_id },
          select: { annee_scolaire_id: true },
        });
        annee_scolaire_id = cl?.annee_scolaire_id ?? '';
      }
      const periodeRaw = parametres?.periode ? Number(parametres.periode) : 0;
      const periode = Number.isFinite(periodeRaw) && periodeRaw > 0 ? periodeRaw : null;

      const tbl = await buildTableauNotesClasse(
        destinataire_id,
        annee_scolaire_id,
        periode,
        type === 'RELEVE_NOTES_VIERGE',
      );

      vars.TABLEAU_NOTES_CLASSE = tbl.html;
      vars.CLASSE_FR = vars.CLASSE_FR || tbl.classeNom;
      vars.ANNEE_SCOLAIRE = vars.ANNEE_SCOLAIRE || tbl.anneeLabel;
      vars.EFFECTIF = String(tbl.effectif);
      vars.TITULAIRE = tbl.titulaire;
      vars.PERIODE_LABEL = !periode
        ? 'Annuel (toutes périodes)'
        : `${periode}${periode === 1 ? 'er' : 'ème'} Trimestre`;
    }
  }

  applyCheckboxes(vars);
  html = replaceVars(html, vars);
  return { html, customTplId: customTpl?.id ?? null };
}

export async function genererDocument(
  etablissement_id: string,
  genere_par: string,
  body: GenererDocumentInput,
  previewMode = false,
): Promise<Buffer> {
  const { type, destinataire_type, destinataire_id } = body;

  if (CARD_TYPES.has(type as 'CARTE_ELEVE' | 'CARTE_PROFESSEUR')) {
    let html: string;
    if (type === 'CARTE_ELEVE') {
      ({ html } = await genererCarteEleve(destinataire_id, etablissement_id, previewMode));
    } else {
      ({ html } = await genererCarteProfesseur(destinataire_id, etablissement_id, previewMode));
    }
    const pdf = await renderCard(html);
    if (!previewMode) {
      await prisma.documentGenere.create({
        data: { etablissement_id, type: type as TypeDocument, destinataire_type, destinataire_id, genere_par, parametres: {} },
      });
    }
    return pdf;
  }

  const { html, customTplId } = await buildA4DocumentHtml(etablissement_id, body);

  // Relevés de notes au niveau classe : paysage + marges réduites pour faire
  // tenir la grille des matières en largeur sans tronquer.
  const landscape = type === 'RELEVE_NOTES_CLASSE' || type === 'RELEVE_NOTES_VIERGE';
  const { renderPdfHtml } = await import('../../utils/browserPool');
  const pdf = await renderPdfHtml(html, {
    format: 'A4',
    landscape,
    printBackground: true,
    margin: landscape
      ? { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
      : { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  });

  if (!previewMode) {
    await prisma.documentGenere.create({
      data: {
        etablissement_id,
        template_id: customTplId,
        type,
        destinataire_type,
        destinataire_id,
        genere_par,
        parametres: body.parametres ?? {},
      },
    });
  }

  return pdf;
}

export async function apercuDocumentHtml(
  etablissement_id: string,
  body: GenererDocumentInput,
): Promise<{ html: string; is_card: boolean; has_photo?: boolean }> {
  const { type, destinataire_id } = body;

  if (type === 'CARTE_ELEVE') {
    const { html, eleve } = await genererCarteEleve(destinataire_id, etablissement_id, true);
    return { html, is_card: true, has_photo: !!eleve.photo_url };
  }
  if (type === 'CARTE_PROFESSEUR') {
    const prof = await prisma.personnel.findFirst({
      where: { OR: [{ id: destinataire_id }, { utilisateur_id: destinataire_id }], utilisateur: { etablissement_id } },
      select: { photo_url: true },
    });
    const { html } = await genererCarteProfesseur(destinataire_id, etablissement_id, true);
    return { html, is_card: true, has_photo: !!prof?.photo_url };
  }

  const { html } = await buildA4DocumentHtml(etablissement_id, body);
  return { html, is_card: false };
}

export async function genererCartesLot(
  etablissement_id: string,
  genere_par: string,
  body: GenererCartesLotInput,
): Promise<{ pdf: Buffer; erreurs: { id: string; message: string }[] }> {
  const { PDFDocument } = await import('pdf-lib');
  const erreurs: { id: string; message: string }[] = [];
  const pages: Buffer[] = [];

  for (const id of body.ids) {
    try {
      let html: string;
      if (body.type === 'CARTE_ELEVE') {
        ({ html } = await genererCarteEleve(id, etablissement_id));
      } else {
        ({ html } = await genererCarteProfesseur(id, etablissement_id));
      }
      const cardPdf = await renderCard(html);
      pages.push(cardPdf);
      await prisma.documentGenere.create({
        data: {
          etablissement_id,
          type: body.type as TypeDocument,
          destinataire_type: body.type === 'CARTE_ELEVE' ? 'eleve' : 'professeur',
          destinataire_id: id,
          genere_par,
          parametres: {},
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      erreurs.push({ id, message: msg });
    }
  }

  if (pages.length === 0) {
    throw Object.assign(new Error('Aucune carte générée — vérifiez que toutes les photos sont renseignées'), { statusCode: 400 });
  }

  const merged = await PDFDocument.create();
  for (const pdfBuf of pages) {
    const src = await PDFDocument.load(pdfBuf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach(p => merged.addPage(p));
  }

  const mergedBytes = await merged.save();
  return { pdf: Buffer.from(mergedBytes), erreurs };
}

export async function listerHistorique(etablissement_id: string, skip = 0, take = 50) {
  const [total, items] = await Promise.all([
    prisma.documentGenere.count({ where: { etablissement_id } }),
    prisma.documentGenere.findMany({
      where: { etablissement_id },
      include: {
        utilisateur: { select: { nom_fr: true, prenom_fr: true } },
      },
      orderBy: { genere_le: 'desc' },
      skip,
      take,
    }),
  ]);
  return { total, items };
}
