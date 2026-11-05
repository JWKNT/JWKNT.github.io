import temml from 'temml';
import { escapeHtml } from './directory.mjs';
import { figures } from './ai-math-figures.mjs';

// Pages that explain what an AI mathematics result answers, without the proof.
// data/ai-math.json holds the order and the status. content/ai-math/<slug>.html
// holds each body, with TeX between \( \) and \[ \] and {{…}} directives.
export const ROOT = 'https://jehlp.net/ai-math/';
const THEME = 'https://jehlp.net/site-theme/v2/';
const THEME_VERSION = '20261009-reading-folio';
const COMPONENT_VERSION = '20261105-math3';
const ASSET_VERSION = '20261105-math3';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_SECTIONS = ['question', 'examples', 'result', 'not', 'checked', 'sources'];

// Bodies are HTML, so TeX in them escapes <, > and &. Temml needs the plain characters.
const plainTex = tex => tex.trim().replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const inlineMath = tex => temml.renderToString(plainTex(tex), { displayMode: false, throwOnError: true, annotate: false });
const displayMath = tex => `<div class="ui-equation" data-scroll-region data-scroll-noun="of the formula" aria-label="Formula">${temml.renderToString(plainTex(tex), { displayMode: true, throwOnError: true, annotate: false })}</div>`;
// Browsers can break a line between a formula and the punctuation after it, so hold them together.
export const typesetMath = html => String(html)
  .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => displayMath(tex))
  .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => inlineMath(tex))
  .replace(/(<math>(?:(?!<\/math>)[\s\S])*<\/math>)([,.:)]+)/g, '<span class="ai-math-nobreak">$1$2</span>');

// Wrenfold Text and the interface fonts have no double-struck letters.
export const mathChars = text => escapeHtml(text).replace(/[ℤℚℝℂ]/g, char => `<span class="ui-math-char">${char}</span>`);

const DIVIDER = '<div class="site-divider ai-math-divider" data-ornament="folio" aria-hidden="true"><span></span></div>';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

export function validateAiMath(data, bodies) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.checked) || !Array.isArray(data.results) || !data.results.length) throw new Error('Add a checked date and at least one result');
  const slugs = new Set();
  for (const result of data.results) {
    if (!SLUG.test(result?.slug ?? '') || slugs.has(result.slug)) throw new Error(`Invalid or repeated slug: ${result?.slug}`);
    slugs.add(result.slug);
    for (const key of ['title', 'summary', 'status']) if (typeof result[key] !== 'string' || !result[key].trim()) throw new Error(`Invalid ${key}: ${result.slug}`);
    if (!Array.isArray(result.facts) || result.facts.length !== 3 || result.facts.some(fact => fact.length !== 2)) throw new Error(`Give three facts: ${result.slug}`);
    const body = bodies[result.slug];
    if (typeof body !== 'string') throw new Error(`Missing body: ${result.slug}`);
    for (const id of REQUIRED_SECTIONS) if (!body.includes(`<h2 id="${id}">`)) throw new Error(`${result.slug} has no ${id} section`);
    if (!body.includes('{{facts}}') || !body.includes('{{divider}}')) throw new Error(`${result.slug} needs its facts and divider`);
    for (const [, name] of body.matchAll(/\{\{fig:([\w-]+)\}\}/g)) if (!Object.hasOwn(figures, name)) throw new Error(`Unknown figure in ${result.slug}: ${name}`);
    const leftover = body.replace(/\{\{(?:facts|divider|fig:[\w-]+)\}\}/g, '').match(/\{\{[^}]*\}\}/);
    if (leftover) throw new Error(`Unknown directive in ${result.slug}: ${leftover[0]}`);
    for (const [, target] of body.matchAll(/href="\.\.\/([^"]+)\/"/g)) if (!data.results.some(other => other.slug === target)) throw new Error(`Broken link in ${result.slug}: ${target}`);
  }
}

function frame({ canonical, title, ogTitle, description, assets, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:site_name" content="jehlp.net">
    <meta name="theme-color" content="#fbfaf7">
    <link rel="canonical" href="${canonical}">
    <title>${escapeHtml(title)} · jehlp.net</title>
    <link rel="icon" href="${THEME}favicons/ai-math.png" type="image/png">
    <script src="${THEME}theme.js?v=${THEME_VERSION}"></script>
    <link rel="stylesheet" href="${THEME}base.css?v=${THEME_VERSION}">
    <link rel="stylesheet" href="${THEME}components.css?v=${COMPONENT_VERSION}">
    <link rel="stylesheet" href="${assets}ai-math.css?v=${ASSET_VERSION}">
    <script src="${THEME}components.js?v=${COMPONENT_VERSION}" defer></script>
  </head>
  <body data-site-tone="blue">
${body}
  </body>
</html>
`;
}

const UTILITIES = '<span class="site-utility-pair"><a class="site-home" href="https://jehlp.net/" aria-label="Home — jehlp.net" title="Home — jehlp.net"><span aria-hidden="true">✳</span></a><button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark theme" aria-pressed="false">◐</button></span>';
const MARK = `<img class="site-mark" src="${THEME}marks/ai-math.png" width="32" height="32" alt="">`;

export function renderLanding(data) {
  const rows = data.results.map(result => `        <li>
          <a class="ai-math-result" href="${result.slug}/">${mathChars(result.title)}<span class="ui-link-arrow" aria-hidden="true"></span></a>
          <p class="ai-math-summary">${mathChars(result.summary)}</p>
          <p class="ai-math-status">${mathChars(result.status)}</p>
        </li>`).join('\n');
  return frame({
    canonical: ROOT,
    title: 'AI Math Results',
    ogTitle: 'AI Math Results',
    description: 'What each AI mathematics result answers, explained without the proof, for a reader with high-school mathematics and some science or engineering education.',
    assets: '../assets/',
    body: `    <a class="skip-link" href="#results">Skip to the results</a>
    <header class="site-header site-header--identity">
      <div class="site-brand">${MARK}<h1 class="site-title">AI Math Results</h1></div>
      <nav aria-label="Site links">${UTILITIES}</nav>
    </header>
    <main id="results" class="ai-math-shell" tabindex="-1">
      <p class="lede">Each page explains the question that an AI mathematics result answers. The pages do not show the proofs. They assume high-school mathematics and some science or engineering education.</p>
      <ul class="ai-math-list">
${rows}
      </ul>
      <section class="ai-math-key" aria-labelledby="key">
        <h2 id="key">How to read the status lines</h2>
        <p>Each status line gives the state of public sources on ${longDate(data.checked)}. A claim of proof can still contain an error. Each page separates these kinds of check.</p>
        <dl>
          <dt>Preprint</dt><dd>A public manuscript that no journal has reviewed.</dd>
          <dt>Lean proof</dt><dd>A proof in a language that a computer checks step by step. A person must still confirm that the formal statement says what the headline says.</dd>
          <dt>Human review</dt><dd>Study of the proof by experts in the field, reported in public.</dd>
          <dt>Peer review</dt><dd>Formal review for a journal. It usually takes months or years.</dd>
        </dl>
      </section>
    </main>`,
  });
}

export function renderExplainer(result, body, data) {
  const facts = `<dl class="data-strip ai-math-facts">${[...result.facts, ['Status date', data.checked]].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
  const expanded = body.trim()
    .replace('{{facts}}', facts)
    .replace('{{divider}}', DIVIDER)
    .replace(/\{\{fig:([\w-]+)\}\}/g, (_, name) => figures[name]());
  return frame({
    canonical: `${ROOT}${result.slug}/`,
    title: `${result.title} · AI Math Results`,
    ogTitle: result.title,
    description: result.summary,
    assets: '../../assets/',
    body: `    <a class="skip-link" href="#explainer">Skip to the explanation</a>
    <header class="site-header site-header--identity">
      <div class="site-brand">${MARK}<a class="site-title" href="../">AI Math Results</a></div>
      <nav aria-label="Site links">${UTILITIES}</nav>
    </header>
    <main id="explainer" class="ai-math-shell" tabindex="-1">
      <article class="prose ai-math-article">
        <h1>${mathChars(result.title)}</h1>
${typesetMath(expanded)}
      </article>
      <p class="ai-math-back"><a href="../">All results</a></p>
    </main>`,
  });
}

// Returns [relative path, html] for every page, in reading order.
export function renderAiMath(data, bodies) {
  validateAiMath(data, bodies);
  return [['index.html', renderLanding(data)], ...data.results.map(result => [`${result.slug}/index.html`, renderExplainer(result, bodies[result.slug], data)])];
}
