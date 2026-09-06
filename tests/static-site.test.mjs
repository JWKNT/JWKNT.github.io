import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { marks, renderDirectory, validateDirectory } from '../lib/directory.mjs';

const categories = JSON.parse(await readFile(new URL('../data/directory.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const copy = () => structuredClone(categories);
const destinations = ['albatross-koukairoku', 'black-sheep-town', 'profile', 'mystery-report', 'bl2', 'ngu-idle-dashboard', 'ndb-idle', 'box-puzzles', 'logical-solver', 'mtl-guide', 'links', 'puzzles', 'baba-is-you'];

test('checked-in homepage is the deterministic directory build', () => {
  assert.equal(index, renderDirectory(categories), 'Run node build.mjs after changing the directory or renderer.');
  assert.equal(renderDirectory(categories), renderDirectory(copy()));
});

test('all thirteen destinations are present in the static native-disclosure fallback', () => {
  assert.deepEqual(categories.flatMap(category => category.pages.map(page => page.id)).sort(), [...destinations].sort());
  assert.equal([...index.matchAll(/<li data-project=/g)].length, destinations.length);
  for (const destination of destinations) assert.match(index, new RegExp(`<li data-project="${destination}"><a href="/${destination}/">`));
  for (const category of categories) assert.match(index, new RegExp(`<details class="atlas-category" data-category="${category.id}"${category.open ? ' open' : ''}>\\s*<summary>`));
  assert.match(index, /class="skip-link" href="#directory"/);
  assert.match(index, /site-theme\/v2\/base\.css/);
  assert.match(index, /favicons\/home\.png/);
  assert.match(index, /data-theme-toggle/);
});

test('games and recordings share a compact category without hiding destinations', () => {
  const games = categories.find(category => category.id === 'games');
  assert.deepEqual(games.pages.map(page => page.id), ['ndb-idle', 'puzzles', 'baba-is-you']);
  assert.equal(games.pages.find(page => page.id === 'baba-is-you').label, 'Baba Is You recordings');
});

test('metadata and disclosure state follow the authored categories', () => {
  const fixture = copy();
  fixture[0].label = 'Future category';
  fixture[0].open = false;
  const html = renderDirectory(fixture);
  assert.match(html, /name="description" content="Future category, Data, Tools, Games at jehlp.net\."/);
  assert.match(html, /data-category="reading">\s*<summary>/);
});

test('the index has no visible site title, masthead or description', () => {
  const body = index.split('<body>')[1].split('</body>')[0];
  assert.doesNotMatch(body, /<h[1-6]\b|<header\b|masthead|jehlp\.net|jwknt\.github\.io/i);
  assert.doesNotMatch(body, /class="(?:project-description|category-description|intro|hero)"/);
  assert.match(index, /<title>jehlp\.net<\/title>/);
  assert.match(index, /<link rel="canonical" href="https:\/\/jehlp\.net\/">/);
});

test('typographic studies and link glyphs are decorative; controls have textual names', () => {
  for (const category of categories) {
    assert.match(index, new RegExp(`class="type-study study-${category.mark}" aria-hidden="true"`));
    assert.match(index, new RegExp(`<span class="category-label">${category.label}</span><span class="fold" aria-hidden="true">`));
  }
  assert.equal([...index.matchAll(/class="link-point" aria-hidden="true"/g)].length, destinations.length);
  assert.match(index, /class="search-toggle icon-button"[^>]*aria-label="Find a page"[^>]*hidden/);
  assert.match(index, /id="page-status" role="status" aria-live="polite"/);
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

test('invalid, duplicate and reserved category configurations are rejected', () => {
  for (const fixture of [null, {}, []]) assert.throws(() => validateDirectory(fixture));
  for (const id of ['other', 'Reading', '', 'a" onclick="x', 'two words']) {
    const fixture = copy(); fixture[0].id = id;
    assert.throws(() => renderDirectory(fixture));
  }
  const duplicate = copy(); duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateDirectory(duplicate), /Duplicate or invalid category/);
  for (const [key, value] of [['label', '  '], ['mark', '__proto__'], ['mark', 'unknown'], ['open', 'true'], ['pages', []]]) {
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
    id: `category-${i}`, label: `Category ${i}`, mark: markNames[i % markNames.length], open: i < 4,
    pages: Array.from({ length: 20 }, (_, j) => ({ id: `page-${i}-${j}`, label: `Page ${i} / ${j}`, href: `/page-${i}-${j}/` })),
  }));
  const html = renderDirectory(expanded);
  assert.equal([...html.matchAll(/<li data-project=/g)].length, 480);
  assert.equal([...html.matchAll(/<details class="atlas-category" data-category="category-/g)].length, 24);
  assert.equal([...html.matchAll(/data-category="category-\d+" open>/g)].length, 4);
  assert.match(html, /data-category="category-23">\s*<summary>/);
  assert.match(html, /data-project="page-23-19"><a href="\/page-23-19\/">Page 23 \/ 19/);
});
