import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

// JavaScript initial d'un chargement à froid sur un navigateur moderne, runtime Next inclus.
// Les imports chargés après une interaction et les graphiques différés restent mesurables séparément.
const buildRoot = '.next';
const budget = 200 * 1024;
const bootstrap = JSON.parse(readFileSync(join(buildRoot, 'build-manifest.json'), 'utf8')).rootMainFiles;
const manifests = globSync('server/app/**/page_client-reference-manifest.js', { cwd: buildRoot });
if (!bootstrap?.length || !manifests.length) throw new Error('Build Next complet requis avant de mesurer le JavaScript.');
let failed = false;
for (const file of manifests) {
  const context = { globalThis: {} };
  runInNewContext(readFileSync(join(buildRoot, file), 'utf8'), context);
  const [entry] = Object.entries(context.globalThis.__RSC_MANIFEST);
  const [route, manifest] = entry;
  const page =
    manifest.entryJSFiles[`[project]/app${route}`] ??
    (route === '/page' ? manifest.entryJSFiles['[project]/app/layout'] : undefined) ??
    (route === '/_global-error/page' ? manifest.entryJSFiles['[project]/app/global-error'] : undefined) ??
    (route === '/_not-found/page' ? manifest.entryJSFiles['[project]/app/not-found'] : undefined);
  if (!page?.length) throw new Error(`Manifeste de page incomplet pour ${route}`);
  const chunks = new Set([...bootstrap, ...page]);
  const bytes = [...chunks].reduce((total, chunk) => total + gzipSync(readFileSync(join(buildRoot, chunk)), { level: 9 }).length, 0);
  const path = route.replace(/\/\([^/]+\)/g, '').replace(/\/page$/, '') || '/';
  console.log(`${bytes > budget ? 'FAIL' : 'OK'} ${path} ${(bytes / 1024).toFixed(1)} Ko gzip / 200 Ko`);
  if (bytes > budget) failed = true;
}
if (failed) process.exitCode = 1;
