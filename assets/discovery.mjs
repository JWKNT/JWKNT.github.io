// Discovery supplements the complete static directory; it never replaces it.
export async function discoverPages(fetcher, known, { maxPages = 10, signal } = {}) {
  const seen = new Set(['jwknt.github.io', 'site-theme', ...known].map(id => id.toLowerCase()));
  const pages = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetcher(`https://api.github.com/users/JWKNT/repos?per_page=100&sort=full_name&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: signal ?? AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Page discovery failed: ${response.status}`);
    const repos = await response.json();
    if (!Array.isArray(repos)) throw new Error('Invalid repository list');
    for (const repo of repos) {
      if (!repo || typeof repo.name !== 'string' || !/^[a-z0-9][a-z0-9_.-]*$/i.test(repo.name)) continue;
      const id = repo.name.toLowerCase();
      if (!repo.has_pages || repo.archived || seen.has(id)) continue;
      seen.add(id);
      pages.push({
        id,
        label: repo.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        href: `https://jehlp.net/${encodeURIComponent(repo.name)}/`,
      });
    }
    if (repos.length < 100) break;
  }
  return pages.sort((a, b) => a.label.localeCompare(b.label));
}
