# 02 — Audit Cybersécurité

> Périmètre : authentification, autorisation, secrets, validation entrées, headers HTTP, multi-tenant, audit trail, fuites d'information.

**Note globale : 8/10** (↑ de 6/10) — les 4 critiques et 4 hautes du précédent audit sont corrigées. Reste à fermer 3 lacunes moyennes (CSP, soft-delete, CSRF) et 2 points multi-device (refresh token rotation, brute-force progressif).

---

## ✅ Acquis depuis l'audit précédent (2026-05-19)

| Ancien constat | État | Référence |
|---|---|---|
| C1 — `QR_SECRET` hardcodé en fallback | ✅ **Corrigé** | [env.ts:7](../backend/src/config/env.ts#L7) — Zod `.min(32)` + fail-fast au boot. Le runtime ([eleves.service.ts:6-10](../backend/src/modules/eleves/eleves.service.ts#L6), [documents.service.ts:6-10](../backend/src/modules/documents/documents.service.ts#L6)) re-vérifie via `getQrSecret()` |
| C2 — XSS dans la génération de PDF | ✅ **Corrigé** | [documents.service.ts:401-427](../backend/src/modules/documents/documents.service.ts#L401) — `escapeHtml()` appliqué à toutes les variables sauf `HTML_KEYS` (logo, signature, photos, tableaux) |
| C3 — Token JWT en localStorage | ✅ **Corrigé** | [authStore.ts:28-33](../frontend/src/store/authStore.ts#L28) — JWT vit en cookie `httpOnly daaragest_token` uniquement, plus de persist token côté frontend |
| C4 — `COOKIE_DOMAIN` défaut `.dg.sakai.sn` | ✅ **Corrigé** | [env.ts:9](../backend/src/config/env.ts#L9) — `optional()`, sans défaut. Warning logué si `NODE_ENV=production` mais `COOKIE_DOMAIN` undefined ([server.ts:43-45](../backend/src/server.ts#L43)) |
| H1 — Autorisation horizontale notes/bulletins | ✅ **Corrigé** | [teachingPolicy.ts:34-54](../backend/src/utils/teachingPolicy.ts#L34) — `assertProfPeutModifierNotes()` vérifie `PersonnelMatiereClasse`. Appelée dans [notes.service.ts](../backend/src/modules/notes/notes.service.ts) + bulletins observations + absences |
| H2 — Token portail parent 1 an, partageable | ✅ **Corrigé** | [portail-parent.service.ts:4-12](../backend/src/modules/portail-parent/portail-parent.service.ts#L4) — expiration alignée sur `date_fin` de l'année scolaire (fallback 90 j). Rate-limit 30 req/min/IP sur la route publique ([portail-parent.routes.ts:14-18](../backend/src/modules/portail-parent/portail-parent.routes.ts#L14)) |
| H4 — Logger Fastify sans redaction | ✅ **Corrigé** | [server.ts:48-60](../backend/src/server.ts#L48) — redaction complète sur `req.body.mot_de_passe`, `req.body.ancien_mot_de_passe`, `req.body.nouveau_mot_de_passe`, `req.headers.cookie`, `req.headers.authorization`, `res.headers["set-cookie"]` |
| H5 — `setErrorHandler` fuite messages Prisma | ✅ **Corrigé** | [server.ts:148-170](../backend/src/server.ts#L148) — gère explicitement `PrismaClientKnownRequestError` (P2025 → 404, autres → 400 "Données invalides") et `PrismaClientValidationError` |
| M2 — Mot de passe min 8 chars sans complexité | ✅ **Corrigé** | [passwordPolicy.ts:8-16](../backend/src/utils/passwordPolicy.ts#L8) — regex maj/min/chiffre/spécial + 8 chars min. `assertMotDePasseValide()` appelée au changement |
| M5+M6 — Audit log incomplet | ✅ **Corrigé** | [audit.ts:6-23](../backend/src/utils/audit.ts#L6) — non-bloquant via try/catch. **21 appels** `logAction(...)` dans tous les services critiques |
| E11 — Variables d'env non centralisées | ✅ **Corrigé** | [env.ts](../backend/src/config/env.ts) — Zod validation centrale fail-fast au boot |

## 🆕 Nouveaux acquis sécurité

- **Module `teachingPolicy.ts`** : couche policy dédiée (`assertProfPeutModifierNotes`, `assertProfPeutAccederClasse`)
- **Module Personnel** : `etablissement_id` filtré systématiquement ([personnel.service.ts:14-47](../backend/src/modules/personnel/personnel.service.ts#L14))
- **Module DemandeAbsencePersonnel** : RBAC strict + validation transitions de statut + audit log
- **CORS multi-origines** : [server.ts:64-74](../backend/src/server.ts#L64) supporte une liste séparée par virgules
- **41 indexes Prisma** dont tous les `etablissement_id` (multi-tenant strict en perf et en isolation)

---

## ✅ Maturité globale

- **JWT fail-fast** + **QR_SECRET fail-fast** + **env Zod centralisé** au boot
- **Multi-tenant strict** : `etablissement_id` extrait du JWT à chaque requête, filtre systématique dans tous les services
- **bcrypt cost 10** ([auth.service.ts:60](../backend/src/modules/auth/auth.service.ts#L60))
- **Refresh tokens en DB révocables** ([schema.prisma:858-872](../backend/prisma/schema.prisma#L858))
- **Headers sécurité** : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en prod ([server.ts:88-99](../backend/src/server.ts#L88))
- **Rate-limit** : global 100/15 min · login 5/min · refresh 10/min · portail-parent 30/min/IP
- **Zod validation** systématique aux frontières HTTP
- **Payload JWT validé** par Zod à chaque requête ([auth.middleware.ts:13](../backend/src/middlewares/auth.middleware.ts#L13))

---

## 🟠 Hautes restantes (P1)

### H1 — Hard delete cascade dans `bulkSupprimerEleves`
**Fichier :** [eleves.service.ts:308-327](../backend/src/modules/eleves/eleves.service.ts#L308)

```ts
await prisma.$transaction([
  prisma.note.deleteMany({ where: { eleve_id: { in: validIds } } }),
  prisma.bulletin.deleteMany({ where: { eleve_id: { in: validIds } } }),
  prisma.paiementEleve.deleteMany({ where: { eleve_id: { in: validIds } } }),
  prisma.inscription.deleteMany({ where: { eleve_id: { in: validIds } } }),
  prisma.parent.deleteMany({ where: { eleve_id: { in: validIds } } }),
  prisma.eleve.deleteMany({ where: { id: { in: validIds } } }),
]);
```

`supprimerEleve()` unitaire utilise `actif=false` (soft-delete) mais `bulkSupprimerEleves` détruit définitivement notes, bulletins, paiements. **Aucune récupération possible**. Pour un produit RGPD-sensible (données mineures), c'est un risque réglementaire et opérationnel.

**Fix :** transformer en soft-delete (`actif: false`) pour les élèves + lien parent inactif ; conserver notes/bulletins/paiements (historique).

**Effort :** 2 h · **Impact :** récupération possible, conformité RGPD.

---

### H2 — Refresh token rotation toujours destructive (anti-multi-device)
**Fichier :** [auth.service.ts:87-91](../backend/src/modules/auth/auth.service.ts#L87)

```ts
await prisma.refreshToken.updateMany({
  where: { utilisateur_id, revoked: false },
  data: { revoked: true }
});
```

À chaque `creerRefreshToken`, tous les tokens actifs sont révoqués. Conséquences :
- Login sur tablette tue la session du téléphone
- Race condition deux onglets refresh → un éjecté
- **Bloque l'app mobile React Native** (roadmap)

**Fix :** lier le refresh token à un `device_id` (UUID stocké en localStorage + envoyé au login). Ne révoquer que les tokens du même device.

**Effort :** 0.5 j · **Impact :** débloque le multi-device.

---

### H3 — Pas de Content-Security-Policy
**Fichier :** [server.ts:88-99](../backend/src/server.ts#L88)

Les headers de sécurité standards sont là, **sauf CSP**. C'est la défense en profondeur n°1 contre XSS résiduel (cf. C2 corrigé, mais surface frontend toujours large).

**Fix :**
```ts
reply.header('Content-Security-Policy',
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; script-src 'self'; connect-src 'self' " + env.CORS_ORIGIN
);
```

Tester en mode `Report-Only` d'abord pendant 48 h.

**Effort :** 1 h + 48 h surveillance · **Impact :** défense XSS.

---

### H4 — `.uuid()` toujours absent des schemas Zod
Toujours `z.string().min(1)` pour les paramètres UUID dans :
- [demandes-absence.schema.ts](../backend/src/modules/demandes-absence-personnel/demandes-absence.schema.ts)
- [notes.schema.ts:4-7](../backend/src/modules/notes/notes.schema.ts#L4)
- [activites.schema.ts](../backend/src/modules/activites/activites.schema.ts)
- + autres modules

**Risque :** un client peut envoyer une chaîne arbitraire (« ../../etc/passwd ») qui passe Zod, puis Prisma renvoie une erreur de format mais après avoir touché le router. Pas exploitable directement mais bruite les logs et trahit l'absence de validation stricte.

**Fix :** `z.string().uuid()` partout. Le seed v2 utilise déjà des UUID v4 stables.

**Effort :** 2 h · **Impact :** validation stricte + fail-fast au routing.

---

## 🟡 Moyennes (P2)

| # | Sujet | Référence |
|---|---|---|
| M1 | Identifiants seed prévisibles (`Admin123!`, `Directeur123!`, `Prof123!`) malgré `must_change_password: true` | [seed.ts:146-202](../backend/prisma/seed.ts#L146) |
| M2 | Pas de protection CSRF explicite (SameSite + Bearer atténuent, mais cookie domain partagé peut neutraliser) | — |
| M3 | Pas de monitoring brute-force progressif (verrouillage IP après N échecs, captcha) | — |
| M4 | `notif_paiement_retard / notif_messages` activés par défaut → broadcast non maîtrisé | [schema.prisma:211-213](../backend/prisma/schema.prisma#L211) |
| M5 | `Fastify.log.error` reçoit l'erreur complète : OK en interne mais s'il est exporté ailleurs (Datadog, Loki) la trace Prisma peut fuir hors-prod | [server.ts:149](../backend/src/server.ts#L149) |
| M6 | Frontend `ProtectedRoute` consulte seulement `role` du store local — bypassable par édition localStorage (le backend RBAC compense) | [ProtectedRoute.tsx](../frontend/src/components/ui/ProtectedRoute.tsx) |
| M7 | Pas de hash/salt distinct par utilisateur pour les refresh tokens stockés (bcrypt suffirait au lieu d'UUID brut) | [auth.service.ts](../backend/src/modules/auth/auth.service.ts) |
| M8 | `$executeRawUnsafe` toujours utilisé pour les séquences matricule (entrées contrôlées, mais surface SQL à éviter par principe) | [eleves.service.ts:174](../backend/src/modules/eleves/eleves.service.ts#L174) |
| M9 | Module Demandes d'absence personnel : pas de vérification que `personnel_id` appartient bien à `etablissement_id` du demandeur si rôle = personnel | [demandes-absence.service.ts](../backend/src/modules/demandes-absence-personnel/demandes-absence.service.ts) |

---

## 🎯 Priorisation

| Priorité | Action | Effort | Risque évité |
|---|---|---|---|
| 🟠 P1 | **H1** : soft-delete pour `bulkSupprimerEleves` | 2 h | Perte irréversible historique élève |
| 🟠 P1 | **H3** : Content-Security-Policy (mode Report-Only) | 1 h + 48 h | Défense en profondeur XSS |
| 🟠 P1 | **H4** : `.uuid()` partout dans Zod | 2 h | Validation stricte |
| 🟠 P1 | **H2** : refresh token rotation par device | 0.5 j | Débloque app mobile |
| 🟡 P2 | **M1** : forcer mot de passe seed généré aléatoirement | 1 h | Cycle d'install sécurisé |
| 🟡 P2 | **M3** : verrouillage IP progressif sur login | 0.5 j | Brute-force |
| 🟡 P2 | **M2** : CSRF token sur PUT/POST/DELETE | 0.5 j | Cross-origin |
| 🟢 P3 | **M8** : remplacer séquences raw par compteur Prisma | 0.5 j | Surface SQL réduite |
| 🟢 P3 | **M9** : durcir RBAC demandes-absence | 1 h | Multi-tenant strict |

---

## 📊 Verdict cybersécurité

La posture sécurité a **fortement progressé** depuis l'audit précédent : tous les **P0 critiques** sont corrigés, ainsi que 4 hautes (H1/H2/H4/H5) et 2 moyennes (M2/M5+M6). L'ajout de [`teachingPolicy.ts`](../backend/src/utils/teachingPolicy.ts) résout la dette la plus importante (autorisation horizontale) avec un pattern réutilisable et lisible.

La validation Zod centralisée des variables d'environnement ([`config/env.ts`](../backend/src/config/env.ts)) est exemplaire : fail-fast au boot, fallback test-safe pour Vitest. L'ergonomie DX est préservée tout en sécurisant.

Les manques restants sont raisonnables :
- **H1 (soft-delete bulk)** est le seul point qui présente un risque opérationnel sérieux (perte de données historiques en cas d'erreur opérateur)
- **H2 (rotation refresh)** bloque purement la roadmap mobile
- **H3 (CSP)** et **M2 (CSRF)** sont de la défense en profondeur

Une fois H1+H3+H4 traités (~5 h cumulées), la posture monte à **~9/10**, niveau **enterprise** pour un SaaS éducatif multi-tenant.
