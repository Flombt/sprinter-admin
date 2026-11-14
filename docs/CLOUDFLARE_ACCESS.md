# Cloudflare Access et limitation de débit · Sprinter Admin

Procédure à réaliser **une fois par Flo** (action manuelle n° 8 du §13.3) avant d'ouvrir `admin.<domaine>`.
Cloudflare Access ajoute une couche d'accès **devant** le site : un visiteur non autorisé n'atteint jamais la page de connexion.
La limitation de débit utilise **un seul mécanisme** (§10.2) : les règles de limitation de débit de Cloudflare. Le site n'embarque aucun compteur (pas d'Upstash).

> Les noms de menus et les limites d'offre évoluent : vérifier la documentation Cloudflare à jour au moment de la mise en place
> ([Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/) ·
> [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)). Noter tout écart dans la PR suivante.

## 0. Prérequis

- Le domaine `<domaine>` est géré par Cloudflare (DNS « proxied », nuage orange) et le projet Vercel est créé.
- Le sous-domaine `admin.<domaine>` pointe vers Vercel (CNAME `cname.vercel-dns.com`, proxied par Cloudflare).
- Dans Vercel : domaine `admin.<domaine>` ajouté au projet, variables d'environnement saisies directement dans Vercel
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_ALLOWED_EMAILS`). **Jamais dans le chat ni dans un fichier.**
- Chiffrement SSL/TLS de Cloudflare en mode **Full (strict)**.

## 1. Application Access

1. Cloudflare Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. Nom : `Sprinter Admin`. Domaine : `admin.<domaine>` (tout le sous-domaine, aucun chemin exclu).
3. Durée de session Access : **12 h** (alignée sur la durée absolue de session du site).
4. Fournisseur d'identité : **One-time PIN** (code par e-mail) ou Google, au choix de Flo.
5. Politique `Administrateurs` :
   - Action : **Allow**.
   - Include → **Emails** : l'adresse de Flo (et uniquement les administrateurs déclarés dans `private.admin_users`).
   - Facultatif : Require → *Country* = `France`.
6. Politique par défaut : tout le reste est refusé (comportement natif d'Access).
7. Paramètres → cookie `CF_Authorization` : `SameSite=Lax`, `HttpOnly` activé, **Binding cookie** activé.
8. Désactiver l'indexation et l'aperçu (« Enable automatic cloudflared authentication » inutile ici).

**Vérification** : en navigation privée, `https://admin.<domaine>/login` doit afficher l'écran Cloudflare Access, jamais la page du site.

## 2. Limitation de débit (mécanisme unique)

Security → WAF → **Rate limiting rules** sur la zone `<domaine>`. Deux règles, action **Block** (réponse 429), compteurs indépendants.

### Règle 1 — Connexion : 5 tentatives / 15 min

| Champ | Valeur |
|---|---|
| Nom | `admin-login` |
| Expression | `(http.host eq "admin.<domaine>" and http.request.method eq "POST" and http.request.uri.path in {"/api/auth/otp" "/api/auth/verify" "/api/auth/mfa/verify"})` |
| Caractéristiques de comptage | IP **+** en-tête `Cf-Access-Authenticated-User-Email` (identité Access, équivalent « IP + e-mail ») **+** chemin (un compteur par étape : envoi du code, code e-mail, code TOTP) |
| Seuil | 5 requêtes par étape |
| Période | 15 minutes (ou la période maximale de l'offre si plus courte : voir ci-dessous) |
| Durée de blocage | 15 minutes |

Une connexion normale consomme une requête par étape ; il reste donc 4 essais par étape (code mal saisi, renvoi du code)
avant blocage. Le site renvoie la même réponse que l'adresse existe ou non (`/api/auth/otp`) : la règle limite aussi l'envoi
d'e-mails en rafale. Si l'offre ne permet pas de compter par chemin, retenir 5 requêtes au total sur les trois chemins et
l'indiquer dans la PR (une connexion complète en consomme alors 3).

### Règle 2 — Recherche : 60 requêtes / min par administrateur

| Champ | Valeur |
|---|---|
| Nom | `admin-search` |
| Expression | `(http.host eq "admin.<domaine>" and http.request.method eq "POST" and http.request.uri.path eq "/api/rpc/admin_search_users")` |
| Caractéristiques de comptage | en-tête `Cf-Access-Authenticated-User-Email` (un compteur par administrateur), sinon IP |
| Seuil | 60 requêtes |
| Période | 1 minute |
| Durée de blocage | 1 minute |

Le texte recherché voyage dans le **corps** de la requête POST : il n'apparaît ni dans l'URL ni dans les journaux d'accès.
La palette ⌘K et la page Utilisateurs passent par la même route, donc par le même compteur.

### Selon l'offre Cloudflare

- Le comptage par **en-tête** (identité Access) et une période de **15 minutes** relèvent des règles avancées (offres supérieures).
- Si l'offre ne les propose pas : compter **par IP** (un administrateur = une IP en pratique) et retenir la période la plus proche
  disponible **sans dépasser** le seuil (par exemple 1 requête / 3 min ≈ 5 / 15 min), puis noter l'écart dans `docs/` et dans la PR.
- Ne pas ajouter de second mécanisme (Upstash, compteur applicatif) pour compenser : un seul mécanisme, conformément au §10.2.

**Vérification** (staging) : 6 POST successifs sur `/api/auth/otp` depuis la même session Access → la 6ᵉ renvoie **429**.
61 recherches en moins d'une minute → la 61ᵉ renvoie **429**. Le site affiche alors « Trop de requêtes. Patientez un instant avant de réessayer. »

## 3. Contrôles complémentaires

- **Bot Fight Mode** : désactivé sur `admin.<domaine>` (Access suffit ; évite les défis sur les appels JSON du site).
- **Cache** : règle *Cache Rules* → `admin.<domaine>` en **Bypass cache** (le site envoie déjà `Cache-Control: private, no-store`).
- **En-têtes** : vérifier sur `https://admin.<domaine>/login` la présence de `Strict-Transport-Security`, `Content-Security-Policy`
  (`frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`.
- **Journaux** : les journaux Cloudflare contiennent l'adresse de l'administrateur (identité Access) ; durée de conservation à reporter
  dans `docs/rgpd/sous-traitants.md` (dépôt de l'app).

## 4. Retour arrière

Désactiver la politique Access rend le site accessible à tous (la page de connexion reste protégée par OTP + TOTP + rôle) :
à ne faire que temporairement. Les règles de limitation de débit peuvent être passées en **Log** au lieu de **Block** pour diagnostic.
