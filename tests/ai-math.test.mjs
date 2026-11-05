import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderAiMath, typesetMath, mathChars, validateAiMath } from '../lib/ai-math.mjs';
import { UG_CONSTRAINTS, UG_LABELS, UNIT_ARRANGEMENTS, ZETA_ZEROS, deltoidNeedle, deltoidPoint, figures, unitPairs } from '../lib/ai-math-figures.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/ai-math.json', root), 'utf8'));
const bodies = Object.fromEntries(await Promise.all(data.results.map(async ({ slug }) => [slug, await readFile(new URL(`content/ai-math/${slug}.html`, root), 'utf8')])));
const pages = renderAiMath(data, bodies);
const pageOf = slug => pages.find(([path]) => path === `${slug}/index.html`)[1];

test('the committed pages are the deterministic build of the data and bodies', async () => {
  for (const [path, html] of pages) assert.equal(await readFile(new URL(`ai-math/${path}`, root), 'utf8'), html, `Run node build.mjs after changing ${path}.`);
  assert.deepEqual(pages, renderAiMath(data, bodies));
});

test('the landing page lists every result in authored order, and each page links back', () => {
  const landing = pages[0][1];
  assert.deepEqual([...landing.matchAll(/<a class="ai-math-result" href="([^"]+)\/">/g)].map(m => m[1]), data.results.map(r => r.slug));
  assert.match(landing, /<link rel="canonical" href="https:\/\/jehlp\.net\/ai-math\/">/);
  assert.match(landing, /<h1 class="site-title">AI Math Results<\/h1>/);
  assert.match(landing, /The pages do not show the proofs/);
  for (const { slug } of data.results) {
    const page = pageOf(slug);
    assert.match(page, new RegExp(`<link rel="canonical" href="https://jehlp\\.net/ai-math/${slug}/">`));
    assert.match(page, /<a class="site-title" href="\.\.\/">AI Math Results<\/a>/);
    assert.match(page, /<p class="ai-math-back"><a href="\.\.\/">All results<\/a><\/p>/);
    assert.match(page, /<img class="site-mark" src="https:\/\/jehlp\.net\/site-theme\/v2\/marks\/ai-math\.png" width="32" height="32" alt="">/);
    assert.match(page, /<span class="site-utility-pair"><a class="site-home" href="https:\/\/jehlp\.net\/"/);
    assert.equal((page.match(/<h1[ >]/g) || []).length, 1, slug);
  }
});

test('the frame uses the theme versions of the homepage', async () => {
  const index = await readFile(new URL('index.html', root), 'utf8');
  for (const asset of ['theme\\.js', 'base\\.css']) assert.equal(pages[0][1].match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1], index.match(new RegExp(`${asset}\\?v=([\\w-]+)`))[1]);
});

test('every page keeps the required sections in order, a status date and at least two sources', () => {
  for (const { slug } of data.results) {
    const page = pageOf(slug), order = ['question', 'examples', 'result', 'not', 'checked', 'sources'].map(id => page.indexOf(`<h2 id="${id}">`));
    assert.ok(order.every(position => position > 0), slug);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), slug);
    assert.match(page, new RegExp(`<dt>Status date</dt><dd>${data.checked}</dd>`));
    assert.ok((page.split('<h2 id="sources">')[1].match(/<a href="https:/g) || []).length >= 2, slug);
  }
});

test('math becomes native MathML with no TeX, script or typesetter left in a page', () => {
  assert.match(typesetMath('\\(x &gt; 0\\)'), /^<math>.*&gt;.*<\/math>$/);
  assert.match(typesetMath('\\(x\\), and'), /^<span class="ai-math-nobreak"><math>.*<\/math>,<\/span> and$/);
  assert.match(typesetMath('\\[ x^2 \\]'), /^<div class="ui-equation" data-scroll-region data-scroll-noun="of the formula" aria-label="Formula"><math display="block"/);
  assert.match(mathChars('ℤ & <ℚ>'), /<span class="ui-math-char">ℤ<\/span> &amp; &lt;<span class="ui-math-char">ℚ<\/span>&gt;/);
  for (const [path, html] of pages) {
    assert.doesNotMatch(html, /\\\(|\\\[|\\\)|\\\]|\{\{/, path);
    assert.doesNotMatch(html, /katex|mathjax|temml\.(?:js|mjs)|\.css"[^>]*temml/i, path);
    for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert.match(src, /^https:\/\/jehlp\.net\/site-theme\/v2\/(?:theme|components)\.js/, path);
  }
});

test('validation rejects a missing section, an unknown figure, a repeated slug and a broken link', () => {
  const slug = data.results[0].slug, one = { checked: data.checked, results: [data.results[0]] };
  const good = bodies[slug].replace(/href="\.\.\/[^"]+\/"/g, 'href="https://example.com/"');
  assert.doesNotThrow(() => validateAiMath(one, { [slug]: good }));
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('<h2 id="not">', '<h2>') }), /no not section/);
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('{{fig:shadow}}', '{{fig:nothing}}') }), /Unknown figure/);
  assert.throws(() => validateAiMath(one, { [slug]: good + '{{source:x}}' }), /Unknown directive/);
  assert.throws(() => validateAiMath({ checked: data.checked, results: [data.results[0], data.results[0]] }, { [slug]: good }), /repeated slug/);
  assert.throws(() => validateAiMath(one, { [slug]: bodies[slug] }), /Broken link/);
  assert.throws(() => validateAiMath(one, {}), /Missing body/);
});

// A screen, not a certification: STE counts names and formulas in its own way.
const plain = html => html.replace(/<math[\s\S]*?<\/math>/g, 'X').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const sentences = text => text.replace(/\b(\d)\.(\d)/g, '$1_$2').split(/(?<=[.!?:])\s+(?=[A-Z"X(])/).filter(s => /\w/.test(s));
test('original prose stays within the writing policy limits', () => {
  const problems = [];
  for (const { slug } of data.results) {
    const main = pageOf(slug).split('<main')[1].split(/<h2 id="sources">/)[0];
    const blocks = [...main.matchAll(/<(p|li)(?: [^>]*)?>([\s\S]*?)<\/\1>/g)].map(m => plain(m[2]));
    for (const block of blocks) {
      if (block.includes(';')) problems.push(`${slug}: semicolon in "${block.slice(0, 70)}"`);
      if (block.includes('?')) problems.push(`${slug}: question in "${block.slice(0, 70)}"`);
      const parts = sentences(block);
      if (parts.length > 6) problems.push(`${slug}: ${parts.length} sentences in "${block.slice(0, 70)}"`);
      for (const part of parts) {
        const words = part.split(' ').length;
        if (words > 25) problems.push(`${slug}: ${words} words in "${part}"`);
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

test('Jacobian page: the map sends the quoted inputs to the quoted outputs', () => {
  const F = (x, y, z) => {
    const one = Q.of(1), xy = x.mul(y), s = one.add(xy), t = Q.of(4).add(Q.of(3).mul(xy));
    return [
      s.pow(3).mul(z).add(y.pow(2).mul(s).mul(t)),
      y.add(Q.of(3).mul(x).mul(s.pow(2)).mul(z)).add(Q.of(3).mul(x).mul(y.pow(2)).mul(t)),
      Q.of(2).mul(x).sub(Q.of(3).mul(x.pow(2)).mul(y)).sub(x.pow(3).mul(z)),
    ];
  };
  const hits = (input, output) => F(...input).forEach((value, i) => assert.ok(value.eq(output[i]), `${input} coordinate ${i}`));
  for (const k of [1, 2, 5, 50]) {
    const a = Q.of(-1, 4 * k * k);
    hits([Q.of(0), Q.of(0), a], [a, Q.of(0), Q.of(0)]);
    hits([Q.of(k), Q.of(-3, 2 * k), Q.of(13, 2 * k * k)], [a, Q.of(0), Q.of(0)]);
    hits([Q.of(-k), Q.of(3, 2 * k), Q.of(13, 2 * k * k)], [a, Q.of(0), Q.of(0)]);
  }
  // The printed matrix at (0, 0, -1/4), expanded along its first row.
  const M = [[0, 0, 1], [Q.of(-3, 4), 1, 0], [2, 0, 0]].map(row => row.map(v => v instanceof Q ? v : Q.of(v)));
  const det = M[0][0].mul(M[1][1].mul(M[2][2]).sub(M[1][2].mul(M[2][1]))).sub(M[0][1].mul(M[1][0].mul(M[2][2]).sub(M[1][2].mul(M[2][0])))).add(M[0][2].mul(M[1][0].mul(M[2][1]).sub(M[1][1].mul(M[2][0]))));
  assert.ok(det.eq(Q.of(-2)));
  // The closed-form cubic for the x coordinates of the inputs.
  const cubic = (a, b, c) => [Q.of(27).mul(a.pow(2)).mul(c.pow(2)).sub(Q.of(18).mul(a).mul(b).mul(c)).add(Q.of(16).mul(a)).add(b.pow(3).mul(c)).sub(b.pow(2)), Q.of(4).sub(Q.of(3).mul(b).mul(c)), Q.of(-2).mul(c)];
  const [p, q, r] = cubic(Q.of(1, 27), Q.of(2, 3), Q.of(2));
  assert.ok(p.eq(Q.of(0)) && q.eq(Q.of(0)) && r.eq(Q.of(-4)), 'the output (1/27, 2/3, 2) has no input');
  const [p2, q2, r2] = cubic(Q.of(0), Q.of(0), Q.of(1));
  assert.ok(p2.eq(Q.of(0)) && q2.eq(Q.of(4)) && r2.eq(Q.of(-2)), 'the output (0, 0, 1) has one input');
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
  assert.deepEqual(F.map(f => Math.max(...[...f.keys()].map(m => parts(m).reduce((sum, e) => sum + e, 0)))), [7, 6, 4]);
});

test('Hilbert page: the quoted solutions satisfy their equations', () => {
  assert.ok(Q.of(17, 21).pow(3).add(Q.of(37, 21).pow(3)).eq(Q.of(6)));
  assert.ok(Q.of(3, 5).pow(2).add(Q.of(4, 5).pow(2)).eq(Q.of(1)));
  const cubes = new Set(); for (let p = 0; p < 9; p++) for (let q = 0; q < 9; q++) cubes.add((p ** 3 + q ** 3) % 9);
  assert.ok(!cubes.has(6), 'no two integer cubes add up to 6');
  const x = new Q(375494528127162193105504069942092792346201n, 6215987776871505425463220780697238044100n);
  const y2 = x.pow(3).add(Q.of(877).mul(x));
  assert.equal(isqrt(y2.n) ** 2n, y2.n);
  assert.equal(isqrt(y2.d) ** 2n, y2.d);
});

test('Diophantine page: the examples and tower sizes are exact', () => {
  assert.ok(Q.of(3, 7).eq(Q.of(4, 7).pow(2).add(Q.of(2, 7).pow(2)).add(Q.of(1, 7).pow(2))));
  assert.ok(Q.of(5, 13).pow(2).add(Q.of(12, 13).pow(2)).eq(Q.of(1)));
  assert.equal(2 ** 16, 65536);
  assert.equal((2n ** 65536n).toString().length, 19729);
  assert.equal(292890231904 + 1, 292890231905);
});

test('Unit distance page: the small arrangements and the grid counts are exact', () => {
  for (const [key, count] of [['three', 3], ['four', 5], ['seven', 12], ['nine', 18]]) assert.equal(unitPairs(UNIT_ARRANGEMENTS[key]).length, count, key);
  assert.equal(new Set(UNIT_ARRANGEMENTS.nine.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)).size, 9);
  const vectors = m => { const out = []; const r = Math.floor(Math.sqrt(m)); for (let p = -r; p <= r; p++) for (let q = -r; q <= r; q++) if (p * p + q * q === m) out.push([p, q]); return out; };
  const pairs = (side, m) => vectors(m).filter(([p, q]) => p > 0 || (p === 0 && q > 0)).reduce((sum, [p, q]) => sum + (side - Math.abs(p)) * (side - Math.abs(q)), 0);
  for (const [m, neighbors, count] of [[1, 4, 1998000], [5, 8, 3988008], [65, 16, 7920144], [1105, 32, 15333376], [32045, 64, 25063376]]) {
    assert.equal(vectors(m).length, neighbors, `m=${m}`);
    assert.equal(pairs(1000, m), count, `m=${m}`);
  }
  assert.equal(vectors(25).length, 12);
});

test('Quasi-Riemann page: prime counts, last digits and the zeta sums match', () => {
  const N = 1_000_000, sieve = new Uint8Array(N + 1).fill(1); sieve[0] = sieve[1] = 0;
  for (let i = 2; i * i <= N; i++) if (sieve[i]) for (let j = i * i; j <= N; j += i) sieve[j] = 0;
  assert.equal(sieve.reduce((sum, v) => sum + v, 0), 78498);
  const partial = terms => { let sum = 0; for (let n = 1; n <= terms; n++) sum += 1 / (n * n); return sum; };
  assert.equal(partial(10).toFixed(4), '1.5498');
  assert.equal(partial(1000).toFixed(4), '1.6439');
  assert.equal((Math.PI ** 2 / 6).toFixed(4), '1.6449');
  assert.deepEqual(ZETA_ZEROS.map(z => z.toFixed(2)), ['14.13', '21.02', '25.01', '30.42', '32.94']);
  const squares = new Set(); for (let i = 1; i < 7; i++) squares.add(i * i % 7);
  assert.deepEqual([...squares].sort(), [1, 2, 4]);
});

test('Kakeya page: every drawn needle has length one, with both ends on the deltoid', () => {
  for (let k = 0; k < 24; k++) {
    const [p, q] = deltoidNeedle(.25, k * Math.PI / 12 + .13);
    assert.ok(Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1]) - 1) < 1e-12);
    for (const end of [p, q]) {
      let best = Infinity;
      for (let i = 0; i < 20000; i++) { const [x, y] = deltoidPoint(.25, i * 2 * Math.PI / 20000); best = Math.min(best, Math.hypot(x - end[0], y - end[1])); }
      assert.ok(best < 1e-3, `end point of needle ${k} is ${best} from the curve`);
    }
  }
  assert.equal((Math.log(2) / Math.log(3)).toFixed(3), '0.631');
  assert.equal((Math.PI / 8).toFixed(3), '0.393');
  assert.equal((1 / Math.sqrt(3)).toFixed(3), '0.577');
});

test('Exponential Time page: the formula has exactly the listed solutions', () => {
  const clauses = [[1, 2, 3], [-1, -2, 3], [1, -2, -3], [-1, 2, -3]];
  const outcome = [];
  for (const bits of [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]]) {
    const failed = clauses.findIndex(clause => !clause.some(lit => lit > 0 ? bits[lit - 1] : !bits[-lit - 1]));
    outcome.push(failed < 0 ? 'Solution' : `Clause ${failed + 1} fails`);
  }
  assert.deepEqual(outcome, ['Clause 1 fails', 'Solution', 'Solution', 'Clause 3 fails', 'Solution', 'Clause 4 fails', 'Clause 2 fails', 'Solution']);
  const c = logTen => { const ln = logTen * Math.LN10; return Math.log(ln) / Math.sqrt(ln); };
  assert.deepEqual([3, 12, 100, 1000, 10000, 1000000].map(n => c(n).toFixed(3)), ['0.735', '0.631', '0.358', '0.161', '0.066', '0.010']);
  assert.equal((2 ** 100 / 1e18 / (365.25 * 86400) / 1000).toFixed(0), '40');
});

test('Unique Games page: the labels satisfy all eight constraints and the changed system behaves as stated', () => {
  const score = (constraints, labels) => constraints.filter(([from, to, k]) => (labels[from] + k) % 5 === labels[to]).length;
  assert.equal(UG_CONSTRAINTS.length, 8);
  assert.equal(score(UG_CONSTRAINTS, UG_LABELS), 8);
  const changed = [['a', 'b', 3], ...UG_CONSTRAINTS.slice(1)];
  let best = 0;
  for (let n = 0; n < 5 ** 5; n++) {
    const digits = [0, 1, 2, 3, 4].map(i => Math.floor(n / 5 ** i) % 5);
    best = Math.max(best, score(changed, { a: digits[0], b: digits[1], c: digits[2], d: digits[3], e: digits[4] }));
  }
  assert.equal(best, 7);
  const walked = { a: 0 }; for (const [from, to, k] of changed.slice(0, 4)) walked[to] = (walked[from] + k) % 5;
  assert.equal(score(changed, walked), 6);
  assert.equal((1 - .99 ** 100).toFixed(2), '0.63');
  let cut = 0; for (let n = 0; n < 32; n++) cut = Math.max(cut, [0, 1, 2, 3, 4].filter(i => ((n >> i) & 1) !== ((n >> ((i + 1) % 5)) & 1)).length);
  assert.equal(cut, 4);
});

test('Navier–Stokes page: the model equations give the quoted values', () => {
  assert.deepEqual([0, .5, .9, .99, .999].map(t => Math.round(1 / (1 - t))), [1, 2, 10, 100, 1000]);
  assert.deepEqual([0, .5, .9, .99, .999, 1].map(t => Math.exp(t).toFixed(2)), ['1.00', '1.65', '2.46', '2.69', '2.72', '2.72']);
  assert.equal(Math.log(2).toFixed(3), '0.693');
  const check = (y, f, t) => { const h = 1e-6; assert.ok(Math.abs((y(t + h) - y(t - h)) / (2 * h) - f(y(t))) < 1e-4); };
  check(t => 1 / (1 + Math.exp(t)), y => y * y - y, .3);
  check(t => 1 / (1 - Math.exp(t) / 2), y => y * y - y, .3);
});

test('figures are named, stay on theme tokens and contain no raw color', async () => {
  for (const [name, figure] of Object.entries(figures)) {
    const out = figure();
    assert.match(out, /<svg viewBox="[\d. ]+" role="img" aria-label="[^"]+">/, name);
    assert.doesNotMatch(out, /#[0-9a-f]{3,8}\b|fill="|stroke="|style="|NaN|undefined/i, name);
  }
  const css = await readFile(new URL('assets/ai-math.css', root), 'utf8');
  for (const [name, figure] of Object.entries(figures)) for (const [, cls] of figure().matchAll(/class="(fig-[\w-]+)"/g)) assert.match(css, new RegExp(`\\.${cls}\\b`), `${name}: ${cls}`);
});

test('the release artifact publishes the pages', async () => {
  const build = await readFile(new URL('tools/build-search.mjs', root), 'utf8');
  assert.match(build, /'accounts', 'ai-math'\]/);
  const verify = await readFile(new URL('tools/verify-search-artifact.mjs', root), 'utf8');
  assert.match(verify, /_site\/ai-math\/index\.html/);
});
