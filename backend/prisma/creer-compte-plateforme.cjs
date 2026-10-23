'use strict';
/**
 * Crée un compte de la PLATEFORME (console super-admin), rattaché à l'établissement technique
 * « PLATEFORME ». Le mot de passe temporaire est affiché UNE fois ; changement imposé à la 1re connexion.
 *
 *   node prisma/creer-compte-plateforme.cjs <identifiant> "<Nom>" ["<Prénom>"]
 *
 * Connexion ensuite : code école « PLATEFORME » + identifiant.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const [identifiant, nom_fr, prenom_fr] = process.argv.slice(2);
  if (!identifiant || !nom_fr) throw new Error('Usage : node prisma/creer-compte-plateforme.cjs <identifiant> "<Nom>" ["<Prénom>"]');
  const etab = await prisma.etablissement.findFirst({ where: { est_plateforme: true } });
  if (!etab) throw new Error('Établissement PLATEFORME absent (migration 20261025000000 non appliquée ?)');
  if (await prisma.utilisateur.findFirst({ where: { etablissement_id: etab.id, identifiant } })) {
    throw new Error(`Le compte plateforme « ${identifiant} » existe déjà`);
  }
  const role = await prisma.role.findUnique({ where: { libelle_fr: 'admin' } });
  if (!role) throw new Error('Rôle admin introuvable');
  const mdp = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 12) + 'A1a!';
  await prisma.utilisateur.create({
    data: {
      etablissement_id: etab.id, role_id: role.id, identifiant, nom_fr, prenom_fr: prenom_fr || null,
      mot_de_passe: await bcrypt.hash(mdp, 10), must_change_password: true, super_admin: true,
    },
  });
  console.log(`Compte plateforme créé — code école : ${etab.code} · identifiant : ${identifiant} · mot de passe temporaire : ${mdp}`);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
