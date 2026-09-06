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
