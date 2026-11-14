'use client';

import { RotateCcwIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Chip {
  id: string;
  label: string;
  onRemove: () => void;
}

/** Puces des filtres appliqués (combinables) + « Réinitialiser » (§10.3 FilterBar). */
export function FilterChips({ chips, onReset }: { chips: Chip[]; onReset: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres appliqués" role="group">
      {chips.map((chip) => (
        <span key={chip.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-3 pr-1 text-sm text-fg">
          {chip.label}
          <button
            type="button"
            className="rounded-full p-1 text-fg-muted hover:bg-surface hover:text-fg"
            aria-label={`Retirer le filtre ${chip.label}`}
            onClick={chip.onRemove}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={onReset}>
        <RotateCcwIcon aria-hidden="true" />
        Réinitialiser
      </Button>
    </div>
  );
}
