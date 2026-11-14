'use client';

import { useQueryStates } from 'nuqs';
import { useCallback, useMemo } from 'react';
import { periodParsers } from './parsers';
import { resolvePeriod, todayInParis, type PeriodPreset, type ResolvedPeriod } from './period';

export interface PeriodState {
  resolved: ResolvedPeriod;
  compare: boolean;
  today: string;
  setPreset: (preset: Exclude<PeriodPreset, 'custom'>) => void;
  setCustom: (from: string, to: string) => void;
  setCompare: (compare: boolean) => void;
}

export function usePeriodState(defaultPeriod: Exclude<PeriodPreset, 'custom'>): PeriodState {
  const [state, setState] = useQueryStates(periodParsers, { history: 'replace', scroll: false });
  const today = todayInParis();
  const resolved = useMemo(
    () => resolvePeriod({ preset: state.period, from: state.from, to: state.to }, today, defaultPeriod),
    [state.period, state.from, state.to, today, defaultPeriod],
  );
  const setPreset = useCallback(
    (preset: Exclude<PeriodPreset, 'custom'>) => void setState({ period: preset === defaultPeriod ? null : preset, from: null, to: null }),
    [setState, defaultPeriod],
  );
  const setCustom = useCallback((from: string, to: string) => void setState({ period: 'custom', from, to }), [setState]);
  const setCompare = useCallback((compare: boolean) => void setState({ compare: compare ? null : false }), [setState]);
  return { resolved, compare: state.compare ?? true, today, setPreset, setCustom, setCompare };
}
