import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { marks, renderDirectory, validateDirectory, escapeHtml } from '../lib/directory.mjs';
import { introParagraphs } from '../lib/intro.mjs';

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
  // A new address makes browsers fetch the seal favicon instead of an old cached copy.
  assert.match(index, /favicons\/home\.png\?v=20261107-seal"/);
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

test('the index has one title, the seal, and the owner’s introduction with the human mark', () => {
  const body = index.split('<body>')[1].split('</body>')[0];
  assert.equal((body.match(/<h1\b/g) || []).length, 1);
  const title = body.match(/<h1 class="site-seal">([\s\S]*?)<\/h1>/)?.[1];
  assert.ok(title, 'the seal is the page title');
  assert.match(title, /^<span class="sr-only">jehlp\.net<\/span>/, 'the seal has a text name');
  assert.equal((title.match(/<svg [^>]*aria-hidden="true"/g) || []).length, 1);
  assert.match(title, /class="intro-seal"/);
  assert.match(title, /M12 3\.2C14 2\.1 16 4 16 5\.5/, 'the seal is style library icon i0063');
  assert.doesNotMatch(index, /wordmark/);
  // The owner wrote the introduction. Keep the exact words, and mark them with the theme's human mark.
  const intro = body.match(/<div class="intro-text ui-human">\s*<p>([\s\S]*?)<\/p>\s*<p>([\s\S]*?)<\/p>\s*(<span class="ui-human-mark"[^>]*><\/span>)\s*<\/div>/);
  assert.ok(intro, 'the introduction is two marked paragraphs');
  const words = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replaceAll('&nbsp;', ' ').trimEnd();
  assert.deepEqual([words(intro[1]), words(intro[2])], introParagraphs.map(words));
  assert.deepEqual(introParagraphs.map(words), [
    'I have been on the internet a long time, and depending on where you have encountered me, I have gone by Jay, JW, jehlp, or KNT. I am interested in mathematics, data science, puzzles, science fiction, and otaku culture.',
    'This website serves as a work-in-progress centralization of my past and future brainchildren, and everything directly on this site (i.e., any page starting with jehlp.net/) is written and programmed fully by AI under my supervision, unless explicitly marked with this symbol shown to the right.',
  ]);
  assert.match(intro[1], /gone by <strong>Jay<\/strong>, <strong>JW<\/strong>, <strong>jehlp<\/strong>, or <strong>KNT<\/strong>\./, 'the four names are bold');
  assert.equal((body.match(/<strong>/g) || []).length, 4, 'nothing else is bold');
  assert.match(intro[2], /<span class="intro-end">the right\.&nbsp;<svg class="intro-arrow" aria-hidden="true"[^>]*>[\s\S]*<\/svg><\/span>$/, 'the arrow ends the paragraph on the line of the last words');
  assert.equal(intro[3], '<span class="ui-human-mark" role="img" aria-label="Written by a human" title="Written by a human"></span>');
  assert.match(body, /<\/div>\s*<\/div>\s*<hr class="atlas-rule">\s*<nav class="directory"/, 'one rule ends the introduction, before the categories');
  assert.equal((body.match(/class="[^"]*\bui-human[\s"]/g) || []).length, 1, 'only the owner’s words carry the mark');
  assert.match(index, /<link rel="stylesheet" href="https:\/\/jehlp\.net\/site-theme\/v2\/components\.css\?v=20261108-margin">/, 'the theme layer that draws the mark');
  assert.ok(body.indexOf('site-seal') < body.indexOf('intro-text') && body.indexOf('intro-text') < body.indexOf('id="directory"'), 'the title and introduction come before the directory');
  assert.doesNotMatch(body, /<header\b|jwknt\.github\.io/i);
  assert.doesNotMatch(body, /class="(?:project-description|category-description|hero)"/);
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
  assert.ok(index.includes('base.css?v=20261108-justify'));
  assert.ok(index.includes('theme.js?v=20261009-reading-folio'));
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

test('Mathematics has an abstract category mark and plain Erdős and Cookie Clicker destinations', () => {
  const mathematics = categories.find(category => category.id === 'mathematics');
  assert.equal(mathematics.mark, 'continuum');
  assert.deepEqual(mathematics.pages, [
    { id: 'erdos1016', label: 'Erdős 1016', href: '/erdos1016/' },
    { id: 'forest-estimate', label: 'Forest Estimate', href: '/erdos1016/forest/' },
    { id: 'exact-maximums', label: 'Exact Maximums', href: '/erdos1016/exact-maximums/' },
    { id: 'ai-math', label: 'AI Math Results', href: '/ai-math/' },
    { id: 'cookie-clicker', label: 'Cookie Clicker', href: '/cookie-clicker/' },
  ]);
  assert.ok(!categories.find(category => category.id === 'translations').pages.some(page => page.id === 'erdos1016'));
  assert.match(index, /class="type-study study-continuum" aria-hidden="true"><svg class="continuum-study" aria-hidden="true" focusable="false"/);
  assert.match(index, /<li data-project="erdos1016"><a href="\/erdos1016\/">Erdős 1016<span class="link-point ui-link-arrow"/);
  // The two companion tours are pages of the Erdős site, so their addresses are below its address.
  assert.match(index, /<li data-project="forest-estimate"><a href="\/erdos1016\/forest\/">Forest Estimate<span class="link-point ui-link-arrow"/);
  assert.match(index, /<li data-project="exact-maximums"><a href="\/erdos1016\/exact-maximums\/">Exact Maximums<span class="link-point ui-link-arrow"/);
  assert.match(index, /<li data-project="cookie-clicker"><a href="\/cookie-clicker\/">Cookie Clicker<span class="link-point ui-link-arrow"/);
  assert.doesNotMatch(index.split('id="directory"')[1], /destination-symbol|graph-study|<circle/);
});

test('Agents groups agent guidance under an abstract spiral mark, apart from Tools', () => {
  const agents = categories.find(category => category.id === 'agents');
  assert.equal(agents.mark, 'spiral');
  const guidance = ['mtl-guide', 'style-library', 'skills', 'site-theme'];
  for (const id of guidance) assert.ok(agents.pages.some(page => page.id === id), `${id} is in Agents`);
  assert.ok(!categories.find(category => category.id === 'tools').pages.some(page => guidance.includes(page.id)));
  assert.match(index, /class="type-study study-spiral" aria-hidden="true"><svg class="spiral-study" aria-hidden="true" focusable="false"/);
  assert.match(index, /<span class="category-label">Agents<\/span>/);
});


test('Me comes first under an abstract mark and holds the personal pages', () => {
  const [first] = categories;
  assert.equal(first.id, 'me');
  assert.equal(first.label, 'Me');
  assert.equal(first.mark, 'whorl');
  assert.deepEqual(first.pages, [
    { id: 'profile', label: 'Profile', href: '/profile/' },
    { id: 'links', label: 'Links', href: '/links/' },
    { id: 'accounts', label: 'Accounts', href: '/accounts/' },
  ]);
  assert.match(index, /<nav class="directory"[^>]*>\s*<section class="atlas-category" data-category="me"/);
  assert.match(index, /class="type-study study-whorl" aria-hidden="true"><svg class="whorl-study" aria-hidden="true" focusable="false"/);
});

test('NGU Idle and Box Logic are games, and Gazetteer is a tool', () => {
  const owner = id => categories.find(category => category.pages.some(page => page.id === id)).id;
  assert.equal(owner('ngu-idle-dashboard'), 'games');
  assert.equal(owner('box-puzzles'), 'games');
  assert.equal(owner('gazetteer'), 'tools');
});

test('Translations holds the translated works, and Readers is a tool', () => {
  const translations = categories.find(category => category.id === 'translations');
  assert.equal(translations.label, 'Translations');
  assert.equal(translations.mark, 'parentheses');
  assert.deepEqual(translations.pages.map(page => page.id), ['albatross-koukairoku', 'black-sheep-town', 'omniscient-readers-viewpoint']);
  assert.deepEqual(categories.find(category => category.id === 'tools').pages.map(page => page.id), ['logical-solver', 'gazetteer', 'readers']);
  assert.ok(!categories.some(category => category.id === 'reading'));
  assert.match(index, /<span class="category-label">Translations<\/span>/);
  assert.doesNotMatch(index, /Reading/);
});

test('decorative studies keep their original font and fixed geometry', async () => {
  const css = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.glyph \{[^}]*font-family: 'Baskerville', 'Times New Roman', serif;/);
  assert.deepEqual(css.match(/--reading|Wrenfold/g), ['--reading'], 'only the introduction uses the reading face');
  assert.match(css, /\.intro-text \{[^}]*font: 1\.25rem\/1\.65 var\(--reading\);/);
  assert.match(css, /\.type-study \{[^}]*font-size: 16px;/);
  assert.match(css, /\.study-parentheses \.glyph \{ font-size: 128px;/);
  assert.match(index, /assets\/styles\.css\?v=20261108-search/);
  assert.match(index, /assets\/app\.js\?v=20261108-search/);
});

test('search opens directly under the search box, above the introduction', async () => {
  const css = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
  const body = index.split('<body>')[1];
  assert.match(body, /<\/span>\s*<\/div>\s*<section id="search-panel"[\s\S]*?<\/section>\s*<div class="site-intro">/, 'the filter and results follow the search box, not the introduction');
  assert.match(css, /\.search-panel \{ max-width: 58rem; margin: \.75rem 0 0; \}/);
  assert.doesNotMatch(css.match(/\.index-tools \{[^}]*\}/)[0], /margin/, 'the gap above the introduction belongs to the introduction');
  assert.match(css, /\.site-intro \{[^}]*margin: clamp\(1rem, 5vh, 3rem\) 0 clamp\(1\.75rem, 5vh, 3rem\);/);
});

test('the introduction covers the frame, indents its second paragraph and ends at one clear rule', async () => {
  const css = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.intro-text \{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /max-width/, 'the text covers the frame from the destination names to its right edge');
  // The mark hangs in the right page margin as far as that margin has room, less 1rem.
  assert.match(rule, /--human-mark-hang: clamp\(0px, max\(\(100vw - var\(--site-frame-page, 74rem\)\) \/ 2, var\(--site-frame-gutter, 2\.5rem\)\) - 1rem, var\(--human-mark-size\) \* 7 \/ 3\);/);
  assert.match(css, /\.intro-text p \+ p \{ text-indent: 2\.5em; \}/, 'a tab indent starts the second paragraph');
  // The landing page justifies by spacing alone: no hyphens at line ends.
  assert.match(css, /\.intro-text p \{ margin: 0; text-wrap: pretty; -webkit-hyphens: none; hyphens: none; \}/);
  assert.match(css, /\.intro-end, \.intro-keep \{ white-space: nowrap; \}/);
  assert.match(index, /<span class="intro-keep">work-in-progress<\/span>/);
  assert.match(css, /\.atlas-rule \{[^}]*border-top: 1px solid var\(--ink\);/);
  assert.match(css, /\.atlas-category:nth-child\(-n \+ 2\) \{ border-top-color: transparent; \}/, 'the rule replaces the faint rules of the first row');
  assert.match(css, /@media \(max-width: 38rem\) \{[\s\S]*?\.atlas-category:nth-child\(2\) \{ border-top-color: var\(--atlas-faint\); \}/, 'on one column the second category keeps its rule');
});
