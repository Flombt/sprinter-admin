'use client';

import { BarChart3Icon, TableIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Cadre commun des graphiques : titre, définition, bascule « Voir en tableau » (alternative
 * tabulaire obligatoire, §10.3) et méthode de calcul affichée.
 */
export function ChartCard({
  title,
  description,
  chart,
  table,
  method,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  method?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Button size="sm" variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? <BarChart3Icon aria-hidden="true" /> : <TableIcon aria-hidden="true" />}
            {asTable ? 'Voir le graphique' : 'Voir en tableau'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {asTable ? <div className="max-h-[420px] overflow-auto">{table}</div> : chart}
        {method ? <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">{method}</div> : null}
      </CardContent>
    </Card>
  );
}
