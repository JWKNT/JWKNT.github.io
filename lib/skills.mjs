import { escapeHtml } from './directory.mjs';

// site-theme maintains the only skill set. Build from its published copy and
// never keep a second set of skill files in this repository.
export const SKILLS_SOURCE = 'https://jehlp.net/site-theme/';
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The catalog's links give the authored order. Only the skills that the
// catalog links appear on the page.
export function catalogSkills(catalog) {
  const names = [...new Set([...String(catalog).matchAll(/\]\((?:\.\/)?skills\/([^/()\s]+)\/SKILL\.md\)/g)].map(match => match[1]))];
  if (!names.length) throw new Error('The skills catalog lists no skills');
  for (const name of names) if (!NAME.test(name)) throw new Error(`Invalid skill name: ${name}`);
  return names;
}

const unquote = value => /^".*"$/s.test(value) ? value.slice(1, -1).replace(/\\(["\\])/g, '$1')
  : /^'.*'$/s.test(value) ? value.slice(1, -1).replaceAll("''", "'") : value;

export function parseSkill(source, name) {
  const text = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const front = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!front) throw new Error(`Skill ${name} has no front matter`);
  const meta = {};
  let key;
  for (const line of front[1].split('\n')) {
    const field = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (field) meta[key = field[1]] = (field[2] || '').trim();
    else if (key && /^\s+\S/.test(line)) meta[key] += ' ' + line.trim();
  }
  for (const field of Object.keys(meta)) meta[field] = unquote(meta[field].replace(/^[>|][+-]?(?:\s+|$)/, '').trim());
  if (meta.name !== name) throw new Error(`Skill ${name} declares the name ${JSON.stringify(meta.name)}`);
  if (!meta.description) throw new Error(`Skill ${name} has no description`);
  // The article heading already shows the name, so drop a title that repeats it.
  const body = text.slice(front[0].length).replace(/^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/, (line, title) => title === name ? '' : line);
  return { name, description: meta.description, sections: splitSections(body) };
}

function splitSections(body) {
  const sections = [{ heading: null, lines: [] }];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) sections.push({ heading: heading[1], lines: [] });
    else sections.at(-1).lines.push(line);
  }
  return sections.map(({ heading, lines }) => ({ heading, markdown: lines.join('\n').trim() })).filter(section => section.heading || section.markdown);
}

const sectionKey = section => `${section.heading}\n${section.markdown.replace(/\s+/g, ' ')}`;
const slug = text => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

// Skills repeat some sections word for word so that each one stands alone.
// The page shows such a section once and links to it from every skill.
export function sharedSections(skills) {
  const uses = new Map();
  for (const skill of skills) for (const section of skill.sections) {
    if (!section.heading) continue;
    const key = sectionKey(section);
    if (!uses.has(key)) uses.set(key, { ...section, key, skills: [] });
    if (!uses.get(key).skills.includes(skill.name)) uses.get(key).skills.push(skill.name);
  }
  const ids = new Set(skills.map(skill => skill.name));
  return [...uses.values()].filter(section => section.skills.length > 1).map(section => {
    let id = `shared-${slug(section.heading)}`;
    for (let n = 2; ids.has(id); n++) id = `shared-${slug(section.heading)}-${n}`;
    ids.add(id);
    return { ...section, id };
  });
}

const safeUrl = (href, base) => {
  try {
    const url = new URL(href, base);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};

// Code spans, links and strong text only. Single * and _ stay literal so that
// paths and globs such as tests/*.test.mjs keep their exact characters.
const INLINE = /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*(?=\S)([\s\S]*?\S)\*\*/g;
export function renderInline(text, base) {
  text = String(text);
  let html = '', last = 0;
  for (const match of text.matchAll(INLINE)) {
    html += escapeHtml(text.slice(last, match.index));
    if (match[1]) html += `<code>${escapeHtml(match[2].replace(/^ (.+) $/s, '$1'))}</code>`;
    else if (match[3]) {
      const url = safeUrl(match[4], base);
      html += url ? `<a href="${escapeHtml(url)}">${renderInline(match[3], base)}</a>` : escapeHtml(match[0]);
    } else html += `<strong>${renderInline(match[5], base)}</strong>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

// Link text cannot contain another link, so contents entries use plain text.
const plainInline = text => escapeHtml(String(text).replace(/\[([^\]\n]+)\]\([^()\s]+\)/g, '$1').replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1').replace(/`+/g, ''));

// A small Markdown subset: paragraphs, headings, flat lists and fenced code.
// Anything else renders as escaped text, never as markup.
export function renderMarkdown(markdown, base) {
  const html = [];
  let paragraph = [], list = null, fence = null;
  const flushParagraph = () => { if (paragraph.length) html.push(`<p>${renderInline(paragraph.join(' '), base)}</p>`); paragraph = []; };
  const flushList = () => { if (list) html.push(`<${list.tag}>${list.items.map(item => `<li>${renderInline(item.join(' '), base)}</li>`).join('')}</${list.tag}>`); list = null; };
  for (const line of String(markdown).split('\n')) {
    if (fence) {
      if (/^\s*(?:```|~~~)/.test(line)) { html.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`); fence = null; }
      else fence.push(line);
      continue;
    }
    if (/^\s*(?:```|~~~)/.test(line)) { flushParagraph(); flushList(); fence = []; continue; }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph(); flushList();
      // Article titles are h2, so skill headings start at h3.
      const level = Math.min(6, Math.max(3, heading[1].length + 1));
      html.push(`<h${level}>${renderInline(heading[2], base)}</h${level}>`);
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list?.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push([item[2]]);
    } else if (!line.trim()) { flushParagraph(); flushList(); }
    else if (list && /^\s+\S/.test(line)) list.items.at(-1).push(line.trim());
    else { flushList(); paragraph.push(line.trim()); }
  }
  if (fence) html.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  flushParagraph(); flushList();
  return html.join('\n');
}

export const skillSource = name => new URL(`skills/${name}/SKILL.md`, SKILLS_SOURCE).href;

// Names share a namespace such as "jehlp-". Quieter ink for that prefix lets the
// distinct part lead without changing the exact identifier.
function namePrefix(names) {
  if (names.length < 2) return '';
  let prefix = names[0];
  for (const name of names) while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.slice(0, prefix.lastIndexOf('-') + 1);
}
const renderName = (name, prefix) => prefix && name.startsWith(prefix) && name.length > prefix.length
  ? `<span class="skill-prefix">${escapeHtml(prefix)}</span>${escapeHtml(name.slice(prefix.length))}` : escapeHtml(name);

export function validateSkills(skills) {
  if (!Array.isArray(skills) || !skills.length) throw new Error('Publish at least one skill');
  const names = new Set();
  for (const skill of skills) {
    if (typeof skill?.name !== 'string' || !NAME.test(skill.name) || names.has(skill.name)) throw new Error('Duplicate or invalid skill name');
    if (typeof skill.description !== 'string' || !skill.description.trim() || !Array.isArray(skill.sections)) throw new Error(`Invalid skill: ${skill.name}`);
    names.add(skill.name);
  }
}

export function renderSkillsPage(skills) {
  validateSkills(skills);
  const shared = sharedSections(skills);
  const sharedByKey = new Map(shared.map(section => [section.key, section]));
  const prefix = namePrefix(skills.map(skill => skill.name));
  const count = `${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`;
  const renderSection = (section, base) => {
    if (!section.heading) return renderMarkdown(section.markdown, base);
    const common = sharedByKey.get(sectionKey(section));
    if (common) return `<p class="skill-shared-ref">Shared section: <a href="#${common.id}">${plainInline(common.heading)}</a></p>`;
    return `<h3>${renderInline(section.heading, base)}</h3>\n${renderMarkdown(section.markdown, base)}`;
  };
  const articles = skills.map(skill => {
    const id = escapeHtml(skill.name), source = skillSource(skill.name);
    return `          <article class="skill" id="${id}" aria-labelledby="${id}-name">
            <header class="skill-header">
              <h2 class="skill-name" id="${id}-name">${renderName(skill.name, prefix)}</h2>
              <a class="skill-source" href="${escapeHtml(source)}" aria-label="Markdown source of ${id}">Markdown<span class="ui-link-arrow" aria-hidden="true"></span></a>
            </header>
            <p class="skill-description">${renderInline(skill.description, source)}</p>
            <div class="skill-body prose">
${skill.sections.map(section => renderSection(section, source)).join('\n')}
            </div>
          </article>`;
  });
  const sharedArticles = shared.map(section => {
    const source = skillSource(section.skills[0]);
    const scope = section.skills.length === skills.length ? 'every skill' : `${section.skills.length} of ${skills.length} skills`;
    return `          <section class="skill skill--shared" id="${section.id}" aria-labelledby="${section.id}-name">
            <header class="skill-header">
              <h2 class="skill-name" id="${section.id}-name">${renderInline(section.heading, source)}</h2>
            </header>
            <p class="skill-description">Shared section in ${scope}.</p>
            <div class="skill-body prose">
${renderMarkdown(section.markdown, source)}
            </div>
          </section>`;
  });
  const contents = skills.map(skill => `<li><a href="#${escapeHtml(skill.name)}">${renderName(skill.name, prefix)}</a></li>`).join('');
  const sharedContents = shared.length ? `
          <h3 class="skills-index-label">Shared</h3>
          <ul>${shared.map(section => `<li><a href="#${section.id}">${plainInline(section.heading)}</a></li>`).join('')}</ul>` : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${count} for agents that work on jehlp.net pages.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Skills">
    <meta property="og:url" content="https://jehlp.net/skills/">
    <meta property="og:site_name" content="jehlp.net">
    <meta name="theme-color" content="#fbfaf7">
    <link rel="canonical" href="https://jehlp.net/skills/">
    <title>Skills · jehlp.net</title>
    <link rel="icon" href="https://jehlp.net/site-theme/v2/favicons/site-theme.png" type="image/png">
    <script src="https://jehlp.net/site-theme/v2/theme.js?v=20261009-reading-folio"></script>
    <link rel="stylesheet" href="https://jehlp.net/site-theme/v2/base.css?v=20261009-reading-folio">
    <link rel="stylesheet" href="../assets/skills.css?v=20261102-skills">
  </head>
  <body data-site-tone="blue">
    <a class="skip-link" href="#skills">Skip to skills</a>
    <header class="site-header site-header--identity">
      <div class="site-brand"><img class="site-mark" src="https://jehlp.net/site-theme/v2/marks/site-theme.png" width="32" height="32" alt=""><h1 class="site-title">Skills</h1></div>
      <nav aria-label="Site links"><span class="site-utility-pair"><a class="site-home" href="https://jehlp.net/" aria-label="Home — jehlp.net" title="Home — jehlp.net"><span aria-hidden="true">✳</span></a><button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark theme" aria-pressed="false">◐</button></span></nav>
    </header>
    <main id="skills" class="skills-shell" tabindex="-1">
      <div class="skills-intro">
        <p class="lede">Agents use these skills for work on jehlp.net pages.</p>
        <p class="skills-meta">${count} · <a href="${SKILLS_SOURCE}SKILLS.md">Catalog and installation<span class="ui-link-arrow" aria-hidden="true"></span></a></p>
      </div>
      <nav class="skills-index" aria-labelledby="skills-index-title">
          <h2 class="skills-index-label" id="skills-index-title">Contents</h2>
          <ol>${contents}</ol>${sharedContents}
      </nav>
      <div class="skills-list">
${articles.join('\n')}${shared.length ? `
          <div class="site-divider" data-ornament="folio" aria-hidden="true"><span></span></div>
${sharedArticles.join('\n')}` : ''}
      </div>
    </main>
  </body>
</html>
`;
}
