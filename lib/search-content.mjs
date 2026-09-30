import { parse, parseFragment } from 'parse5';

export const ORIGIN = 'https://jehlp.net';
const ignored = new Set(['script', 'style', 'noscript', 'template', 'svg', 'nav', 'footer']);
const blocks = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'br', 'dt', 'dd', 'pre', 'blockquote']);
export const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
export function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}
export function textContent(node) {
  if (ignored.has(node.tagName) || attr(node, 'aria-hidden') === 'true' || attr(node, 'data-search-ignore') !== undefined) return '';
  if (node.nodeName === '#text') return node.value;
  const text = (node.childNodes || []).map(textContent).join('');
  return blocks.has(node.tagName) ? ` ${text} ` : text;
}
export const cleanText = text => String(text).replace(/\s+/gu, ' ').trim();
export const htmlText = html => cleanText(textContent(parseFragment(String(html))));

export function allowedPage(href, base, projectPaths) {
  let url;
  try { url = new URL(href, base); } catch { return null; }
  if (url.origin !== ORIGIN || url.username || url.password) return null;
  if (url.pathname.includes('%')) return null;
  if (!projectPaths.some(path => url.pathname.startsWith(path))) return null;
  if (/\/(?:assets|data|tests?|raw_agents|audit|methodology|node_modules|\.git)\//i.test(url.pathname)) return null;
  if (!/\/$|\.html?$/i.test(url.pathname)) return null;
  // Readers has canonical reader routes and its own manifest adapter. Never
  // duplicate the static chapter edition or crawl hidden, unlisted books.
  if (url.pathname.startsWith('/readers/') && url.pathname !== '/readers/') return null;
  url.search = ''; url.hash = '';
  url.pathname = url.pathname.replace(/index\.html?$/i, '');
  return url.pathname;
}

export function extractPage(html, pathname, project, paths) {
  const doc = parse(html);
  let main, body, title = '', heading = '', description = '';
  const links = new Set();
  walk(doc, node => {
    if (node.tagName === 'main' && !main) main = node;
    if (node.tagName === 'body') body = node;
    if (node.tagName === 'title') title = cleanText(textContent(node));
    if (node.tagName === 'h1' && !heading) heading = cleanText(textContent(node));
    if (node.tagName === 'meta' && attr(node, 'name') === 'description') description = attr(node, 'content') || '';
    if (node.tagName === 'a') {
      const path = allowedPage(attr(node, 'href'), ORIGIN + pathname, paths);
      if (path) links.add(path);
    }
  });
  return {
    record: { url: pathname, title: heading || title || project.label, site: project.label,
      content: cleanText(`${heading || title || project.label} ${description} ${textContent(main || body || doc)}`) },
    links: [...links],
  };
}

// Keep passages bounded so snippets and links land close to the matched words.
// A long paragraph remains intact; the next paragraph begins a new passage.
export function passages(paragraphs, maxWords = 240) {
  const result = [];
  let batch = [], words = 0;
  for (const paragraph of paragraphs) {
    const text = cleanText(paragraph.text);
    if (!text) continue;
    const count = text.split(/\s+/u).length;
    if (batch.length && words + count > maxWords) { result.push(batch); batch = []; words = 0; }
    batch.push({ id: paragraph.id, text }); words += count;
  }
  if (batch.length) result.push(batch);
  return result;
}

export async function collectReaders({ getJSON, addRecord }) {
  const library = await getJSON('/readers/library.json');
  if (!Array.isArray(library) || !library.length) throw new Error('Readers library is empty or has changed schema');
  let chapters = 0, annotations = 0;
  for (const book of library) {
    if (typeof book.id !== 'string' || !/^[a-z0-9-]+$/.test(book.id) || !book.title) throw new Error('Invalid Readers book');
    const root = `/readers/${book.id}/`;
    const [manifest, search, glossary] = await Promise.all([getJSON(root + 'manifest.json'), getJSON(root + 'search.json'), getJSON(root + 'glossary.json')]);
    if (!Array.isArray(glossary)) throw new Error(`Invalid Readers annotations: ${book.id}`);
    if (!Array.isArray(manifest.chapters) || !manifest.chapters.length || !Array.isArray(search) || search.length !== manifest.chapters.length) throw new Error(`Incomplete Readers chapters: ${book.id}`);
    await addRecord({ url: root, title: book.title, site: 'Readers', content: `${book.title} ${book.author || ''} ${(book.volumes || []).map(v => v.title).join(' ')}` });
    const seen = new Set();
    for (const chapter of search) {
      const info = manifest.chapters.find(c => c.id === chapter.id);
      if (!info || seen.has(chapter.id) || !Array.isArray(chapter.paragraphs) || !chapter.paragraphs.length) throw new Error(`Invalid Readers chapter: ${book.id}/${chapter.id}`);
      if (typeof chapter.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(chapter.id) || chapter.paragraphs.some(p => typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(p.id) || typeof p.text !== 'string')) throw new Error(`Invalid Readers paragraph: ${book.id}/${chapter.id}`);
      seen.add(chapter.id); chapters++;
      if (!chapter.paragraphs.some(p => p.id !== 'chapter-title' && p.text.trim())) throw new Error(`Empty Readers body: ${book.id}/${chapter.id}`);
      const title = [...new Set([book.title, info.volumeTitle, chapter.title].filter(Boolean))].join(' · ');
      // Search JSON is the published searchable wording, with paragraph IDs that
      // the reader understands. It excludes duplicate static/EPUB source copies.
      for (const passage of passages(chapter.paragraphs.filter(p => p.id !== 'chapter-title'))) {
        const id = passage[0].id;
        await addRecord({ url: `${root}#${encodeURIComponent(chapter.id)}/${encodeURIComponent(id)}`, title,
          site: 'Readers', content: `${title} ${book.author || ''} ${passage.map(p => p.text).join(' ')}` });
      }
    }
    for (const note of glossary) {
      if (!note.first || !note.occurrences) continue;
      const chapter = search.find(chapter => chapter.id === note.first.chapter);
      if (!chapter?.paragraphs.some(paragraph => paragraph.id === note.first.paragraph)) throw new Error(`Invalid Readers annotation anchor: ${book.id}/${note.id}`);
      if (typeof note.note !== 'string' || typeof note.term !== 'string') throw new Error(`Invalid Readers annotation: ${book.id}/${note.id}`);
      await addRecord({ url: `${root}#${encodeURIComponent(note.first.chapter)}/${encodeURIComponent(note.first.paragraph)}`, title: `${book.title} · Notes for ${chapter.title}`, site: 'Readers',
        content: cleanText(`${note.term} ${(note.aliases || []).join(' ')} ${note.note}`) });
      annotations++;
    }
  }
  return { books: library.length, chapters, annotations };
}

// Mixed catalogues occasionally contain Japanese titles alongside English copy.
// Keep each script in its matching tokenizer without indexing a second full copy.
export function splitSearchLanguages(record) {
  const runs = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヶ]+/gu;
  return {
    english: record.content.replace(runs, ' '),
    japanese: record.japanese || (record.content.match(runs) || []).join(' '),
  };
}
