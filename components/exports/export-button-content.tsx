'use client';

import { DownloadIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useAdmin } from '@/components/shell/admin-context';
import { CorrelationId } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { safeCsvFilename, sanitizeExportCsv, downloadCsv } from '@/lib/csv/csv';
import { formatDay, plural } from '@/lib/format/fr';
import { MAX_PERIOD_DAYS, daysInclusive } from '@/lib/period/period';
import { ApiError, isApiError, rpc } from '@/lib/rpc/client';
import { EXPORT_FORMATS, EXPORT_FORMAT_LABELS, EXPORT_KIND_LABELS, type ExportFormat, type ExportKind } from '@/lib/rpc/constants';
import { errorMessage } from '@/lib/rpc/errors';

/**
 * Export CSV d'agrégats (`admin_export_aggregates`) : période ≤ 366 jours, journalisé par la
 * base, aucune donnée personnelle ; téléchargement côté navigateur après contrôle du contenu.
 */
export function ExportButton({ kinds, from, to, initialOpen = false }: { kinds: readonly ExportKind[]; from: string; to: string; initialOpen?: boolean }) {
  const admin = useAdmin();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(initialOpen);
  const [kind, setKind] = useState<ExportKind>(kinds[0] as ExportKind);
  const [format, setFormat] = useState<ExportFormat>('excel_fr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const days = daysInclusive(from, to);
  const tooLong = days > MAX_PERIOD_DAYS;

  if (!admin.can('export.aggregates')) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rpc('admin_export_aggregates', { p_kind: kind, p_from: from, p_to: to, p_format: format });
      const filename = safeCsvFilename(result.filename, `sprinter-${kind}-${from}_${to}.csv`);
      downloadCsv(sanitizeExportCsv(result.csv, format), filename);
      toast({ tone: 'success', title: 'Export prêt', description: filename });
      setOpen(false);
    } catch (err) {
      setError(isApiError(err) ? err : new ApiError('unknown', 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <DownloadIcon aria-hidden="true" />
        Exporter
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-w-lg">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Exporter des agrégats (CSV)</DialogTitle>
              <DialogDescription>
                Données agrégées uniquement, sans aucune donnée personnelle. Chaque export est journalisé.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-kind`} className="text-sm font-medium text-fg">
                Contenu
              </label>
              <select id={`${id}-kind`} className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-fg" value={kind} onChange={(e) => setKind(e.target.value as ExportKind)}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {EXPORT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">Format</legend>
              {EXPORT_FORMATS.map((f) => (
                <label key={f} className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm text-fg has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="accent-[var(--accent)]" />
                  {EXPORT_FORMAT_LABELS[f]}
                </label>
              ))}
            </fieldset>
            <p className="text-sm text-fg-muted">
              Période : {formatDay(from)} → {formatDay(to)} ({days} {plural(days, 'jour')}).
            </p>
            {tooLong ? (
              <p role="alert" className="text-sm text-danger">
                La période d’un export ne peut pas dépasser {MAX_PERIOD_DAYS} jours.
              </p>
            ) : null}
            {error ? (
              <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                <span>{errorMessage(error.code)}</span>
                <CorrelationId id={error.correlationId} />
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" disabled={busy || tooLong}>
                <DownloadIcon aria-hidden="true" />
                {busy ? 'Préparation…' : 'Télécharger'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
