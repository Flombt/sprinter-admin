import { describe, expect, it } from 'vitest';
import { BOM, neutralizeFormula, parseCsv, safeCsvFilename, sanitizeExportCsv, serializeCsv } from './csv';

describe('génération des exports CSV', () => {
  it('lit et réécrit un CSV RFC 4180 (guillemets, séparateurs et sauts de ligne dans les champs)', () => {
    const rows = parseCsv('jour,valeur\r\n2026-11-01,"3,5"\n"a ""b""",x\n', ',');
    expect(rows).toEqual([
      ['jour', 'valeur'],
      ['2026-11-01', '3,5'],
      ['a "b"', 'x'],
    ]);
    expect(serializeCsv(rows, ',')).toBe('jour,valeur\r\n2026-11-01,"3,5"\r\n"a ""b""",x\r\n');
  });

  it('neutralise les formules mais garde les nombres négatifs', () => {
    expect(neutralizeFormula('=HYPERLINK("http://x")')).toBe('\'=HYPERLINK("http://x")');
    expect(neutralizeFormula('+33 6 00')).toBe("'+33 6 00");
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeFormula('-5,2')).toBe('-5,2');
    expect(neutralizeFormula('-12')).toBe('-12');
    expect(neutralizeFormula('1.2.0')).toBe('1.2.0');
  });

  it('format standard : virgule, sans BOM', () => {
    const csv = sanitizeExportCsv('version,appareils\r\n=1+1,90\r\n', 'standard');
    expect(csv.startsWith(BOM)).toBe(false);
    expect(csv).toBe("version,appareils\r\n'=1+1,90\r\n");
  });

  it('format Excel FR : point-virgule, BOM UTF-8, décimales à virgule conservées', () => {
    const csv = sanitizeExportCsv(`${BOM}jour;distance_km\r\n2026-11-01;7123,4\r\n`, 'excel_fr');
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1)).toBe('jour;distance_km\r\n2026-11-01;7123,4\r\n');
    expect(parseCsv(csv.slice(1), ';')[1]).toEqual(['2026-11-01', '7123,4']);
  });

  it('n’accepte qu’un nom de fichier sûr', () => {
    expect(safeCsvFilename('sprinter-daily_kpis-2026-11-01_2026-11-14.csv', 'x.csv')).toBe('sprinter-daily_kpis-2026-11-01_2026-11-14.csv');
    expect(safeCsvFilename('../../etc/passwd.csv', 'repli.csv')).toBe('repli.csv');
    expect(safeCsvFilename('export.exe', 'repli.csv')).toBe('repli.csv');
    expect(safeCsvFilename(null, 'repli.csv')).toBe('repli.csv');
  });
});
