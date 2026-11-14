'use client';

import { ChevronDownIcon, RotateCcwIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { plural } from '@/lib/format/fr';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '@/lib/rpc/constants';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditFiltersBar({
  actions,
  from,
  to,
  target,
  onChange,
  onReset,
}: {
  actions: string[];
  from: string | null;
  to: string | null;
  target: string | null;
  onChange: (patch: Partial<{ action: string[] | null; from: string | null; to: string | null; target: string | null }>) => void;
  onReset?: () => void;
}) {
  const fromId = useId();
  const toId = useId();
  const targetId = useId();
  const [targetDraft, setTargetDraft] = useState(target ?? '');
  const targetInvalid = targetDraft !== '' && !GUID.test(targetDraft);

  return (
    <Card className="flex flex-wrap items-end gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg">Actions</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="min-w-40 justify-between">
              {actions.length === 0 ? 'Toutes' : `${actions.length} ${plural(actions.length, 'sélectionnée', 'sélectionnées')}`}
              <ChevronDownIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Types d’action</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AUDIT_ACTIONS.map((action) => (
              <DropdownMenuCheckboxItem
                key={action}
                checked={actions.includes(action)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => {
                  const next = checked ? [...actions, action] : actions.filter((a) => a !== action);
                  onChange({ action: next.length > 0 ? next : null });
                }}
              >
                {AUDIT_ACTION_LABELS[action]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fromId}>Du</Label>
        <Input id={fromId} type="date" className="h-8 w-40" value={from ?? ''} onChange={(e) => onChange({ from: e.target.value || null })} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={toId}>Au</Label>
        <Input id={toId} type="date" className="h-8 w-40" value={to ?? ''} onChange={(e) => onChange({ to: e.target.value || null })} />
      </div>
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!targetInvalid) onChange({ target: targetDraft || null });
        }}
      >
        <Label htmlFor={targetId}>Identifiant complet de la cible</Label>
        <Input
          id={targetId}
          className="h-8 w-80 max-w-full font-mono text-sm"
          placeholder="UUID"
          value={targetDraft}
          aria-invalid={targetInvalid}
          onChange={(e) => setTargetDraft(e.target.value.trim())}
          onBlur={() => {
            if (!targetInvalid) onChange({ target: targetDraft || null });
          }}
        />
      </form>
      {onReset ? (
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcwIcon aria-hidden="true" />
          Réinitialiser
        </Button>
      ) : null}
    </Card>
  );
}
