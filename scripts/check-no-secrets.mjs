#!/usr/bin/env node
/**
 * Garde anti-secrets du dépôt Sprinter Admin (§12.2) : échoue si le code du site contient
 * une référence à la clé à privilèges de Supabase, une clé secrète ou une clé privée.
 *
 *   node scripts/check-no-secrets.mjs            → sources du site
 *   node scripts/check-no-secrets.mjs --bundle   → bundle navigateur produit par `next build`
 *
 * Les motifs sont assemblés à l'exécution pour que ce fichier ne se signale pas lui-même.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const PATTERNS = [
  ['service', 'role'].join('_'),
  ['sb', 'secret', ''].join('_'),
  ['SUPABASE', 'SECRET'].join('_'),
  ['BEGIN', 'PRIVATE', 'KEY'].join(' '),
];

const bundleMode = process.argv.includes('--bundle');
const SOURCE_DIRS = ['app', 'components', 'lib', 'public', 'e2e', 'tests'];
const SOURCE_FILES = ['proxy.ts', 'next.config.ts', 'vercel.json', 'package.json', '.env.example', 'playwright.config.ts', 'vitest.config.ts'];
const BUNDLE_DIRS = ['.next/static', '.next/server/app'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.txt', '.example', '']);
const SKIP = new Set(['node_modules', '.git', '.next', 'playwright-report', 'test-results']);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!bundleMode && SKIP.has(name)) continue;
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(name))) yield path;
  }
}

const targets = bundleMode
  ? BUNDLE_DIRS.flatMap((dir) => [...walk(join(ROOT, dir))])
  : [...SOURCE_DIRS.flatMap((dir) => [...walk(join(ROOT, dir))]), ...SOURCE_FILES.map((f) => join(ROOT, f))];

if (bundleMode && targets.length === 0) {
  console.error('Garde anti-secrets : aucun bundle trouvé, lancez `npm run build` avant `--bundle`.');
  process.exit(1);
}

const findings = [];
for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      if (line.includes(pattern)) findings.push(`${relative(ROOT, file)}:${index + 1} → motif interdit « ${pattern} »`);
    }
  });
}

if (findings.length > 0) {
  console.error(`Garde anti-secrets : ${findings.length} occurrence(s) interdite(s) :`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`Garde anti-secrets : OK (${targets.length} fichiers ${bundleMode ? 'du bundle' : 'sources'} analysés, ${PATTERNS.length} motifs).`);
