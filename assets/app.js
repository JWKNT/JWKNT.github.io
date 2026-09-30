import { normalizeQuery, safeResultURL, excerptParts } from './search-view.mjs';

const toggle = document.querySelector('.search-toggle');
const form = document.querySelector('.page-search');
const input = document.querySelector('#page-query');
const status = document.querySelector('#page-status');
const directory = document.querySelector('#directory');
const panel = document.querySelector('#search-panel');
const list = document.querySelector('#search-results');
const siteSelect = document.querySelector('#search-site');
const more = document.querySelector('#search-more');
const retry = document.querySelector('#search-retry');
const hint = document.querySelector('#search-hint');
const PAGE_SIZE = 12;
let enginePromises = new Map(), sequence = 0, timer, matches = [], shown = 0, busy = false;

function loadEngine(query) {
  const language = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(query) ? 'ja' : 'en';
  if (!enginePromises.has(language)) {
    const promise = import('../pagefind/pagefind.js').then(async module => {
      const engine = module.createInstance({ basePath: language === 'ja' ? '/pagefind-ja/' : '/pagefind/', baseUrl: '/', excerptLength: 38, metaCacheTag: String(Date.now()), ranking: { metaWeights: { title: 5, site: 2 } } });
      await engine.init();
      return engine;
    }).catch(error => { enginePromises.delete(language); throw error; });
    enginePromises.set(language, promise);
  }
  return enginePromises.get(language);
}
function setBusy(value) {
  busy = value;
  panel.setAttribute('aria-busy', String(value));
  more.disabled = value;
}
function idle() {
  sequence++;
  clearTimeout(timer);
  matches = []; shown = 0;
  list.replaceChildren(); more.hidden = true; retry.hidden = true;
  status.textContent = ''; setBusy(false);
  directory.hidden = false;
  hint.hidden = false;
}
function openSearch() {
  form.hidden = false; panel.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  input.focus();
}
function closeSearch() {
  input.value = ''; siteSelect.value = ''; idle();
  form.hidden = true; panel.hidden = true;
  toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
}
function excerpt(html) {
  const p = document.createElement('p'); p.className = 'search-excerpt';
  let target = p;
  for (const part of excerptParts(html)) {
    if (part.marker) {
      if (part.text.toLowerCase() === '<mark>') { target = document.createElement('mark'); p.append(target); }
      else target = p;
    } else {
      // Decode character references without parsing result-provided elements.
      const area = document.createElement('textarea');
      area.innerHTML = part.text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      target.append(document.createTextNode(area.value));
    }
  }
  return p;
}
function resultRow(result) {
  const path = safeResultURL(result.url, location.origin);
  if (!path) return null;
  const li = document.createElement('li');
  const a = document.createElement('a'); a.href = path; a.className = 'search-result-link';
  a.textContent = result.meta.title || path;
  const meta = document.createElement('p'); meta.className = 'search-result-site'; meta.textContent = result.meta.site || '';
  li.append(meta, a, excerpt(result.excerpt));
  return li;
}
async function showNext(token = sequence) {
  const start = shown;
  setBusy(true); retry.hidden = true;
  try {
    const data = await Promise.all(matches.slice(start, start + PAGE_SIZE).map(match => match.data()));
    if (token !== sequence) return;
    for (const result of data) { const row = resultRow(result); if (row) list.append(row); }
    shown += data.length;
    status.textContent = `${matches.length.toLocaleString()} ${matches.length === 1 ? 'result' : 'results'}${siteSelect.value ? ' in ' + siteSelect.value : ''}. Showing ${shown.toLocaleString()}.`;
    more.hidden = shown >= matches.length;
  } catch (error) {
    if (token !== sequence) return;
    status.textContent = 'Some results could not load. Check your connection and try again.';
    retry.hidden = false;
  } finally { if (token === sequence) setBusy(false); }
}
async function runSearch() {
  clearTimeout(timer);
  const query = normalizeQuery(input.value);
  if (!query) { idle(); return; }
  const token = ++sequence;
  matches = []; shown = 0;
  list.replaceChildren(); more.hidden = true; retry.hidden = true; hint.hidden = true;
  directory.hidden = true; setBusy(true); status.textContent = 'Searching all sites…';
  try {
    const engine = await loadEngine(query);
    if (token !== sequence) return;
    const result = await engine.search(query, siteSelect.value ? { filters: { site: siteSelect.value } } : {});
    if (token !== sequence) return;
    matches = result.results;
    if (!matches.length) {
      status.textContent = `No results for “${query}”${siteSelect.value ? ' in ' + siteSelect.value : ''}. Try fewer words or another site.`;
      setBusy(false); return;
    }
    await showNext(token);
  } catch (error) {
    if (token !== sequence) return;
    status.textContent = 'Search could not load. Check your connection and try again.';
    retry.hidden = false; directory.hidden = false; setBusy(false);
  }
}

// Native links/disclosures remain usable if scripts or the search index fail.
toggle.hidden = false;
toggle.addEventListener('click', () => form.hidden ? openSearch() : closeSearch());
input.addEventListener('input', () => {
  sequence++; clearTimeout(timer); more.hidden = true; retry.hidden = true;
  if (!normalizeQuery(input.value)) { idle(); return; }
  // Do not leave stale results clickable while a newer query is being typed.
  list.replaceChildren(); status.textContent = 'Searching all sites…';
  timer = setTimeout(runSearch, 180);
});
siteSelect.addEventListener('change', runSearch);
form.addEventListener('submit', event => { event.preventDefault(); runSearch(); });
more.addEventListener('click', async () => {
  if (busy) return;
  const previous = shown, token = sequence;
  await showNext(token);
  if (token === sequence) list.children[previous]?.querySelector('a')?.focus();
});
retry.addEventListener('click', () => {
  // Pagefind caches rejected fragment promises. A retry needs a fresh instance
  // and metadata, including when a deployment replaced old content-hash files.
  for (const promise of enginePromises.values()) promise.then(engine => engine.destroy()).catch(() => {});
  enginePromises.clear();
  runSearch();
});
document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); openSearch();
  } else if (event.key === 'Escape' && !form.hidden) {
    event.preventDefault(); closeSearch();
  } else if (event.key === 'ArrowDown' && event.target === input && list.firstElementChild) {
    event.preventDefault(); list.querySelector('a')?.focus();
  }
});
