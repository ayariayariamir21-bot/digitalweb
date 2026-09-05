# Production readiness — ETAPE 10

## 1. Webhook Stripe — comportement par événement

| Événement | Comportement |
|---|---|
| `checkout.session.completed` + `payment_status=paid` + `metadata.orderId` entier valide | `markOrderPaid(orderId, session.id)` — UPDATE limité à `status=pending AND paymentStatus=pending`. Idempotent : redelivery et ordre déjà payé/annulé/remboursé → 0 ligne modifiée, `{handled:true}` quand même (pas d'erreur, pas de retry infini). |
| `checkout.session.async_payment_succeeded` + `payment_status=paid` | Identique au précédent. |
| `checkout.session.completed` avec `payment_status != paid` | `{handled:false}` — la commande reste `pending`. Le navigateur ne peut jamais forcer `paid`. |
| Tout autre type (`customer.created`, …) | `{handled:false}`, aucune touche DB. |
| Signature absente / forgée / tronquée | Rejet (`Missing Stripe signature` / erreur constructEvent) → HTTP 400. Le raw body (`express.raw`) est obligatoire : ne jamais activer `express.json()` sur cette route. |
| `metadata.orderId` absent / non entier | Rejet `invalid order metadata` → HTTP 400 (retry Stripe légitime, à corriger côté création de session). |
| Commande inexistante | `markOrderPaid` ne modifie aucune ligne → `{handled:true}`, silencieux (pas d'enumération d'ids). |

Tests : `server/webhook.test.ts` (10 tests, signatures réelles via `generateTestHeaderString`).

## 2. Rate limiting

Implémentation : `server/_core/rateLimit.ts` (fenêtre glissante, in-memory, sans dépendance).
Mono-processus : en multi-réplicas, passer sur un store partagé (Redis).

| Endpoint | Limite | Justification |
|---|---|---|
| `POST /api/stripe/webhook` | 300 req / 60 s / IP | Généreux : bursts + redeliveries Stripe jamais cassés. La vraie protection = signature. |
| `GET /api/download/:token` | 60 req / 60 s / IP | Freine le brute-force de tokens sans gêner un usage normal. |
| `orders.create` (tRPC) | 30 / 10 min / IP | Anti order-spam / création massive. |
| `orders.createCheckoutSession` (tRPC) | 60 / 10 min / IP | Anti brute-force orderId+token. |

HTTP : `429 {error:"Too many requests"}` + header `Retry-After`.
tRPC : `TOO_MANY_REQUESTS` (message générique, pas d'oracle).

## 3. Validation réelle — procédure (à exécuter avec MySQL + clés test)

```bash
# 1. DB de TEST uniquement (jamais les credentials prod)
export DATABASE_URL="mysql://test:test@localhost:3306/store_test"
export PRIVATE_STORAGE_ROOT="/srv/store-private-test"   # hors de dist/public
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."

pnpm exec drizzle-kit migrate        # applique 0000 → 0006
pnpm db:seed                         # idempotent (onDuplicateKeyUpdate) :
                                     # 2e exécution = UPDATE, aucune duplication
# vérifier : UNIQUE orders_access_token_unique, FK, indexes, enums
```

Parcours critique manuel :
1. Catalogue → produit publié → panier → checkout → `orders.create` (récupère `accessToken`).
2. `orders.createCheckoutSession({orderId, accessToken})` → URL Stripe.
3. Paiement carte test `4242 4242 4242 4242` → webhook → order `paid`.
4. `stripe listen --forward-to localhost:3000/api/stripe/webhook` pour le test local.
5. PaymentResult → `listForSession` → `GET /api/download/:token` → comparer les octets.
6. Refus : unpaid / inconnu / token invalide / expiré / mauvais produit / asset inexistant /
   fichier absent / 11e téléchargement / `../` traversal → tous 404/« invalid or expired »,
   jamais de chemin ni de secret dans la réponse.
7. Concurrence : `maxDownloads=10`, lancer 20 requêtes parallèles → exactement 10 succès,
   10 refus (UPDATE atomique `downloadCount+1 WHERE count<max AND expiresAt>now`).
8. Admin : anonyme → `/admin` refusé ; user → refusé ; admin → OK ; create/edit/publish/
   archive produit → vérifier le catalogue public à chaque étape.

## 4. Seed

`drizzle/seed.ts` : upsert par clé UNIQUE (slug catégorie/produit). Ré-exécution sûre.
Vérifié par lecture ; exécution réelle requiert `DATABASE_URL` (voir §3).

## 5. Logging — audit

Aucun log ne contient : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`,
mot de passe DB, `accessToken` brut, token de download brut, `storageKey`, chemin privé.
- `[Stripe] Webhook rejected:` → `error.message` uniquement (erreurs Stripe = génériques).
- `[Downloads] Streaming failed:` → message uniquement.
- `[StorageProxy] forge error:` → statut HTTP + corps d'erreur du backend (pas nos secrets).
- Aucun `console.*` côté client n'affiche de token (vérifié par recherche).

## 6. Configuration production

- `NODE_ENV=production` : HSTS activé, pas de Vite dev, `serveStatic` sur `dist/public`.
- CORS : aucune middleware CORS (API same-origin uniquement).
- Headers : `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `x-powered-by` désactivé, HSTS en prod.
- Body : JSON/URL-encoded limités à `1mb` ; webhook en `express.raw` (1mb) non affecté.
- Erreurs : webhook → 400 générique ; download → 404 générique ; tRPC checkout → message
  générique (pas d'oracle d'existence) ; admin → messages masqués (`safeAdminMessage`).
- Statiques : `PRIVATE_STORAGE_ROOT` n'est jamais sous `dist/public` (à garantir au déploiement) ;
  seul `/api/download/:token` sert ces octets, après vérification paid + grant valide.
- Source maps : build Vite standard (pas de `sourcemap: hidden` explicite — LOW, voir rapport).
- Health : `GET /api/health` → `{ok:true}` (liveness ; readiness DB/Stripe = §3).
- `console.log` résiduels au boot (`Server running…`, `Port busy…`) : bénins, sans secret.
