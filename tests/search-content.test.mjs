import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedPage, extractPage, htmlText, passages, collectReaders } from '../lib/search-content.mjs';
import { normalizeQuery, safeResultURL, excerptParts } from '../assets/search-view.mjs';

const paths = ['/readers/', '/puzzles/', '/mtl-guide/'];
test('crawler stays in authored public HTML roots, without source or duplicate editions', () => {
  for (const href of ['https://other.test/puzzles/', '/private/', '/puzzles/data/a.html', '/puzzles/raw_agents/a.html', '/puzzles/a.pdf', '/readers/book/chapters/1.html', 'javascript:alert(1)']) assert.equal(allowedPage(href, 'https://jehlp.net/puzzles/', paths), null, href);
  assert.equal(allowedPage('example/index.html?q=x#title', 'https://jehlp.net/puzzles/', paths), '/puzzles/example/');
  assert.equal(allowedPage('/readers/', 'https://jehlp.net/', paths), '/readers/');
});
test('HTML extraction keeps real prose and inline words while excluding scripts/navigation', () => {
  const html = '<html><head><title>Doc</title><script>privateSecret</script></head><body><nav>Navigation</nav><main><h1>Guide</h1><p><span>I</span>t is <em>café</em>.</p><p aria-hidden="true">decoration</p><a href="next.html">Next</a></main></body></html>';
  const result = extractPage(html, '/mtl-guide/', { label: 'MTL Guide' }, paths);
  assert.match(result.record.content, /It is café\./);
  assert.doesNotMatch(result.record.content, /privateSecret|Navigation|decoration/);
  assert.deepEqual(result.links, ['/mtl-guide/next.html']);
  assert.equal(htmlText('<p>A &amp; B</p><p>C</p>'), 'A & B C');
});
test('passages keep exact stable start anchors and never truncate paragraphs', () => {
  const input = [{ id: 'p-1', text: 'one two three' }, { id: 'p-2', text: 'four five' }, { id: 'p-3', text: 'six seven eight nine' }];
  assert.deepEqual(passages(input, 5).map(p => p.map(i => i.id)), [['p-1', 'p-2'], ['p-3']]);
});
test('Readers uses published searchable text and chapter/paragraph routes once', async () => {
  const records = [];
  const sources = {
    '/readers/library.json': [{ id: 'book', title: 'Book', author: 'Author', volumes: [] }],
    '/readers/book/glossary.json': [],
    '/readers/book/manifest.json': { chapters: [{ id: 'first', title: 'First' }] },
    '/readers/book/search.json': [{ id: 'first', title: 'First', paragraphs: [{ id: 'chapter-title', text: 'First' }, { id: 'p-001', text: 'Rare body phrase' }] }],
  };
  const coverage = await collectReaders({ getJSON: async path => sources[path], addRecord: async record => records.push(record) });
  assert.deepEqual(coverage, { books: 1, chapters: 1, annotations: 0 });
  assert.deepEqual(records.map(r => r.url), ['/readers/book/', '/readers/book/#first/p-001']);
  assert.match(records[1].content, /Rare body phrase/);
  sources['/readers/book/search.json'] = [];
  await assert.rejects(collectReaders({ getJSON: async path => sources[path], addRecord: async () => {} }), /Incomplete Readers/);
});
test('browser helpers normalize queries and reject off-site links and HTML injection', () => {
  assert.equal(normalizeQuery('  Ｃafé\n WORD  '), 'Café WORD');
  assert.equal(safeResultURL('/readers/book/#one/p-1'), '/readers/book/#one/p-1');
  for (const url of ['javascript:alert(1)', 'https://evil.test/', '//evil.test/']) assert.equal(safeResultURL(url), null);
  const tokens = excerptParts('a <mark>word</mark> <img onerror=evil>');
  assert.equal(tokens.filter(t => t.marker).length, 2);
  assert.equal(tokens.at(-1).marker, false);
});

test('encoded excluded paths and empty reader bodies fail safely', async () => {
  assert.equal(allowedPage('/puzzles/%64ata/private.html', 'https://jehlp.net/', paths), null);
  const sources = {
    '/readers/library.json': [{ id: 'book', title: 'Book' }],
    '/readers/book/glossary.json': [],
    '/readers/book/manifest.json': { chapters: [] },
    '/readers/book/search.json': [],
  };
  const options = { getJSON: async path => sources[path], addRecord: async () => {} };
  await assert.rejects(collectReaders(options), /Incomplete Readers/);
  sources['/readers/book/manifest.json'].chapters = [{ id: 'one', title: 'One' }];
  sources['/readers/book/search.json'] = [{ id: 'one', title: 'One', paragraphs: [{ id: 'chapter-title', text: 'One' }] }];
  await assert.rejects(collectReaders(options), /Empty Readers body/);
});
