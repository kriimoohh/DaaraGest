import { TypeDocument } from '../documents.schema';

export const TYPE_DOCUMENT_LABELS: Record<TypeDocument, string> = {
  CERTIFICAT_SCOLARITE:    'Certificat de scolarité',
  ATTESTATION_INSCRIPTION: 'Attestation d\'inscription',
  CONVOCATION_EXAMEN:      'Convocation aux examens',
  FICHE_TRANSFERT:         'Fiche de transfert',
  EMPLOI_DU_TEMPS_ELEVE:   'Emploi du temps (élève)',
  RELEVE_NOTES:            'Relevé de notes',
  CERTIFICAT_BONNE_CONDUITE: 'Certificat de bonne conduite',
  FICHE_RENSEIGNEMENTS:    'Fiche de renseignements',
  ATTESTATION_RESULTATS:   'Attestation de résultats',
  LISTE_CLASSE:            'Liste de classe',
  ATTESTATION_TRAVAIL:     'Attestation de travail',
  ORDRE_MISSION:           'Ordre de mission',
  FICHE_PAIE:              'Fiche de paie',
  PLANNING_COURS:          'Planning de cours',
  CARTE_ELEVE:             'Carte d\'identité scolaire (élève)',
  CARTE_PROFESSEUR:        'Carte d\'identité professeur',
};

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const COMMON_CSS = `
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  .page { padding: 30px 40px; max-width: 780px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a5276; padding-bottom: 16px; margin-bottom: 24px; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .etab-name { font-size: 16px; font-weight: bold; color: #1a5276; }
  .etab-info { font-size: 11px; color: #555; line-height: 1.6; }
  .doc-title { text-align: center; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #1a5276; margin: 24px 0 8px; }
  .doc-subtitle { text-align: center; font-size: 12px; color: #777; margin-bottom: 24px; }
  .ref-line { text-align: right; font-size: 11px; color: #999; margin-bottom: 20px; }
  .body-text { font-size: 13px; line-height: 2; }
  .underscore { display: inline-block; border-bottom: 1px solid #333; min-width: 200px; }
  .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .info-table td { padding: 8px 12px; border: 1px solid #ddd; }
  .info-table td:first-child { background: #f5f5f5; font-weight: bold; width: 40%; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .signature-block { text-align: center; }
  .signature-block p { font-size: 12px; color: #333; margin-bottom: 8px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
  .data-table th { background: #1a5276; color: white; padding: 8px 10px; text-align: left; }
  .data-table td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  .data-table tr:nth-child(even) td { background: #f9f9f9; }
`;

// ─── Shared header/footer snippets ───────────────────────────────────────────
const SHARED_HEADER = `
  <div class="header">
    <div class="header-left">
      {{LOGO}}
      <div>
        <div class="etab-name">{{NOM_ETABLISSEMENT}}</div>
        <div class="etab-info">{{ADRESSE_ETABLISSEMENT}}<br>Tél : {{TEL_ETABLISSEMENT}}</div>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#555">
      Année scolaire : <strong>{{ANNEE_SCOLAIRE}}</strong>
    </div>
  </div>`;

const SHARED_FOOTER = `
  <div class="footer">
    <div class="signature-block">
      <p>Le/La Directeur(trice)</p>
      {{SIGNATURE}}
      <p style="margin-top:4px;font-size:11px">Signature et cachet</p>
    </div>
    <div class="signature-block">
      <p>Cachet de l'établissement</p>
      {{CACHET}}
    </div>
    <div style="text-align:right;font-size:11px;color:#555">
      Fait à _____, le {{DATE_AUJOURD_HUI}}
    </div>
  </div>`;

function wrapPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="page">
    ${SHARED_HEADER}
    ${body}
    ${SHARED_FOOTER}
  </div>
</body>
</html>`;
}

// ─── Individual templates ─────────────────────────────────────────────────────

const CERTIFICAT_SCOLARITE = wrapPage('Certificat de scolarité', `
  <div class="doc-title">Certificat de scolarité</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je soussigné(e), Directeur(trice) de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    certifie que l'élève :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Date de naissance</td><td>{{DATE_NAISSANCE}}</td></tr>
      <tr><td>Lieu de naissance</td><td>{{LIEU_NAISSANCE}}</td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Année scolaire</td><td>{{ANNEE_SCOLAIRE}}</td></tr>
    </table>
    <p>est régulièrement inscrit(e) dans notre établissement en <strong>{{CLASSE_FR}}</strong>
    pour l'année scolaire <strong>{{ANNEE_SCOLAIRE}}</strong>.</p>
    <p>Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
  </div>`);

const ATTESTATION_INSCRIPTION = wrapPage("Attestation d'inscription", `
  <div class="doc-title">Attestation d'inscription</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je soussigné(e), Directeur(trice) de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    atteste par la présente que l'élève :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Date de naissance</td><td>{{DATE_NAISSANCE}}</td></tr>
      <tr><td>Lieu de naissance</td><td>{{LIEU_NAISSANCE}}</td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Classe (filière française)</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Classe (filière arabe)</td><td>{{CLASSE_AR}}</td></tr>
      <tr><td>Date d'inscription</td><td>{{DATE_INSCRIPTION}}</td></tr>
      <tr><td>Statut</td><td>{{STATUT_INSCRIPTION}}</td></tr>
    </table>
    <p>a été régulièrement inscrit(e) dans notre établissement pour l'année scolaire
    <strong>{{ANNEE_SCOLAIRE}}</strong>.</p>
    <p>Cette attestation est délivrée à l'intéressé(e) sur sa demande pour servir et valoir ce que de droit.</p>
  </div>`);

const CONVOCATION_EXAMEN = wrapPage('Convocation aux examens', `
  <div class="doc-title">Convocation aux examens</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>L'élève soussigné(e) est convoqué(e) aux examens selon les modalités suivantes :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Date de l'examen</td><td><strong>{{DATE_EXAMEN}}</strong></td></tr>
      <tr><td>Salle</td><td><strong>{{SALLE}}</strong></td></tr>
      <tr><td>Heure de convocation</td><td>{{HEURE_CONVOCATION}}</td></tr>
    </table>
    <p><strong>Matières concernées :</strong></p>
    {{LISTE_MATIERES}}
    <p style="margin-top:16px;font-size:12px;color:#c0392b;">
      <strong>Important :</strong> L'élève est prié(e) de se présenter 15 minutes avant l'heure de convocation,
      muni(e) de sa carte scolaire et du matériel nécessaire. Tout retard ne sera pas toléré.
    </p>
  </div>`);

const FICHE_TRANSFERT = wrapPage('Fiche de transfert', `
  <div class="doc-title">Fiche de transfert</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p><strong>Informations sur l'élève transféré(e) :</strong></p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td>{{NOM_PRENOM_ELEVE}}</td></tr>
      <tr><td>Date de naissance</td><td>{{DATE_NAISSANCE}}</td></tr>
      <tr><td>Lieu de naissance</td><td>{{LIEU_NAISSANCE}}</td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Sexe</td><td>{{SEXE}}</td></tr>
      <tr><td>Classe actuelle</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Année scolaire</td><td>{{ANNEE_SCOLAIRE}}</td></tr>
      <tr><td>Établissement de destination</td><td>{{ETABLISSEMENT_DESTINATION}}</td></tr>
      <tr><td>Motif du transfert</td><td>{{MOTIF}}</td></tr>
      <tr><td>Date effective du transfert</td><td>{{DATE_TRANSFERT}}</td></tr>
    </table>
    <p>L'élève sus-mentionné(e) est autorisé(e) à quitter notre établissement à compter de la date indiquée ci-dessus.
    Tous les documents scolaires ont été remis à l'intéressé(e).</p>
  </div>`);

const EMPLOI_DU_TEMPS_ELEVE = wrapPage("Emploi du temps (élève)", `
  <div class="doc-title">Emploi du temps</div>
  <div class="doc-subtitle">Année scolaire {{ANNEE_SCOLAIRE}} — Classe : {{CLASSE_FR}}</div>
  <table class="info-table" style="margin-bottom:16px">
    <tr><td>Élève</td><td>{{NOM_PRENOM_ELEVE}}</td></tr>
    <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
    <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
  </table>
  {{TABLEAU_EMPLOI_DU_TEMPS}}`);

const RELEVE_NOTES = wrapPage('Relevé de notes', `
  <div class="doc-title">Relevé de notes</div>
  <div class="doc-subtitle">Année scolaire {{ANNEE_SCOLAIRE}}</div>
  <table class="info-table" style="margin-bottom:16px">
    <tr><td>Élève</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
    <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
    <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
    <tr><td>Année scolaire</td><td>{{ANNEE_SCOLAIRE}}</td></tr>
  </table>
  {{TABLEAU_NOTES}}
  <div class="body-text" style="margin-top:16px;">
    <p>Moyenne annuelle : <strong>{{MOYENNE_ANNUELLE}}</strong></p>
  </div>`);

const CERTIFICAT_BONNE_CONDUITE = wrapPage('Certificat de bonne conduite', `
  <div class="doc-title">Certificat de bonne conduite</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je soussigné(e), Directeur(trice) de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    certifie que l'élève :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Année scolaire</td><td>{{ANNEE_SCOLAIRE}}</td></tr>
    </table>
    <p>a fait preuve d'une conduite irréprochable au cours de l'année scolaire
    <strong>{{ANNEE_SCOLAIRE}}</strong>. Aucune sanction disciplinaire n'a été prononcée à son encontre
    durant sa scolarité dans notre établissement.</p>
    <p>Ce certificat est délivré à l'intéressé(e) sur sa demande pour servir et valoir ce que de droit.</p>
  </div>`);

const FICHE_RENSEIGNEMENTS = wrapPage('Fiche de renseignements', `
  <div class="doc-title">Fiche de renseignements</div>
  <div class="doc-subtitle">Année scolaire {{ANNEE_SCOLAIRE}}</div>
  <p style="font-size:13px;font-weight:bold;color:#1a5276;margin:16px 0 8px;">Informations personnelles</p>
  <table class="info-table">
    <tr><td>Nom et prénom</td><td>{{NOM_PRENOM_ELEVE}}</td></tr>
    <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
    <tr><td>Date de naissance</td><td>{{DATE_NAISSANCE}}</td></tr>
    <tr><td>Lieu de naissance</td><td>{{LIEU_NAISSANCE}}</td></tr>
    <tr><td>Sexe</td><td>{{SEXE}}</td></tr>
    <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
    <tr><td>Filière arabe</td><td>{{CLASSE_AR}}</td></tr>
  </table>
  <p style="font-size:13px;font-weight:bold;color:#1a5276;margin:16px 0 8px;">Informations du tuteur / parent</p>
  <table class="info-table">
    <tr><td>Nom du tuteur</td><td>{{NOM_TUTEUR}}</td></tr>
    <tr><td>Lien de parenté</td><td>{{LIEN_PARENTE}}</td></tr>
    <tr><td>Téléphone</td><td>{{TEL_TUTEUR}}</td></tr>
    <tr><td>Adresse</td><td>{{ADRESSE_TUTEUR}}</td></tr>
  </table>`);

const ATTESTATION_RESULTATS = wrapPage('Attestation de résultats', `
  <div class="doc-title">Attestation de résultats</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je soussigné(e), Directeur(trice) de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    atteste que l'élève :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Matricule</td><td>{{MATRICULE}}</td></tr>
      <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Année scolaire</td><td>{{ANNEE_SCOLAIRE}}</td></tr>
      <tr><td>Moyenne annuelle</td><td><strong>{{MOYENNE_ANNUELLE}} / 20</strong></td></tr>
      <tr><td>Décision</td><td><strong>{{DECISION}}</strong></td></tr>
    </table>
    <p>a obtenu les résultats mentionnés ci-dessus au terme de l'année scolaire <strong>{{ANNEE_SCOLAIRE}}</strong>.</p>
    <p>Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>
  </div>`);

const LISTE_CLASSE = wrapPage('Liste de classe', `
  <div class="doc-title">Liste de classe</div>
  <div class="doc-subtitle">Classe : {{CLASSE_FR}} — Année scolaire : {{ANNEE_SCOLAIRE}}</div>
  {{TABLEAU_ELEVES}}`);

const ATTESTATION_TRAVAIL = wrapPage('Attestation de travail', `
  <div class="doc-title">Attestation de travail</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je soussigné(e), Directeur(trice) de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    atteste que :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
      <tr><td>Type de contrat</td><td>{{TYPE_CONTRAT}}</td></tr>
      <tr><td>Date de prise de service</td><td>{{DATE_EMBAUCHE}}</td></tr>
      <tr><td>Poste occupé</td><td>Professeur</td></tr>
    </table>
    <p>est employé(e) en qualité de <strong>Professeur</strong> au sein de notre établissement depuis le
    <strong>{{DATE_EMBAUCHE}}</strong>.</p>
    <p>Cette attestation est délivrée à l'intéressé(e) sur sa demande pour servir et valoir ce que de droit.</p>
  </div>`);

const ORDRE_MISSION = wrapPage('Ordre de mission', `
  <div class="doc-title">Ordre de mission</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Le Directeur de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong> autorise par la présente
    le déplacement professionnel de :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Fonction</td><td>Professeur</td></tr>
      <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
      <tr><td>Destination</td><td><strong>{{DESTINATION}}</strong></td></tr>
      <tr><td>Objet de la mission</td><td>{{OBJET_MISSION}}</td></tr>
      <tr><td>Date de début</td><td>{{DATE_DEBUT_MISSION}}</td></tr>
      <tr><td>Date de fin</td><td>{{DATE_FIN_MISSION}}</td></tr>
    </table>
    <p>Les frais de déplacement seront pris en charge conformément aux dispositions réglementaires en vigueur.</p>
  </div>`);

const FICHE_PAIE = wrapPage('Fiche de paie', `
  <div class="doc-title">Fiche de paie</div>
  <div class="doc-subtitle">Période : {{MOIS_ANNEE}}</div>
  <table class="info-table" style="margin-bottom:16px">
    <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
    <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
    <tr><td>Type de contrat</td><td>{{TYPE_CONTRAT}}</td></tr>
    <tr><td>Date d'embauche</td><td>{{DATE_EMBAUCHE}}</td></tr>
    <tr><td>Période</td><td>{{MOIS_ANNEE}}</td></tr>
  </table>
  <p style="font-size:13px;font-weight:bold;color:#1a5276;margin:16px 0 8px;">Détail de la rémunération</p>
  <table class="data-table">
    <thead>
      <tr><th>Libellé</th><th style="text-align:right">Montant (FCFA)</th></tr>
    </thead>
    <tbody>
      <tr><td>Salaire brut</td><td style="text-align:right">{{SALAIRE_BRUT}}</td></tr>
      <tr><td>Retenues</td><td style="text-align:right; color:#c0392b">- {{RETENUES}}</td></tr>
      <tr>
        <td style="font-weight:bold">Net à payer</td>
        <td style="text-align:right;font-weight:bold;color:#1a5276">{{NET_A_PAYER}}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:#555;margin-top:24px;">
    Heures théoriques : {{HEURES_THEORIQUES}} h &nbsp;|&nbsp; Heures réelles : {{HEURES_REELLES}} h
  </p>`);

const PLANNING_COURS = wrapPage('Planning de cours', `
  <div class="doc-title">Planning de cours</div>
  <div class="doc-subtitle">Année scolaire {{ANNEE_SCOLAIRE}}</div>
  <table class="info-table" style="margin-bottom:16px">
    <tr><td>Professeur</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
    <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
  </table>
  {{TABLEAU_PLANNING}}`);

// ─── Carte d'identité scolaire (élève) — CR80 85.6×54mm ──────────────────────

const CARTE_ELEVE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 85.6mm; height: 54mm; font-family: Arial, sans-serif; }
    .card {
      width: 85.6mm; height: 54mm; position: relative; overflow: hidden;
      background: linear-gradient(135deg, #0a6b52 0%, #0e5a9e 60%, #083a7a 100%);
      color: #fff;
    }
    .card::before {
      content: '';
      position: absolute; top: -8mm; right: -8mm;
      width: 32mm; height: 32mm; border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .card::after {
      content: '';
      position: absolute; bottom: -4mm; left: 20mm;
      width: 22mm; height: 22mm; border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .header {
      display: flex; align-items: center; gap: 1.5mm;
      padding: 2mm 3mm 1.5mm;
      border-bottom: 0.4mm solid rgba(255,255,255,0.3);
    }
    .logo-wrap { flex-shrink: 0; height: 6mm; display: flex; align-items: center; }
    .etab-name {
      font-size: 5.5pt; font-weight: bold; letter-spacing: 0.2mm;
      text-transform: uppercase; opacity: 0.95; line-height: 1.2;
    }
    .card-label {
      font-size: 4pt; opacity: 0.7; letter-spacing: 0.3mm; text-transform: uppercase;
      text-align: right; flex: 1;
    }
    .body { display: flex; padding: 2mm 2.5mm; gap: 2.5mm; flex: 1; }
    .photo-wrap {
      flex-shrink: 0; width: 18mm; height: 18mm; border-radius: 50%;
      border: 0.7mm solid rgba(255,255,255,0.6);
      overflow: hidden; background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
    }
    .photo-placeholder {
      font-size: 16pt; opacity: 0.5;
    }
    .info { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.8mm; }
    .student-name { font-size: 8pt; font-weight: bold; line-height: 1.2; }
    .student-sub { font-size: 5.5pt; opacity: 0.85; line-height: 1.4; }
    .bottom {
      display: flex; align-items: flex-end; justify-content: space-between;
      padding: 0 2.5mm 1.5mm;
    }
    .matricule-badge {
      font-size: 5pt; font-weight: bold; letter-spacing: 0.3mm;
      background: rgba(255,255,255,0.2); border-radius: 1mm;
      padding: 0.5mm 1.5mm;
    }
    .qr-wrap {
      width: 15mm; height: 15mm; background: #fff; border-radius: 1mm;
      padding: 0.5mm; display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-wrap">{{LOGO}}</div>
      <div class="etab-name">{{NOM_ETABLISSEMENT}}</div>
      <div class="card-label">Carte scolaire</div>
    </div>
    <div class="body">
      <div class="photo-wrap">{{PHOTO_ELEVE}}</div>
      <div class="info">
        <div class="student-name">{{NOM_PRENOM_ELEVE}}</div>
        <div class="student-sub">Classe : {{CLASSE_FR}}</div>
        <div class="student-sub">{{ANNEE_SCOLAIRE}}</div>
      </div>
      <div class="qr-wrap">{{QR_CODE_ELEVE}}</div>
    </div>
    <div class="bottom">
      <div class="matricule-badge">{{MATRICULE}}</div>
    </div>
  </div>
</body>
</html>`;

// ─── Carte professeur — CR80 85.6×54mm recto + verso ─────────────────────────

const CARTE_PROFESSEUR_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 85.6mm; font-family: Arial, sans-serif; }
    .card {
      width: 85.6mm; height: 54mm; position: relative; overflow: hidden;
      color: #fff;
    }
    .card-front {
      background: linear-gradient(135deg, #5c1320 0%, #8b1a2e 50%, #6b1a2e 100%);
    }
    .card-back {
      page-break-before: always;
      background: linear-gradient(135deg, #5c1320 0%, #8b1a2e 50%, #6b1a2e 100%);
    }
    .gold { color: #f0c040; }
    .gold-line {
      height: 0.6mm; background: linear-gradient(90deg, transparent, #c9a227, transparent);
      margin: 0 4mm;
    }
    .header {
      display: flex; align-items: center; gap: 1.5mm;
      padding: 2mm 3mm 1.5mm;
    }
    .logo-wrap { flex-shrink: 0; height: 6mm; display: flex; align-items: center; }
    .etab-name { font-size: 5.5pt; font-weight: bold; letter-spacing: 0.2mm; text-transform: uppercase; line-height: 1.2; }
    .card-label { font-size: 4pt; opacity: 0.7; letter-spacing: 0.3mm; text-transform: uppercase; text-align: right; flex: 1; }
    .body { display: flex; padding: 1.5mm 2.5mm; gap: 2.5mm; }
    .photo-wrap {
      flex-shrink: 0; width: 18mm; height: 18mm; border-radius: 50%;
      border: 0.7mm solid #c9a227;
      overflow: hidden; background: rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
    }
    .info { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1mm; }
    .prof-name { font-size: 8pt; font-weight: bold; line-height: 1.2; }
    .role-badge {
      display: inline-block; font-size: 4.5pt; letter-spacing: 0.3mm; text-transform: uppercase;
      background: #c9a227; color: #3d0a14; padding: 0.4mm 1.5mm; border-radius: 0.8mm; font-weight: bold;
    }
    .prof-sub { font-size: 5.5pt; opacity: 0.85; line-height: 1.4; }
    .bottom { padding: 1mm 2.5mm 1.5mm; font-size: 4.5pt; opacity: 0.6; }

    /* Verso */
    .verso-body {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 46mm; gap: 2mm;
    }
    .qr-wrap-back {
      width: 30mm; height: 30mm; background: #fff; border-radius: 1.5mm;
      padding: 1mm; display: flex; align-items: center; justify-content: center;
      border: 0.5mm solid #c9a227;
    }
    .scan-label { font-size: 5pt; opacity: 0.8; letter-spacing: 0.3mm; text-transform: uppercase; }
    .verso-etab { font-size: 4.5pt; opacity: 0.5; }
  </style>
</head>
<body>
  <!-- RECTO -->
  <div class="card card-front">
    <div class="header">
      <div class="logo-wrap">{{LOGO}}</div>
      <div class="etab-name">{{NOM_ETABLISSEMENT}}</div>
      <div class="card-label">Carte professeur</div>
    </div>
    <div class="gold-line"></div>
    <div class="body">
      <div class="photo-wrap">{{PHOTO_PROF}}</div>
      <div class="info">
        <div class="prof-name">{{NOM_PRENOM_PROF}}</div>
        <div><span class="role-badge">Professeur</span></div>
        <div class="prof-sub">{{SPECIALITE}}</div>
        <div class="prof-sub">{{TYPE_CONTRAT}}</div>
      </div>
    </div>
    <div class="gold-line"></div>
    <div class="bottom">{{NOM_ETABLISSEMENT}} &nbsp;·&nbsp; {{DATE_AUJOURD_HUI}}</div>
  </div>

  <!-- VERSO -->
  <div class="card card-back">
    <div class="header" style="justify-content: center; padding-bottom: 0.5mm;">
      <div class="etab-name" style="text-align:center; font-size:5pt;">{{NOM_ETABLISSEMENT}}</div>
    </div>
    <div class="gold-line"></div>
    <div class="verso-body">
      <div class="qr-wrap-back">{{QR_CODE_PROF}}</div>
      <div class="scan-label gold">Scanner pour pointage</div>
      <div class="verso-etab">{{NOM_PRENOM_PROF}}</div>
    </div>
  </div>
</body>
</html>`;

// ─── Map ──────────────────────────────────────────────────────────────────────

const TEMPLATES: Record<TypeDocument, string> = {
  CERTIFICAT_SCOLARITE:      CERTIFICAT_SCOLARITE,
  ATTESTATION_INSCRIPTION:   ATTESTATION_INSCRIPTION,
  CONVOCATION_EXAMEN:        CONVOCATION_EXAMEN,
  FICHE_TRANSFERT:           FICHE_TRANSFERT,
  EMPLOI_DU_TEMPS_ELEVE:     EMPLOI_DU_TEMPS_ELEVE,
  RELEVE_NOTES:              RELEVE_NOTES,
  CERTIFICAT_BONNE_CONDUITE: CERTIFICAT_BONNE_CONDUITE,
  FICHE_RENSEIGNEMENTS:      FICHE_RENSEIGNEMENTS,
  ATTESTATION_RESULTATS:     ATTESTATION_RESULTATS,
  LISTE_CLASSE:              LISTE_CLASSE,
  ATTESTATION_TRAVAIL:       ATTESTATION_TRAVAIL,
  ORDRE_MISSION:             ORDRE_MISSION,
  FICHE_PAIE:                FICHE_PAIE,
  PLANNING_COURS:            PLANNING_COURS,
  CARTE_ELEVE:               CARTE_ELEVE_HTML,
  CARTE_PROFESSEUR:          CARTE_PROFESSEUR_HTML,
};

const CARD_TEMPLATES: Record<'CARTE_ELEVE' | 'CARTE_PROFESSEUR', string> = {
  CARTE_ELEVE:     CARTE_ELEVE_HTML,
  CARTE_PROFESSEUR: CARTE_PROFESSEUR_HTML,
};

export function getDefaultTemplate(type: TypeDocument): string {
  return TEMPLATES[type];
}

export function getCardTemplate(type: 'CARTE_ELEVE' | 'CARTE_PROFESSEUR'): string {
  return CARD_TEMPLATES[type];
}
