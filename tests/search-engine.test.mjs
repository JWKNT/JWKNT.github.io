import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import * as pagefind from 'pagefind';
import { hardenPagefind } from '../lib/search-runtime.mjs';
import { publishedInterfaceCopy } from '../lib/search-app-copy.mjs';

test('bundled-app adapter extracts displayed JSX copy, never arbitrary strings or story data', () => {
  const result = publishedInterfaceCopy('const story = {secret:"Never index this story"}; const help = (0, r.jsx)("p", {children: `Public help text`}); const instruction = r.jsxs("div", {children:["Select the box", dynamic]});');
  assert.deepEqual(result, ['Public help text', 'Select the box']);
});

test('real sharded search matches body, phrases, case, accents, filters and title relevance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jehlp-search-test-'));
  const savedFetch = globalThis.fetch;
  const savedDocument = globalThis.document;
  const savedWindow = globalThis.window;
  let engine;
  try {
    const { index } = await pagefind.createIndex({ forceLanguage: 'en' });
    for (const record of [
      { url: '/readers/book/#chapter/p-021', title: 'The Cat', site: 'Readers', content: 'A spectral cat walked upon the keyboard of the chor alcelo choralcelo. The café served hot tea.' },
      { url: '/guide/', title: 'Choralcelo guide', site: 'MTL Guide', content: 'The choralcelo was a musical instrument. A comprehensive description follows.' },
      { url: '/albatross/?chapter=1#line-001', title: 'Voyage', site: 'Albatross', content: 'A transcendent mass overhead.' },
      { url: '/readers/other/#chapter/p-003', title: 'Narcotherapeutic examinations', site: 'Readers', content: 'The narcotherapeutic examinations were necessary.' },
    ]) await index.addCustomRecord({ ...record, language: 'en', meta: { title: record.title, site: record.site }, filters: { site: [record.site] } });
    await index.writeFiles({ outputPath: directory });
    const { index: japanese } = await pagefind.createIndex();
    await japanese.addCustomRecord({ url: '/albatross/?chapter=1#line-001', content: 'そういう学校に通ってるもの。', language: 'ja', meta: { title: 'Voyage', site: 'Albatross' }, filters: { site: ['Albatross'] } });
    await japanese.writeFiles({ outputPath: join(directory, 'ja') });
    await pagefind.close();
    const runtime = join(directory, 'pagefind.js');
    await writeFile(runtime, hardenPagefind(await readFile(runtime, 'utf8')));
    globalThis.document = { currentScript: null, querySelector: () => ({ getAttribute: () => 'en' }) };
    globalThis.window = { location: { origin: 'https://jehlp.net' } };
    let bytes = 0, requests = 0;
    globalThis.fetch = async path => {
      const name = new URL(String(path), 'https://jehlp.net').pathname.replace(/^\/pagefind\//, '');
      assert(!name.includes('..'));
      const content = await readFile(join(directory, name)); bytes += content.length; requests++;
      return new Response(content);
    };
    const module = await import(pathToFileURL(join(directory, 'pagefind.js')));
    engine = module.createInstance({ basePath: '/pagefind/', baseUrl: '/' });
    await engine.init();
    await engine.mergeIndex('/pagefind/ja/', { language: 'ja', baseUrl: '/' });
    const search = async (query, opts) => {
      const results = await engine.search(query, opts);
      return Promise.all(results.results.map(r => r.data()));
    };
    assert.equal((await search('CHORALCELO'))[0].url, '/guide/');
    assert.equal((await search('choralcelo', { filters: { site: 'Readers' } }))[0].url, '/readers/book/#chapter/p-021');
    assert.equal((await search('"spectral cat"'))[0].url, '/readers/book/#chapter/p-021');
    assert.equal((await search('cafe'))[0].url, '/readers/book/#chapter/p-021');
    assert.equal((await search('narcotherapeutic'))[0].url, '/readers/other/#chapter/p-003');
    assert.equal((await search('qzxnotaword')).length, 0);
    assert.equal((await search('学校'))[0].url, '/albatross/?chapter=1#line-001');
    assert.equal((await search('"transcendent mass"'))[0].url, '/albatross/?chapter=1#line-001');
    assert(bytes > 0 && requests > 0);
    const workingFetch = globalThis.fetch;
    globalThis.fetch = async path => String(path).includes('/index/') ? new Response('Unavailable', { status: 503 }) : workingFetch(path);
    const failing = module.createInstance({ basePath: '/pagefind/', baseUrl: '/' });
    await failing.init();
    await assert.rejects(failing.search('choralcelo'), /HTTP 503/);
    globalThis.fetch = workingFetch;
    const recovered = module.createInstance({ basePath: '/pagefind/', baseUrl: '/', metaCacheTag: 'retry' });
    await recovered.init();
    assert.equal((await recovered.search('choralcelo')).results.length, 2);
    await failing.destroy(); await recovered.destroy();
    // Exercise the actual browser-worker runtime too, using its real message
    // handler and a transport-only stub. Node's no-Worker fallback is not enough.
    const workerSource = hardenPagefind(await readFile(join(directory, 'pagefind-worker.js'), 'utf8'));
    for (const failurePath of ['pagefind-entry.json', 'wasm.', '/index/', '/fragment/']) {
      let listener, response, messageID = 0;
      const self = { addEventListener: (_, callback) => { listener = callback; }, postMessage: value => { response = value; } };
      const quietConsole = { log() {}, warn() {}, error() {} };
      let blocked = true;
      const workerFetch = path => blocked && String(path).includes(failurePath) ? Promise.resolve(new Response('Unavailable', { status: 503 })) : workingFetch(path);
      vm.runInNewContext(workerSource, { self, fetch: workerFetch, URL, Response, Request, TextDecoder, TextEncoder, WebAssembly, performance, setTimeout, clearTimeout, console: quietConsole });
      const send = async (method, args, instanceId = 'first') => { await listener({ data: { id: ++messageID, instanceId, method, args } }); return response; };
      await send('init', [{ basePath: '/pagefind/', baseUrl: '/', language: 'en', primary: true }]);
      const failedSearch = await send('search', ['choralcelo', {}]);
      if (failurePath === '/fragment/') {
        assert.equal(failedSearch.result.results.length, 2);
        const failedFragment = await send('getData', [failedSearch.result.results[0].data]);
        assert.match(failedFragment.error, /503/);
      } else assert(failedSearch.error, `Worker must expose ${failurePath} failure`);
      blocked = false;
      await send('init', [{ basePath: '/pagefind/', baseUrl: '/', language: 'en', primary: true }], 'retry');
      const retry = await send('search', ['choralcelo', {}], 'retry');
      assert.equal(retry.result.results.length, 2, `Worker must recover after ${failurePath}`);
    }
  } finally {
    await engine?.destroy();
    await pagefind.close();
    globalThis.fetch = savedFetch; globalThis.document = savedDocument; globalThis.window = savedWindow;
    await rm(directory, { force: true, recursive: true });
  }
});
