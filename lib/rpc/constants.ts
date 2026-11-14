/**
 * Listes blanches et libellés du contrat, sans dépendance à zod : importables par les
 * composants navigateur sans alourdir leur bundle (les schémas restent côté serveur).
 */

export const ACCESS_REASONS = ['support', 'data_request', 'technical', 'other'] as const;
export type AccessReason = (typeof ACCESS_REASONS)[number];
export const ACCESS_REASON_LABELS: Record<AccessReason, string> = {
  support: 'Support',
  data_request: 'Demande d’accès ou de suppression',
  technical: 'Anomalie technique',
  other: 'Autre',
};

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABELS: Record<Platform, string> = { ios: 'iOS', android: 'Android' };

export const PROVIDERS = ['apple', 'google', 'email'] as const;
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_LABELS: Record<Provider, string> = { apple: 'Apple', google: 'Google', email: 'E-mail' };

export const ADMIN_ROLES = ['owner', 'support', 'analyst'] as const;

export const KPI_KEYS = [
  'signups',
  'dau',
  'wau',
  'mau',
  'stickiness',
  'activation',
  'runs',
  'distance_km',
  'avg_pace_s_per_km',
  'runs_per_active',
  'sync_success',
  'guest_conversion',
] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

export const AUDIT_ACTIONS = [
  'user.view',
  'user.search',
  'user.disable',
  'user.enable',
  'user.revoke_sessions',
  'user.process_deletion',
  'leaderboard.view_nominative',
  'export.aggregates',
  'config.write',
  'support.update',
  'moderation.view',
  'moderation.decide',
] as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.view': 'Consultation d’une fiche',
  'user.search': 'Recherche d’utilisateurs',
  'user.disable': 'Désactivation d’un compte',
  'user.enable': 'Réactivation d’un compte',
  'user.revoke_sessions': 'Révocation des sessions',
  'user.process_deletion': 'Traitement d’une suppression',
  'leaderboard.view_nominative': 'Classement nominatif consulté',
  'export.aggregates': 'Export d’agrégats',
  'config.write': 'Modification de la configuration',
  'support.update': 'Mise à jour d’une demande de support',
  'moderation.view': 'Consultation d’un signalement',
  'moderation.decide': 'Décision de modération',
};

/* ------------------------------------------------------------------ Utilisateurs (4b) */

export const USER_STATUSES = ['active', 'disabled', 'deleting'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Actif',
  disabled: 'Désactivé',
  deleting: 'Suppression en cours',
};

/** Tri sur liste blanche (contrat) ; préfixe `-` = décroissant. */
export const USER_SORT_KEYS = ['signed_up_at', 'last_active_day', 'display_name', 'runs_count', 'distance_km'] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];
export const USER_SORT_LABELS: Record<UserSortKey, string> = {
  signed_up_at: 'Inscription',
  last_active_day: 'Dernière activité',
  display_name: 'Nom affiché',
  runs_count: 'Courses',
  distance_km: 'Distance',
};
export const DEFAULT_USER_SORT = '-signed_up_at';

export const USER_ACTIONS = ['disable', 'enable', 'revoke_sessions', 'process_deletion'] as const;
export type UserAction = (typeof USER_ACTIONS)[number];

export const AGE_BANDS = ['16-24', '25-34', '35-44', '45-54', '55+'] as const;

/** Nombre de résultats exact jusqu'à 10 000, « 10 000+ » au-delà (contrat). */
export const SEARCH_TOTAL_CAP = 10_000;

export const CONSENT_PURPOSE_LABELS: Record<string, string> = {
  terms: 'Conditions d’utilisation',
  privacy_policy: 'Politique de confidentialité',
  cloud_sync_runs: 'Sauvegarde des courses',
  cloud_sync_routes: 'Sauvegarde des parcours GPS',
  community_leaderboard: 'Classement communautaire',
};

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  account: 'Compte',
  sync: 'Synchronisation',
  bug: 'Anomalie',
  data_request: 'Demande sur les données',
  other: 'Autre',
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  in_progress: 'En cours',
  resolved: 'Résolue',
  closed: 'Fermée',
};

export const SYNC_STATUS_LABELS: Record<string, string> = { ok: 'OK', partial: 'Partielle', error: 'Erreur' };
