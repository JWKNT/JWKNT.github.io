import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { marks, renderDirectory, validateDirectory, escapeHtml } from '../lib/directory.mjs';

const categories = JSON.parse(await readFile(new URL('../data/directory.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
// Fixed fixtures exercise layout/schema independently of the changing public
// directory. New or retired sites must not require editing the test registry.
const fixtureCategories = [
  { id: 'reading', label: 'Reading', mark: 'parentheses', pages: [{ id: 'example', label: 'Example', href: '/example/' }] },
  { id: 'data', label: 'Data', mark: 'constellation', pages: [{ id: 'data-page', label: 'Data page', href: '/data-page/' }] },
  { id: 'tools', label: 'Tools', mark: 'asterisk', pages: [{ id: 'tool', label: 'Tool', href: '/tool/' }] },
  { id: 'games', label: 'Games', mark: 'chevrons', pages: [
    { id: 'ndb-idle', label: 'NDB Idle', href: '/ndb-idle/' },
    { id: 'puzzles', label: 'Puzzles', href: '/puzzles/' },
    { id: 'baba-is-you', label: 'Baba Is You', href: '/baba-is-you/' },
  ] },
];
const copy = () => structuredClone(fixtureCategories);
const destinations = categories.flatMap(category => category.pages);

test('generated homepage is the deterministic directory build', () => {
  assert.equal(index, renderDirectory(categories), 'Run node build.mjs after changing the directory or renderer.');
  assert.equal(renderDirectory(fixtureCategories), renderDirectory(copy()));
});

test('all authored destinations are present in the always-visible semantic sections', () => {
  assert.equal([...index.matchAll(/<li data-project=/g)].length, destinations.length);
  for (const destination of destinations) assert.ok(index.includes(`<li data-project="${destination.id}"><a href="${destination.href}">`));
  for (const category of categories) assert.match(index, new RegExp(`<section class="atlas-category" data-category="${category.id}" aria-labelledby="category-${category.id}">\\s*<h2 id="category-${category.id}" class="category-heading">`));
  assert.match(index, /class="skip-link" href="#directory"/);
  assert.match(index, /site-theme\/v2\/base\.css/);
  assert.match(index, /favicons\/home\.png/);
  assert.match(index, /data-theme-toggle/);
});

test('games and recordings share a compact category without hiding destinations', () => {
  const games = fixtureCategories.find(category => category.id === 'games');
  assert.deepEqual(games.pages.map(page => page.id), ['ndb-idle', 'puzzles', 'baba-is-you']);
  assert.equal(games.pages.find(page => page.id === 'baba-is-you').label, 'Baba Is You');
});

test('only authored categories render; no Other section or repository discovery runs', async () => {
  assert.equal([...index.matchAll(/<section class="atlas-category"/g)].length, categories.length);
  assert.doesNotMatch(index, /other-projects|other-project-list|data-category="other"/);
  const script = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /discoverPages|discovery\.mjs|fetch\s*\(|other-project/);
});

test('metadata follows authored categories and legacy open flags cannot hide them', () => {
  const fixture = copy();
  fixture[0].label = 'Future category';
  fixture[0].open = false;
  const html = renderDirectory(fixture);
  assert.match(html, /name="description" content="Future category, Data, Tools, Games at jehlp.net\."/);
  assert.match(html, /data-category="reading" aria-labelledby="category-reading">\s*<h2/);
});

test('the index has no visible site title, masthead or description', () => {
  const body = index.split('<body>')[1].split('</body>')[0].replace(/<a class="site-home"[^>]*>[\s\S]*?<\/a>/, '');
  assert.doesNotMatch(body, /<h1\b|<header\b|masthead|jehlp\.net|jwknt\.github\.io/i);
  assert.doesNotMatch(body, /class="(?:project-description|category-description|intro|hero)"/);
  assert.match(index, /<title>jehlp\.net<\/title>/);
  assert.match(index, /<link rel="canonical" href="https:\/\/jehlp\.net\/">/);
});

test('typographic studies and link glyphs are decorative; controls have textual names', () => {
  for (const category of categories) {
    assert.match(index, new RegExp(`class="type-study study-${category.mark}" aria-hidden="true"`));
    assert.ok(index.includes(`<span class="category-label">${escapeHtml(category.label)}</span>`));
  }
  assert.equal([...index.matchAll(/class="link-point ui-link-arrow" aria-hidden="true"/g)].length, destinations.length);
  assert.match(index, /class="search-toggle site-search"[^>]*aria-label="Search all sites"[^>]*hidden/);
  assert.match(index, /id="page-status"[^>]*role="status" aria-live="polite"/);
});

test('labels are escaped as text, including markup and attribute delimiters', () => {
  const fixture = copy();
  fixture[0].label = 'Reading <script>alert("x")</script> & more';
  fixture[0].pages[0].label = '<img src=x onerror="alert(1)"> & words';
  const html = renderDirectory(fixture);
  assert.match(html, /Reading &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; more/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; words/);
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
});

test('invalid and duplicate category configurations are rejected', () => {
  for (const fixture of [null, {}, []]) assert.throws(() => validateDirectory(fixture));
  for (const id of ['Reading', '', 'a" onclick="x', 'two words']) {
    const fixture = copy(); fixture[0].id = id;
    assert.throws(() => renderDirectory(fixture));
  }
  const duplicate = copy(); duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateDirectory(duplicate), /Duplicate or invalid category/);
  for (const [key, value] of [['label', '  '], ['mark', '__proto__'], ['mark', 'unknown'], ['pages', []]]) {
    const fixture = copy(); fixture[0][key] = value;
    assert.throws(() => renderDirectory(fixture));
  }
});

test('duplicate pages and unsafe destination routes are rejected', () => {
  const repeatedId = copy(); repeatedId[1].pages[0].id = repeatedId[0].pages[0].id.toUpperCase();
  assert.throws(() => validateDirectory(repeatedId), /Duplicate or invalid page/);
  const repeatedHref = copy(); repeatedHref[1].pages[0].href = repeatedHref[0].pages[0].href;
  assert.throws(() => validateDirectory(repeatedHref), /Invalid destination/);
  for (const href of ['javascript:alert(1)', 'https://example.com/', '//example.com/', '/x/../private/', '/x/?q=1', '/x/#frag', '/x', '/', '/x/" onfocus="x']) {
    const fixture = copy(); fixture[0].pages[0].href = href;
    assert.throws(() => renderDirectory(fixture), `Unsafe route ${JSON.stringify(href)} must be rejected.`);
  }
});

test('24 categories and 480 destinations use the same renderer without a fixed cap', () => {
  const markNames = Object.keys(marks);
  const expanded = Array.from({ length: 24 }, (_, i) => ({
    id: `category-${i}`, label: `Category ${i}`, mark: markNames[i % markNames.length],
    pages: Array.from({ length: 20 }, (_, j) => ({ id: `page-${i}-${j}`, label: `Page ${i} / ${j}`, href: `/page-${i}-${j}/` })),
  }));
  const html = renderDirectory(expanded);
  assert.equal([...html.matchAll(/<li data-project=/g)].length, 480);
  assert.equal([...html.matchAll(/<section class="atlas-category" data-category="category-/g)].length, 24);
  assert.doesNotMatch(html, /<details|<summary| class="fold"/);
  assert.match(html, /data-category="category-23" aria-labelledby="category-category-23">\s*<h2/);
  assert.match(html, /data-project="page-23-19"><a href="\/page-23-19\/">Page 23 \/ 19/);
});

test('homepage omits the redundant Home link and retains search and theme controls', async () => {
  assert.equal((index.match(/class="site-home"/g) || []).length, 0);
  assert.doesNotMatch(index, /site-home-dock/);
  assert.match(index, /<div class="index-tools">[\s\S]*?<span class="site-utility-pair"><button class="search-toggle site-search"[\s\S]*?<\/button><button[^>]*data-theme-toggle/);
  assert.ok(index.includes('base.css?v=20261003-controls'));
  assert.ok(index.includes('theme.js?v=20261009-navigation'));
  const css = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.page-search \{[^}]*min-width: 0;[^}]*flex: 0 1 24rem;/);
  assert.match(css, /\.page-search input \{[^}]*min-width: 0;/);
});


test('homepage sections have no collapse semantics, handlers, or collapsed styles', async () => {
  const css = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(index, /<details|<summary|class="fold"/);
  assert.doesNotMatch(css, /\[open\]|details-content|summary|\.fold/);
  assert.doesNotMatch(css, /\.icon-button|\.search-toggle \{/);
  assert.equal((index.match(/<h2 id="category-/g) || []).length, categories.length);
});

test('Mathematics has an abstract category mark and a plain Erdős destination', () => {
  const mathematics = categories.find(category => category.id === 'mathematics');
  assert.equal(mathematics.mark, 'continuum');
  assert.deepEqual(mathematics.pages, [{ id: 'erdos1016', label: 'Erdős 1016', href: '/erdos1016/' }]);
  assert.ok(!categories.find(category => category.id === 'reading').pages.some(page => page.id === 'erdos1016'));
  assert.match(index, /class="type-study study-continuum" aria-hidden="true"><svg class="continuum-study" aria-hidden="true" focusable="false"/);
  assert.match(index, /<li data-project="erdos1016"><a href="\/erdos1016\/">Erdős 1016<span class="link-point ui-link-arrow"/);
  assert.doesNotMatch(index, /destination-symbol|graph-study|<circle/);
});
