export const marks = {
  parentheses: '<span class="glyph glyph-a">(</span><span class="glyph glyph-b">)</span><span class="glyph glyph-c">)</span><i></i>',
  constellation: '<span class="glyph glyph-a">∴</span><span class="glyph glyph-b">∴</span><i></i>',
  asterisk: '<span class="glyph glyph-a">[</span><span class="glyph glyph-b">*</span><span class="glyph glyph-c">]</span><i></i>',
  section: '<span class="glyph glyph-a">§</span><span class="glyph glyph-b">§</span><i></i>',
  chevrons: '<span class="glyph glyph-a">›</span><span class="glyph glyph-b">›</span><i></i>',
};

export const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function validateDirectory(categories) {
  const ids = new Set();
  const projects = new Set();
  const hrefs = new Set();
  if (!Array.isArray(categories) || !categories.length) throw new Error('Add at least one category');
  for (const category of categories) {
    if (!category || typeof category.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(category.id) || ids.has(category.id)) throw new Error('Duplicate or invalid category ID');
    if (typeof category.label !== 'string' || !category.label.trim() || typeof category.mark !== 'string' || !Object.hasOwn(marks, category.mark)) throw new Error(`Invalid category: ${category.id}`);
    if (!Array.isArray(category.pages) || !category.pages.length) throw new Error(`Empty category: ${category.id}`);
    ids.add(category.id);
    for (const page of category.pages) {
      const id = page?.id;
      if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id) || projects.has(id)) throw new Error('Duplicate or invalid page ID');
      if (typeof page.label !== 'string' || !page.label.trim() || typeof page.href !== 'string' || !/^\/(?!\/)[a-zA-Z0-9/_-]+\/$/.test(page.href) || hrefs.has(page.href)) throw new Error(`Invalid destination: ${page.id}`);
      projects.add(id); hrefs.add(page.href);
    }
  }
}

export function renderCategory(category) {
  return `        <section class="atlas-category" data-category="${escapeHtml(category.id)}" aria-labelledby="category-${escapeHtml(category.id)}">
          <h2 id="category-${escapeHtml(category.id)}" class="category-heading">
            <span class="type-study study-${category.mark}" aria-hidden="true">${marks[category.mark]}</span>
            <span class="category-label">${escapeHtml(category.label)}</span>
          </h2>
          <ul class="page-links">
${category.pages.map(page => `            <li data-project="${escapeHtml(page.id)}"><a href="${escapeHtml(page.href)}">${escapeHtml(page.label)}<span class="link-point" aria-hidden="true"></span></a></li>`).join('\n')}
          </ul>
        </section>`;
}

export function renderDirectory(categories) {
  validateDirectory(categories);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(categories.map(category => category.label).join(', '))} at jehlp.net.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="jehlp.net">
    <meta property="og:url" content="https://jehlp.net/">
    <meta property="og:site_name" content="jehlp.net">
    <meta name="theme-color" content="#fbfaf7">
    <link rel="canonical" href="https://jehlp.net/">
    <title>jehlp.net</title>
    <link rel="icon" href="https://jehlp.net/site-theme/v2/favicons/home.png" type="image/png">
    <script src="https://jehlp.net/site-theme/v2/theme.js?v=20260930-header-home"></script>
    <link rel="stylesheet" href="https://jehlp.net/site-theme/v2/base.css?v=20261001-utilities">
    <link rel="stylesheet" href="assets/styles.css?v=20261001-utilities">
    <script src="assets/app.js?v=20260930-search-back" type="module"></script>
  </head>
  <body>
    <a class="skip-link" href="#directory">Skip to pages</a>
    <main class="atlas">
      <div class="index-tools">
        <form class="page-search" role="search" hidden>
          <label class="sr-only" for="page-query">Search all sites</label>
          <input id="page-query" type="search" autocomplete="off" placeholder="Search all sites" aria-controls="search-results" aria-describedby="search-hint" enterkeyhint="search">
        </form>
        <span class="site-utility-pair"><button class="search-toggle site-search" type="button" aria-label="Search all sites" aria-expanded="false" aria-controls="page-query search-panel" title="Search all sites (/)" hidden><span aria-hidden="true">/</span></button><a class="site-home" href="https://jehlp.net/" aria-label="Home — jehlp.net" title="Home — jehlp.net"><span aria-hidden="true">✳</span></a><button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark theme" aria-pressed="false">◐</button></span>
      </div>
      <section id="search-panel" class="search-panel" aria-label="Site search results" aria-busy="false" hidden>
        <div class="search-options">
          <label for="search-site">Search in</label>
          <select id="search-site"><option value="">All sites</option>${categories.flatMap(category => category.pages).map(page => `<option value="${escapeHtml(page.label)}">${escapeHtml(page.label)}</option>`).join('')}</select>
        </div>
        <p id="search-hint" class="search-hint">Search pages, chapters and text across the sites. Put a phrase in quotes for an exact match.</p>
        <p id="page-status" class="search-status" role="status" aria-live="polite" aria-atomic="true"></p>
        <ol id="search-results" class="search-results"></ol>
        <button id="search-more" type="button" hidden>Show more results</button>
        <button id="search-retry" type="button" hidden>Try again</button>
      </section>
      <nav class="directory" id="directory" aria-label="Pages" tabindex="-1">
${categories.map(renderCategory).join('\n')}
      </nav>
    </main>
  </body>
</html>
`;
}
