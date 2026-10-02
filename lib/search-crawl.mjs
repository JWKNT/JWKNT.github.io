import { ORIGIN, allowedPage, extractPage } from './search-content.mjs';

// One queue for homepage roots and adapter-discovered HTML alike. A fresh build
// has a fresh visited set: additions, edits, and removals need no registry update.
export async function crawlPublishedPages({ projects, getText, addRecord, seeds = projects.map(p => p.href), visited = new Set(), limit = 4000, concurrency = 6 }) {
  const paths = projects.map(p => p.href);
  const queue = [];
  const queued = new Set(visited);
  const enqueue = path => {
    const canonical = allowedPage(path, ORIGIN, paths);
    if (!canonical) throw new Error(`Invalid public HTML seed: ${path}`);
    if (!queued.has(canonical)) { queued.add(canonical); queue.push(canonical); }
    if (queued.size > limit) throw new Error('Public-page crawl exceeded its safety limit');
  };
  seeds.forEach(enqueue);
  while (queue.length) {
    const batch = queue.splice(0, concurrency);
    const pages = await Promise.all(batch.map(async path => {
      const project = projects.filter(p => path.startsWith(p.href)).sort((a, b) => b.href.length - a.href.length)[0];
      return { path, ...extractPage(await getText(path), path, project, paths) };
    }));
    for (const page of pages) {
      await addRecord(page.record);
      visited.add(page.path);
      page.links.forEach(enqueue);
    }
  }
  return visited;
}
