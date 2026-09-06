export const marks = {
  parentheses: '<span class="glyph glyph-a">(</span><span class="glyph glyph-b">)</span><span class="glyph glyph-c">)</span><i></i>',
  constellation: '<span class="glyph glyph-a">∴</span><span class="glyph glyph-b">∴</span><i></i>',
  asterisk: '<span class="glyph glyph-a">[</span><span class="glyph glyph-b">*</span><span class="glyph glyph-c">]</span><i></i>',
  section: '<span class="glyph glyph-a">§</span><span class="glyph glyph-b">§</span><i></i>',
};

export const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function validateDirectory(categories) {
  const ids = new Set(['other']);
  const projects = new Set();
  const hrefs = new Set();
  if (!Array.isArray(categories) || !categories.length) throw new Error('Add at least one category');
  for (const category of categories) {
    if (!category || typeof category.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(category.id) || ids.has(category.id)) throw new Error('Duplicate or invalid category ID');
    if (typeof category.label !== 'string' || !category.label.trim() || typeof category.mark !== 'string' || !Object.hasOwn(marks, category.mark) || typeof category.open !== 'boolean') throw new Error(`Invalid category: ${category.id}`);
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
  return `        <details class="atlas-category" data-category="${escapeHtml(category.id)}"${category.open ? ' open' : ''}>
          <summary>
            <span class="type-study study-${category.mark}" aria-hidden="true">${marks[category.mark]}</span>
            <span class="category-label">${escapeHtml(category.label)}</span><span class="fold" aria-hidden="true"></span>
          </summary>
          <ul class="page-links">
${category.pages.map(page => `            <li data-project="${escapeHtml(page.id)}"><a href="${escapeHtml(page.href)}">${escapeHtml(page.label)}<span class="link-point" aria-hidden="true">↗</span></a></li>`).join('\n')}
          </ul>
        </details>`;
}

export function renderDirectory(categories) {
  validateDirectory(categories);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Reading, data, tools, and writing at jehlp.net.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="jehlp.net">
    <meta property="og:url" content="https://jehlp.net/">
    <meta property="og:site_name" content="jehlp.net">
    <meta name="theme-color" content="#fbfaf7">
    <link rel="canonical" href="https://jehlp.net/">
    <title>jehlp.net</title>
    <link rel="icon" href="https://jehlp.net/site-theme/v2/favicons/home.png" type="image/png">
    <script src="https://jehlp.net/site-theme/v2/theme.js"></script>
    <link rel="stylesheet" href="https://jehlp.net/site-theme/v2/base.css">
    <link rel="stylesheet" href="assets/styles.css?v=20260905-atlas">
    <script src="assets/app.js?v=20260905-atlas" type="module"></script>
  </head>
  <body>
    <a class="skip-link" href="#directory">Skip to pages</a>
    <main class="atlas">
      <div class="index-tools">
        <form class="page-search" role="search" hidden>
          <label class="sr-only" for="page-query">Find a page</label>
          <input id="page-query" type="search" autocomplete="off" placeholder="Find a page" aria-controls="directory">
        </form>
        <button class="search-toggle icon-button" type="button" aria-label="Find a page" aria-expanded="false" aria-controls="page-query" title="Find a page (/)" hidden><span aria-hidden="true">/</span></button>
        <button class="theme-toggle icon-button" type="button" data-theme-toggle aria-label="Use dark theme" aria-pressed="false">◐</button>
      </div>
      <nav class="directory" id="directory" aria-label="Pages" tabindex="-1">
${categories.map(renderCategory).join('\n')}
        <details class="atlas-category" data-category="other" id="other-projects" hidden>
          <summary><span class="type-study study-asterisk" aria-hidden="true">${marks.asterisk}</span><span class="category-label">Other</span><span class="fold" aria-hidden="true"></span></summary>
          <ul class="page-links" id="other-project-list"></ul>
        </details>
      </nav>
      <p class="empty-result" hidden>No matching pages.</p>
      <p class="sr-only" id="page-status" role="status" aria-live="polite"></p>
    </main>
  </body>
</html>
`;
}
