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
category has a unique `id`, `label`, `mark`, `open`, and a `pages` array. Each page
has a unique `id`, `label`, and root-relative `href` ending in `/`. IDs use lowercase
letters, digits, and hyphens. Marks are `parentheses`, `constellation`, `asterisk`,
`section`, or `chevrons`; extend the named mark registry in `lib/directory.mjs` and the local
study CSS for a genuinely new motif. Categories can reuse existing marks.

Add future categories with `open: false` when expansion would make the initial
view too long. There is no category or page-count limit in the generator. All
links are present in static HTML; native disclosures still work without scripts.
Search matches category and destination words, temporarily opens matching groups,
and restores earlier disclosure states when cleared. `/` opens search; Escape
clears and closes it, returning focus to its button.

`assets/discovery.mjs` supplements—not replaces—the authored directory with new,
non-archived public GitHub Pages repositories. It paginates up to ten 100-repository
batches, excludes the homepage/theme and known destinations case-insensitively,
and adds safe jehlp.net links under a closed Other category. Network failure or
rate limiting leaves all authored links intact. Curate discovered pages into the
JSON to choose their category and readable name; do not depend on discovery for
the canonical directory.

The current four groups preserve all thirteen destinations. Games includes the
playable NDB Idle, authored Puzzles, and Baba Is You recordings; the latter's label
distinguishes viewing from playing. Links belongs with Reading. Category metadata
is generated from the labels, not a fixed list of the original categories.

## Verification and release

Check 390px/1440px, light/dark, 200% text, native disclosure keyboard behavior,
search and empty results, Escape/focus restoration, no-JS, print, and a much
larger category fixture. Node tests cover rendering, schema rejection, and mocked
discovery—not browser accessibility. Keep CNAME and canonical metadata intact.
Use explicit staging, publish `main`, and verify the actual homepage and its local
assets after the Pages workflow completes. Shared skills and release evidence
are maintained in `site-theme`.
