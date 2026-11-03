import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderAccountsPage, validateAccounts } from '../lib/accounts.mjs';

const accounts = JSON.parse(await readFile(new URL('../data/accounts.json', import.meta.url), 'utf8'));
const page = await readFile(new URL('../accounts/index.html', import.meta.url), 'utf8');
const fixture = () => [
  { site: 'Example', handle: 'me', kind: 'Lists', href: 'https://example.com/me' },
  { site: 'Other', href: 'https://other.example/u/1?tab=a&b=c' },
];

test('the accounts page is the deterministic build of the authored list', () => {
  assert.equal(page, renderAccountsPage(accounts), 'Run node build.mjs after changing data/accounts.json.');
  assert.deepEqual([...page.matchAll(/<a class="account-site" href="([^"]+)" rel="me">/g)].map(m => m[1].replaceAll('&amp;', '&')), accounts.map(a => a.href));
});

test('every account is a labelled same-person link with optional handle and kind', () => {
  const html = renderAccountsPage(fixture());
  assert.match(html, /<li><a class="account-site" href="https:\/\/example\.com\/me" rel="me">Example<span class="ui-link-arrow" aria-hidden="true"><\/span><\/a><span class="account-handle">me<\/span><span class="account-kind">Lists<\/span><\/li>/);
  assert.match(html, /<li><a class="account-site" href="https:\/\/other\.example\/u\/1\?tab=a&amp;b=c" rel="me">Other<span class="ui-link-arrow" aria-hidden="true"><\/span><\/a><\/li>/);
  assert.match(html, /<meta name="description" content="jehlp on Example, Other\.">/);
});

test('names are escaped and unsafe or repeated links are rejected', () => {
  const html = renderAccountsPage([{ site: '<img src=x onerror="alert(1)">', handle: '<b>', href: 'https://x.example/"onmouseover="y' }]);
  assert.doesNotMatch(html, /<img src=x|<b>|"onmouseover="/);
  for (const bad of [null, [], [{ href: 'https://x.example/' }], [{ site: 'A', href: 'http://x.example/' }], [{ site: 'A', href: 'javascript:alert(1)' }], [{ site: 'A', href: 'https://user:pass@x.example/' }], [{ site: 'A', href: 'https://x.example/', handle: ' ' }], [{ site: 'A', href: 'https://x.example/' }, { site: 'B', href: 'https://x.example/' }]]) {
    assert.throws(() => validateAccounts(bad));
  }
});

test('the page keeps the shared frame, the homepage identity and its canonical route', async () => {
  assert.match(page, /<link rel="canonical" href="https:\/\/jehlp\.net\/accounts\/">/);
  assert.match(page, /<title>Accounts · jehlp\.net<\/title>/);
  assert.match(page, /<a class="skip-link" href="#accounts">Skip to accounts<\/a>/);
  assert.match(page, /<img class="site-mark" src="https:\/\/jehlp\.net\/site-theme\/v2\/marks\/home\.png" width="32" height="32" alt=""><h1 class="site-title">Accounts<\/h1>/);
  assert.match(page, /<span class="site-utility-pair"><a class="site-home" href="https:\/\/jehlp\.net\/"[^>]*>[\s\S]*?<\/a><button class="theme-toggle" type="button" data-theme-toggle/);
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const asset of ['theme\\.js', 'base\\.css']) assert.equal(page.match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1], index.match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1]);
  assert.equal((page.match(/<script\b/g) || []).length, 1, 'Only the shared theme controller runs.');
});

test('the release artifact and its verifier include the accounts page', async () => {
  const build = await readFile(new URL('../tools/build-search.mjs', import.meta.url), 'utf8');
  assert.match(build, /for \(const file of \[[^\]]*'accounts'[^\]]*\]\) await cp/);
  const verify = await readFile(new URL('../tools/verify-search-artifact.mjs', import.meta.url), 'utf8');
  assert.match(verify, /_site\/accounts\/index\.html/);
});
