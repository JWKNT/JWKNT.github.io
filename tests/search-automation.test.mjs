import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { crawlPublishedPages } from '../lib/search-crawl.mjs';
import { collectDynamicRecords } from '../lib/search-adapters.mjs';
import { collectAppCopy } from '../lib/search-app-copy.mjs';
import { validateSearchCoverage } from '../lib/search-coverage.mjs';

const project = { id: 'guide', href: '/guide/', label: 'Guide' };
const html = (body) => `<html><title>Guide</title><main>${body}</main></html>`;
async function crawl(sources, options = {}) {
  const records = [], requests = [];
  const visited = await crawlPublishedPages({ projects: [project], getText: async path => {
    requests.push(path);
    if (!(path in sources)) throw new Error(`HTTP 404: ${path}`);
    return sources[path];
  }, addRecord: async record => records.push(record), ...options });
  return { records, requests, visited };
}

test('new linked pages and nested descendants are discovered without index registration', async () => {
  const sources = {
    '/guide/': html('<a href="new.html">New page</a>'),
    '/guide/new.html': html('Newly published unique prose. <a href="nested/">More</a>'),
    '/guide/nested/': html('Newest nested prose. <a href="/guide/index.html#top">Home</a>'),
  };
  const result = await crawl(sources);
  assert.deepEqual(result.requests, Object.keys(sources));
  assert.match(result.records.at(-1).content, /Newest nested prose/);
});

test('fresh crawls replace changed text and drop removed or unlinked pages', async () => {
  const sources = { '/guide/': html('<a href="old.html">Old</a>'), '/guide/old.html': html('obsolete content') };
  assert.equal((await crawl(sources)).records.length, 2);
  sources['/guide/'] = html('<p>replacement content</p>');
  delete sources['/guide/old.html'];
  const fresh = await crawl(sources);
  assert.equal(fresh.records.length, 1);
  assert.match(fresh.records[0].content, /replacement content/);
  assert.doesNotMatch(JSON.stringify(fresh.records), /obsolete content/);
});

test('new homepage roots are accepted without a hard-coded site count', async () => {
  const newProject = { id: 'new-site', href: '/new-site/', label: 'New site' };
  const result = await crawl({ '/guide/': html('Guide'), '/new-site/': html('Future root') }, { projects: [project, newProject] });
  assert.deepEqual(result.records.map(r => r.site), ['Guide', 'New site']);
  const directory = [{ pages: Array.from({ length: 23 }, (_, i) => ({ label: `Site ${i}` })) }];
  const coverage = { records: 23, htmlPages: 23, generatedAt: new Date().toISOString(), sites: Object.fromEntries(directory[0].pages.map(p => [p.label, 1])) };
  assert.doesNotThrow(() => validateSearchCoverage(coverage, directory));
  delete coverage.sites['Site 22'];
  assert.throws(() => validateSearchCoverage(coverage, directory), /complete search artifact/);
});

test('same-origin allowlist excludes external sites, unlisted roots, source and download paths', async () => {
  const result = await crawl({ '/guide/': html(`
    <a href="https://outside.test/guide/">External</a><a href="/unlisted/">Unlisted</a>
    <a href="data/private.html">Data</a><a href="%64ata/private.html">Encoded data</a>
    <a href="paper.pdf">PDF</a><a href="index.html?q=x#top">Same page</a>
    <a href="next.html?one#two">Next</a><a href="next.html?three">Duplicate</a>`),
    '/guide/next.html': html('Only public text'),
  });
  assert.deepEqual(result.requests, ['/guide/', '/guide/next.html']);
});

test('failed fetches and crawl safety limit fail the whole refresh, never a partial success', async () => {
  await assert.rejects(crawl({ '/guide/': html('<a href="missing.html">Missing</a>') }), /HTTP 404/);
  await assert.rejects(crawl({ '/guide/': html('<a href="a.html">A</a><a href="b.html">B</a>') }, { limit: 2 }), /safety limit/);
});

test('adapter-discovered HTML also recursively discovers new links with a shared visited set', async () => {
  const visited = new Set(['/guide/']);
  const result = await crawl({ '/guide/generated.html': html('<a href="detail.html">Detail</a><a href="/guide/">Root</a>'), '/guide/detail.html': html('Generated descendant') }, { seeds: ['/guide/generated.html'], visited });
  assert.deepEqual(result.requests, ['/guide/generated.html', '/guide/detail.html']);
  assert.equal(visited.size, 3);
});

test('overlapping authored roots use the most specific site label', async () => {
  const result = await crawl({ '/guide/': html('Root'), '/guide/sub/': html('Subsite') }, { projects: [project, { href: '/guide/sub/', label: 'Subsite' }] });
  assert.equal(result.records[1].site, 'Subsite');
});

test('workflow builds uncached snapshots on push and schedule with a guarded deployment', async () => {
  const source = await readFile(new URL('../.github/workflows/search-pages.yml', import.meta.url), 'utf8');
  assert.match(source, /push:\s+branches: \[main\]/);
  assert.match(source, /cron: '23 \* \* \* \*'/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /run: npm test/);
  assert.match(source, /run: npm run build:site/);
  assert.match(source, /run: node tools\/verify-search-artifact.mjs/);
  assert.match(source, /needs: build/);
  assert.match(source, /if \[ "\$source" != workflow \]/);
  assert.match(source, /path: _site/);
  assert.doesNotMatch(source, /contents: write|\$\{\{ secrets\.|--cached|git push|git commit|enablement: true/);
});


test('removed adapted roots perform no fetches or leave stale catalogue records', async () => {
  const forbidden = async () => { throw new Error('Unlisted root fetched'); };
  const options = { paths: ['/guide/'], getJSON: forbidden, getText: forbidden, addRecord: forbidden };
  const dynamic = await collectDynamicRecords(options);
  assert.deepEqual(dynamic.coverage, {});
  assert.deepEqual(dynamic.htmlPaths, []);
  assert.deepEqual(await collectAppCopy(options), {});
});

test('failed deployment reruns reuse the successful build artifact name', async () => {
  const source = await readFile(new URL('../.github/workflows/search-pages.yml', import.meta.url), 'utf8');
  assert.match(source, /artifact-name: \$\{\{ steps\.artifact\.outputs\.name \}\}/);
  assert.match(source, /artifact_name: \$\{\{ needs\.build\.outputs\.artifact-name \}\}/);
});
