/**
 * Exports CSV d'agrégats (§10.4) : le contenu est produit et journalisé par la base
 * (`admin_export_aggregates`) ; le site le contrôle puis le télécharge côté navigateur.
 * Deux formats : standard (`,`, UTF-8) et Excel FR (`;`, BOM UTF-8, décimales à virgule).
 */

export type CsvFormat = 'standard' | 'excel_fr';

export const BOM = '﻿';
export const CSV_DELIMITERS: Record<CsvFormat, ',' | ';'> = { standard: ',', excel_fr: ';' };

/** Lecture RFC 4180 (guillemets doublés, séparateurs et retours à la ligne dans les champs). */
export function parseCsv(text: string, delimiter: ',' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function quote(cell: string, delimiter: string): string {
  return cell.includes('"') || cell.includes(delimiter) || /[\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function serializeCsv(rows: string[][], delimiter: ',' | ';'): string {
  return rows.map((row) => row.map((cell) => quote(cell, delimiter)).join(delimiter)).join('\r\n') + '\r\n';
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/;
const FORMULA = /^[=+\-@\t\r]/;

/**
 * Neutralise une cellule interprétable comme formule par un tableur (injection CSV) :
 * préfixe « ' ». Les nombres (y compris négatifs) restent intacts.
 */
export function neutralizeFormula(cell: string): string {
  return FORMULA.test(cell) && !NUMBER.test(cell) ? `'${cell}` : cell;
}

/** Contrôle du CSV reçu : séparateur du format, cellules neutralisées, BOM pour Excel FR. */
export function sanitizeExportCsv(csv: string, format: CsvFormat): string {
  const delimiter = CSV_DELIMITERS[format];
  const body = csv.startsWith(BOM) ? csv.slice(1) : csv;
  const rows = parseCsv(body, delimiter)
    .filter((row) => !(row.length === 1 && row[0] === ''))
    .map((row) => row.map(neutralizeFormula));
  const text = serializeCsv(rows, delimiter);
  return format === 'excel_fr' ? `${BOM}${text}` : text;
}

/** Nom de fichier sûr (`sprinter-<type>-<du>_<au>.csv`), sinon nom de repli. */
export function safeCsvFilename(name: string | null | undefined, fallback: string): string {
  const candidate = (name ?? '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.csv$/.test(candidate) ? candidate : fallback;
}

export function csvBlob(csv: string): Blob {
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

/** Téléchargement côté navigateur, sans stockage ni nouvel appel réseau. */
export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(csvBlob(csv));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
