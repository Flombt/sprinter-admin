export interface ChartSeries {
  key: string;
  label: string;
  /** Couleur CSS (variables Okabe-Ito `var(--chart-n)`, gris pointillé pour la comparaison). */
  color: string;
  dashed?: boolean;
}

export interface ChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
  formatValue: (value: number) => string;
  formatX: (value: string) => string;
  /** Clic sur un point ou une barre → détail agrégé (index dans `data`). */
  onSelect?: (index: number) => void;
  height?: number;
  /** Libellé accessible du graphique. */
  label: string;
}

/** Palette Okabe-Ito (§10.3), sûre pour le daltonisme. */
export const OKABE_ITO = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-4)'];
export const COMPARE_COLOR = 'var(--chart-compare)';
