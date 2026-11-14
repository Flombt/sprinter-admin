import { useId } from 'react';

/** Mini-courbe SVG légère (pas de bibliothèque de graphiques sur la vue d'ensemble). */
export function Sparkline({ values, label, className }: { values: (number | null)[]; label: string; className?: string }) {
  const gradientId = useId();
  const points = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => typeof p[1] === 'number' && Number.isFinite(p[1]));
  if (points.length < 2) return <div className={className} aria-hidden="true" />;
  const width = 120;
  const height = 32;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (x: number) => ((x - minX) / Math.max(1, maxX - minX)) * (width - 2) + 1;
  const scaleY = (y: number) => height - 2 - ((y - minY) / Math.max(1e-9, maxY - minY)) * (height - 4);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${scaleX(x).toFixed(1)},${scaleY(y).toFixed(1)}`).join(' ');
  const area = `${line} L${scaleX(maxX).toFixed(1)},${height} L${scaleX(minX).toFixed(1)},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
