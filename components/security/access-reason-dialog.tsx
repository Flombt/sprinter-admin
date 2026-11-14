'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { ACCESS_REASONS, ACCESS_REASON_LABELS, type AccessReason } from '@/lib/rpc/constants';
import type { AccessReasonValue, ReasonRequest } from './access-reason';

const NOTE_MAX = 200;

export default function AccessReasonDialog({
  request,
  initial,
  onDone,
}: {
  request: ReasonRequest;
  initial: AccessReasonValue | null;
  onDone: (value: AccessReasonValue | null) => void;
}) {
  const [reason, setReason] = useState<AccessReason | null>(initial?.reason ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const noteId = useId();
  const hintId = useId();
  const errorId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!reason) return;
    onDone({ reason, note: note.trim() ? note.trim().slice(0, NOTE_MAX) : null });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone(null)}>
      <DialogContent className="max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{request.title ?? 'Motif d’accès'}</DialogTitle>
            <DialogDescription>
              {request.description ??
                'L’ouverture d’une fiche et tout affichage nominatif exigent un motif, journalisé avec l’accès. Il est mémorisé pour cette session et transmis à chaque consultation.'}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2" aria-describedby={submitted && !reason ? errorId : undefined}>
            <legend className="mb-1 text-sm font-medium text-fg">Motif</legend>
            {ACCESS_REASONS.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm text-fg has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="motif"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-[var(--accent)]"
                />
                {ACCESS_REASON_LABELS[value]}
              </label>
            ))}
          </fieldset>
          {submitted && !reason ? (
            <p id={errorId} role="alert" className="text-sm text-danger">
              Choisissez un motif.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>Précision (facultative)</Label>
            <Textarea
              id={noteId}
              maxLength={NOTE_MAX}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={hintId}
            />
            <p id={hintId} className="text-xs text-fg-muted">
              {NOTE_MAX} caractères au plus, sans donnée personnelle superflue ({note.length}/{NOTE_MAX}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onDone(null)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary">
              Continuer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
