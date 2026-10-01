# jehlp.net · type atlas

The root [jehlp.net](https://jehlp.net) directory, published from `main` / root by
GitHub Pages. This repository does not own the project subpages.

## Design contract

No visible site name, masthead, introduction, taglines, or destination descriptions.
Category and destination names are the content. Small accessible utility labels,
search feedback, the skip link, and document metadata remain useful exceptions.
Composed punctuation supplies a quiet, ink-like identity; it is decorative and
hidden from assistive technology. It is not a replacement for the shared PNG
masthead convention on project pages. No images, canvas, animation, or framework
are needed for these code-native studies.

Keep the directory compact: a two-column desktop composition and a single column
on mobile, with no internal scrollports. Preserve the shared paper/charcoal
palette, serif destinations, readable sans-serif categories, and focus behavior.
Only homepage-local CSS changes this composition; subpage styles are untouched.

## Add pages or categories

Edit `data/directory.json`, then run:

```sh
node build.mjs
node --test tests/*.test.mjs
```

Commit the generated `index.html` together with the authored data/source. Each
category has a unique `id`, `label`, `mark`, and a `pages` array. Each page
has a unique `id`, `label`, and root-relative `href` ending in `/`. IDs use lowercase
letters, digits, and hyphens. Marks are `parentheses`, `constellation`, `asterisk`,
`section`, or `chevrons`; extend the named mark registry in `lib/directory.mjs` and the local
study CSS for a genuinely new motif. Categories can reuse existing marks.

All categories are permanent, labeled sections. Their destination links stay visible
without scripts; do not restore disclosures or collapse controls. There is no
category or page-count limit in the generator. The slash control opens full-text
search across the authored public sites. `/` opens search; Escape clears and closes
it, returning focus to its button. Clearing a query restores the full directory.

The directory is authored only: no automatic GitHub discovery or Other category.
Add new destinations explicitly to the JSON with their intended category and name.

The current four groups preserve all fourteen destinations. Games includes the
playable NDB Idle, authored Puzzles, and Baba Is You. Links belongs with Reading. Category metadata
is generated from the labels, not a fixed list of the original categories.

## Verification and release

Check 390px/1440px, light/dark, 200% text, heading/link keyboard behavior,
search and empty results, Escape/focus restoration, no-JS, print, and a much
larger category fixture. Node tests cover rendering, schema rejection, and the
absence of discovery—not browser accessibility. Keep CNAME and canonical metadata intact.
Use explicit staging, publish `main`, and verify the actual homepage and its local
assets after the Pages workflow completes. Shared skills and release evidence
are maintained in `site-theme`.


## Full-text site search

Install build dependencies with `npm ci --ignore-scripts`. Run `npm test`, then
`npm run build:site`. The build artifact is `_site/`: only the generated homepage,
public assets, CNAME, robots.txt, coverage metadata and search indexes. Source,
credentials, dependency files and fetch caches are never copied into it.

The build fetches **only currently published jehlp.net inputs** under the 14
explicit roots in `data/directory.json`. It does not use an authenticated API,
discover account repositories, follow external references, or execute downloaded
JavaScript. Linked HTML is followed under those roots. Adapters enumerate public
Readers/VN manifests, generated Puzzle pages and rendered fields of catalogues.
The React app adapter parses literal displayed JSX help/control copy from the
published entry bundles; it does not evaluate code or capture game saves/states.
Profile uses nested, explicit allowlists of fields the public UI actually renders.

Readers passages link to real chapter/paragraph routes, VN passages to real
chapter/line routes, and BL2 items to their existing item modal links. Annotations
link to the relevant paragraph where their note can be opened. Apps without item
routing use their supported section/dataset route. Static fallback editions and
raw data/audit files are not separately indexed. Identical destination records
are combined rather than inventing unsupported routes.

Pagefind 1.5.2 builds compressed, content-addressed shards. The homepage loads no
search corpus on ordinary visits; it imports the engine after a query and loads
only needed index chunks and 12 result excerpts at a time. English and Japanese
copy use separate language indexes selected by query script, so Japanese words inside
sentences work without changing their display text. The current history entry preserves the query/filter across Back navigation;
closing search clears it. Queries are not put in the URL or local storage.
Query matching is case- and accent-insensitive, with title weighting and optional site filters. Search runs
entirely in the browser; query text is not sent to an external search provider.

`lib/search-runtime.mjs` applies a version-checked, small compatibility patch to
the generated Pagefind runtime: propagate HTTP/chunk failures instead of silently
returning zero results. Tests exercise the real generated engine and recovery.
Retry creates a fresh engine with fresh metadata, avoiding cached rejected
fragments and handling an open tab across a new deployment. Re-review this patch
before changing the pinned Pagefind version.

### Refresh and failure policy

This repository publishes the complete generated `pagefind/`, `pagefind-ja/`
and `search-coverage.json` snapshot through its existing main/root Pages setup.
**Refresh is manual**: after a subsite content update, run:

```sh
npm ci --ignore-scripts
npm test
npm run refresh:search
# Review the coverage timestamp and representative results, then commit the
# generated pagefind/ and pagefind-ja/ directories plus search-coverage.json
# together with any authored homepage changes. Push main when authorized.
```

The refresh command fetches sources afresh. A failed fetch, changed schema,
broken expected anchor or missing corpus fails the build before the published
snapshot is replaced locally. GitHub Pages deploys the complete commit; until
then the previous complete snapshot stays live. This avoids a silently partial
index. Run a refresh after urgent subsite edits or removals. The public
`search-coverage.json` records generation time, counts, coverage and limitations.

Automatic scheduled rebuilding is not configured: the existing publishing token
can update site assets but cannot create GitHub Actions workflows. No additional
OAuth access is required for the manual static workflow.

For offline iteration, `node tools/build-search.mjs --cached` reuses successful
responses in ignored `.search-cache/`. The public refresh command never uses that option.
Delete that directory to discard local snapshots. The index intentionally omits
image/video/audio transcription, downloads, external linked websites, transient
telemetry, private data and runtime game state. NDB story datasets and arbitrary
generated puzzle permutations are outside the published interface-copy adapter.

### Search checks

`npm test` includes schema/extraction/XSS checks, real Pagefind body/phrase/accent/
ranking/network-failure checks, and DOM interaction tests for slash/Escape/focus,
filters, loading/no-results/errors/retry, query races and bounded pagination.
Mixed-language queries search the Japanese field when they contain Japanese characters;
they do not intersect separate Japanese and English translations. These checks
do not replace a live browser review at desktop/mobile widths in both
color modes. Useful published-body checks include `choralcelo`,
`narcotherapeutic`, `"transcendent mass"`, `"ripening cherry tomatoes"`,
`"traveler must alternately obtain"`, and Japanese `学校` / `日本`.
