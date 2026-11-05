import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderAiMath, typesetMath, mathChars, validateAiMath } from '../lib/ai-math.mjs';
import { UG_CONSTRAINTS, UG_VALUES, ZETA_ZEROS, deltoidNeedle, deltoidPoint, figures, paleyMatrix } from '../lib/ai-math-figures.mjs';

const root = new URL('../', import.meta.url);
const results = JSON.parse(await readFile(new URL('data/ai-math.json', root), 'utf8'));
const bodies = Object.fromEntries(await Promise.all(results.map(async ({ slug }) => [slug, await readFile(new URL(`content/ai-math/${slug}.html`, root), 'utf8')])));
const pages = renderAiMath(results, bodies);
const pageOf = slug => pages.find(([path]) => path === `${slug}/index.html`)[1];
const articleOf = slug => pageOf(slug).split('<article')[1].split('</article>')[0];

test('the committed pages are the deterministic build of the data and bodies', async () => {
  for (const [path, html] of pages) assert.equal(await readFile(new URL(`ai-math/${path}`, root), 'utf8'), html, `Run node build.mjs after changing ${path}.`);
  assert.deepEqual(pages, renderAiMath(results, bodies));
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
test('each explainer is a two-minute read', () => {
  const counts = Object.fromEntries(results.map(({ slug }) => [slug, plain(articleOf(slug)).split(' ').length]));
  for (const [slug, words] of Object.entries(counts)) assert.ok(words <= 300, `${slug} has ${words} words`);
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
  assert.doesNotThrow(() => validateAiMath(one, { [slug]: good }));
  assert.throws(() => validateAiMath(one, { [slug]: `<h2>The question</h2>${good}` }), /has a heading/);
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('class="ai-math-side"', '') }), /exactly one margin figure/);
  assert.throws(() => validateAiMath(one, { [slug]: good.replace('{{fig:shadow}}', '{{fig:nothing}}') }), /Unknown figure/);
  assert.throws(() => validateAiMath(one, { [slug]: `${good}{{source:x}}` }), /Unknown directive/);
  assert.throws(() => validateAiMath([results[0], results[0]], { [slug]: good }), /repeated slug/);
  assert.throws(() => validateAiMath(one, { [slug]: bodies[slug] }), /Broken link/);
  assert.throws(() => validateAiMath(one, {}), /Missing body/);
});

// A screen, not a certification: STE counts names and formulas in its own way.
const sentences = text => text.replace(/\b(\d)\.(\d)/g, '$1_$2').split(/(?<=[.!?:])\s+(?=[A-Z"X(])/).filter(s => /\w/.test(s));
test('original prose stays within the writing policy limits', () => {
  const problems = [];
  for (const { slug } of results) {
    for (const [, , inner] of articleOf(slug).matchAll(/<(p|figcaption)(?: [^>]*)?>([\s\S]*?)<\/\1>/g)) {
      const block = plain(inner);
      if (block.includes(';')) problems.push(`${slug}: semicolon in "${block.slice(0, 70)}"`);
      if (block.includes('?')) problems.push(`${slug}: question in "${block.slice(0, 70)}"`);
      const parts = sentences(block);
      if (parts.length > 6) problems.push(`${slug}: ${parts.length} sentences in "${block.slice(0, 70)}"`);
      for (const part of parts) if (part.split(' ').length > 25) problems.push(`${slug}: ${part.split(' ').length} words in "${part}"`);
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
