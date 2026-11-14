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
