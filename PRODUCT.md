# Product

## Register

product

## Users

Personnel administratif et enseignant d'établissements scolaires franco-arabes au Sénégal (direction, gestionnaires, professeurs, surveillants), plus deux surfaces publiques : les parents d'élèves (portail sans compte via lien UUID, souvent sur mobile) et les visiteurs de la landing page. Les utilisateurs travaillent en français, en arabe (RTL) ou en anglais, souvent sur du matériel modeste et une connexion partagée (une seule IP publique pour toute l'école).

## Product Purpose

DaaraGest gère la vie complète d'un établissement : élèves, personnel, classes multi-filières (FR/AR/EN et combinaisons), notes et bulletins, finances, pointage QR, emploi du temps, messagerie, bibliothèque, documents officiels et rapports. Le succès, c'est qu'un gestionnaire saisisse et retrouve l'information vite, sans formation, et que les documents produits (bulletins, reçus, cartes) soient dignes d'un établissement sérieux.

## Brand Personality

Sérieux, chaleureux, artisanal. L'identité « papier chaud + terracotta » évoque le registre scolaire tenu avec soin — ni SaaS froid, ni gadget. Fraunces (display) pour les titres et chiffres-clés, Instrument Sans pour l'UI, Noto Naskh Arabic pour l'arabe.

## Anti-references

- Le look « admin Bootstrap » : tableaux à en-tête bleu marine, badges jaune/vert délavés, gris neutres froids (#6b7280, #e5e7eb).
- Le SaaS générique gris-bleu (palette Tailwind gray + blue-600 par défaut).
- Toute couleur codée en dur qui casse le thème sombre ou le RTL.

## Design Principles

1. **Un seul vocabulaire visuel** : mêmes boutons, badges, tableaux, modales et formulaires sur chaque écran ; tout écart est un bug.
2. **Tokens d'abord** : aucune couleur hors variables CSS (`--paper/--ink/--terra/…`) ; le thème sombre et le RTL doivent fonctionner partout, y compris sur les pages publiques.
3. **La densité au service de la tâche** : tableaux denses, filtres en ligne, saisie en masse — l'outil s'efface derrière le travail du gestionnaire.
4. **Trilingue par construction** : chaque libellé passe par i18next (fr référence, ar RTL, en) ; propriétés logiques CSS (`inset-inline-*`, `margin-inline-*`) obligatoires.
5. **Les documents imprimés sont une vitrine** : bulletins, listes et reçus PDF portent l'identité de l'établissement (templates dédiés, hors tokens applicatifs).

## Accessibility & Inclusion

Contraste AA sur papier chaud (`--ink-3` = 4.5:1 sur `--paper`, documenté dans index.css), focus visible sur les contrôles, `prefers-reduced-motion` respecté globalement, cibles tactiles ≥ 44px sur les actions principales, support complet RTL pour l'arabe.
