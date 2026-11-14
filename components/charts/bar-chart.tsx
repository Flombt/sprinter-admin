'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './chart-tooltip';
import type { ChartProps } from './types';

/** Barres et histogrammes (Recharts, chargé à la demande). */
export default function CategoryBarChart({ data, xKey, series, formatValue, formatX, onSelect, height = 260, label }: ChartProps) {
  const reduced = useReducedMotion();
  // Tracé progressif à la première apparition seulement (500 ms), jamais aux mises à jour.
  const [firstAppearance, setFirstAppearance] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setFirstAppearance(false), 600);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <figure aria-label={label} className="m-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          onClick={(state) => {
            const index = Number(state?.activeIndex);
            if (onSelect && Number.isInteger(index) && index >= 0) onSelect(index);
          }}
          style={{ cursor: onSelect ? 'pointer' : undefined }}
        >
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={(v: string) => formatX(String(v))} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} stroke="var(--border)" interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: number) => formatValue(v)} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} stroke="var(--border)" width={64} />
          <Tooltip content={<ChartTooltip series={series} formatValue={formatValue} formatX={formatX} />} cursor={{ fill: 'var(--surface-2)' }} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} /> : null}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={!reduced && firstAppearance} animationDuration={500} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
