import crypto from 'crypto';
import QRCode from 'qrcode';
import prisma from '../../config/database';
import { TypeDocument, GenererDocumentInput, GenererCartesLotInput, UpsertTemplateInput, TYPE_DOCUMENT_VALUES, CARD_TYPES } from './documents.schema';
import { getDefaultTemplate, TYPE_DOCUMENT_LABELS, getCardTemplate } from './templates/defaults';

const QR_SECRET = process.env.QR_SECRET ?? 'daaragest-qr-secret-change-in-prod';

function signQrPayload(payload: object): string {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex').slice(0, 16);
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
  const prof = await prisma.professeur.findFirstOrThrow({
    where: { OR: [{ id: profId }, { utilisateur_id: profId }] },
  });
  if (prof.qr_token) return prof.qr_token;
  const token = crypto.randomUUID();
  await prisma.professeur.update({ where: { id: prof.id }, data: { qr_token: token } });
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
  });

  const logoHtml = etab.logo_url
    ? `<img src="${etab.logo_url}" alt="Logo" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';
  const signatureHtml = etab.signature_url
    ? `<img src="${etab.signature_url}" alt="Signature" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';
  const cachetHtml = etab.cachet_url
    ? `<img src="${etab.cachet_url}" alt="Cachet" style="height:60px;object-fit:contain;">`
    : '<div style="height:60px;"></div>';

  // Active school year
  const annee = await prisma.anneeScolaire.findFirst({
    where: { etablissement_id, active: true },
  });

  const today = new Date();
  const refDoc = `REF-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return {
    NOM_ETABLISSEMENT: etab.nom_fr,
    ADRESSE_ETABLISSEMENT: etab.adresse ?? '',
    TEL_ETABLISSEMENT: etab.telephone ?? '',
    ANNEE_SCOLAIRE: annee?.libelle ?? '',
    LOGO: logoHtml,
    SIGNATURE: signatureHtml,
    CACHET: cachetHtml,
    DATE_AUJOURD_HUI: fmtDate(today),
    REF_DOCUMENT: refDoc,
  };
}

// ─── Build eleve vars ─────────────────────────────────────────────────────────

async function buildEleveVars(eleve_id: string, etablissement_id: string): Promise<Record<string, string>> {
  const eleve = await prisma.eleve.findUniqueOrThrow({
    where: { id: eleve_id },
    include: {
      parents: true,
      inscriptions: {
        where: { statut: 'actif' },
        include: {
          classe_fr: true,
          classe_ar: true,
          annee_scolaire: true,
        },
        orderBy: { date_inscription: 'desc' },
        take: 1,
      },
    },
  });

  const inscription = eleve.inscriptions[0];
  const classe_fr = inscription?.classe_fr?.nom_fr ?? '';
  const classe_ar = inscription?.classe_ar?.nom_fr ?? '';
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
      ? `<img src="${eleve.photo_url}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : '',
    QR_CODE_ELEVE: '',
  };
}

// ─── Build prof vars ──────────────────────────────────────────────────────────

async function buildProfVars(prof_id: string, _etablissement_id: string): Promise<Record<string, string>> {
  const prof = await prisma.professeur.findFirstOrThrow({
    where: { OR: [{ id: prof_id }, { utilisateur_id: prof_id }] },
    include: { utilisateur: true },
  });

  return {
    NOM_PRENOM_PROF: `${prof.utilisateur.nom_fr} ${prof.utilisateur.prenom_fr ?? ''}`.trim(),
    SPECIALITE: prof.specialite_fr ?? '',
    TYPE_CONTRAT: prof.type_contrat,
    DATE_EMBAUCHE: fmtDate(prof.date_embauche),
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
      ? `<img src="${prof.photo_url}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : '',
    QR_CODE_PROF: '',
  };
}

// ─── Build notes table ────────────────────────────────────────────────────────

function buildNotesTable(notes: Array<{ periode: number; matiere: { nom_fr: string }; valeur: { toNumber(): number } }>): string {
  if (!notes.length) return '<p style="font-size:13px;color:#777">Aucune note enregistrée.</p>';

  // Group by period
  const byPeriode = new Map<number, typeof notes>();
  for (const n of notes) {
    const arr = byPeriode.get(n.periode) ?? [];
    arr.push(n);
    byPeriode.set(n.periode, arr);
  }

  let html = '';
  for (const [periode, pNotes] of Array.from(byPeriode.entries()).sort((a, b) => a[0] - b[0])) {
    const total = pNotes.reduce((s, n) => s + n.valeur.toNumber(), 0);
    const moy = (total / pNotes.length).toFixed(2);
    html += `
    <p style="font-size:13px;font-weight:bold;color:#1a5276;margin:16px 0 6px;">Période ${periode}</p>
    <table class="data-table">
      <thead><tr><th>Matière</th><th style="text-align:right">Note / 20</th></tr></thead>
      <tbody>
        ${pNotes.map(n => `<tr><td>${n.matiere.nom_fr}</td><td style="text-align:right">${n.valeur.toNumber().toFixed(2)}</td></tr>`).join('')}
        <tr style="background:#e8f4f8"><td style="font-weight:bold">Moyenne période ${periode}</td><td style="text-align:right;font-weight:bold">${moy}</td></tr>
      </tbody>
    </table>`;
  }
  return html;
}

// ─── Build emploi du temps ────────────────────────────────────────────────────

async function buildEmploiDuTemps(classe_id: string): Promise<string> {
  const creneaux = await prisma.creneau.findMany({
    where: { classe_id },
    include: { matiere: true, professeur: { include: { utilisateur: true } } },
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
    where: { professeur_id: prof_id },
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

// ─── Build liste classe ───────────────────────────────────────────────────────

async function buildListeClasse(classe_id: string, annee_scolaire_id: string, _etablissement_id: string): Promise<string> {
  const inscriptions = await prisma.inscription.findMany({
    where: {
      classe_fr_id: classe_id,
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

function replaceVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v ?? ''),
    html,
  );
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
        include: { classe_fr: true, classe_ar: true, annee_scolaire: true },
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
    CLASSE_FR: inscription?.classe_fr?.nom_fr ?? '',
    CLASSE_AR: inscription?.classe_ar?.nom_fr ?? '',
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
  const prof = await prisma.professeur.findFirstOrThrow({
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

export async function genererDocument(
  etablissement_id: string,
  genere_par: string,
  body: GenererDocumentInput,
  previewMode = false,
): Promise<Buffer> {
  const { type, destinataire_type, destinataire_id, parametres } = body;

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

  // Get template HTML
  const customTpl = await prisma.documentTemplate.findUnique({
    where: { etablissement_id_type: { etablissement_id, type } },
  });
  let html = customTpl?.contenu_html ?? getDefaultTemplate(type);

  // Build vars
  const vars: Record<string, string> = {
    ...(await buildCommonVars(etablissement_id)),
    ...(parametres ?? {}),
  };

  if (destinataire_type === 'eleve') {
    Object.assign(vars, await buildEleveVars(destinataire_id, etablissement_id));

    // Apply parametres override again (they take priority)
    if (parametres) Object.assign(vars, parametres);

    if (type === 'RELEVE_NOTES') {
      // Fetch active inscription to get annee_scolaire_id
      const inscription = await prisma.inscription.findFirst({
        where: { eleve_id: destinataire_id, statut: 'actif' },
        include: { annee_scolaire: true },
        orderBy: { date_inscription: 'desc' },
      });
      if (inscription) {
        const notes = await prisma.note.findMany({
          where: {
            eleve_id: destinataire_id,
            annee_scolaire_id: inscription.annee_scolaire_id,
          },
          include: { matiere: true },
          orderBy: [{ periode: 'asc' }, { matiere: { nom_fr: 'asc' } }],
        });
        vars.TABLEAU_NOTES = buildNotesTable(notes as Parameters<typeof buildNotesTable>[0]);

        if (!vars.MOYENNE_ANNUELLE && notes.length > 0) {
          const total = notes.reduce((s, n) => s + (n.valeur as unknown as { toNumber(): number }).toNumber(), 0);
          vars.MOYENNE_ANNUELLE = (total / notes.length).toFixed(2);
        }
      }
    }

    if (type === 'EMPLOI_DU_TEMPS_ELEVE') {
      // Get classe_id from active inscription
      const inscription = await prisma.inscription.findFirst({
        where: { eleve_id: destinataire_id, statut: 'actif' },
        orderBy: { date_inscription: 'desc' },
      });
      if (inscription?.classe_fr_id) {
        vars.TABLEAU_EMPLOI_DU_TEMPS = await buildEmploiDuTemps(inscription.classe_fr_id);
      }
    }
  } else if (destinataire_type === 'professeur') {
    Object.assign(vars, await buildProfVars(destinataire_id, etablissement_id));

    // Apply parametres override
    if (parametres) Object.assign(vars, parametres);

    if (type === 'PLANNING_COURS') {
      vars.TABLEAU_PLANNING = await buildPlanningCours(destinataire_id);
    }

    if (type === 'FICHE_PAIE') {
      // Fetch latest paiement for this professeur
      const paiement = await prisma.paiementProfesseur.findFirst({
        where: { professeur_id: destinataire_id },
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
    // Apply parametres
    if (parametres) Object.assign(vars, parametres);

    if (type === 'LISTE_CLASSE') {
      const annee_scolaire_id = parametres?.annee_scolaire_id ?? '';
      vars.TABLEAU_ELEVES = await buildListeClasse(destinataire_id, annee_scolaire_id, etablissement_id);

      // Also get classe name for header
      const classe = await prisma.classe.findUnique({
        where: { id: destinataire_id },
        include: { annee_scolaire: true },
      });
      if (classe) {
        vars.CLASSE_FR = classe.nom_fr;
        vars.ANNEE_SCOLAIRE = vars.ANNEE_SCOLAIRE || classe.annee_scolaire.libelle;
      }
    }
  }

  html = replaceVars(html, vars);

  const { renderPdfHtml } = await import('../../utils/browserPool');
  const pdf = await renderPdfHtml(html, {
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  });

  if (!previewMode) {
    await prisma.documentGenere.create({
      data: {
        etablissement_id,
        template_id: customTpl?.id ?? null,
        type,
        destinataire_type,
        destinataire_id,
        genere_par,
        parametres: parametres ?? {},
      },
    });
  }

  return pdf;
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

export async function apercuCarte(
  etablissement_id: string,
  type: 'CARTE_ELEVE' | 'CARTE_PROFESSEUR',
  destinataire_id: string,
): Promise<{ html: string; has_photo: boolean }> {
  if (type === 'CARTE_ELEVE') {
    const { html, eleve } = await genererCarteEleve(destinataire_id, etablissement_id, true);
    return { html, has_photo: !!eleve.photo_url };
  }
  const prof = await prisma.professeur.findFirstOrThrow({
    where: { OR: [{ id: destinataire_id }, { utilisateur_id: destinataire_id }], utilisateur: { etablissement_id } },
    select: { photo_url: true },
  });
  const { html } = await genererCarteProfesseur(destinataire_id, etablissement_id, true);
  return { html, has_photo: !!prof.photo_url };
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
