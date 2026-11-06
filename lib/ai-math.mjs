import temml from 'temml';
import { escapeHtml } from './directory.mjs';
import { figures } from './ai-math-figures.mjs';

// Short pages that say what an AI mathematics result means, with no proof.
// data/ai-math.json holds the order and titles. content/ai-math/<slug>.html
// holds each body: plain paragraphs, TeX between \( \) and \[ \], one margin figure.
// The short page is the default. Its Simplify button opens <slug>/simple/, built from
// <slug>.simple.html: the same result, longer, with every term defined from the start.
export const ROOT = 'https://jehlp.net/ai-math/';
const THEME = 'https://jehlp.net/site-theme/v2/';
const THEME_VERSION = '20261009-reading-folio';
const COMPONENT_VERSION = '20261105-math3';
const ASSET_VERSION = '20261105-simple1';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Each version links to the same version of another result.
const SHORT_LINK = /^\.\.\/([^/]+)\/$/;
const SIMPLE_LINK = /^\.\.\/\.\.\/([^/]+)\/simple\/$/;

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

function validateBody(results, slug, body, noun, link) {
  if (typeof body !== 'string') throw new Error(`Missing ${noun}: ${slug}`);
  if (/<h[1-6][ >]/.test(body)) throw new Error(`${slug} has a heading. An explainer is plain paragraphs under its title.`);
  if ((body.match(/class="ai-math-side"/g) || []).length !== 1) throw new Error(`${slug} needs exactly one margin figure`);
  for (const [, name] of body.matchAll(/\{\{fig:([\w-]+)\}\}/g)) if (!Object.hasOwn(figures, name)) throw new Error(`Unknown figure in ${slug}: ${name}`);
  const leftover = body.replace(/\{\{fig:[\w-]+\}\}/g, '').match(/\{\{[^}]*\}\}/);
  if (leftover) throw new Error(`Unknown directive in ${slug}: ${leftover[0]}`);
  for (const [, href] of body.matchAll(/href="(\.[^"]*)"/g)) {
    const target = href.match(link)?.[1];
    if (!results.some(other => other.slug === target)) throw new Error(`Broken link in ${slug}: ${href}`);
  }
}

export function validateAiMath(results, bodies, simpleBodies) {
  if (!Array.isArray(results) || !results.length) throw new Error('Add at least one result');
  const slugs = new Set();
  for (const result of results) {
    if (!SLUG.test(result?.slug ?? '') || slugs.has(result.slug)) throw new Error(`Invalid or repeated slug: ${result?.slug}`);
    slugs.add(result.slug);
    for (const key of ['title', 'description']) if (typeof result[key] !== 'string' || !result[key].trim()) throw new Error(`Invalid ${key}: ${result.slug}`);
    validateBody(results, result.slug, bodies[result.slug], 'body', SHORT_LINK);
    validateBody(results, result.slug, simpleBodies[result.slug], 'simple body', SIMPLE_LINK);
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

export function renderLanding(results) {
  const rows = results.map(result => `        <li><a class="ai-math-result" href="${result.slug}/"><span>${mathChars(result.title)}</span><span class="ui-link-arrow" aria-hidden="true"></span></a></li>`).join('\n');
  return frame({
    canonical: ROOT,
    title: 'AI Math Results',
    ogTitle: 'AI Math Results',
    description: 'What each AI mathematics result means, in two minutes, without the proof.',
    assets: '../assets/',
    body: `    <a class="skip-link" href="#results">Skip to the results</a>
    <header class="site-header site-header--identity">
      <div class="site-brand">${MARK}<h1 class="site-title">AI Math Results</h1></div>
      <nav aria-label="Site links">${UTILITIES}</nav>
    </header>
    <main id="results" class="ai-math-shell" tabindex="-1">
      <ul class="ai-math-list">
${rows}
      </ul>
    </main>`,
  });
}

function renderPage(result, body, { path, title, description, assets, home, version }) {
  const expanded = body.trim().replace(/\{\{fig:([\w-]+)\}\}/g, (_, name) => figures[name]());
  return frame({
    canonical: `${ROOT}${result.slug}/${path}`,
    title: `${title} · AI Math Results`,
    ogTitle: title,
    description,
    assets,
    body: `    <a class="skip-link" href="#explainer">Skip to the explanation</a>
    <header class="site-header site-header--identity">
      <div class="site-brand">${MARK}<span class="site-title">AI Math Results</span></div>
      <nav aria-label="Site links"><a href="${home}">All results</a>${UTILITIES}</nav>
    </header>
    <main id="explainer" class="ai-math-shell" tabindex="-1">
      <article class="prose ai-math-article">
        <div class="ai-math-head"><h1>${mathChars(result.title)}</h1>${version}</div>
${typesetMath(expanded)}
      </article>
    </main>`,
  });
}

export const renderExplainer = (result, body) => renderPage(result, body, {
  path: '',
  title: result.title,
  description: result.description,
  assets: '../../assets/',
  home: '../',
  version: '<a class="ai-math-version" href="simple/">Simplify</a>',
});

export const renderSimple = (result, body) => renderPage(result, body, {
  path: 'simple/',
  title: `${result.title}, simplified`,
  description: `${result.description} A longer version in plain language.`,
  assets: '../../../assets/',
  home: '../../',
  version: '<a class="ai-math-version" href="../">Short version</a>',
});

// Returns [relative path, html] for every page, in reading order.
export function renderAiMath(results, bodies, simpleBodies) {
  validateAiMath(results, bodies, simpleBodies);
  return [
    ['index.html', renderLanding(results)],
    ...results.flatMap(result => [
      [`${result.slug}/index.html`, renderExplainer(result, bodies[result.slug])],
      [`${result.slug}/simple/index.html`, renderSimple(result, simpleBodies[result.slug])],
    ]),
  ];
}
