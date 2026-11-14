import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Contraste WCAG 2.x des couples de jetons du design system (texte ≥ 4,5:1, §10.3). */
const css = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`bloc introuvable : ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[match[1] as string] = (match[2] as string).toLowerCase();
  return vars;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-2'],
  ['accent-text', 'bg'],
  ['accent-text', 'surface'],
  ['accent-text', 'accent-soft'],
  ['on-accent', 'accent'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['danger', 'danger-soft'],
  ['warning', 'warning-soft'],
];

describe('contraste des jetons', () => {
  const dark = block(':root {');
  const light = block(":root[data-theme='light']");

  it('reprend l’accent de l’app Sprinter (sombre #19C7B0, clair #107F70)', () => {
    expect(dark.accent).toBe('#19c7b0');
    expect(light.accent).toBe('#107f70');
  });

  for (const [theme, tokens] of [
    ['sombre', dark],
    ['clair', light],
  ] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`${theme} : ${fg} sur ${bg} ≥ 4,5:1`, () => {
        const fgColor = tokens[fg];
        const bgColor = tokens[bg];
        expect(fgColor, fg).toBeDefined();
        expect(bgColor, bg).toBeDefined();
        expect(contrast(fgColor as string, bgColor as string)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
