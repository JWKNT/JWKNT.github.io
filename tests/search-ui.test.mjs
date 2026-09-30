import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { normalizeQuery, safeResultURL, excerptParts } from '../assets/search-view.mjs';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = (await readFile(new URL('../assets/app.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/, '')
  .replace("import('../pagefind/pagefind.js')", 'window.loadTestModule()');
const settle = () => new Promise(resolve => setTimeout(resolve, 25));
const result = (title = 'Rare result', url = '/readers/the-cat/#story/p-021') => ({
  data: async () => ({ url, meta: { title, site: 'Readers' }, excerpt: 'A <mark>rare</mark> body passage &amp; a safe &lt;img onerror=evil&gt;.' }),
});
function setup(search) {
  const dom = new JSDOM(html, { url: 'https://jehlp.net/', runScripts: 'outside-only' });
  const window = dom.window;
  Object.assign(window, { normalizeQuery, safeResultURL, excerptParts });
  window.loadTestModule = async () => ({ createInstance: () => ({ init: async () => {}, destroy: async () => {}, mergeIndex: async () => {}, search }) });
  window.eval(source);
  const document = window.document;
  const $ = selector => document.querySelector(selector);
  const submit = value => { $('#page-query').value = value; $('.page-search').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); };
  return { dom, window, document, $, submit };
}

test('Slash/Escape, empty state and focus restoration preserve directory disclosures', async () => {
  const t = setup(async () => ({ results: [result()] }));
  try {
    t.$('.atlas-category').open = false;
    t.document.body.dispatchEvent(new t.window.KeyboardEvent('keydown', { key: '/', bubbles: true }));
    assert.equal(t.document.activeElement.id, 'page-query');
    assert.equal(t.$('#search-panel').hidden, false);
    t.submit(''); await settle();
    assert.equal(t.$('#directory').hidden, false);
    t.submit('rare'); await settle();
    assert.equal(t.$('#search-results a').getAttribute('href'), '/readers/the-cat/#story/p-021');
    assert.equal(t.$('#search-results img'), null);
    assert.match(t.$('#search-results').textContent, /<img onerror=evil>/);
    t.$('#page-query').dispatchEvent(new t.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.equal(t.document.activeElement, t.$('#search-results a'));
    t.document.activeElement.dispatchEvent(new t.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(t.$('#search-panel').hidden, true);
    assert.equal(t.$('#directory').hidden, false);
    assert.equal(t.$('.atlas-category').open, false);
    assert.equal(t.document.activeElement, t.$('.search-toggle'));
  } finally { t.dom.window.close(); }
});
test('loading and no-results states are distinct and filters reach the engine', async () => {
  let finish, options;
  const t = setup(async (_, opts) => { options = opts; return new Promise(resolve => { finish = resolve; }); });
  try {
    t.$('.search-toggle').click(); t.$('#search-site').value = 'Readers'; t.submit('nonexistent'); await settle();
    assert.match(t.$('#page-status').textContent, /Searching/);
    assert.equal(t.$('#search-panel').getAttribute('aria-busy'), 'true');
    assert.equal(options.filters.site, 'Readers');
    finish({ results: [] }); await settle();
    assert.match(t.$('#page-status').textContent, /No results.*in Readers/);
    assert.equal(t.$('#search-panel').getAttribute('aria-busy'), 'false');
  } finally { t.dom.window.close(); }
});
test('network failure provides a working fresh-engine retry', async () => {
  let instances = 0;
  const t = setup(async () => ({ results: [] }));
  try {
    t.window.loadTestModule = async () => ({ createInstance: () => {
      const id = ++instances;
      return { init: async () => {}, destroy: async () => {}, mergeIndex: async () => {}, search: async () => {
        if (id === 1) throw new Error('Network failed');
        return { results: [result()] };
      } };
    } });
    t.$('.search-toggle').click(); t.submit('rare'); await settle();
    assert.match(t.$('#page-status').textContent, /could not load/);
    assert.equal(t.$('#search-retry').hidden, false);
    assert.equal(t.$('#directory').hidden, false);
    t.$('#search-retry').click(); await settle();
    assert.equal(instances, 2);
    assert.equal(t.$('#search-results').children.length, 1);
  } finally { t.dom.window.close(); }
});
test('new query and close invalidate stale async results', async () => {
  let finishOld;
  const t = setup(async query => query === 'old' ? new Promise(resolve => { finishOld = resolve; }) : ({ results: [result('Newest')] }));
  try {
    t.$('.search-toggle').click(); t.submit('old'); await settle();
    t.submit('new'); await settle();
    finishOld({ results: [result('Stale')] }); await settle();
    assert.equal(t.$('#search-results a').textContent, 'Newest');
    t.submit('old'); await settle(); t.$('.search-toggle').click();
    finishOld({ results: [result('Stale')] }); await settle();
    assert.equal(t.$('#search-panel').hidden, true);
    assert.equal(t.$('#search-results').children.length, 0);
    assert.equal(t.document.activeElement, t.$('.search-toggle'));
  } finally { t.dom.window.close(); }
});
test('pagination bounds rendered results and moves keyboard focus to newly loaded results', async () => {
  const t = setup(async () => ({ results: Array.from({ length: 14 }, (_, i) => result(`Result ${i}`)) }));
  try {
    t.$('.search-toggle').click(); t.submit('many'); await settle();
    assert.equal(t.$('#search-results').children.length, 12);
    assert.equal(t.$('#search-more').hidden, false);
    t.$('#search-more').click(); await settle();
    assert.equal(t.$('#search-results').children.length, 14);
    assert.equal(t.document.activeElement.textContent, 'Result 12');
    assert.equal(t.$('#search-more').hidden, true);
  } finally { t.dom.window.close(); }
});
