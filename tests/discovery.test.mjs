import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverPages } from '../assets/discovery.mjs';

const repository = (name, extra = {}) => ({ name, has_pages: true, archived: false, ...extra });
const response = (value, extra = {}) => ({ ok: true, status: 200, json: async () => value, ...extra });
function paginatedFetcher(pages) {
  const calls = [];
  const fetcher = async (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(url.pathname, '/users/JWKNT/repos');
    assert.equal(url.searchParams.get('per_page'), '100');
    assert.equal(url.searchParams.get('sort'), 'full_name');
    assert.equal(Number(url.searchParams.get('page')), calls.length + 1);
    assert.ok(options.signal instanceof AbortSignal);
    calls.push({ url, options });
    assert.notEqual(pages[calls.length - 1], undefined, 'Must stop after the last short page.');
    return response(pages[calls.length - 1]);
  };
  return { calls, fetcher };
}

test('discovery paginates beyond 100 repositories and deduplicates case-insensitively', async () => {
  const first = [repository('zeta-page'), repository('KNOWN-page'), repository('JwKnT.GITHUB.io'), repository('SITE-THEME')];
  while (first.length < 100) first.push(repository(`unused-${first.length}`, { has_pages: false }));
  const second = [repository('alpha_notes'), repository('ZETA-PAGE'), repository('Archived', { archived: true })];
  const { calls, fetcher } = paginatedFetcher([first, second]);
  assert.deepEqual(await discoverPages(fetcher, ['known-PAGE']), [
    { id: 'alpha_notes', label: 'Alpha Notes', href: 'https://jehlp.net/alpha_notes/' },
    { id: 'zeta-page', label: 'Zeta Page', href: 'https://jehlp.net/zeta-page/' },
  ]);
  assert.equal(calls.length, 2);
});

test('only active Pages repositories become trusted-origin links; untrusted metadata is ignored', async () => {
  const rows = [
    repository('safe-page', { homepage: 'javascript:alert(1)', html_url: 'https://evil.example/', description: '<script>bad</script>' }),
    repository('MixedCase.v2'), repository('no-pages', { has_pages: false }), repository('old-pages', { archived: true }),
    null, {},
    ...['', '../escape', '/absolute', '//evil.example', 'javascript:alert(1)', '<img>', 'space name', '_leading', 'a?query', 'a#fragment', 'a%2fescape', 'a\\escape'].map(name => repository(name)),
  ];
  const { fetcher } = paginatedFetcher([rows]);
  const result = await discoverPages(fetcher, []);
  assert.deepEqual(result.map(page => page.id).sort(), ['mixedcase.v2', 'safe-page']);
  assert.deepEqual(result.find(page => page.id === 'safe-page'), { id: 'safe-page', label: 'Safe Page', href: 'https://jehlp.net/safe-page/' });
  assert.equal(result.find(page => page.id === 'mixedcase.v2').href, 'https://jehlp.net/MixedCase.v2/');
  for (const page of result) {
    assert.equal(new URL(page.href).origin, 'https://jehlp.net');
    assert.deepEqual(Object.keys(page).sort(), ['href', 'id', 'label']);
    assert.doesNotMatch(page.label, /<|javascript:|evil\.example/);
  }
});

test('an empty API page stops discovery', async () => {
  const { calls, fetcher } = paginatedFetcher([[]]);
  assert.deepEqual(await discoverPages(fetcher, []), []);
  assert.equal(calls.length, 1);
});

test('maximum page count bounds work even when every response is full', async () => {
  const full = Array.from({ length: 100 }, (_, i) => repository(`page-${i}`));
  const { calls, fetcher } = paginatedFetcher([full, full]);
  assert.equal((await discoverPages(fetcher, [], { maxPages: 2 })).length, 100);
  assert.equal(calls.length, 2);
});

test('a caller-supplied abort signal is forwarded unchanged', async () => {
  const controller = new AbortController();
  const { calls, fetcher } = paginatedFetcher([[]]);
  await discoverPages(fetcher, [], { signal: controller.signal });
  assert.equal(calls[0].options.signal, controller.signal);
});

test('HTTP, malformed JSON shape and network failures reject so the caller can preserve static fallback', async () => {
  await assert.rejects(() => discoverPages(async () => response([], { ok: false, status: 403 }), []));
  for (const value of [null, {}, 'not repositories']) await assert.rejects(() => discoverPages(async () => response(value), []));
  const offline = new Error('offline');
  await assert.rejects(() => discoverPages(async () => { throw offline; }, []), error => error === offline);
});

test('a failed later page rejects instead of claiming partial discovery is complete', async () => {
  let calls = 0;
  const first = Array.from({ length: 100 }, (_, i) => repository(`page-${i}`));
  await assert.rejects(() => discoverPages(async () => {
    calls += 1;
    return calls === 1 ? response(first) : response([], { ok: false, status: 503 });
  }, []));
  assert.equal(calls, 2);
});
