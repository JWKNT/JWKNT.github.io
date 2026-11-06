import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderAiMath, typesetMath, mathChars, validateAiMath } from '../lib/ai-math.mjs';
import { allowedPage, ORIGIN } from '../lib/search-content.mjs';
import { APSP_EDGES, UG_CONSTRAINTS, UG_VALUES, ZETA_ZEROS, deltoidNeedle, deltoidPoint, figures, k5Color, paleyMatrix } from '../lib/ai-math-figures.mjs';

const root = new URL('../', import.meta.url);
const results = JSON.parse(await readFile(new URL('data/ai-math.json', root), 'utf8'));
const readBodies = async suffix => Object.fromEntries(await Promise.all(results.map(async ({ slug }) => [slug, await readFile(new URL(`content/ai-math/${slug}${suffix}.html`, root), 'utf8')])));
const bodies = await readBodies('');
const simpleBodies = await readBodies('.simple');
const pages = renderAiMath(results, bodies, simpleBodies);
const pageOf = slug => pages.find(([path]) => path === `${slug}/index.html`)[1];
const simplePageOf = slug => pages.find(([path]) => path === `${slug}/simple/index.html`)[1];
const articleIn = page => page.split('<article')[1].split('</article>')[0];
const articleOf = slug => articleIn(pageOf(slug));
const simpleArticleOf = slug => articleIn(simplePageOf(slug));

test('the committed pages are the deterministic build of the data and bodies', async () => {
  for (const [path, html] of pages) assert.equal(await readFile(new URL(`ai-math/${path}`, root), 'utf8'), html, `Run node build.mjs after changing ${path}.`);
  assert.deepEqual(pages, renderAiMath(results, bodies, simpleBodies));
});

test('the landing page is a list of titles and nothing else', () => {
  const landing = pages[0][1], main = landing.split('<main')[1];
  assert.deepEqual([...landing.matchAll(/<a class="ai-math-result" href="([^"]+)\/">/g)].map(m => m[1]), results.map(r => r.slug));
  assert.match(landing, /<link rel="canonical" href="https:\/\/jehlp\.net\/ai-math\/">/);
  assert.match(landing, /<h1 class="site-title">AI Math Results<\/h1>/);
  assert.doesNotMatch(main, /<p[ >]|<h2|<dl|<section/);
});

test('each explainer is a title, short paragraphs and one margin figure', () => {
  for (const { slug, title } of results) {
    const page = pageOf(slug), article = articleOf(slug);
    assert.match(page, new RegExp(`<link rel="canonical" href="https://jehlp\\.net/ai-math/${slug}/">`));
    assert.match(page, /<span class="site-title">AI Math Results<\/span><\/div>\s*<nav aria-label="Site links"><a href="\.\.\/">All results<\/a>/);
    assert.match(page, /<img class="site-mark" src="https:\/\/jehlp\.net\/site-theme\/v2\/marks\/ai-math\.png" width="32" height="32" alt="">/);
    assert.equal((page.match(/<h1[ >]/g) || []).length, 1, slug);
    assert.doesNotMatch(article, /<h[2-6][ >]|<dl|site-divider|class="lede"/, slug);
    assert.doesNotMatch(article, /\bSources\b|\bStatus\b|Peer review|Why the result matters/, slug);
    assert.equal((article.match(/class="ai-math-side"/g) || []).length, 1, slug);
    assert.ok(title.length < 40, slug);
  }
});

const plain = html => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<math[\s\S]*?<\/math>/g, 'X').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const wordsIn = article => plain(article.replace(/<a class="ai-math-version"[^>]*>[^<]*<\/a>/, '')).split(' ').length;
test('each explainer is a two-minute read', () => {
  for (const { slug } of results) assert.ok(wordsIn(articleOf(slug)) <= 300, `${slug} has ${wordsIn(articleOf(slug))} words`);
});

test('the short page is the default, and its button opens a longer plain page and returns', () => {
  const landing = pages[0][1];
  assert.doesNotMatch(landing, /simple\//, 'the landing page links to the short pages');
  for (const { slug, title, description } of results) {
    assert.match(articleOf(slug), /<div class="ai-math-head"><h1>[\s\S]*?<\/h1><a class="ai-math-version" href="simple\/">Simplify<\/a><\/div>/, slug);
    const page = simplePageOf(slug), article = simpleArticleOf(slug);
    assert.match(article, /<div class="ai-math-head"><h1>[\s\S]*?<\/h1><a class="ai-math-version" href="\.\.\/">Short version<\/a><\/div>/, slug);
    assert.match(page, new RegExp(`<link rel="canonical" href="https://jehlp\\.net/ai-math/${slug}/simple/">`));
    assert.match(page, /<nav aria-label="Site links"><a href="\.\.\/\.\.\/">All results<\/a>/);
    assert.match(page, /href="\.\.\/\.\.\/\.\.\/assets\/ai-math\.css\?v=/);
    assert.ok(page.includes(`<title>${title.replaceAll('&', '&amp;')}, simplified · AI Math Results · jehlp.net</title>`), slug);
    assert.ok(page.includes(`content="${description} A longer version in plain language."`), slug);
    assert.equal(pageOf(slug).split('<h1>')[1].split('</h1>')[0], page.split('<h1>')[1].split('</h1>')[0], 'one title for both versions');
    // The same rules as the short page, with room to spell things out.
    assert.equal((page.match(/<h1[ >]/g) || []).length, 1, slug);
    assert.doesNotMatch(article, /<h[2-6][ >]|<dl|site-divider|class="lede"/, slug);
    assert.doesNotMatch(article, /\bSources\b|\bStatus\b|Peer review|Why the result matters/, slug);
    assert.equal((article.match(/class="ai-math-side"/g) || []).length, 1, slug);
    const words = wordsIn(article);
    assert.ok(words >= 1.5 * wordsIn(articleOf(slug)), `${slug}: ${words} words is not much longer than the short page`);
    assert.ok(words <= 800, `${slug} has ${words} words`);
  }
});

test('site search has one record for each result, the short page', () => {
  assert.equal(allowedPage('/ai-math/hadamard-matrices/', ORIGIN, ['/ai-math/']), '/ai-math/hadamard-matrices/');
  assert.equal(allowedPage('/ai-math/hadamard-matrices/simple/', ORIGIN, ['/ai-math/']), null);
  assert.equal(allowedPage('simple/', `${ORIGIN}/ai-math/hadamard-matrices/`, ['/ai-math/']), null);
  assert.equal(allowedPage('/ai-math/hadamard-matrices/simple/index.html', ORIGIN, ['/ai-math/']), null);
});

test('the frame uses the theme versions of the homepage', async () => {
  const index = await readFile(new URL('index.html', root), 'utf8');
  for (const asset of ['theme\\.js', 'base\\.css']) assert.equal(pages[0][1].match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1], index.match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1]);
});

test('math becomes native MathML with no TeX, script or typesetter left in a page', () => {
  assert.match(typesetMath('\\(x &gt; 0\\)'), /^<math>.*&gt;.*<\/math>$/);
  assert.match(typesetMath('\\(x\\), and'), /^<span class="ai-math-nobreak"><math>.*<\/math>,<\/span> and$/);
  assert.match(typesetMath('\\[ x^2 \\]'), /^<div class="ui-equation" data-scroll-region data-scroll-noun="of the formula" aria-label="Formula"><math display="block"/);
  assert.match(mathChars('ℤ & <ℚ>'), /<span class="ui-math-char">ℤ<\/span> &amp; &lt;<span class="ui-math-char">ℚ<\/span>&gt;/);
  for (const [path, html] of pages) {
    assert.doesNotMatch(html, /\\\(|\\\[|\\\)|\\\]|\{\{/, path);
    assert.doesNotMatch(html, /katex|mathjax|temml\.(?:js|mjs)/i, path);
    for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert.match(src, /^https:\/\/jehlp\.net\/site-theme\/v2\/(?:theme|components)\.js/, path);
  }
});

test('validation rejects a heading, a missing figure, an unknown figure, a repeated slug and a broken link', () => {
  const slug = results[0].slug, one = [results[0]], good = bodies[slug].replace(/href="\.\.\/[^"]+\/"/g, 'href="https://example.com/"');
  const simple = { [slug]: simpleBodies[slug].replace(/href="\.\.\/\.\.\/[^"]+\/"/g, 'href="https://example.com/"') };
  assert.doesNotThrow(() => validateAiMath(one, { [slug]: good }, simple));
  assert.throws(() => validateAiMath(one, { [slug]: `<h2>The question</h2>${good}` }, simple), /has a heading/);
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('class="ai-math-side"', '') }, simple), /exactly one margin figure/);
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('{{fig:shadow}}', '{{fig:nothing}}') }, simple), /Unknown figure/);
  assert.throws(() => validateAiMath(one, { [slug]: `${good}{{source:x}}` }, simple), /Unknown directive/);
  assert.throws(() => validateAiMath([results[0], results[0]], { [slug]: good }, simple), /repeated slug/);
  assert.throws(() => validateAiMath(one, { [slug]: bodies[slug] }, simple), /Broken link/);
  assert.throws(() => validateAiMath(one, {}, simple), /Missing body/);
  assert.throws(() => validateAiMath(one, { [slug]: good }, {}), /Missing simple body/);
  assert.throws(() => validateAiMath(one, { [slug]: good }, { [slug]: `<h2>The idea</h2>${simple[slug]}` }), /has a heading/);
  // A link from a simple page keeps the reader on the simple version of a known result.
  assert.throws(() => validateAiMath(one, { [slug]: good }, { [slug]: `${simple[slug]}<a href="../../missing/simple/">x</a>` }), /Broken link/);
  assert.throws(() => validateAiMath(one, { [slug]: good }, { [slug]: `${simple[slug]}<a href="../${slug}/">x</a>` }), /Broken link/);
  assert.doesNotThrow(() => validateAiMath(one, { [slug]: good }, { [slug]: `${simple[slug]}<a href="../../${slug}/simple/">x</a>` }));
});

// A screen, not a certification: STE counts names and formulas in its own way.
const sentences = text => text.replace(/\b(\d)\.(\d)/g, '$1_$2').split(/(?<=[.!?:])\s+(?=[A-Z"X(])/).filter(s => /\w/.test(s));
test('original prose stays within the writing policy limits', () => {
  const problems = [];
  for (const { slug } of results) {
    for (const article of [articleOf(slug), simpleArticleOf(slug)]) {
      for (const [, , inner] of article.matchAll(/<(p|figcaption)(?: [^>]*)?>([\s\S]*?)<\/\1>/g)) {
        const block = plain(inner);
        if (block.includes(';')) problems.push(`${slug}: semicolon in "${block.slice(0, 70)}"`);
        if (block.includes('?')) problems.push(`${slug}: question in "${block.slice(0, 70)}"`);
        const parts = sentences(block);
        if (parts.length > 6) problems.push(`${slug}: ${parts.length} sentences in "${block.slice(0, 70)}"`);
        for (const part of parts) if (part.split(' ').length > 25) problems.push(`${slug}: ${part.split(' ').length} words in "${part}"`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

// Exact checks for the calculations that the pages quote.
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
  constructor(n, d = 1n) { const g = gcd(n, d) * (d < 0n ? -1n : 1n); this.n = n / g; this.d = d / g; }
  static of(a, b = 1) { return new Q(BigInt(a), BigInt(b)); }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); }
  pow(k) { return k ? this.mul(this.pow(k - 1)) : Q.of(1); }
  eq(o) { return this.n === o.n && this.d === o.d; }
}
const isqrt = n => { let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };

test('Jacobian page: three inputs have one output', () => {
  const F = (x, y, z) => {
    const one = Q.of(1), xy = x.mul(y), s = one.add(xy), t = Q.of(4).add(Q.of(3).mul(xy));
    return [
      s.pow(3).mul(z).add(y.pow(2).mul(s).mul(t)),
      y.add(Q.of(3).mul(x).mul(s.pow(2)).mul(z)).add(Q.of(3).mul(x).mul(y.pow(2)).mul(t)),
      Q.of(2).mul(x).sub(Q.of(3).mul(x.pow(2)).mul(y)).sub(x.pow(3).mul(z)),
    ];
  };
  const output = [Q.of(-1, 4), Q.of(0), Q.of(0)];
  for (const input of [[Q.of(0), Q.of(0), Q.of(-1, 4)], [Q.of(1), Q.of(-3, 2), Q.of(13, 2)], [Q.of(-1), Q.of(3, 2), Q.of(13, 2)]]) {
    F(...input).forEach((value, i) => assert.ok(value.eq(output[i]), `coordinate ${i}`));
  }
});

test('Jacobian page: the determinant is -2 as a polynomial identity', () => {
  // Polynomials in x, y, z as a map from exponents to integer coefficients.
  const tidy = map => new Map([...map].filter(([, c]) => c !== 0n));
  const key = (i, j, k) => `${i},${j},${k}`, parts = text => text.split(',').map(Number);
  const c = n => new Map([[key(0, 0, 0), BigInt(n)]]);
  const add = (a, b, sign = 1n) => { const out = new Map(a); for (const [m, v] of b) out.set(m, (out.get(m) ?? 0n) + sign * v); return tidy(out); };
  const mul = (...factors) => factors.reduce((a, b) => { const out = new Map(); for (const [m, v] of a) for (const [n, w] of b) { const [p, q] = [parts(m), parts(n)], k = key(p[0] + q[0], p[1] + q[1], p[2] + q[2]); out.set(k, (out.get(k) ?? 0n) + v * w); } return tidy(out); });
  const diff = (a, axis) => { const out = new Map(); for (const [m, v] of a) { const e = parts(m); if (!e[axis]) continue; const power = BigInt(e[axis]); e[axis] -= 1; const k = key(...e); out.set(k, (out.get(k) ?? 0n) + v * power); } return tidy(out); };
  const x = new Map([[key(1, 0, 0), 1n]]), y = new Map([[key(0, 1, 0), 1n]]), z = new Map([[key(0, 0, 1), 1n]]);
  const s = add(c(1), mul(x, y)), t = add(c(4), mul(c(3), x, y));
  const F = [
    add(mul(s, s, s, z), mul(y, y, s, t)),
    add(add(y, mul(c(3), x, s, s, z)), mul(c(3), x, y, y, t)),
    add(add(mul(c(2), x), mul(c(3), x, x, y), -1n), mul(x, x, x, z), -1n),
  ];
  const J = F.map(f => [0, 1, 2].map(axis => diff(f, axis)));
  const minor = (a, b, d, e) => add(mul(a, e), mul(b, d), -1n);
  const det = add(add(mul(J[0][0], minor(J[1][1], J[1][2], J[2][1], J[2][2])), mul(J[0][1], minor(J[1][0], J[1][2], J[2][0], J[2][2])), -1n), mul(J[0][2], minor(J[1][0], J[1][1], J[2][0], J[2][1])));
  assert.deepEqual([...det], [[key(0, 0, 0), -2n]]);
});

test('Hilbert page: the table entries are exact', () => {
  assert.ok(Q.of(3, 5).pow(2).add(Q.of(4, 5).pow(2)).eq(Q.of(1)));
  assert.ok(Q.of(17, 21).pow(3).add(Q.of(37, 21).pow(3)).eq(Q.of(6)));
  const x = new Q(375494528127162193105504069942092792346201n, 6215987776871505425463220780697238044100n);
  const y2 = x.pow(3).add(Q.of(877).mul(x));
  assert.equal(isqrt(y2.n) ** 2n, y2.n);
  assert.equal(isqrt(y2.d) ** 2n, y2.d);
  assert.equal(x.n.toString().length, 42);
});

test('Diophantine page: the sizes are as stated', () => {
  assert.equal(Math.round(292890231905 / 1e9), 293);
  assert.ok(Q.of(3, 7).eq(Q.of(4, 7).pow(2).add(Q.of(2, 7).pow(2)).add(Q.of(1, 7).pow(2))), 'a fraction as a sum of squares');
});

test('Unit distance page: 25 has twelve representations and the figure shows them', () => {
  let count = 0; for (let p = -5; p <= 5; p++) for (let q = -5; q <= 5; q++) if (p * p + q * q === 25) count++;
  assert.equal(count, 12);
  assert.equal((figures['unit-grid']().match(/class="fig-dot-accent"/g) || []).length, 12);
});

test('Quasi-Riemann page: the figure shows the first five zeros', () => {
  assert.deepEqual(ZETA_ZEROS.map(z => z.toFixed(2)), ['14.13', '21.02', '25.01', '30.42', '32.94']);
});

test('Kakeya page: every drawn needle has length one, with both ends on the deltoid', () => {
  for (let k = 0; k < 12; k++) {
    const [p, q] = deltoidNeedle(.25, k * Math.PI / 6 + .13);
    assert.ok(Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1]) - 1) < 1e-12);
    for (const end of [p, q]) {
      let best = Infinity;
      for (let i = 0; i < 20000; i++) { const [x, y] = deltoidPoint(.25, i * 2 * Math.PI / 20000); best = Math.min(best, Math.hypot(x - end[0], y - end[1])); }
      assert.ok(best < 1e-3, `end point of needle ${k} is ${best} from the curve`);
    }
  }
  assert.equal((Math.log(2) / Math.log(3)).toFixed(2), '0.63');
});

test('Unique Games page: the values satisfy all eight equations, and the chain probability is right', () => {
  assert.equal(UG_CONSTRAINTS.length, 8);
  assert.equal(UG_CONSTRAINTS.filter(([from, to, k]) => (UG_VALUES[from] + k) % 5 === UG_VALUES[to]).length, 8);
  assert.equal((1 - .99 ** 100).toFixed(2), '0.63');
});

test('Navier–Stokes page: the model solution satisfies its equation', () => {
  const y = t => 1 / (1 - t), h = 1e-6;
  for (const t of [0, .5, .9]) assert.ok(Math.abs((y(t + h) - y(t - h)) / (2 * h) - y(t) ** 2) < 1e-2);
  assert.equal(y(0), 1);
});

test('Hadamard page: the drawn matrices are Hadamard, and the quoted orders hold', () => {
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const isHadamard = m => m.every((row, i) => m.every((other, j) => dot(row, other) === (i === j ? m.length : 0)));
  const four = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
  assert.ok(isHadamard(four));
  const twelve = paleyMatrix();
  assert.equal(twelve.length, 12);
  assert.ok(isHadamard(twelve));
  assert.ok(twelve.every(row => row.every(v => v === 1 || v === -1)));
  assert.equal(twelve[0].filter((v, j) => v === twelve[1][j]).length, 6);
  // Three orthogonal rows split the columns into four groups of equal size.
  const groups = new Map();
  for (let j = 0; j < 12; j++) { const key = [twelve[0][j], twelve[1][j], twelve[2][j]].join(); groups.set(key, (groups.get(key) ?? 0) + 1); }
  assert.deepEqual([...groups.values()].sort(), [3, 3, 3, 3]);
  assert.equal(668 ** 2, 446224);
  const orders = [668, 716, 892, 1132, 1244, 1388, 1436, 1676, 1772, 1916, 1948, 1964];
  assert.ok(orders.every(n => n % 4 === 0 && n < 2000));
  assert.equal(orders.length, 12);
  assert.equal(4 * 599, 2396);
  for (const n of orders) assert.ok(bodies['hadamard-matrices'].includes(String(n)), String(n));
});

test('Non-sofic page: the string operators obey the stated rules', () => {
  // Each operator maps a binary string to a string, or to null for zero.
  const s = bit => w => (w === null ? null : bit + w);
  const t = bit => w => (w !== null && w.startsWith(bit) ? w.slice(1) : null);
  for (const w of ['', '0', '1', '01', '10', '110', '0011']) {
    for (const i of ['0', '1']) assert.equal(t(i)(s(i)(w)), w);
    assert.equal(t('0')(s('1')(w)), null);
    assert.equal(t('1')(s('0')(w)), null);
    if (w) assert.equal([s('0')(t('0')(w)), s('1')(t('1')(w))].filter(x => x !== null).length, 1, 'one term survives');
    if (w) assert.equal(s('0')(t('0')(w)) ?? s('1')(t('1')(w)), w);
  }
  assert.equal(s('0')(t('0')('1')), null, 's0 t0 is not the identity');
  assert.equal((figures.cycle().match(/class="fig-dot"/g) || []).length, 12);
  for (let k = 1; k < 12; k++) for (let x = 0; x < 12; x++) assert.notEqual((x + k) % 12, x);
});

test('3SUM page: the example sums to zero', () => {
  assert.equal(-7 + 2 + 5, 0);
  assert.match(bodies['subquadratic-3sum'], /\{-7, -3, 2, 5, 8, 11\\\}/);
});

test('Shortest paths page: the route, the product and the table agree', () => {
  const names = ['a', 'b', 'c', 'd'], n = 4, index = Object.fromEntries(names.map((v, i) => [v, i]));
  const weights = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const [from, to, w] of APSP_EDGES) weights[index[from]][index[to]] = w;
  const floyd = weights.map(row => [...row]);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) floyd[i][j] = Math.min(floyd[i][j], floyd[i][k] + floyd[k][j]);
  assert.equal(weights[0][2], 7);
  assert.equal(floyd[0][2], 3);
  const star = (A, B) => A.map((_, i) => A.map((_, j) => Math.min(...A.map((_, k) => A[i][k] + B[k][j]))));
  assert.equal(star(weights, weights)[0][2], 3, 'two edges give the shorter route');
  assert.deepEqual(star(star(weights, weights), star(weights, weights)), floyd, 'repeated squaring gives all distances');
});

test('Quantum page: the game values are as stated', () => {
  const bits = [0, 1];
  let chsh = 0;
  for (const a0 of bits) for (const a1 of bits) for (const b0 of bits) for (const b1 of bits) {
    let wins = 0;
    for (const x of bits) for (const y of bits) if ((((x ? a1 : a0) + (y ? b1 : b0)) % 2) === (x & y)) wins++;
    chsh = Math.max(chsh, wins / 4);
  }
  assert.equal(chsh, .75);
  assert.equal((Math.cos(Math.PI / 8) ** 2).toFixed(3), '0.854');
  // One copy of Feige's game: an answer is a named player (0 Alice, 1 Bob) and a bit.
  const answers = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const wins = (x, y, a, b) => a[0] === b[0] && a[1] === b[1] && a[1] === (a[0] === 0 ? x : y);
  let single = 0;
  for (const a0 of answers) for (const a1 of answers) for (const b0 of answers) for (const b1 of answers) {
    let count = 0;
    for (const x of bits) for (const y of bits) if (wins(x, y, x ? a1 : a0, y ? b1 : b0)) count++;
    single = Math.max(single, count / 4);
  }
  assert.equal(single, .5);
  // The strategy in the table for two copies.
  let both = 0;
  for (const x1 of bits) for (const x2 of bits) for (const y1 of bits) for (const y2 of bits) {
    if (wins(x1, y1, [0, x1], [0, y2]) && wins(x2, y2, [1, x1], [1, y2])) { both++; assert.equal(x1, y2); }
  }
  assert.equal(both / 16, .5);
});

test('Ramsey page: the small facts and the stated rates hold', () => {
  const triangleFree = color => { for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) if (color(i, j) === color(i, k) && color(i, j) === color(j, k)) return false; return true; };
  assert.ok(triangleFree(k5Color), 'the drawn coloring has no one-color triangle');
  const edges = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) edges.push([i, j]);
  const position = new Map(edges.map(([i, j], e) => [`${i},${j}`, e]));
  let bad = 0;
  for (let mask = 0; mask < 2 ** 15; mask++) {
    let found = false;
    for (let i = 0; i < 6 && !found; i++) for (let j = i + 1; j < 6 && !found; j++) for (let k = j + 1; k < 6 && !found; k++) {
      const [p, q, r] = [position.get(`${i},${j}`), position.get(`${i},${k}`), position.get(`${j},${k}`)].map(e => (mask >> e) & 1);
      if (p === q && q === r) found = true;
    }
    if (!found) bad++;
  }
  assert.equal(bad, 0, 'every two-coloring on six points has a one-color triangle');
  assert.equal((380 ** .2).toFixed(2), '3.28');
});

// Exact checks for the extra numbers on the simple pages. Each number must appear on its page.
const quotes = (slug, ...values) => { for (const value of values) assert.ok(simpleBodies[slug].includes(value), `${slug} quotes ${value}`); };

test('Simple Diophantine page: the tower sizes and the worked tests', () => {
  assert.equal(2 ** 2 ** 2 ** 2, 65536);
  assert.equal(String(2n ** 65536n).length, 19729);
  assert.ok(Q.of(3, 4).mul(Q.of(4, 3)).eq(Q.of(1)));
  assert.ok(Q.of(3, 2).pow(2).eq(Q.of(9, 4)));
  quotes('z-diophantine-in-q', '65,536', '19,729', '9/4');
});

test('Simple ETH page: the settings, the years and the zeros', () => {
  assert.equal(2 ** 10, 1024);
  const settings = 2n ** 100n;
  assert.equal(String(settings).length, 31);
  assert.equal(String(settings).slice(0, 3), '126');
  assert.equal(Math.round(Number(settings) / 1e18 / (365.25 * 86400) / 1e4) * 1e4, 40000);
  quotes('exponential-time-hypothesis', '1,024', '1.27 \\times 10^{30}', '31 digits', '40,000 years', '10^{10\\,000}');
});

test('Simple quasi-Riemann page: the prime counts, the estimate and the scale', () => {
  const N = 1000000, composite = new Uint8Array(N + 1), byEnding = {};
  let total = 0, hundred = 0, thousand = 0;
  for (let i = 2; i <= N; i++) {
    if (composite[i]) continue;
    total++; if (i <= 100) hundred++; if (i <= 1000) thousand++;
    byEnding[i % 10] = (byEnding[i % 10] ?? 0) + 1;
    for (let j = i * i; j <= N; j += i) composite[j] = 1;
  }
  assert.deepEqual([hundred, thousand, total], [25, 168, 78498]);
  assert.deepEqual([byEnding[1], byEnding[3], byEnding[7], byEnding[9]], [19617, 19665, 19621, 19593]);
  // li(x), from the series gamma + ln ln x + sum of (ln x)^k / (k k!). It rounds to 78,628.
  const lnx = Math.log(N); let li = 0.57721566490153286 + Math.log(lnx), term = 1;
  for (let k = 1; k < 200; k++) { term *= lnx / k; li += term / k; }
  assert.equal(Math.round(li), 78628);
  assert.equal(78628 - 78498, 130);
  let zeta = 0; for (let k = 1; k <= 1e6; k++) zeta += 1 / k ** 2;
  assert.equal(zeta.toFixed(3), '1.645');
  assert.equal(Math.round(N ** .5), 1000);
  assert.equal(Math.round(N ** (7 / 8) / 1000), 178);
  // The number of zeros up to the checked height 3e12, by the Riemann-von Mangoldt formula.
  const T = 3e12, zeros = T / (2 * Math.PI) * (Math.log(T / (2 * Math.PI)) - 1);
  assert.equal(Math.round(zeros / 1e12), 12);
  quotes('quasi-riemann-hypothesis', '78,498', '78,628', '19,617', '19,665', '19,621', '19,593', '178,000', '12 trillion');
});

test('Simple Kakeya page: the areas and box counts', () => {
  assert.equal((Math.PI / 4).toFixed(3), '0.785');
  assert.equal((Math.PI / 8).toFixed(3), '0.393');
  quotes('kakeya-conjecture', '0.785', '0.393', '0.63');
});

test('Simple Jacobian page: the examples in the text', () => {
  const shear = ([x, y]) => [x + y ** 2, y], undo = ([u, v]) => [u - v ** 2, v];
  assert.deepEqual(shear([1, 2]), [5, 2]);
  assert.deepEqual(undo([5, 2]), [1, 2]);
  const fold = ([x, y]) => [x ** 2, y];
  assert.deepEqual(fold([1, 5]), fold([-1, 5]));
  quotes('jacobian-conjecture', '(1, 2)', '(5, 2)', '(-1, 5)');
});

test('Simple unit distance page: small arrangements, neighbor counts and the per-dot rates', () => {
  const representations = m => { let count = 0; for (let p = -300; p <= 300; p++) for (let q = -300; q <= 300; q++) if (p * p + q * q === m) count++; return count; };
  assert.deepEqual([25, 65, 1105].map(representations), [12, 16, 32]);
  const pairs = points => { let count = 0; points.forEach((a, i) => points.slice(i + 1).forEach(b => { if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - 1) < 1e-9) count++; })); return count; };
  const h = Math.sqrt(3) / 2;
  assert.equal(pairs([[0, 0], [1, 0], [.5, h]]), 3);
  assert.equal(pairs([[0, 0], [1, 0], [.5, h], [1.5, h]]), 5);
  assert.equal(pairs([[0, 0], [1, 0], [.5, h], [-.5, h], [-1, 0], [-.5, -h], [.5, -h]]), 12);
  assert.ok(Q.of(3, 5).pow(2).add(Q.of(4, 5).pow(2)).eq(Q.of(1)));
  assert.equal(Math.round(1e6 ** (4 / 3) / 1e6), 100);
  // The best spacing for a 1,000 by 1,000 grid: each displacement (p, q) occurs (W - |p|)(W - |q|) times.
  const W = 1000, totals = new Map();
  for (let p = -W + 1; p < W; p++) for (let q = -W + 1; q < W; q++) { const m = p * p + q * q; if (m) totals.set(m, (totals.get(m) ?? 0) + (W - Math.abs(p)) * (W - Math.abs(q))); }
  let most = 0; for (const total of totals.values()) most = Math.max(most, total);
  assert.equal(Math.round(most / 2 / W ** 2), 26);
  quotes('unit-distance-problem', '100 million', 'about 26 per dot', '1/\\sqrt{65}', '1/\\sqrt{1105}');
});

test('Simple Hilbert page: the worked equations', () => {
  assert.equal((-80538738812075974n) ** 3n + 80435758145817515n ** 3n + 12602123297335631n ** 3n, 42n);
  assert.equal(String(80538738812075974n).length, 17);
  assert.equal(3 ** 2 + 4 ** 2, 25);
  assert.ok(Q.of(17, 21).pow(3).add(Q.of(37, 21).pow(3)).eq(Q.of(6)));
  // Cubes modulo 9 are 0, 1 or 8, so two cubes cannot sum to 6 in the integers.
  for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) assert.notEqual((a ** 3 + b ** 3) % 9, 6);
  quotes('hilberts-tenth-problem', '17-digit', '42 digits');
});

test('Simple Unique Games page: the clock sum and the walk through the figure', () => {
  assert.equal((3 + 4) % 5, 2);
  assert.deepEqual([UG_VALUES.a, UG_VALUES.b, UG_VALUES.c, UG_VALUES.d, UG_VALUES.e], [0, 2, 3, 2, 0]);
  assert.equal((1 - .99 ** 100).toFixed(2), '0.63');
  quotes('unique-games', '\\(3 + 4 = 2\\)', '\\(a = 0\\) gives \\(b = 2\\), then \\(c = 3\\), \\(d = 2\\) and \\(e = 0\\)', '63%', '87.8%');
});

test('Simple Navier–Stokes page: the table of values', () => {
  const y = t => 1 / (1 - t);
  assert.deepEqual([0, .5, .9, .99, .999].map(t => Math.round(y(t))), [1, 2, 10, 100, 1000]);
  quotes('navier-stokes', '<td>1000</td>', '<td>Infinite</td>');
});

test('Simple Hadamard page: the rows, the doubling step and the count', () => {
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const isHadamard = m => m.every((row, i) => m.every((other, j) => dot(row, other) === (i === j ? m.length : 0)));
  const four = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.equal(four[i].filter((v, c) => v === four[j][c]).length, 2);
  assert.deepEqual([0, 1, 2, 3].filter(c => four[0][c] === four[1][c]), [0, 2], 'the first two rows agree in positions 1 and 3');
  const doubled = [...four.map(row => [...row, ...row]), ...four.map(row => [...row, ...row.map(v => -v)])];
  assert.equal(doubled.length, 8);
  assert.ok(isHadamard(doubled));
  assert.equal(String(2n ** 446224n).length, 134327);
  quotes('hadamard-matrices', '446,224', '134,327');
});

test('Simple 3SUM page: the walk through the list and the rates', () => {
  const list = [-3, 2, 5, 8, 11], walk = [];
  let low = 0, high = list.length - 1;
  while (low < high) { const sum = list[low] + list[high]; walk.push(sum); if (sum === 7) break; if (sum > 7) high--; else low++; }
  assert.deepEqual(walk, [8, 5, 10, 7]);
  assert.deepEqual([...simpleBodies['subquadratic-3sum'].matchAll(/ and \d+<\/td><td>(\d+)<\/td>/g)].map(m => Number(m[1])), walk, 'the table shows the walk');
  assert.equal(1000 * 999 * 998 / 6, 166167000);
  assert.equal(((1 - 1e9 ** -.0008) * 100).toFixed(1), '1.6');
  quotes('subquadratic-3sum', '166 million', '1.6%');
});

test('Simple shortest paths page: the rate', () => {
  assert.equal(APSP_EDGES.length, 6);
  assert.ok((1 - 1e6 ** -.0005) * 100 < 1);
  quotes('all-pairs-shortest-paths', 'less than 1%', 'six one-way roads');
});

test('Simple quantum page: the ten-round expectation', () => {
  assert.equal((.75 ** 10 * 100).toFixed(1), '5.6');
  quotes('quantum-parallel-repetition', '5.6%', '85.4%');
});

test('Simple Ramsey page: the table of limits and the product coloring', () => {
  const factorial = k => { let out = 1; for (let i = 2; i <= k; i++) out *= i; return out; };
  const short = value => value.toExponential(1).replace(/e\+(\d+)/, ' \\times 10^{$1}');
  const rows = [10, 20, 30].map(k => [`<td>${k}</td>`, `\\(${short(380 ** (k / 5))}\\)`, `\\(${short(Math.E * factorial(k))}\\)`]);
  for (const [k, lower, upper] of rows) quotes('multicolor-triangle-ramsey', `<tr>${k}<td>${lower}</td><td>${upper}</td></tr>`);
  // Two five-point colorings combine into 25 points and 4 colors with no one-color triangle.
  const color = (a, b) => (Math.floor(a / 5) === Math.floor(b / 5) ? k5Color(a % 5, b % 5) : k5Color(Math.floor(a / 5), Math.floor(b / 5)) + 2);
  for (let a = 0; a < 25; a++) for (let b = a + 1; b < 25; b++) for (let c = b + 1; c < 25; c++) assert.ok(!(color(a, b) === color(a, c) && color(a, b) === color(b, c)), `${a} ${b} ${c}`);
  assert.equal(new Set(Array.from({ length: 25 }, (_, a) => Array.from({ length: 25 }, (_, b) => (a < b ? color(a, b) : null))).flat().filter(v => v !== null)).size, 4);
});

test('figures are named, stay on theme tokens and contain no raw color', async () => {
  const css = await readFile(new URL('assets/ai-math.css', root), 'utf8');
  for (const [name, figure] of Object.entries(figures)) {
    const out = figure();
    assert.match(out, /<svg viewBox="[\d. ]+" role="img" aria-label="[^"]+" preserveAspectRatio="xMinYMin meet">/, name);
    assert.doesNotMatch(out, /#[0-9a-f]{3,8}\b|fill="|stroke="|style="|NaN|undefined/i, name);
    for (const [, cls] of out.matchAll(/class="(fig-[\w-]+)"/g)) assert.match(css, new RegExp(`\\.${cls}\\b`), `${name}: ${cls}`);
  }
  for (const name of Object.keys(figures)) assert.ok(Object.values(bodies).some(body => body.includes(`{{fig:${name}}}`)), `${name} is unused`);
});

test('the release artifact publishes the pages', async () => {
  const build = await readFile(new URL('tools/build-search.mjs', root), 'utf8');
  assert.match(build, /'accounts', 'ai-math'\]/);
  const verify = await readFile(new URL('tools/verify-search-artifact.mjs', root), 'utf8');
  assert.match(verify, /_site\/ai-math\/index\.html/);
});
