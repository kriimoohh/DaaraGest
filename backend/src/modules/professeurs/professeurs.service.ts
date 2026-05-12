import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { ProfesseurInput } from './professeurs.schema';
import { renderPdfHtml } from '../../utils/browserPool';

function escHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FICHE_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 11.5px; color: #111; padding: 24px 32px; }
.header { text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 14px; margin-bottom: 18px; }
.header h1 { font-size: 17px; font-weight: 700; color: #10B981; letter-spacing: 0.5px; }
.header h2 { font-size: 13px; font-weight: 600; margin-top: 4px; }
.header .annee { font-size: 11px; color: #555; margin-top: 4px; }
.prof-info { display: flex; gap: 24px; background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
.prof-info .block { flex: 1; }
.prof-info .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
.prof-info .value { font-size: 12px; font-weight: 700; margin-top: 2px; }
.section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; }
thead tr { background: #10B981; color: white; }
thead th { padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
tbody tr:nth-child(even) { background: #f0fdf4; }
tbody tr:hover { background: #dcfce7; }
td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 9.5px; font-weight: 600; }
.badge-fr { background: #dbeafe; color: #1d4ed8; }
.badge-ar { background: #fef3c7; color: #92400e; }
.badge-perm { background: #d1fae5; color: #065f46; }
.badge-vac { background: #fce7f3; color: #9d174d; }
.empty { text-align: center; padding: 28px; color: #9ca3af; font-size: 12px; }
.signature { margin-top: 36px; display: flex; justify-content: space-between; }
.sig-box { text-align: center; font-size: 10px; color: #374151; }
.sig-line { border-top: 1px solid #374151; width: 180px; margin: 28px auto 4px; }
.footer { margin-top: 20px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; }
@page { size: A4; margin: 0; }
`;

async function ficheCoursHtml(professeur_id: string, etablissement_id: string, annee_scolaire_id?: string): Promise<string> {
  const professeur = await prisma.professeur.findFirst({
    where: { id: professeur_id, utilisateur: { etablissement_id } },
    include: {
      utilisateur: true,
      matieres_classes: {
        where: annee_scolaire_id ? { annee_scolaire_id } : undefined,
        include: {
          matiere: true,
          classe: { include: { niveau: true } },
          annee_scolaire: true,
        },
        orderBy: [{ classe: { nom_fr: 'asc' } }, { matiere: { ordre_bulletin: 'asc' } }],
      },
    },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  const etablissement = await prisma.etablissement.findUnique({ where: { id: etablissement_id } });

  const anneeLabel = professeur.matieres_classes[0]?.annee_scolaire?.libelle ?? '';
  const nomProf = escHtml(`${professeur.utilisateur.nom_fr}`);
  const specialite = escHtml(professeur.specialite_fr ?? 'Non renseignée');
  const typeContrat = professeur.type_contrat === 'permanent' ? 'Permanent' : 'Vacataire';
  const contratBadge = professeur.type_contrat === 'permanent' ? 'badge-perm' : 'badge-vac';
  const etablissementNom = escHtml(etablissement?.nom_fr ?? '');

  const lignes = professeur.matieres_classes.map(pmc => {
    const filiere = pmc.classe.filiere === 'FR' ? 'FR' : 'AR';
    const filiereBadge = filiere === 'FR' ? 'badge-fr' : 'badge-ar';
    const niveau = pmc.classe.niveau?.libelle ?? '';
    const classeNom = escHtml(pmc.classe.nom_fr) + (niveau ? ` <span style="color:#6b7280;font-size:9px;">(${escHtml(niveau)})</span>` : '');
    const matiereNom = escHtml(pmc.matiere.nom_fr);
    const coeff = Number(pmc.matiere.coeff_defaut);
    return `
      <tr>
        <td>${classeNom}</td>
        <td>${matiereNom}</td>
        <td><span class="badge ${filiereBadge}">${filiere}</span></td>
        <td style="text-align:center;">${coeff % 1 === 0 ? coeff.toFixed(0) : coeff.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const tableOrEmpty = lignes
    ? `<table>
        <thead><tr>
          <th>Classe</th>
          <th>Matière</th>
          <th>Filière</th>
          <th style="text-align:center;">Coeff.</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>`
    : `<div class="empty">Aucune attribution de cours enregistrée pour cette année scolaire.</div>`;

  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Fiche de cours — ${nomProf}</title>
  <style>${FICHE_CSS}</style>
  </head><body>
  <div class="header">
    <h1>${etablissementNom || 'Établissement'}</h1>
    <h2>Fiche de cours du professeur</h2>
    ${anneeLabel ? `<div class="annee">Année scolaire : ${escHtml(anneeLabel)}</div>` : ''}
  </div>

  <div class="prof-info">
    <div class="block">
      <div class="label">Nom du professeur</div>
      <div class="value">${nomProf}</div>
    </div>
    <div class="block">
      <div class="label">Spécialité</div>
      <div class="value">${specialite}</div>
    </div>
    <div class="block">
      <div class="label">Type de contrat</div>
      <div class="value"><span class="badge ${contratBadge}">${typeContrat}</span></div>
    </div>
    <div class="block">
      <div class="label">Nombre de cours</div>
      <div class="value">${professeur.matieres_classes.length}</div>
    </div>
  </div>

  <div class="section-title">Attribution des cours</div>
  ${tableOrEmpty}

  <div class="signature">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div>Le Professeur</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div>Le Directeur</div>
    </div>
  </div>

  <div class="footer">
    <span>Édité le ${now}</span>
    <span>${etablissementNom}</span>
  </div>
  </body></html>`;
}

export async function genererFicheCoursPdf(professeur_id: string, etablissement_id: string, annee_scolaire_id?: string): Promise<Buffer> {
  const html = await ficheCoursHtml(professeur_id, etablissement_id, annee_scolaire_id);
  return renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
}

export async function listerProfesseurs(etablissement_id: string, page = 1, search?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    etablissement_id,
    actif: true,
    professeur: { isNot: null },
  };

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { nom_ar: { contains: search, mode: 'insensitive' } },
      { identifiant: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: { professeur: true, role: true },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getProfesseur(id: string, etablissement_id: string) {
  const professeur = await prisma.professeur.findFirst({
    where: {
      id,
      utilisateur: { etablissement_id },
    },
    include: {
      utilisateur: { include: { role: true } },
      matieres_classes: { include: { matiere: true, classe: true } },
    },
  });
  if (!professeur) throw new Error('Professeur introuvable');
  return professeur;
}

export async function creerProfesseur(etablissement_id: string, data: ProfesseurInput) {
  const roleProf = await prisma.role.findFirst({ where: { libelle_fr: 'professeur' } });
  if (!roleProf) throw new Error('Rôle professeur introuvable');

  const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      etablissement_id,
      role_id: roleProf.id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      identifiant: data.identifiant,
      mot_de_passe: hashedPassword,
    },
  });

  const professeur = await prisma.professeur.create({
    data: {
      utilisateur_id: utilisateur.id,
      specialite_fr: data.specialite_fr,
      specialite_ar: data.specialite_ar,
      telephone: data.telephone,
      date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
      type_contrat: data.type_contrat ?? 'permanent',
      salaire_base: data.salaire_base,
      photo_url: data.photo_url,
    },
    include: { utilisateur: true },
  });

  return professeur;
}

export async function modifierProfesseur(id: string, etablissement_id: string, data: Partial<ProfesseurInput>) {
  const professeur = await prisma.professeur.findFirst({
    where: { id, utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  const updateTasks: Promise<unknown>[] = [];

  if (data.nom_fr || data.nom_ar) {
    updateTasks.push(
      prisma.utilisateur.update({
        where: { id: professeur.utilisateur_id },
        data: {
          nom_fr: data.nom_fr,
          nom_ar: data.nom_ar,
        },
      })
    );
  }

  updateTasks.push(
    prisma.professeur.update({
      where: { id },
      data: {
        specialite_fr: data.specialite_fr,
        specialite_ar: data.specialite_ar,
        telephone: data.telephone,
        date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
        type_contrat: data.type_contrat,
        salaire_base: data.salaire_base,
        photo_url: data.photo_url,
      },
      include: { utilisateur: true },
    })
  );

  const results = await Promise.all(updateTasks);
  return results[results.length - 1];
}

export async function supprimerProfesseur(id: string, etablissement_id: string) {
  const professeur = await prisma.professeur.findFirst({
    where: { id, utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  return prisma.utilisateur.update({
    where: { id: professeur.utilisateur_id },
    data: { actif: false },
  });
}
