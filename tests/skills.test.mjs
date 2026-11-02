import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { catalogSkills, parseSkill, renderInline, renderMarkdown, renderSkillsPage, sharedSections, skillSource } from '../lib/skills.mjs';

const page = await readFile(new URL('../skills/index.html', import.meta.url), 'utf8');
const shared = '## Original technical writing\n\nFor original prose, use `jehlp-technical-writing`.\nApply ASD-STE100 Issue 9.';
const skill = (name, body, description = `Use ${name}.`) => `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n\n${body}\n`;
// Fixed fixtures: the published skill set changes without editing these tests.
const fixtures = () => [
  parseSkill(skill('jehlp-alpha', `Read the first file.\nWrap this line.\n\n${shared}`), 'jehlp-alpha'),
  parseSkill(skill('jehlp-beta', `Run node --test tests/*.test.mjs.\n\n### Detail\n\n- One\n- Two\n\n${shared}`), 'jehlp-beta'),
  parseSkill(skill('jehlp-gamma', 'Write short sentences.'), 'jehlp-gamma'),
];

test('the catalog supplies the ordered list of published skills', () => {
  const catalog = '| [`b-two`](skills/b-two/SKILL.md) | Two |\n| [`a-one`](./skills/a-one/SKILL.md) | One |\n[again](skills/b-two/SKILL.md)';
  assert.deepEqual(catalogSkills(catalog), ['b-two', 'a-one']);
  assert.throws(() => catalogSkills('# No skills'), /lists no skills/);
  for (const name of ['..', 'UPPER', 'a_b', '-x']) assert.throws(() => catalogSkills(`[x](skills/${name}/SKILL.md)`), /Invalid skill name/);
});

test('skill front matter and the repeated title are read from the source', () => {
  const parsed = parseSkill(skill('jehlp-alpha', 'Body text.', 'Say \\"exactly\\" this'), 'jehlp-alpha');
  assert.equal(parsed.description, 'Say "exactly" this');
  assert.deepEqual(parsed.sections, [{ heading: null, markdown: 'Body text.' }]);
  assert.equal(parseSkill('---\nname: x-y\ndescription: Plain text: with a colon\n---\nBody', 'x-y').description, 'Plain text: with a colon');
  assert.equal(parseSkill('---\nname: x-y\ndescription: >\n  Folded\n  words\n---\nBody', 'x-y').description, 'Folded words');
  assert.match(parseSkill('---\nname: x-y\ndescription: d\n---\n# Different title\n\nBody', 'x-y').sections[0].markdown, /^# Different title/);
  assert.throws(() => parseSkill('# x-y\n\nNo front matter', 'x-y'), /no front matter/);
  assert.throws(() => parseSkill('---\nname: other\ndescription: d\n---\n', 'x-y'), /declares the name/);
  assert.throws(() => parseSkill('---\nname: x-y\n---\n', 'x-y'), /no description/);
});

test('Markdown renders as escaped text with a small safe subset', () => {
  assert.equal(renderMarkdown('One\nline.\n\nTwo.'), '<p>One line.</p>\n<p>Two.</p>');
  assert.equal(renderInline('Use `a <b>` and tests/*.test.mjs *here*'), 'Use <code>a &lt;b&gt;</code> and tests/*.test.mjs *here*');
  assert.equal(renderInline('<script>alert("x")</script> & **bold**'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; <strong>bold</strong>');
  assert.equal(renderMarkdown('- a\n- b\n\n1. c'), '<ul><li>a</li><li>b</li></ul>\n<ol><li>c</li></ol>');
  assert.equal(renderMarkdown('```\n<x> & y\n```'), '<pre><code>&lt;x&gt; &amp; y</code></pre>');
  assert.equal(renderMarkdown('# Top\n### Deep'), '<h3>Top</h3>\n<h4>Deep</h4>');
  const base = skillSource('jehlp-alpha');
  assert.equal(renderInline('[style](../../docs/WRITING-STYLE.md)', base), '<a href="https://jehlp.net/site-theme/docs/WRITING-STYLE.md">style</a>');
  assert.equal(renderInline('[x](javascript:alert(1))', base), '[x](javascript:alert(1))');
  assert.equal(renderInline('[x](javascript:void)', base), '[x](javascript:void)');
});

test('a section repeated word for word renders once, with a link from each skill', () => {
  const skills = fixtures();
  const common = sharedSections(skills);
  assert.equal(common.length, 1);
  assert.equal(common[0].id, 'shared-original-technical-writing');
  assert.deepEqual(common[0].skills, ['jehlp-alpha', 'jehlp-beta']);
  const html = renderSkillsPage(skills);
  assert.equal((html.match(/Apply ASD-STE100 Issue 9\./g) || []).length, 1);
  assert.equal((html.match(/class="skill-shared-ref">Shared section: <a href="#shared-original-technical-writing">/g) || []).length, 2);
  assert.match(html, /<p class="skill-description">Shared section in 2 of 3 skills\.<\/p>/);
  assert.match(html, /<h4>Detail<\/h4>\n<ul><li>One<\/li><li>Two<\/li><\/ul>/);
  // A different body under the same heading is not shared.
  skills[1].sections.at(-1).markdown += ' Extra.';
  assert.equal(sharedSections(skills).length, 0);
});

test('the page lists every skill in catalog order with its source and contents link', () => {
  const html = renderSkillsPage(fixtures());
  assert.deepEqual([...html.matchAll(/<article class="skill" id="([^"]+)"/g)].map(match => match[1]), ['jehlp-alpha', 'jehlp-beta', 'jehlp-gamma']);
  for (const name of ['jehlp-alpha', 'jehlp-beta', 'jehlp-gamma']) {
    assert.ok(html.includes(`<li><a href="#${name}"><span class="skill-prefix">jehlp-</span>${name.slice(6)}</a></li>`));
    assert.ok(html.includes(`href="https://jehlp.net/site-theme/skills/${name}/SKILL.md" aria-label="Markdown source of ${name}">Markdown`));
  }
  assert.match(html, /<p class="skill-description">Use jehlp-alpha\.<\/p>/);
  assert.match(html, /<p>Read the first file\. Wrap this line\.<\/p>/);
  assert.doesNotMatch(html, /<h[1-6][^>]*># jehlp/);
  assert.match(html, /<p class="skills-meta">3 skills · /);
  assert.equal(renderSkillsPage(fixtures()), html, 'Rendering is deterministic.');
});

test('skill names and descriptions are escaped and invalid sets are rejected', () => {
  const [alpha] = fixtures();
  const html = renderSkillsPage([{ ...alpha, description: '<img src=x onerror="alert(1)"> & more' }]);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; more/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.throws(() => renderSkillsPage([]), /at least one skill/);
  assert.throws(() => renderSkillsPage([alpha, alpha]), /Duplicate or invalid skill name/);
  assert.throws(() => renderSkillsPage([{ ...alpha, name: 'a" onclick="x' }]), /Duplicate or invalid skill name/);
  assert.throws(() => renderSkillsPage([{ ...alpha, description: ' ' }]), /Invalid skill/);
});

test('the published page keeps the shared frame, identity and canonical route', async () => {
  assert.match(page, /<link rel="canonical" href="https:\/\/jehlp\.net\/skills\/">/);
  assert.match(page, /<title>Skills · jehlp\.net<\/title>/);
  assert.match(page, /<a class="skip-link" href="#skills">Skip to skills<\/a>/);
  assert.match(page, /<main id="skills" class="skills-shell" tabindex="-1">/);
  assert.match(page, /<img class="site-mark" src="https:\/\/jehlp\.net\/site-theme\/v2\/marks\/site-theme\.png" width="32" height="32" alt=""><h1 class="site-title">Skills<\/h1>/);
  assert.match(page, /<span class="site-utility-pair"><a class="site-home" href="https:\/\/jehlp\.net\/" aria-label="Home — jehlp\.net"[^>]*>[\s\S]*?<\/a><button class="theme-toggle" type="button" data-theme-toggle/);
  assert.match(page, /<link rel="stylesheet" href="\.\.\/assets\/skills\.css\?v=[\w-]+">/);
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const asset of ['theme.js', 'base.css']) assert.equal(page.match(new RegExp(`${asset.replace('.', '\\.')}\\?v=([\\w-]+)`))[1], index.match(new RegExp(`${asset.replace('.', '\\.')}\\?v=([\\w-]+)`))[1], `${asset} matches the homepage release`);
  assert.equal((page.match(/<script\b/g) || []).length, 1, 'Only the shared theme controller runs.');
  const ids = new Set([...page.matchAll(/ id="([^"]+)"/g)].map(match => match[1]));
  assert.ok([...page.matchAll(/<article class="skill" id=/g)].length >= 1);
  for (const [, target] of page.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target} exists`);
});

test('the release artifact and its verifier include the skills page', async () => {
  const build = await readFile(new URL('../tools/build-search.mjs', import.meta.url), 'utf8');
  assert.match(build, /for \(const file of \[[^\]]*'skills'[^\]]*\]\) await cp/);
  const verify = await readFile(new URL('../tools/verify-search-artifact.mjs', import.meta.url), 'utf8');
  assert.match(verify, /_site\/skills\/index\.html/);
  const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  assert.match(scripts['build:site'], /node tools\/build-skills\.mjs && node tools\/build-search\.mjs/);
});
