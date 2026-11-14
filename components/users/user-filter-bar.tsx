'use client';

import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PROVIDERS,
  PROVIDER_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
} from '@/lib/rpc/constants';
import { COUNTRY_CODES, countryLabel, type ContractUserFilters, type UserFilterUrlState } from '@/lib/users/filters';
import { cn } from '@/lib/utils';

type Patch = Partial<UserFilterUrlState>;

function FilterButton({ label, active, children }: { label: string; active: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={active ? 'primary' : 'secondary'} aria-label={active ? `${label} (filtre actif)` : label}>
          {label}
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">{children(() => setOpen(false))}</PopoverContent>
    </Popover>
  );
}

function DateRangeEditor({ from, to, onApply, close, label }: { from?: string; to?: string; onApply: (from: string | null, to: string | null) => void; close: () => void; label: string }) {
  const fromId = useId();
  const toId = useId();
  const [draftFrom, setDraftFrom] = useState(from ?? '');
  const [draftTo, setDraftTo] = useState(to ?? '');
  const invalid = !!draftFrom && !!draftTo && draftFrom > draftTo;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (invalid) return;
        onApply(draftFrom || null, draftTo || null);
        close();
      }}
    >
      <p className="text-sm font-medium text-fg">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={fromId}>Du</Label>
          <Input id={fromId} type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={toId}>Au</Label>
          <Input id={toId} type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
        </div>
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-danger">
          La date de début doit précéder la date de fin.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <PopoverClose asChild>
          <Button size="sm" variant="ghost">
            Annuler
          </Button>
        </PopoverClose>
        <Button size="sm" type="submit" variant="primary">
          Appliquer
        </Button>
      </div>
    </form>
  );
}

function CheckList<T extends string>({ legend, options, labels, selected, onChange }: { legend: string; options: readonly T[]; labels: Record<T, string>; selected: T[]; onChange: (next: T[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-sm font-medium text-fg">{legend}</legend>
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg hover:bg-surface-2">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={selected.includes(option)}
            onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((s) => s !== option))}
          />
          {labels[option]}
        </label>
      ))}
    </fieldset>
  );
}

function TokenEditor({
  legend,
  values,
  onChange,
  placeholder,
  validate,
  normalize = (v) => v.trim(),
  describe = (v) => v,
  datalist,
}: {
  legend: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  validate: (value: string) => boolean;
  normalize?: (value: string) => string;
  describe?: (value: string) => string;
  datalist?: { value: string; label: string }[];
}) {
  const inputId = useId();
  const listId = useId();
  const [draft, setDraft] = useState('');
  const value = normalize(draft);
  const valid = value.length > 0 && validate(value);
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || values.includes(value)) return;
          onChange([...values, value]);
          setDraft('');
        }}
      >
        <Label htmlFor={inputId}>{legend}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            className="h-8"
            value={draft}
            placeholder={placeholder}
            list={datalist ? listId : undefined}
            aria-invalid={draft.length > 0 && !valid}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button size="sm" type="submit" disabled={!valid} aria-label={`Ajouter ${value || 'la valeur'}`}>
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
        {datalist ? (
          <datalist id={listId}>
            {datalist.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </datalist>
        ) : null}
      </form>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2 pr-1 text-sm">
              {describe(v)}
              <button type="button" className="rounded-full p-0.5 text-fg-muted hover:text-fg" aria-label={`Retirer ${describe(v)}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NumberRangeEditor({
  label,
  min,
  max,
  step,
  onApply,
  close,
}: {
  label: string;
  min?: number;
  max?: number;
  step: number;
  onApply: (min: number | null, max: number | null) => void;
  close: () => void;
}) {
  const minId = useId();
  const maxId = useId();
  const [draftMin, setDraftMin] = useState(min !== undefined ? String(min) : '');
  const [draftMax, setDraftMax] = useState(max !== undefined ? String(max) : '');
  const minValue = draftMin === '' ? null : Number(draftMin.replace(',', '.'));
  const maxValue = draftMax === '' ? null : Number(draftMax.replace(',', '.'));
  const invalid =
    (minValue !== null && (!Number.isFinite(minValue) || minValue < 0)) ||
    (maxValue !== null && (!Number.isFinite(maxValue) || maxValue < 0)) ||
    (minValue !== null && maxValue !== null && minValue > maxValue);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        onApply(minValue, maxValue);
        close();
      }}
    >
      <p className="text-sm font-medium text-fg">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={minId}>Minimum</Label>
          <Input id={minId} type="number" inputMode="decimal" min={0} step={step} value={draftMin} onChange={(e) => setDraftMin(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={maxId}>Maximum</Label>
          <Input id={maxId} type="number" inputMode="decimal" min={0} step={step} value={draftMax} onChange={(e) => setDraftMax(e.target.value)} />
        </div>
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-danger">
          Saisissez des nombres positifs, minimum ≤ maximum.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <PopoverClose asChild>
          <Button size="sm" variant="ghost">
            Annuler
          </Button>
        </PopoverClose>
        <Button size="sm" type="submit" variant="primary">
          Appliquer
        </Button>
      </div>
    </form>
  );
}

const COUNTRY_OPTIONS = COUNTRY_CODES.map((code) => ({ value: code, label: countryLabel(code) }));

/**
 * Barre de filtres combinables (§10.4) : inscription, activité, statut, connexion, plateforme,
 * version, pays, ville (liste contrôlée), nombre de courses, distance. Aucun filtre d'âge,
 * d'adresse ou de position.
 */
export function UserFilterBar({ filters, onChange, className }: { filters: ContractUserFilters; onChange: (patch: Patch) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label="Filtres">
      <FilterButton label="Inscription" active={!!(filters.signup_from || filters.signup_to)}>
        {(close) => (
          <DateRangeEditor
            label="Date d’inscription"
            from={filters.signup_from}
            to={filters.signup_to}
            close={close}
            onApply={(from, to) => onChange({ signup_from: from, signup_to: to })}
          />
        )}
      </FilterButton>
      <FilterButton label="Dernière activité" active={!!(filters.last_active_from || filters.last_active_to)}>
        {(close) => (
          <DateRangeEditor
            label="Dernier jour d’activité"
            from={filters.last_active_from}
            to={filters.last_active_to}
            close={close}
            onApply={(from, to) => onChange({ active_from: from, active_to: to })}
          />
        )}
      </FilterButton>
      <FilterButton label="Statut" active={!!filters.status}>
        {() => (
          <CheckList
            legend="Statut du compte"
            options={USER_STATUSES}
            labels={USER_STATUS_LABELS}
            selected={filters.status ?? []}
            onChange={(next) => onChange({ status: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Connexion" active={!!filters.provider}>
        {() => (
          <CheckList
            legend="Méthode de connexion"
            options={PROVIDERS}
            labels={PROVIDER_LABELS}
            selected={filters.provider ?? []}
            onChange={(next) => onChange({ provider: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Plateforme" active={!!filters.platform}>
        {() => (
          <CheckList
            legend="Plateforme"
            options={PLATFORMS}
            labels={PLATFORM_LABELS}
            selected={filters.platform ?? []}
            onChange={(next) => onChange({ platform: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Version" active={!!filters.app_version}>
        {() => (
          <TokenEditor
            legend="Version de l’app (x.y.z)"
            placeholder="1.2.0"
            values={filters.app_version ?? []}
            validate={(v) => /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(v)}
            onChange={(next) => onChange({ version: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Pays" active={!!filters.country}>
        {() => (
          <TokenEditor
            legend="Pays (code ISO à deux lettres)"
            placeholder="FR"
            values={filters.country ?? []}
            normalize={(v) => v.trim().toUpperCase()}
            validate={(v) => COUNTRY_CODES.includes(v)}
            describe={(v) => `${countryLabel(v)} (${v})`}
            datalist={COUNTRY_OPTIONS}
            onChange={(next) => onChange({ country: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Ville" active={!!filters.city}>
        {() => (
          <TokenEditor
            legend="Ville (80 caractères au plus)"
            placeholder="Lyon"
            values={filters.city ?? []}
            validate={(v) => v.length > 0 && v.length <= 80}
            onChange={(next) => onChange({ city: next.length > 0 ? next : null })}
          />
        )}
      </FilterButton>
      <FilterButton label="Courses" active={filters.runs_min !== undefined || filters.runs_max !== undefined}>
        {(close) => (
          <NumberRangeEditor
            label="Nombre de courses"
            min={filters.runs_min}
            max={filters.runs_max}
            step={1}
            close={close}
            onApply={(min, max) => onChange({ runs_min: min === null ? null : Math.floor(min), runs_max: max === null ? null : Math.floor(max) })}
          />
        )}
      </FilterButton>
      <FilterButton label="Distance" active={filters.km_min !== undefined || filters.km_max !== undefined}>
        {(close) => (
          <NumberRangeEditor
            label="Distance cumulée (km)"
            min={filters.km_min}
            max={filters.km_max}
            step={0.1}
            close={close}
            onApply={(min, max) => onChange({ km_min: min, km_max: max })}
          />
        )}
      </FilterButton>
    </div>
  );
}
