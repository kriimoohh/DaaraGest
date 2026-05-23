import { TypeDocument } from '../documents.schema';

export const TYPE_DOCUMENT_LABELS: Record<TypeDocument, string> = {
  CERTIFICAT_SCOLARITE:         'Certificat de scolarité',
  ATTESTATION_INSCRIPTION:      "Attestation d'inscription",
  CONVOCATION_EXAMEN:           'Convocation aux examens',
  FICHE_TRANSFERT:              'Fiche de transfert',
  EMPLOI_DU_TEMPS_ELEVE:        "Emploi du temps (élève)",
  RELEVE_NOTES:                 'Relevé de notes',
  CERTIFICAT_BONNE_CONDUITE:    'Certificat de bonne conduite',
  FICHE_RENSEIGNEMENTS:         'Fiche de renseignements',
  ATTESTATION_RESULTATS:        'Attestation de résultats',
  LISTE_CLASSE:                 'Liste de classe',
  ATTESTATION_TRAVAIL:          'Attestation de travail',
  ORDRE_MISSION:                'Ordre de mission',
  FICHE_PAIE:                   'Fiche de paie',
  PLANNING_COURS:               'Planning de cours',
  CERTIFICAT_TRAVAIL_PERMANENT: 'Certificat de travail (permanent)',
  CERTIFICAT_TRAVAIL_STAGIAIRE: 'Certificat de travail (stagiaire)',
  AUTORISATION_ABSENCE_ELEVE:   "Autorisation d'absence (élève)",
  AUTORISATION_ABSENCE_PERSONNEL: "Demande d'autorisation d'absence (personnel)",
  CONVOCATION_PARENT:           'Convocation des parents',
  BILLET_ENTREE:                "Billet d'entrée",
  CARTE_ELEVE:                  "Carte d'identité scolaire (élève)",
  CARTE_PROFESSEUR:             "Carte d'identité professeur",
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
      <p>{{DIRECTEUR_QUALITE}}</p>
      <p style="font-size:13px;font-weight:bold;margin:4px 0 2px;min-width:200px;border-bottom:1px solid #333;">{{CIVILITE_DIRECTEUR}} {{NOM_DIRECTEUR}}</p>
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
    <p>Je {{SOUSSIGNE}}, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
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
    <p>Je {{SOUSSIGNE}}, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
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
    <p>Je {{SOUSSIGNE}}, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
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
    <p>Je {{SOUSSIGNE}}, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
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
    <p>Je {{SOUSSIGNE}}, <strong>{{NOM_COMPLET_DIRECTEUR}}</strong>, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    atteste que :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
      <tr><td>Type de contrat</td><td>{{TYPE_CONTRAT}}</td></tr>
      <tr><td>Date de prise de service</td><td>{{DATE_EMBAUCHE}}</td></tr>
      <tr><td>Poste occupé</td><td>{{POSTE_OCCUPE}}</td></tr>
    </table>
    <p>est employé(e) en qualité de <strong>{{POSTE_OCCUPE}}</strong> au sein de notre établissement depuis le
    <strong>{{DATE_EMBAUCHE}}</strong>.</p>
    <p>Cette attestation est délivrée à l'intéressé(e) sur sa demande pour servir et valoir ce que de droit.</p>
  </div>`);

const ORDRE_MISSION = wrapPage('Ordre de mission', `
  <div class="doc-title">Ordre de mission</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>{{DIRECTEUR_QUALITE}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong> autorise par la présente
    le déplacement professionnel de :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Fonction</td><td>Personnel</td></tr>
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
    <tr><td>Personnel</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
    <tr><td>Spécialité</td><td>{{SPECIALITE}}</td></tr>
  </table>
  {{TABLEAU_PLANNING}}`);

// ─── Nouveaux documents prof et élève ────────────────────────────────────────

const CERTIFICAT_TRAVAIL_PERMANENT_TPL = wrapPage('Certificat de travail', `
  <div class="doc-title">Certificat de travail</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je {{SOUSSIGNE}}, <strong>{{NOM_COMPLET_DIRECTEUR}}</strong>, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    certifie par la présente que :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Spécialité / Poste</td><td>{{SPECIALITE}}</td></tr>
      <tr><td>Type de contrat</td><td>Permanent</td></tr>
      <tr><td>Date de prise de service</td><td>{{DATE_EMBAUCHE}}</td></tr>
      <tr><td>Poste occupé</td><td>{{POSTE_OCCUPE}}</td></tr>
    </table>
    <p>est employé(e) en qualité de <strong>{{POSTE_OCCUPE}}</strong> au sein de notre établissement depuis le
    <strong>{{DATE_EMBAUCHE}}</strong> jusqu'au <strong>{{DATE_FIN_CONTRAT}}</strong>.</p>
    <p>Ce certificat est délivré à l'intéressé(e) sur sa demande pour servir et valoir ce que de droit.</p>
  </div>`);

const CERTIFICAT_TRAVAIL_STAGIAIRE_TPL = wrapPage('Certificat de travail (stagiaire)', `
  <div class="doc-title">Certificat de travail</div>
  <div class="ref-line">Réf. : {{REF_DOCUMENT}}</div>
  <div class="body-text">
    <p>Je {{SOUSSIGNE}}, <strong>{{NOM_COMPLET_DIRECTEUR}}</strong>, {{TITRE_DIRECTEUR}} de l'établissement <strong>{{NOM_ETABLISSEMENT}}</strong>,
    certifie par la présente que :</p>
    <table class="info-table">
      <tr><td>Nom et prénom</td><td><strong>{{NOM_PRENOM_PROF}}</strong></td></tr>
      <tr><td>Qualité</td><td>Enseignant(e) stagiaire</td></tr>
      <tr><td>Poste occupé</td><td>{{POSTE_OCCUPE}}</td></tr>
    </table>
    <p>a effectué un stage dans notre établissement sur la période suivante :</p>
    <ul style="font-size:13px;line-height:2;margin-left:20px;">
      <li>Du <strong>{{PERIODE_STAGE_DEBUT}}</strong> au <strong>{{PERIODE_STAGE_FIN}}</strong> en qualité de <strong>{{POSTE_OCCUPE}}</strong>.</li>
    </ul>
    <p>Il nous quitte libre de tout engagement. Ce certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
  </div>`);

const AUTORISATION_ABSENCE_ELEVE_TPL = wrapPage("Autorisation d'absence", `
  <div class="doc-title">Autorisation exceptionnelle d'absence</div>
  <div class="doc-subtitle">(Élève)</div>
  <div class="ref-line">Année scolaire : {{ANNEE_SCOLAIRE}} &nbsp;|&nbsp; Fait à _____, le {{DATE_AUJOURD_HUI}}</div>
  <div class="body-text" style="margin-top:24px;">
    <p>L'élève <strong>{{NOM_PRENOM_ELEVE}}</strong> de la classe de <strong>{{CLASSE_FR}}</strong>
    est autorisé(e) à s'absenter du <strong>{{DATE_DEBUT_ABSENCE}}</strong> au <strong>{{DATE_FIN_ABSENCE}}</strong>
    pour le motif suivant :</p>
    <div style="margin:20px 0;padding:12px 16px;border-left:4px solid #1a5276;background:#f5f9fc;font-size:13px;">
      {{MOTIF_ABSENCE}}
    </div>
    <p>Date de retour prévue : le <strong>{{DATE_RETOUR_ABSENCE}}</strong> à <strong>{{HEURE_RETOUR}}</strong> h.</p>
  </div>
  <div style="margin-top:40px;display:flex;justify-content:space-between;">
    <div style="text-align:center;">
      <p style="font-size:12px;">{{DIRECTEUR_QUALITE}}</p>
      <p style="font-size:13px;font-weight:bold;min-width:180px;border-bottom:1px solid #333;margin:4px 0 2px;">{{NOM_COMPLET_DIRECTEUR}}</p>
      {{SIGNATURE}}
    </div>
    <div style="text-align:center;font-size:11px;color:#555;align-self:flex-end;">
      Cachet de l'établissement<br>{{CACHET}}
    </div>
  </div>`);

const BILLET_ENTREE_TPL = wrapPage("Billet d'entrée", `
  <div style="max-width:400px;margin:40px auto;border:2px solid #1a5276;border-radius:8px;padding:24px;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:14px;font-weight:bold;color:#1a5276;text-transform:uppercase;letter-spacing:1px;">Billet d'entrée</div>
      <div style="font-size:11px;color:#777;">Année scolaire {{ANNEE_SCOLAIRE}}</div>
    </div>
    <table class="info-table">
      <tr><td>Élève</td><td><strong>{{NOM_PRENOM_ELEVE}}</strong></td></tr>
      <tr><td>Classe</td><td>{{CLASSE_FR}}</td></tr>
      <tr><td>Date</td><td>{{DATE_AUJOURD_HUI}}</td></tr>
      <tr><td>Heure d'arrivée</td><td><strong>{{HEURE_RETARD}}</strong> h</td></tr>
    </table>
    <p style="font-size:12px;margin-top:16px;">
      L'élève sus-mentionné(e) ayant justifié son retard est autorisé(e) à entrer en classe.
    </p>
    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="text-align:center;">
        <p style="font-size:11px;">{{DIRECTEUR_QUALITE}}</p>
        <p style="font-size:12px;font-weight:bold;min-width:140px;border-bottom:1px solid #333;margin:4px 0 2px;">{{NOM_COMPLET_DIRECTEUR}}</p>
        {{SIGNATURE}}
      </div>
    </div>
  </div>`);

// ─── Convocation des parents (souche + talon, 2 exemplaires par page) ────────

const CONVOCATION_PARENT_BLOC = `
  <div style="border:1.5px dashed #999;padding:20px 28px;margin-bottom:14px;page-break-inside:avoid;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        {{LOGO}}
        <div>
          <div style="font-size:11px;font-weight:bold;color:#1a5276;line-height:1.3;">{{NOM_ETABLISSEMENT}}</div>
          <div style="font-size:9px;color:#666;line-height:1.4;">{{ADRESSE_ETABLISSEMENT}}<br>Tél : {{TEL_ETABLISSEMENT}}</div>
        </div>
      </div>
      <div style="font-size:10px;color:#555;text-align:right;line-height:1.5;">
        Année scolaire {{ANNEE_SCOLAIRE}}<br>
        {{VILLE_ETABLISSEMENT}}, le {{DATE_CONVOCATION}}
      </div>
    </div>
    <div style="text-align:center;font-size:14px;font-weight:bold;letter-spacing:2px;background:#ddd;padding:4px 0;margin:8px 0 12px;">CONVOCATION</div>
    <p style="font-size:12px;margin:8px 0 6px;"><strong>CHER(E) PARENT(E),</strong></p>
    <p style="font-size:12px;line-height:1.8;margin:6px 0;">
      Nous vous prions de bien vouloir vous présenter à l'école le
      <strong>{{DATE_RDV_CONVOCATION}}</strong> à <strong>{{HEURE_RDV_CONVOCATION}}</strong>
      pour affaire concernant l'élève
      <strong>{{NOM_PRENOM_ELEVE}}</strong> de la classe de <strong>{{CLASSE_FR}}</strong>.
    </p>
    <p style="font-size:11px;font-style:italic;margin:10px 0 6px;text-decoration:underline;">La présente convocation doit être rapportée.</p>
    <div style="font-size:11px;line-height:1.7;margin:6px 0 10px;">
      <strong>• S'ADRESSER :</strong>
      <span style="margin-left:14px;">- AU RÉGISSEUR.</span>
      <span style="margin-left:14px;">- AU DIRECTEUR.</span>
      <span style="margin-left:14px;">- AU MAÎTRE(SSE).</span>
    </div>
    <div style="text-align:right;font-size:11px;margin-top:14px;">
      <em>{{DIRECTEUR_QUALITE}}</em><br>
      <span style="display:inline-block;margin-top:18px;min-width:160px;border-bottom:1px solid #333;">{{NOM_COMPLET_DIRECTEUR}}</span>
    </div>
  </div>`;

const CONVOCATION_PARENT_TPL = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Convocation des parents</title>
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="page" style="padding:18px 28px;">
    ${CONVOCATION_PARENT_BLOC}
    ${CONVOCATION_PARENT_BLOC}
  </div>
</body>
</html>`;

// ─── Demande d'autorisation d'absence (personnel) ────────────────────────────

function motifCheckbox(key: string, label: string): string {
  return `<span style="display:inline-block;margin-right:6px;font-family:monospace;font-size:13px;">{{COCHE_${key}}}</span>${label}`;
}

const AUTORISATION_ABSENCE_PERSONNEL_TPL = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Demande d'autorisation d'absence</title>
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="page">
    ${SHARED_HEADER}
    <div class="doc-title">Demande d'autorisation d'absence</div>
    <div class="doc-subtitle">(À remplir en 2 exemplaires)</div>
    <div class="ref-line">Année scolaire : {{ANNEE_SCOLAIRE}}</div>

    <table class="info-table" style="margin-top:8px;">
    <tr><td>Prénom(s)</td><td>{{PRENOM_PROF}}</td></tr>
    <tr><td>Nom</td><td><strong>{{NOM_PROF}}</strong></td></tr>
    <tr><td>Fonctions</td><td>{{FONCTIONS_PERSONNEL}}</td></tr>
    <tr><td>Classe / Service</td><td>{{CLASSE_SERVICE}}</td></tr>
    <tr><td>Durée demandée</td><td>du <strong>{{DATE_DEBUT_ABSENCE}}</strong> au <strong>{{DATE_FIN_ABSENCE}}</strong>, soit <strong>{{DUREE_JOURS}}</strong> jour(s)</td></tr>
  </table>

  <p style="font-size:13px;line-height:1.8;margin:14px 0;">
    Je m'engage à restituer le temps perdu et à dispenser les leçons non réalisées aux jours et heures suivants :
  </p>
  <table class="info-table">
    <tr>
      <td>Séance 1</td>
      <td>le {{RATTRAPAGE_1_DATE}} de {{RATTRAPAGE_1_HEURE_DEBUT}} à {{RATTRAPAGE_1_HEURE_FIN}}</td>
    </tr>
    <tr>
      <td>Séance 2</td>
      <td>le {{RATTRAPAGE_2_DATE}} de {{RATTRAPAGE_2_HEURE_DEBUT}} à {{RATTRAPAGE_2_HEURE_FIN}}</td>
    </tr>
  </table>

  <p style="font-size:12px;margin:14px 0 4px;">À {{VILLE_ETABLISSEMENT}}, le {{DATE_AUJOURD_HUI}}</p>
  <p style="font-size:12px;margin:0 0 18px;">Signature de l'intéressé(e) : <span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;">&nbsp;</span></p>

  <div style="border:1px solid #aaa;padding:12px 14px;margin-top:10px;">
    <p style="font-size:13px;font-weight:bold;text-align:center;margin:0 0 10px;text-decoration:underline;">
      PARTIE À REMPLIR PAR L'INTÉRESSÉ(E)
    </p>
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;width:50%;padding:3px 6px;">${motifCheckbox('BAPTEME', "Baptême d'un enfant")}</td>
        <td style="vertical-align:top;width:50%;padding:3px 6px;">${motifCheckbox('PIECE_ADMIN', "Besoin d'une pièce administrative")}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('HOSPIT_CONJOINT', "Hospitalisation d'un conjoint")}</td>
        <td style="padding:3px 6px;">${motifCheckbox('FETE_RELIG', 'Fête religieuse')}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('HOSPIT_ENFANT', "Hospitalisation d'un enfant du travailleur")}</td>
        <td style="padding:3px 6px;">${motifCheckbox('PELERINAGE', 'Pèlerinage à la Mecque')}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('CONCOURS', 'Candidature à un concours ou examen')}</td>
        <td style="padding:3px 6px;">${motifCheckbox('RDV_MEDICAL', 'Rendez-vous médical du travailleur')}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('MARIAGE_TRAV', 'Mariage du travailleur')}</td>
        <td style="padding:3px 6px;">${motifCheckbox('RDV_MEDICAL_ENFANT', "Rendez-vous médical d'un fils du travailleur")}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('MARIAGE_ENFANT', "Mariage d'un de ses enfants")}</td>
        <td style="padding:3px 6px;vertical-align:top;">Autres : <span style="display:inline-block;min-width:140px;border-bottom:1px solid #333;">{{AUTRE_MOTIF}}</span></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('MARIAGE_FRERE_SOEUR', "Mariage d'un frère ou d'une sœur")}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('DECES_CONJOINT', "Décès d'un conjoint")}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('DECES_DESC', "Décès d'un descendant en lignée directe")}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('DECES_ASC', "Décès d'un ascendant en lignée directe")}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('DECES_FRERE_SOEUR', "Décès d'un frère ou d'une sœur")}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding:3px 6px;">${motifCheckbox('DECES_BEAU_PARENT', "Décès d'un beau-père ou d'une belle-mère")}</td>
        <td></td>
      </tr>
    </table>
  </div>

  <div style="border:1px solid #aaa;padding:12px 14px;margin-top:10px;">
    <p style="font-size:13px;font-weight:bold;margin:0 0 8px;">Décision de la Direction :</p>
    <p style="font-size:12px;margin:4px 0;">
      Durée : du <strong>{{DECISION_DATE_DEBUT}}</strong> au <strong>{{DECISION_DATE_FIN}}</strong>,
      soit <strong>{{DECISION_DUREE_JOURS}}</strong> jour(s)
    </p>
    <p style="font-size:12px;margin:8px 0;">
      <span style="font-family:monospace;">{{COCHE_AUTORISATION_OUI}}</span> Autorisation accordée &nbsp;&nbsp;
      <span style="font-family:monospace;">{{COCHE_AUTORISATION_NON}}</span> Autorisation non accordée
    </p>
  </div>

    <div style="margin-top:24px;display:flex;justify-content:space-between;gap:20px;">
      <div style="text-align:center;flex:1;">
        <p style="font-size:12px;margin:0 0 6px;"><strong>LE RÉGISSEUR :</strong></p>
        <div style="height:50px;border-bottom:1px solid #333;"></div>
      </div>
      <div style="text-align:center;flex:1;">
        <p style="font-size:12px;margin:0 0 6px;"><strong>LE DIRECTEUR :</strong></p>
        <p style="font-size:12px;font-weight:bold;margin:0 0 4px;">{{NOM_COMPLET_DIRECTEUR}}</p>
        {{SIGNATURE}}
      </div>
    </div>
  </div>
</body>
</html>`;

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
        <div><span class="role-badge">Personnel</span></div>
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
  CERTIFICAT_SCOLARITE:         CERTIFICAT_SCOLARITE,
  ATTESTATION_INSCRIPTION:      ATTESTATION_INSCRIPTION,
  CONVOCATION_EXAMEN:           CONVOCATION_EXAMEN,
  FICHE_TRANSFERT:              FICHE_TRANSFERT,
  EMPLOI_DU_TEMPS_ELEVE:        EMPLOI_DU_TEMPS_ELEVE,
  RELEVE_NOTES:                 RELEVE_NOTES,
  CERTIFICAT_BONNE_CONDUITE:    CERTIFICAT_BONNE_CONDUITE,
  FICHE_RENSEIGNEMENTS:         FICHE_RENSEIGNEMENTS,
  ATTESTATION_RESULTATS:        ATTESTATION_RESULTATS,
  LISTE_CLASSE:                 LISTE_CLASSE,
  ATTESTATION_TRAVAIL:          ATTESTATION_TRAVAIL,
  ORDRE_MISSION:                ORDRE_MISSION,
  FICHE_PAIE:                   FICHE_PAIE,
  PLANNING_COURS:               PLANNING_COURS,
  CERTIFICAT_TRAVAIL_PERMANENT: CERTIFICAT_TRAVAIL_PERMANENT_TPL,
  CERTIFICAT_TRAVAIL_STAGIAIRE: CERTIFICAT_TRAVAIL_STAGIAIRE_TPL,
  AUTORISATION_ABSENCE_ELEVE:   AUTORISATION_ABSENCE_ELEVE_TPL,
  AUTORISATION_ABSENCE_PERSONNEL: AUTORISATION_ABSENCE_PERSONNEL_TPL,
  CONVOCATION_PARENT:           CONVOCATION_PARENT_TPL,
  BILLET_ENTREE:                BILLET_ENTREE_TPL,
  CARTE_ELEVE:                  CARTE_ELEVE_HTML,
  CARTE_PROFESSEUR:             CARTE_PROFESSEUR_HTML,
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
