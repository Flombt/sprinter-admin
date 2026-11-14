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
  'moderation.media',
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
  'moderation.media': 'Consultation d’un média signalé',
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

/* ------------------------------------------------------------------ Classements et analyses (4c) */

export const LEADERBOARD_METRICS = [
  'runs_count',
  'distance_total',
  'longest_run',
  'active_days',
  'active_weeks',
  'best_effort_1k',
  'best_effort_5k',
  'best_effort_10k',
  'best_effort_21k',
] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];
export const LEADERBOARD_METRIC_LABELS: Record<LeaderboardMetric, string> = {
  runs_count: 'Nombre de courses',
  distance_total: 'Distance cumulée',
  longest_run: 'Plus longue course',
  active_days: 'Jours actifs',
  active_weeks: 'Semaines actives',
  best_effort_1k: 'Meilleur 1 km',
  best_effort_5k: 'Meilleur 5 km',
  best_effort_10k: 'Meilleur 10 km',
  best_effort_21k: 'Meilleur semi-marathon',
};

export const LEADERBOARD_PERIODS = ['week', 'month', 'year', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];
export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
  all: 'Toujours',
};

export const ANALYTICS_VIEWS = [
  'signups',
  'activity',
  'distance_histogram',
  'duration_histogram',
  'frequency_histogram',
  'retention',
  'platform_compare',
  'breakdown_country',
  'breakdown_city',
  'breakdown_age_band',
] as const;
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];

/** Seuil de confidentialité k (§10.4, §16 n° 10). */
export const K_ANONYMITY = 10;

export const VALIDITY_LABELS: Record<string, string> = { valid: 'Valides', suspect: 'Suspectes', invalid: 'Invalides' };
export const SOURCE_LABELS: Record<string, string> = { sprinter: 'Sprinter', healthkit: 'Apple Santé', gpx: 'Import GPX' };

/* ------------------------------------------------------------------ Exploitation (4d) */

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const EXPORT_KINDS = ['daily_kpis', 'runs_by_day', 'versions', 'breakdown_country'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export const EXPORT_KIND_LABELS: Record<ExportKind, string> = {
  daily_kpis: 'KPI quotidiens',
  runs_by_day: 'Courses par jour',
  versions: 'Adoption des versions',
  breakdown_country: 'Ventilation par pays (k ≥ 10)',
};
export const EXPORT_FORMATS = ['standard', 'excel_fr'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  standard: 'CSV standard (virgule, UTF-8)',
  excel_fr: 'Excel FR (point-virgule, BOM UTF-8, décimales à virgule)',
};

export const CONFIG_BOOLEAN_KEYS = [
  'accounts_enabled',
  'sync_enabled',
  'routes_sync_enabled',
  'support_enabled',
  'leaderboard_enabled',
  'profiles_enabled',
  'profile_studio_enabled',
  'profile_sharing_enabled',
  'theme_library_enabled',
  'profile_cards_enabled',
] as const;
export const CONFIG_KEYS = [...CONFIG_BOOLEAN_KEYS, 'min_version', 'maintenance'] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];
export const CONFIG_LABELS: Record<ConfigKey, { label: string; description: string }> = {
  accounts_enabled: { label: 'Comptes', description: 'Création de compte et connexion dans l’app.' },
  sync_enabled: { label: 'Synchronisation des courses', description: 'Sauvegarde en ligne et synchronisation entre appareils.' },
  routes_sync_enabled: { label: 'Sauvegarde des parcours GPS', description: 'Envoi des tracés pour les comptes qui l’ont choisi.' },
  support_enabled: { label: 'Contacter le support', description: 'Formulaire de demande de support dans l’app.' },
  leaderboard_enabled: { label: 'Classement communautaire', description: 'Classement facultatif sur inscription explicite (phase 7).' },
  profiles_enabled: { label: 'Profils personnalisés', description: 'Profil privé et éditeur essentiel (phase 8a).' },
  profile_studio_enabled: { label: 'Studio de personnalisation', description: 'Studio avancé, widgets et configurations (phase 8b).' },
  profile_sharing_enabled: { label: 'Partage des profils', description: 'Publication, recherche et modération (phase 8c).' },
  theme_library_enabled: { label: 'Bibliothèque de thèmes', description: 'Thèmes communautaires (phase 8d).' },
  profile_cards_enabled: { label: 'Cartes de profil', description: 'Cartes et signatures partageables (phase 8d).' },
  min_version: { label: 'Version minimale', description: 'En dessous, l’app affiche l’écran « Mise à jour requise ».' },
  maintenance: { label: 'Message de maintenance', description: 'Bandeau affiché dans l’app (280 caractères au plus).' },
};

/* ------------------------------------------------------------------ Modération (8c) */

export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'À traiter',
  actioned: 'Traité',
  dismissed: 'Classé sans suite',
};

export const MODERATION_DECISIONS = ['hide', 'remove', 'restore', 'dismiss'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];
export const MODERATION_DECISION_LABELS: Record<ModerationDecision, string> = {
  hide: 'Masquer',
  remove: 'Retirer',
  restore: 'Restaurer',
  dismiss: 'Classer sans suite',
};

export const ELEMENT_KIND_LABELS: Record<string, string> = {
  avatar: 'Avatar',
  banner: 'Bannière',
  bio: 'Présentation',
  status: 'Statut',
  handle: 'Pseudo',
  link: 'Lien',
  widget: 'Widget',
  gallery: 'Galerie',
  identity: 'Nom de présentation',
  about: 'Présentation',
  profile: 'Profil entier',
  theme: 'Thème de la bibliothèque',
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  offensive: 'Contenu offensant',
  spam: 'Spam',
  harassment: 'Harcèlement',
  hateful: 'Contenu haineux',
  sexual: 'Contenu sexuel',
  impersonation: 'Usurpation d’identité',
  personal_data: 'Données personnelles exposées',
  other: 'Autre',
};
