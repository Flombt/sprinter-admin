# Sprinter Admin

Site web privé d'administration de l'app de course **Sprinter** (§10 du cahier des charges).

- Cahier des charges : [`docs/specs/COMPTES_SYNC_ADMIN_v2_1.md`](docs/specs/COMPTES_SYNC_ADMIN_v2_1.md)
- Contrat des RPC `admin_*` et de l'Edge Function `admin-user-action` : [`docs/specs/ADMIN_RPC_CONTRACT.md`](docs/specs/ADMIN_RPC_CONTRACT.md)
- Cloudflare Access et limitation de débit : [`docs/CLOUDFLARE_ACCESS.md`](docs/CLOUDFLARE_ACCESS.md)

## Principes

- Le site n'appelle **que** les RPC `admin_*` (liste blanche `lib/rpc/registry.ts`) et l'Edge Function `admin-user-action`,
  avec la session de l'administrateur (JWT AAL2). Aucune lecture directe de table, aucune clé à privilèges.
- Le jeton Supabase vit dans des **cookies HttpOnly** ; le navigateur ne parle qu'au site (`/api/*`), qui valide
  chaque entrée **et** chaque sortie de RPC avec zod (`lib/rpc/schemas`).
- Garde à trois niveaux : `proxy.ts` (session, AAL2, inactivité 30 min, durée absolue 12 h) → layout serveur
  `(admin)` (`admin_whoami`) → contrôles SQL (`assert_admin`).
- Aucun cache partagé (`Cache-Control: private, no-store`), CSP stricte à nonce, `frame-ancestors 'none'`,
  `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, journaux `pino` sans donnée personnelle.

## Démarrer

```bash
npm ci
cp .env.example .env.local   # puis renseigner l'URL et la clé PUBLIQUE de staging
npm run dev
```

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Projet Supabase (clé publique uniquement, vérifiée au démarrage) |
| `ADMIN_SESSION_SECRET` | Secret HMAC (≥ 32 caractères) du cookie de session du site, **obligatoire en production** |
| `ADMIN_ALLOWED_EMAILS` | Liste d'autorisation facultative (Annexe A) |

## Vérifications

| Commande | Contenu |
|---|---|
| `npm run guard:secrets` | Échoue si le code du site mentionne la clé à privilèges, une clé secrète ou une clé privée |
| `npm run lint` · `npm run typecheck` | ESLint (config Next) · TypeScript strict |
| `npm test` | Vitest : schémas du contrat, formats fr-FR, périodes, garde d'accès, session, CSP, journalisation, contrastes |
| `npm run build` puis `npm run guard:bundle` | Build de production puis garde anti-secrets sur le bundle |
| `npm run test:e2e` | Playwright + axe (Google Chrome installé) contre un **faux backend synthétique** |

Le faux backend (`e2e/mock-backend/`) est un processus Node distinct lancé par Playwright. Il refuse de démarrer
sans `ADMIN_E2E_MOCK=1` ou avec `NODE_ENV=production`, n'est jamais importé par l'application et n'apparaît pas
dans la build (la configuration Next échoue si `ADMIN_E2E_MOCK=1` en production). Comptes de test : voir
`e2e/mock-backend/accounts.ts` (domaine réservé `example.test`, codes fixes de la maquette).

## Déploiement

Vercel, fonctions en Europe (`cdg1`, `vercel.json`), derrière Cloudflare Access. Les variables sont saisies
directement dans Vercel. Le premier administrateur est créé par le runbook du §10.2 (action manuelle de Flo).

## Branches

Une branche par sous-phase, empilées : `feat/p4a-socle` → `feat/p4b-users` → `feat/p4c-rankings` →
`feat/p4d-ops` → `feat/p8c-moderation`. Aucune fonctionnalité n'est commitée directement sur `main`.
