import {
  ActivityIcon,
  BarChart3Icon,
  FlagIcon,
  GaugeIcon,
  LifeBuoyIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import type { NavIcon } from '@/lib/access/guard';

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  overview: GaugeIcon,
  users: UsersIcon,
  rankings: TrophyIcon,
  analytics: BarChart3Icon,
  runs: ActivityIcon,
  quality: ShieldCheckIcon,
  support: LifeBuoyIcon,
  moderation: FlagIcon,
  audit: ScrollTextIcon,
  config: SlidersHorizontalIcon,
  settings: SettingsIcon,
};
