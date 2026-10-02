// Copy a successfully generated artifact into this repository's main/root Pages
// publication. Commit all generated changes together; never publish mid-build.
import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateSearchCoverage } from '../lib/search-coverage.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const coverage = JSON.parse(await readFile(resolve(root, '_site/search-coverage.json'), 'utf8'));
const directory = JSON.parse(await readFile(resolve(root, 'data/directory.json'), 'utf8'));
validateSearchCoverage(coverage, directory);
for (const folder of ['pagefind', 'pagefind-ja']) {
  await readFile(resolve(root, '_site', folder, 'pagefind-entry.json'));
  await rm(resolve(root, folder), { recursive: true, force: true });
  await cp(resolve(root, '_site', folder), resolve(root, folder), { recursive: true });
}
await cp(resolve(root, '_site/search-coverage.json'), resolve(root, 'search-coverage.json'));
console.log(`Prepared ${coverage.records.toLocaleString()} canonical search targets from ${coverage.generatedAt}. Commit the generated directories and coverage file together.`);
