// Small pure helpers shared by the browser and regression tests.
export const normalizeQuery = value => String(value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
export function safeResultURL(value, origin = 'https://jehlp.net') {
  try { const url = new URL(value, origin); return url.origin === origin && !url.username && !url.password ? url.pathname + url.search + url.hash : null; } catch { return null; }
}
export function excerptParts(html) {
  // Pagefind emits marked-up excerpts. Keep only its <mark> delimiters; every
  // other byte remains text, so a source page cannot inject markup into results.
  return String(html || '').split(/(<\/?mark>)/i).map(part => ({ text: part, marker: /^<\/?mark>$/i.test(part) }));
}
