'use client';

import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './chart-tooltip';
import type { ChartProps } from './types';

/** Courbes temporelles (Recharts, chargé à la demande) ; tracé progressif seulement à la première apparition. */
export default function TimeLineChart({ data, xKey, series, formatValue, formatX, onSelect, height = 260, label }: ChartProps) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Tracé progressif à la première apparition seulement (500 ms), jamais aux mises à jour.
  const [firstAppearance, setFirstAppearance] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setFirstAppearance(false), 600);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <figure aria-label={label} className="m-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          onClick={(state) => {
            const index = Number(state?.activeIndex);
            if (onSelect && Number.isInteger(index) && index >= 0) onSelect(index);
          }}
          style={{ cursor: onSelect ? 'pointer' : undefined }}
        >
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={(v: string) => formatX(String(v))} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} stroke="var(--border)" minTickGap={24} />
          <YAxis tickFormatter={(v: number) => formatValue(v)} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} stroke="var(--border)" width={64} />
          <Tooltip content={<ChartTooltip series={series} formatValue={formatValue} formatX={formatX} />} cursor={{ stroke: 'var(--border)' }} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} /> : null}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={!reduced && firstAppearance}
              animationDuration={500}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
