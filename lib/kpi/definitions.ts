import { formatDecimal, formatInteger, formatKm, formatPace, formatPercent } from '@/lib/format/fr';
import type { KpiKey } from '@/lib/rpc/constants';

/** Définitions des KPI (§10.5), affichées en infobulle sur chaque carte. */
export interface KpiDefinition {
  label: string;
  definition: string;
  format: (value: number | null | undefined) => string;
  /** Variation relative (%) ou en points pour un ratio. */
  variation: 'relative' | 'points';
  /** Sens favorable, pour la couleur d'appoint (toujours doublée d'une flèche et d'un texte). */
  good: 'up' | 'down' | 'neutral';
}

export const KPI_DEFINITIONS: Record<KpiKey, KpiDefinition> = {
  signups: {
    label: 'Comptes créés',
    definition:
      'Comptes inscrits sur la période, par jour d’inscription (Europe/Paris). Variation par rapport à la période précédente de même durée ; base nulle → « n/d ».',
    format: formatInteger,
    variation: 'relative',
    good: 'up',
  },
  dau: {
    label: 'Actifs quotidiens (DAU)',
    definition:
      'Moyenne des utilisateurs actifs par jour sur la période. Actif = au moins une ouverture de l’app connectée ou une course synchronisée dans la journée. Les utilisateurs sans compte ne sont pas mesurés.',
    format: (v) => formatDecimal(v, 1),
    variation: 'relative',
    good: 'up',
  },
  wau: {
    label: 'Actifs sur 7 jours (WAU)',
    definition: 'Utilisateurs actifs distincts sur les 7 jours glissants se terminant le dernier jour de la période.',
    format: formatInteger,
    variation: 'relative',
    good: 'up',
  },
  mau: {
    label: 'Actifs sur 30 jours (MAU)',
    definition: 'Utilisateurs actifs distincts sur les 30 jours glissants se terminant le dernier jour de la période.',
    format: formatInteger,
    variation: 'relative',
    good: 'up',
  },
  stickiness: {
    label: 'Stickiness',
    definition: 'DAU ÷ MAU : part des actifs mensuels revenus un jour donné. Variation en points.',
    format: (v) => formatPercent(v, 1),
    variation: 'points',
    good: 'up',
  },
  activation: {
    label: 'Activation',
    definition:
      'Part des comptes créés sur la période ayant au moins une course non invalide dans les 7 jours suivant l’inscription. Variation en points.',
    format: (v) => formatPercent(v, 1),
    variation: 'points',
    good: 'up',
  },
  runs: {
    label: 'Courses',
    definition: 'Courses non supprimées et non invalides (règle de volume §9.2).',
    format: formatInteger,
    variation: 'relative',
    good: 'up',
  },
  distance_km: {
    label: 'Distance cumulée',
    definition: 'Somme des distances des courses comptées en volume, en kilomètres (Σ distance ÷ 1 000).',
    format: formatKm,
    variation: 'relative',
    good: 'up',
  },
  avg_pace_s_per_km: {
    label: 'Allure moyenne',
    definition:
      'Σ temps actif ÷ Σ distance des courses comptées en volume (jamais la moyenne des allures). La médiane des allures est affichée à côté. Une allure plus basse est plus rapide.',
    format: formatPace,
    variation: 'relative',
    good: 'neutral',
  },
  runs_per_active: {
    label: 'Courses par actif',
    definition: 'Courses de la période ÷ utilisateurs actifs de la période.',
    format: (v) => formatDecimal(v, 2),
    variation: 'relative',
    good: 'up',
  },
  sync_success: {
    label: 'Succès de synchronisation',
    definition: 'Part des appareils vus sur la période dont la dernière synchronisation est « ok ». Variation en points.',
    format: (v) => formatPercent(v, 1),
    variation: 'points',
    good: 'up',
  },
  guest_conversion: {
    label: 'Conversion invité → compte',
    definition: 'Non mesurable : l’usage sans compte n’est pas suivi (minimisation des données). Indicateur toujours « non disponible ».',
    format: formatInteger,
    variation: 'relative',
    good: 'up',
  },
};
