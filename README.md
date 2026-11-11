# jehlp.net · type atlas

The root [jehlp.net](https://jehlp.net) directory, built from `main` and published by the
`Refresh search and publish homepage` GitHub Actions workflow. This repository does not own the project subpages.

## Design contract

One title above the directory: the Ruffle seal (style library icon i0063), with a
hidden text name for the `h1`. The owner's introduction is beside it, in
`lib/intro.mjs`. The seal takes the place of a study. The text starts where the
destination names start and covers the rest of the frame. The owner wrote the
introduction, so keep its words and its two paragraphs exactly. The second
paragraph starts with a tab indent. The text is justified by spacing alone,
without hyphenation. The introduction carries the human mark of
the site theme (`.ui-human`): a square bracket with a human figure. The mark hangs
in the right page margin as far as that margin has room. The last words end in an
arrow that points at the mark. The arrow has the faint echo and the accent point
of the studies below. One clear ink rule separates the introduction from the
categories, in place of the faint rules of the first row.

No taglines or destination descriptions. Category and destination names are the
content. Small accessible utility labels, search feedback, the skip
link, and document metadata remain useful exceptions. Composed punctuation supplies
a quiet, ink-like identity; it is decorative and hidden from assistive technology.
It is not a replacement for the shared PNG masthead convention on project pages.
No images, canvas, animation, or framework are needed for these code-native studies.

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

Commit the authored data/source. Actions regenerates `index.html` and the search
corpus into one artifact; the checked-in homepage is a branch-mode fallback. Each
category has a unique `id`, `label`, `mark`, and a `pages` array. Each page
has a unique `id`, `label`, and root-relative `href` ending in `/`. IDs use lowercase
letters, digits, and hyphens. Marks are `parentheses`, `constellation`, `asterisk`,
`section`, `continuum`, `chevrons`, `spiral`, or `whorl`; extend the named mark registry in `lib/directory.mjs` and the local
study CSS for a genuinely new motif. Categories can reuse existing marks.

All categories are permanent, labeled sections. Their destination links stay visible
without scripts; do not restore disclosures or collapse controls. There is no
category or page-count limit in the generator. The slash control opens full-text
search across the authored public sites. `/` opens search; Escape clears and closes
it, returning focus to its button. The site filter and results open directly under
the search box. While a query runs, its results take the place of the introduction
and the directory. Clearing a query restores both.

The directory is authored only: no automatic GitHub discovery or Other category.
Add new destinations explicitly to the JSON with their intended category and name.

The current seven groups hold 24 destinations. Me comes first, at the top left, and holds Profile,
Links, and Accounts. Translations holds the translated works: Albatross Koukairoku, Black Sheep
Town, and Omniscient Reader’s Viewpoint. Games includes the playable NDB Idle, authored Puzzles,
Baba Is You, NGU Idle, and Box Logic. Agents holds the guidance for agent work: MTL Guide, Style
Library, Skills, and Site Theme. Tools keeps the solvers, Gazetteer, and Readers. Category metadata
is generated from the labels, not a fixed list of the original categories.

## Skills page

`/skills/` shows the agent skills that `site-theme` maintains. This repository keeps
no copy of the skill files. `npm run build:skills` reads the published catalog,
`https://jehlp.net/site-theme/SKILLS.md`, and each `SKILL.md` that the catalog links.
It writes `skills/index.html` in catalog order. `build:site` runs the same step, so
each push and hourly refresh publishes the current skills. A failed read stops the
release, and the previous deployment stays live.

A section that several skills repeat word for word appears once, after the skills.
Each of those skills links to it. Layout rules are in `assets/skills.css`. The page
uses the site-theme mark and favicon because site-theme owns the skills. To preview
unpublished skill edits, run `node tools/build-skills.mjs --from ../site-theme`.
The checked-in page is the branch-mode fallback and the input for `npm test`.

## Accounts page

`/accounts/` links profiles on other sites. To add one, append an entry to `data/accounts.json`
with `site`, `href` and an optional `handle`. Links must use HTTPS. Then run
`node build.mjs` and `npm test`, and commit the data and `accounts/index.html` together.
Every link has `rel="me"`. Layout rules are in `assets/accounts.css`.

## Verification and release

Check 390px/1440px, light/dark, 200% text, heading/link keyboard behavior,
search and empty results, Escape/focus restoration, no-JS, print, and a much
larger category fixture. Node tests cover rendering, schema rejection, and the
absence of discovery—not browser accessibility. Keep CNAME and canonical metadata intact.
Use explicit source-file staging, publish `main`, and verify the actual homepage and its local
assets after the Pages workflow completes. Shared skills and release evidence
are maintained in `site-theme`.


## Full-text site search

Install build dependencies with `npm ci --ignore-scripts`. Run `npm test`, then
`npm run build:site`. The `npm test` pretest regenerates the homepage before checking it.
The build artifact is `_site/`: only the generated homepage,
skills and accounts pages, public assets, CNAME, robots.txt, coverage metadata and search indexes. Source,
credentials, dependency files and fetch caches are never copied into it.

The build fetches **only currently published jehlp.net inputs** under the
authored roots in `data/directory.json`. It does not use an authenticated API,
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

### Automatic refresh and failure policy

`.github/workflows/search-pages.yml` rebuilds and publishes the complete `_site/`
artifact on every homepage `main` push and hourly at minute 23 (UTC). The hourly
crawl picks up independently published subsite changes without hooks, credentials,
index lists, or workflow edits in each project. GitHub can delay scheduled runs;
this is periodic discovery, not immediate cross-repository push notification.

New destinations still belong in the authored homepage `data/directory.json`,
with their chosen category and label. That homepage edit is all a new HTML site
needs for search inclusion. Within a listed site, link new public HTML pages from
its root or another reachable page: the next successful crawl discovers them
recursively, including links on adapter-generated pages. Existing Readers and VN
manifests are re-read for new books/chapters. Changed wording is replaced, and
pages removed from the link graph or manifests disappear from the next complete
snapshot. A still-linked 404 fails the refresh until its stale link is fixed.

The build fetches sources afresh and validates every authored site's coverage,
both language indexes, custom domain, and source commit before deployment. Any
failed fetch, changed adapter schema, broken expected anchor, or missing corpus
fails the workflow, leaving the previous complete deployment live. The next
scheduled run retries. Deployments are serialized. Public `search-coverage.json`
records the generation time, source commit, counts, coverage, and limitations;
check its timestamp and the workflow's Actions run when diagnosing freshness.

The workflow only reads repository contents. Its deploy job uses GitHub's
short-lived Pages deployment token; there are no personal access tokens, secrets,
auto-commits, or per-project setup. It explicitly checks Pages `build_type` and
refuses to deploy while branch publishing is enabled, which could overwrite the
built index. **One-time activation:** in this repository's Settings → Pages,
choose **GitHub Actions** as Source, then run **Refresh search and publish
homepage** from Actions. Verify its first successful deployment and live coverage
before treating automation as enabled. No settings change is needed for later
pages. GitHub disables schedules in public repositories after 60 days without
repository activity; re-enable the workflow if GitHub marks it disabled.

To run the same build locally:

```sh
npm ci --ignore-scripts
npm test
npm run build:site
node tools/verify-search-artifact.mjs
```

For an urgent refresh, use Actions → Refresh search and publish homepage → Run
workflow. Generated index files are deployed as an artifact, not committed on
each refresh. The checked-in `pagefind/`, `pagefind-ja/`, and coverage snapshot are
legacy fallback assets; Actions always replaces them with the freshly built
artifact. `npm run refresh:search` remains a local export command for deliberate
branch-mode rollback only, not the automated release path.

For offline iteration, `node tools/build-search.mjs --cached` reuses successful
responses in ignored `.search-cache/`. Cached artifacts cannot pass the deployment
validator. Delete that directory to discard local snapshots. The index omits
image/video/audio transcription, downloads, external linked websites, transient
telemetry, private data and runtime game state. A brand-new JavaScript-only app
with no rendered HTML or compatible public manifest may need a content adapter;
a generic crawler cannot infer hidden application routes safely. Existing NDB
story datasets and arbitrary generated puzzle permutations are outside the
published interface-copy adapter. Adding ordinary linked HTML requires no adapter.

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

Mathematics has an abstract continuous-loop category mark, distinct from the Erdős guide’s graph icon. Its destination links remain plain text, as in the other categories.
Me has an abstract whorl mark: nested arches around one point, drawn from the ridges of a fingerprint.

Agents has an abstract open-spiral mark. The loop resolves into one straight stroke, with a faint echo of its outer turn. A change to the homepage stylesheet also changes its `?v=` value in `lib/directory.mjs` and the static test.
