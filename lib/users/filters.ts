import { formatInteger, formatKm, formatDay, NNBSP, plural } from '@/lib/format/fr';
import { isIsoDay } from '@/lib/period/period';
import {
  DEFAULT_USER_SORT,
  PLATFORMS,
  PLATFORM_LABELS,
  PROVIDERS,
  PROVIDER_LABELS,
  SEARCH_TOTAL_CAP,
  USER_SORT_KEYS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  type Platform,
  type Provider,
  type UserStatus,
} from '@/lib/rpc/constants';

/**
 * Filtres de la page Utilisateurs : état d'URL (partageable, sans donnée personnelle) ↔ filtres
 * du contrat `admin_search_users`. Les valeurs invalides d'une URL sont ignorées, jamais envoyées.
 * Le texte de recherche n'est PAS dans l'URL (il peut contenir une adresse e-mail).
 */

export interface UserFilterUrlState {
  signup_from: string | null;
  signup_to: string | null;
  active_from: string | null;
  active_to: string | null;
  status: string[] | null;
  provider: string[] | null;
  platform: string[] | null;
  version: string[] | null;
  country: string[] | null;
  city: string[] | null;
  runs_min: number | null;
  runs_max: number | null;
  km_min: number | null;
  km_max: number | null;
}

export interface ContractUserFilters {
  signup_from?: string;
  signup_to?: string;
  last_active_from?: string;
  last_active_to?: string;
  status?: UserStatus[];
  provider?: Provider[];
  platform?: Platform[];
  app_version?: string[];
  country?: string[];
  city?: string[];
  runs_min?: number;
  runs_max?: number;
  km_min?: number;
  km_max?: number;
}

export const EMPTY_FILTERS: UserFilterUrlState = {
  signup_from: null,
  signup_to: null,
  active_from: null,
  active_to: null,
  status: null,
  provider: null,
  platform: null,
  version: null,
  country: null,
  city: null,
  runs_min: null,
  runs_max: null,
  km_min: null,
  km_max: null,
};

const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,4}$/;
const COUNTRY = /^[A-Z]{2}$/;

function pickList<T extends string>(values: string[] | null, allowed: readonly T[]): T[] | undefined {
  const list = [...new Set((values ?? []).filter((v): v is T => (allowed as readonly string[]).includes(v)))];
  return list.length > 0 ? list : undefined;
}

function pickPattern(values: string[] | null, pattern: RegExp, transform: (v: string) => string = (v) => v): string[] | undefined {
  const list = [...new Set((values ?? []).map((v) => transform(v.trim())).filter((v) => pattern.test(v)))];
  return list.length > 0 ? list.slice(0, 20) : undefined;
}

function nonNegative(value: number | null, integer: boolean): number | undefined {
  if (value === null || !Number.isFinite(value) || value < 0) return undefined;
  return integer ? Math.floor(value) : value;
}

/** Filtres du contrat dérivés de l'URL ; bornes inversées ou dates invalides ignorées. */
export function toContractFilters(state: UserFilterUrlState): ContractUserFilters {
  const out: ContractUserFilters = {};
  const signupFrom = isIsoDay(state.signup_from) ? state.signup_from : undefined;
  const signupTo = isIsoDay(state.signup_to) ? state.signup_to : undefined;
  if (signupFrom && (!signupTo || signupFrom <= signupTo)) out.signup_from = signupFrom;
  if (signupTo && (!signupFrom || signupFrom <= signupTo)) out.signup_to = signupTo;
  const activeFrom = isIsoDay(state.active_from) ? state.active_from : undefined;
  const activeTo = isIsoDay(state.active_to) ? state.active_to : undefined;
  if (activeFrom && (!activeTo || activeFrom <= activeTo)) out.last_active_from = activeFrom;
  if (activeTo && (!activeFrom || activeFrom <= activeTo)) out.last_active_to = activeTo;
  const status = pickList(state.status, USER_STATUSES);
  if (status) out.status = status;
  const provider = pickList(state.provider, PROVIDERS);
  if (provider) out.provider = provider;
  const platform = pickList(state.platform, PLATFORMS);
  if (platform) out.platform = platform;
  const versions = pickPattern(state.version, VERSION);
  if (versions) out.app_version = versions;
  const countries = pickPattern(state.country, COUNTRY, (v) => v.toUpperCase());
  if (countries) out.country = countries;
  const cities = [...new Set((state.city ?? []).map((c) => c.trim()).filter((c) => c.length > 0 && c.length <= 80))].slice(0, 20);
  if (cities.length > 0) out.city = cities;
  const runsMin = nonNegative(state.runs_min, true);
  const runsMax = nonNegative(state.runs_max, true);
  if (runsMin !== undefined && (runsMax === undefined || runsMin <= runsMax)) out.runs_min = runsMin;
  if (runsMax !== undefined && (runsMin === undefined || runsMin <= runsMax)) out.runs_max = runsMax;
  const kmMin = nonNegative(state.km_min, false);
  const kmMax = nonNegative(state.km_max, false);
  if (kmMin !== undefined && (kmMax === undefined || kmMin <= kmMax)) out.km_min = kmMin;
  if (kmMax !== undefined && (kmMin === undefined || kmMin <= kmMax)) out.km_max = kmMax;
  return out;
}

export function toContractSort(sort: string | null | undefined): string {
  if (!sort) return DEFAULT_USER_SORT;
  return (USER_SORT_KEYS as readonly string[]).includes(sort.replace(/^-/, '')) ? sort : DEFAULT_USER_SORT;
}

export interface FilterChip {
  id: string;
  label: string;
  /** Modification d'URL qui retire ce filtre. */
  clear: Partial<UserFilterUrlState>;
}

const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

export function countryLabel(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function range(from?: string, to?: string): string {
  if (from && to) return `du ${formatDay(from)} au ${formatDay(to)}`;
  if (from) return `depuis le ${formatDay(from)}`;
  return `jusqu’au ${formatDay(to)}`;
}

function bounds(min: number | undefined, max: number | undefined, format: (v: number) => string): string {
  if (min !== undefined && max !== undefined) return `${format(min)} à ${format(max)}`;
  if (min !== undefined) return `≥${NNBSP}${format(min)}`;
  return `≤${NNBSP}${format(max as number)}`;
}

/** Puces des filtres appliqués (combinables, retirables une à une). */
export function filterChips(filters: ContractUserFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.signup_from || filters.signup_to)
    chips.push({ id: 'signup', label: `Inscription ${range(filters.signup_from, filters.signup_to)}`, clear: { signup_from: null, signup_to: null } });
  if (filters.last_active_from || filters.last_active_to)
    chips.push({ id: 'active', label: `Activité ${range(filters.last_active_from, filters.last_active_to)}`, clear: { active_from: null, active_to: null } });
  if (filters.status) chips.push({ id: 'status', label: `Statut : ${filters.status.map((s) => USER_STATUS_LABELS[s]).join(', ')}`, clear: { status: null } });
  if (filters.provider)
    chips.push({ id: 'provider', label: `Connexion : ${filters.provider.map((p) => PROVIDER_LABELS[p]).join(', ')}`, clear: { provider: null } });
  if (filters.platform)
    chips.push({ id: 'platform', label: `Plateforme : ${filters.platform.map((p) => PLATFORM_LABELS[p]).join(', ')}`, clear: { platform: null } });
  if (filters.app_version) chips.push({ id: 'version', label: `Version : ${filters.app_version.join(', ')}`, clear: { version: null } });
  if (filters.country) chips.push({ id: 'country', label: `Pays : ${filters.country.map(countryLabel).join(', ')}`, clear: { country: null } });
  if (filters.city) chips.push({ id: 'city', label: `Ville : ${filters.city.join(', ')}`, clear: { city: null } });
  if (filters.runs_min !== undefined || filters.runs_max !== undefined)
    chips.push({
      id: 'runs',
      label: `Courses ${bounds(filters.runs_min, filters.runs_max, (v) => formatInteger(v))}`,
      clear: { runs_min: null, runs_max: null },
    });
  if (filters.km_min !== undefined || filters.km_max !== undefined)
    chips.push({ id: 'km', label: `Distance ${bounds(filters.km_min, filters.km_max, (v) => formatKm(v))}`, clear: { km_min: null, km_max: null } });
  return chips;
}

/** « 1 234 résultats » · « 10 000+ résultats » (nombre exact jusqu'à 10 000). */
export function formatResultCount(total: number, capped: boolean): string {
  if (capped || total > SEARCH_TOTAL_CAP) return `${formatInteger(SEARCH_TOTAL_CAP)}+ résultats`;
  return `${formatInteger(total)} ${plural(total, 'résultat')}`;
}

/** Codes pays ISO 3166-1 alpha-2 proposés dans le filtre (liste contrôlée). */
export const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );
