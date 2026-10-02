import { readFile, writeFile, mkdir, rm, cp, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as pagefind from 'pagefind';
import { ORIGIN, collectReaders, splitSearchLanguages } from '../lib/search-content.mjs';
import { crawlPublishedPages } from '../lib/search-crawl.mjs';
import { validateSearchCoverage } from '../lib/search-coverage.mjs';
import { hardenPagefind } from '../lib/search-runtime.mjs';
import { collectAppCopy } from '../lib/search-app-copy.mjs';
import { collectDynamicRecords } from '../lib/search-adapters.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '_site');
const temporary = resolve(root, '_site.next');
const cache = resolve(root, '.search-cache');
const directory = JSON.parse(await readFile(resolve(root, 'data/directory.json'), 'utf8'));
const projects = directory.flatMap(group => group.pages);
const paths = projects.map(p => p.href);
await mkdir(cache, { recursive: true });
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
// The release artifact is an explicit public-file list, never a copy of the repo.
for (const file of ['index.html', 'CNAME', '.nojekyll', 'robots.txt', 'assets']) await cp(resolve(root, file), resolve(temporary, file), { recursive: true });

const useCache = process.argv.includes('--cached');
let fetched = 0;
async function getText(pathname) {
  const url = new URL(pathname, ORIGIN);
  if (url.origin !== ORIGIN || !paths.some(path => url.pathname.startsWith(path)) || url.username || url.password) throw new Error(`Non-public search input refused: ${pathname}`);
  const key = createHash('sha256').update(url.href).digest('hex');
  const filename = resolve(cache, key);
  if (useCache) { try { return await readFile(filename, 'utf8'); } catch {} }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'error', headers: { 'User-Agent': 'jehlp-site-search/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim()) throw new Error('Empty response');
      await writeFile(filename, text);
      fetched++;
      return text;
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`Cannot index ${pathname}: ${last.message}`);
}
const getJSON = async pathname => JSON.parse(await getText(pathname));
const { index, errors } = await pagefind.createIndex({ writePlayground: false });
const { index: japanese } = await pagefind.createIndex({ writePlayground: false });
if (errors?.length || !index) throw new Error(errors?.join('\n') || 'Pagefind did not initialize');
const counts = {};
const languages = {};
const languageInputs = { en: 0, ja: 0 };
const records = new Map();
const seenRecords = new Set();
let words = 0;
async function addRecord(record) {
  if (!record.content?.trim() || !record.title || !record.site) throw new Error(`Invalid record: ${record.url}`);
  const url = new URL(record.url, ORIGIN);
  if (url.origin !== ORIGIN || !paths.some(path => url.pathname.startsWith(path))) throw new Error(`Invalid result URL: ${record.url}`);
  record.site = projects.filter(project => url.pathname.startsWith(project.href)).sort((a, b) => b.href.length - a.href.length)[0].label;
  // Some apps expose data in-place rather than giving every item a route.
  // Merge those records at their real target instead of inventing deep links.
  const prior = records.get(record.url);
  if (prior) { prior.content += '\n' + record.content; if (record.japanese) prior.japanese = (prior.japanese || '') + '\n' + record.japanese; }
  else records.set(record.url, { ...record });
}

try {
  const visited = await crawlPublishedPages({ projects, getText, addRecord });
  console.log(`Indexed ${visited.size} published HTML pages`);
  const readers = paths.includes('/readers/') ? await collectReaders({ getJSON, addRecord }) : { books: 0, chapters: 0, annotations: 0 };
  console.log(`Indexed ${readers.books} Readers books / ${readers.chapters} chapters`);
  const dynamic = await collectDynamicRecords({ getJSON, getText, addRecord, paths });
  await crawlPublishedPages({ projects, getText, addRecord, seeds: dynamic.htmlPaths, visited });
  const apps = await collectAppCopy({ getText, addRecord, paths });
  for (const record of records.values()) {
    const content = splitSearchLanguages(record);
    for (const [engine, language, text] of [[index, 'en', content.english], [japanese, 'ja', content.japanese]]) {
      if (!text.trim()) continue;
      const result = await engine.addCustomRecord({ url: record.url, content: text, language, meta: { title: record.title, site: record.site }, filters: { site: [record.site] } });
      if (result.errors?.length) throw new Error(result.errors.join('\n'));
      languageInputs[language]++;
    }
    seenRecords.add(record.url);
    counts[record.site] = (counts[record.site] || 0) + 1;
    words += record.content.split(/\s+/u).length;
  }
  for (const [engine, folder] of [[index, 'pagefind'], [japanese, 'pagefind-ja']]) {
    const result = await engine.writeFiles({ outputPath: resolve(temporary, folder) });
    if (result.errors?.length) throw new Error(result.errors.join('\n'));
    // Pagefind may omit records without indexable tokens. Record the emitted
    // count, not the number submitted, so legitimate empty languages validate.
    const language = folder === 'pagefind' ? 'en' : 'ja';
    const entry = JSON.parse(await readFile(resolve(temporary, folder, 'pagefind-entry.json'), 'utf8'));
    languages[language] = entry.languages?.[language]?.page_count || 0;
    for (const file of ['pagefind-ui.js', 'pagefind-ui.css', 'pagefind-modular-ui.js', 'pagefind-modular-ui.css', 'pagefind-component-ui.js', 'pagefind-component-ui.css', 'pagefind-highlight.js']) await rm(resolve(temporary, folder, file), { force: true });
    for (const runtime of ['pagefind.js', 'pagefind-worker.js']) {
      const runtimePath = resolve(temporary, folder, runtime);
      await writeFile(runtimePath, hardenPagefind(await readFile(runtimePath, 'utf8')));
    }
  }
  const coverage = { sourceCommit: process.env.GITHUB_SHA || null, refresh: { mode: 'fresh-public-crawl', cached: useCache }, generatedAt: new Date().toISOString(), origin: ORIGIN, records: seenRecords.size, languages, languageInputs, indexedWords: words, htmlPages: visited.size, readers, dynamic, apps, sites: counts,
    limits: ['Published text and public catalogue data only; images, video/audio contents and downloads are not transcribed.', 'Live telemetry, personal game saves, private material and external linked sites are not indexed.'],
  };
  validateSearchCoverage(coverage, directory);
  await writeFile(resolve(temporary, 'search-coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
  await rm(output, { recursive: true, force: true });
  await rename(temporary, output);
  console.log(JSON.stringify({ ...coverage, fetched }, null, 2));
} finally { await pagefind.close(); }
