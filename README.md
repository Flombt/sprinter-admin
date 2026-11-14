# Sprinter Admin

Site web privé d'administration de l'app de course **Sprinter**.

- Cahier des charges : [`docs/specs/COMPTES_SYNC_ADMIN_v2_1.md`](docs/specs/COMPTES_SYNC_ADMIN_v2_1.md) (§10 pour ce dépôt).
- Contrat des RPC `admin_*` et de l'Edge Function `admin-user-action` : [`docs/specs/ADMIN_RPC_CONTRACT.md`](docs/specs/ADMIN_RPC_CONTRACT.md).

Le site n'appelle que les RPC `admin_*` et l'Edge Function `admin-user-action`, avec la session de l'administrateur (AAL2).
Il ne lit jamais une table directement et n'utilise jamais de clé secrète Supabase.

Le développement se fait par sous-phases, une branche par sous-phase (`feat/p4a-socle`, `feat/p4b-users`, …).
Aucune fonctionnalité n'est commitée directement sur `main`.
