'use client';

import { CalendarRangeIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDayShort } from '@/lib/format/fr';
import {
  DEFAULT_PRESETS,
  MAX_PERIOD_DAYS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  RANGE_ERROR_MESSAGES,
  addDays,
  validateRange,
  type PeriodPreset,
} from '@/lib/period/period';
import { usePeriodState } from '@/lib/period/use-period';
import { cn } from '@/lib/utils';

type Preset = Exclude<PeriodPreset, 'custom'>;

/**
 * Sélecteur de période (§10.3) : aujourd'hui · 7 j · 30 j · 90 j · année · personnalisé,
 * avec comparaison à la période précédente. L'état vit dans l'URL (partageable).
 */
export function PeriodPicker({ defaultPeriod, className }: { defaultPeriod: Preset; className?: string }) {
  const { resolved, compare, today, setPreset, setCustom, setCompare } = usePeriodState(defaultPeriod);
  const compareId = useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ToggleGroup
        type="single"
        value={resolved.preset === 'custom' ? '' : resolved.preset}
        onValueChange={(value) => {
          if (value) setPreset(value as Preset);
        }}
        aria-label="Période d’analyse"
        className="hidden xl:inline-flex"
      >
        {DEFAULT_PRESETS.map((preset) => (
          <ToggleGroupItem key={preset} value={preset} title={PRESET_DESCRIPTIONS[preset]}>
            {PRESET_LABELS[preset]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <select
        aria-label="Période d’analyse"
        className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg xl:hidden"
        value={resolved.preset}
        onChange={(event) => {
          const value = event.target.value;
          if (value !== 'custom') setPreset(value as Preset);
        }}
      >
        {DEFAULT_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {PRESET_LABELS[preset]}
          </option>
        ))}
        {resolved.preset === 'custom' ? <option value="custom">{PRESET_LABELS.custom}</option> : null}
      </select>

      <CustomRange
        active={resolved.preset === 'custom'}
        from={resolved.from}
        to={resolved.to}
        today={today}
        onApply={setCustom}
      />

      <div className="flex items-center gap-2">
        <Switch id={compareId} checked={compare} onCheckedChange={setCompare} aria-label="Comparer à la période précédente" />
        <Label htmlFor={compareId} className="hidden text-sm font-normal text-fg-muted lg:inline">
          Comparer
        </Label>
        <span className="sr-only lg:hidden">Comparer à la période précédente</span>
      </div>
    </div>
  );
}

function CustomRange({
  active,
  from,
  to,
  today,
  onApply,
}: {
  active: boolean;
  from: string;
  to: string;
  today: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [submitted, setSubmitted] = useState(false);
  const error = validateRange(draftFrom, draftTo, today);
  const fromId = useId();
  const toId = useId();
  const errorId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (error) return;
    onApply(draftFrom, draftTo);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftFrom(from);
          setDraftTo(to);
          setSubmitted(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant={active ? 'primary' : 'secondary'} aria-label={active ? `Période personnalisée du ${from} au ${to}` : 'Choisir une période personnalisée'}>
          <CalendarRangeIcon aria-hidden="true" />
          <span className="hidden sm:inline">{active ? `${formatDayShort(from)} → ${formatDayShort(to)}` : PRESET_LABELS.custom}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
          <p className="text-sm font-medium text-fg">Période personnalisée</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={fromId}>Du</Label>
              <Input
                id={fromId}
                type="date"
                value={draftFrom}
                min={addDays(today, -3650)}
                max={today}
                onChange={(e) => setDraftFrom(e.target.value)}
                aria-invalid={submitted && !!error}
                aria-describedby={submitted && error ? errorId : undefined}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={toId}>Au</Label>
              <Input
                id={toId}
                type="date"
                value={draftTo}
                max={today}
                onChange={(e) => setDraftTo(e.target.value)}
                aria-invalid={submitted && !!error}
                aria-describedby={submitted && error ? errorId : undefined}
              />
            </div>
          </div>
          <p className="text-xs text-fg-muted">Bornes incluses, jours calendaires (Europe/Paris), {MAX_PERIOD_DAYS} jours au plus.</p>
          {submitted && error ? (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {RANGE_ERROR_MESSAGES[error]}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" type="submit">
              Appliquer
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
