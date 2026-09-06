import { discoverPages } from './discovery.mjs';

const categories = () => [...document.querySelectorAll('.atlas-category')];
const toggle = document.querySelector('.search-toggle');
const search = document.querySelector('.page-search');
const input = document.querySelector('#page-query');
const status = document.querySelector('#page-status');
const empty = document.querySelector('.empty-result');
const priorOpen = new Map();
let filtering = false;

function filterPages() {
  const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length && !filtering) {
    categories().forEach(group => priorOpen.set(group, group.open));
    filtering = true;
  }
  let found = 0;
  for (const group of categories()) {
    const label = group.querySelector('.category-label').textContent;
    let matches = 0;
    for (const page of group.querySelectorAll('[data-project]')) {
      const text = `${label} ${page.textContent}`.toLocaleLowerCase();
      page.hidden = !terms.every(term => text.includes(term));
      if (!page.hidden) matches++;
    }
    group.hidden = matches === 0;
    if (terms.length && matches) group.open = true;
    else if (!terms.length && filtering) group.open = priorOpen.get(group) ?? false;
    found += matches;
  }
  if (!terms.length) { filtering = false; priorOpen.clear(); }
  empty.hidden = !terms.length || found > 0;
  status.textContent = terms.length ? `${found} matching ${found === 1 ? 'page' : 'pages'}.` : '';
}

function openSearch() {
  search.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  input.focus();
}
function closeSearch() {
  input.value = '';
  filterPages();
  search.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.focus();
}

toggle.hidden = false;
toggle.addEventListener('click', () => search.hidden ? openSearch() : closeSearch());
input.addEventListener('input', filterPages);
search.addEventListener('submit', event => event.preventDefault());
document.addEventListener('keydown', event => {
  const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); openSearch();
  } else if (event.key === 'Escape' && !search.hidden) {
    event.preventDefault(); closeSearch();
  }
});

const known = [...document.querySelectorAll('[data-project]')].map(page => page.dataset.project);
discoverPages(fetch, known).then(pages => {
  const other = document.querySelector('#other-projects');
  const list = document.querySelector('#other-project-list');
  for (const page of pages) {
    const item = document.createElement('li');
    item.dataset.project = page.id;
    const link = document.createElement('a');
    link.href = page.href;
    link.textContent = page.label;
    const point = document.createElement('span');
    point.className = 'link-point';
    point.setAttribute('aria-hidden', 'true');
    point.textContent = '↗';
    link.append(point);
    item.append(link);
    list.append(item);
  }
  other.hidden = pages.length === 0;
  if (filtering) { priorOpen.set(other, other.open); filterPages(); }
}).catch(() => {
  // Offline or rate-limited: the authored directory remains fully usable.
});
