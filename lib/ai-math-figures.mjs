// Figures for /ai-math/. The build calculates every shape from its formula, so
// a figure cannot drift from the mathematics. Colors come from theme tokens
// through the fig-* classes in assets/ai-math.css.

const fmt = value => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
const svg = (width, height, label, body) => `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">${body}</svg>`;
const line = (x1, y1, x2, y2, cls = 'fig-line') => `<line class="${cls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
const dot = (x, y, r = 3, cls = 'fig-dot') => `<circle class="${cls}" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/>`;
const text = (x, y, value, cls = 'fig-label', anchor = 'start') => `<text class="${cls}" x="${fmt(x)}" y="${fmt(y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${value}</text>`;
const polyline = (points, cls = 'fig-line') => `<polyline class="${cls}" points="${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}"/>`;
const polygon = (points, cls = 'fig-band') => `<polygon class="${cls}" points="${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}"/>`;
const range = (from, to, count) => Array.from({ length: count + 1 }, (_, i) => from + (to - from) * i / count);

// The curve q = w² with rational w, and the shadow of each point on the q axis.
export function shadowFigure() {
  const X = q => 36 + q * 98, Y = w => 262 - w * 104;
  const fractions = [[0, 1], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [2, 1]];
  const curve = range(0, 2.12, 60).map(w => [X(w * w), Y(w)]);
  let body = line(X(0) - 12, Y(0), X(4.5), Y(0)) + line(X(0), Y(0) + 8, X(0), Y(2.2));
  for (const q of [0, 1, 2, 3, 4]) body += line(X(q), Y(0), X(q), Y(0) + 6) + text(X(q), Y(0) + 22, q, 'fig-label', 'middle');
  body += text(X(4.5) - 2, Y(0) - 8, 'q', 'fig-math', 'end') + text(X(0) - 12, Y(2.2) + 6, 'w', 'fig-math', 'end');
  body += polyline(curve);
  for (const [a, b] of fractions) {
    const w = a / b, q = w * w;
    if (a) body += line(X(q), Y(w), X(q), Y(0), 'fig-guide');
    body += dot(X(q), Y(w), 3) + dot(X(q), Y(0), 2.2, 'fig-dot-accent');
  }
  body += `<circle class="fig-open" cx="${fmt(X(2))}" cy="${fmt(Y(Math.SQRT2))}" r="4"/>`;
  body += text(X(2) + 9, Y(Math.SQRT2) + 18, 'w = √2 is not rational', 'fig-note');
  return svg(490, 296, 'The curve q equals w squared, with rational points and their shadows on the q axis', body);
}

export const ZETA_ZEROS = [14.134725, 21.022040, 25.010858, 30.424876, 32.935062];

// The upper half of the critical strip, with the proved zero-free bands.
export function stripFigure() {
  const X = re => 66 + (re + .25) * 240, top = 18, bottom = 292, Y = im => bottom - im * 7.5;
  let body = polygon([[X(0), top], [X(1 / 8), top], [X(1 / 8), bottom], [X(0), bottom]]) + polygon([[X(7 / 8), top], [X(1), top], [X(1), bottom], [X(7 / 8), bottom]]);
  for (const re of [0, 1]) body += line(X(re), top, X(re), bottom);
  body += line(X(1 / 2), top, X(1 / 2), bottom, 'fig-accent') + line(X(-.25), bottom, X(1.25), bottom);
  for (const [re, label] of [[0, '0'], [1 / 8, '1/8'], [1 / 2, '1/2'], [7 / 8, '7/8'], [1, '1']]) body += line(X(re), bottom, X(re), bottom + 5) + text(X(re), bottom + 20, label, 'fig-label', 'middle');
  for (const im of ZETA_ZEROS) body += dot(X(1 / 2), Y(im), 3.5, 'fig-dot-accent') + text(X(1 / 2) + 9, Y(im) + 4, im.toFixed(2), 'fig-note');
  body += text(X(.0625), top - 5, 'no zeros', 'fig-note', 'middle') + text(X(.9375), top - 5, 'no zeros', 'fig-note', 'middle');
  body += text(X(1.25), bottom - 8, 'Re s', 'fig-note', 'end');
  return svg(490, 322, 'The strip between real part 0 and real part 1, with zeros on the line at one half and shaded bands free of zeros', body);
}

const panel = (label, value, drawing) => `<figure class="ai-math-panel">${drawing}<figcaption><strong>${label}</strong><br>${value}</figcaption></figure>`;

// Three regions in which a needle of length 1 can turn around. 1 unit = 120 px.
export function deltoidNeedle(a, t) {
  const mx = a * Math.cos(t), my = a * Math.sin(t), dx = 2 * a * Math.cos(t / 2), dy = -2 * a * Math.sin(t / 2);
  return [[mx - dx, my - dy], [mx + dx, my + dy]];
}
export function deltoidPoint(a, t) {
  return [2 * a * Math.cos(t) + a * Math.cos(2 * t), 2 * a * Math.sin(t) - a * Math.sin(2 * t)];
}
export function kakeyaShapes() {
  const U = 120;
  // Disk of diameter 1.
  let disk = `<circle class="fig-line" cx="85" cy="85" r="${U / 2}"/>`;
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 8, dx = U / 2 * Math.cos(th), dy = U / 2 * Math.sin(th);
    disk += line(85 - dx, 85 - dy, 85 + dx, 85 + dy, k === 1 ? 'fig-accent' : 'fig-guide');
  }
  // Equilateral triangle of height 1. A needle from a vertex reaches the far side at any angle within 30° of the altitude.
  const side = U * 2 / Math.sqrt(3), top = 25;
  const vertices = [[85, top], [85 - side / 2, top + U], [85 + side / 2, top + U]];
  let triangle = polygon(vertices, 'fig-line-closed');
  const centre = [85, top + U * 2 / 3];
  vertices.forEach(([vx, vy], index) => {
    const altitude = Math.atan2(centre[1] - vy, centre[0] - vx);
    for (const offset of [-24, -12, 0, 12, 24]) {
      const th = altitude + offset * Math.PI / 180;
      triangle += line(vx, vy, vx + U * Math.cos(th), vy + U * Math.sin(th), index === 0 && offset === 12 ? 'fig-accent' : 'fig-guide');
    }
  });
  // Deltoid whose tangent chords have length 1, so a = 1/4.
  const a = U / 4, cx = 85, cy = 96;
  const turn = ([x, y]) => [cx + y, cy - x];
  let deltoid = polygon(range(0, 2 * Math.PI, 180).slice(0, -1).map(t => turn(deltoidPoint(a, t))), 'fig-line-closed');
  for (let k = 0; k < 12; k++) {
    const [p, q] = deltoidNeedle(a, k * 2 * Math.PI / 12 + .13).map(turn);
    deltoid += line(p[0], p[1], q[0], q[1], k === 2 ? 'fig-accent' : 'fig-guide');
  }
  const draw = (label, body) => svg(170, 170, label, body);
  return [
    panel('Disk', 'Area 0.785', draw('A disk of diameter one with several diameters', disk)),
    panel('Triangle', 'Area 0.577', draw('An equilateral triangle of height one with needles from each vertex', triangle)),
    panel('Deltoid', 'Area 0.393', draw('A deltoid with needles that touch its boundary at both ends', deltoid)),
  ].join('');
}

// The map (x + y², y) on a grid, with one shaded cell.
export function shearFigure() {
  const X = x => 150 + x * 62, Y = y => 110 - y * 62, X2 = x => 408 + x * 62;
  const map = ([x, y]) => [x + y * y, y];
  const ticks = [-1, -.5, 0, .5, 1];
  const steps = range(-1, 1, 24);
  let before = '', after = '';
  for (const c of ticks) {
    before += line(X(c), Y(-1), X(c), Y(1), 'fig-guide') + line(X(-1), Y(c), X(1), Y(c), 'fig-guide');
    after += polyline(steps.map(y => map([c, y])).map(([x, y]) => [X2(x - .5), Y(y)]), 'fig-guide') + polyline(steps.map(x => map([x, c])).map(([x, y]) => [X2(x - .5), Y(y)]), 'fig-guide');
  }
  const cell = [...range(0, .5, 6).map(x => [x, .5]), ...range(.5, 1, 6).map(y => [.5, y]), ...range(.5, 0, 6).map(x => [x, 1]), ...range(1, .5, 6).map(y => [0, y])];
  const shaded = polygon(cell.map(([x, y]) => [X(x), Y(y)])) + polygon(cell.map(map).map(([x, y]) => [X2(x - .5), Y(y)]));
  const labels = text(X(0), 200, 'Before', 'fig-label', 'middle') + text(X2(.5), 200, 'After', 'fig-label', 'middle');
  const arrow = line(232, 110, 266, 110) + polygon([[272, 110], [264, 105], [264, 115]], 'fig-solid');
  return svg(560, 208, 'A square grid before and after the map, with one shaded cell of equal area in both grids', shaded + before + after + arrow + labels);
}

// Unit-distance arrangements. Each edge joins two points at distance exactly 1.
const S3 = Math.sqrt(3) / 2;
export function unitPairs(points, tolerance = 1e-9) {
  const pairs = [];
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (Math.abs(Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) - 1) < tolerance) pairs.push([i, j]);
  }
  return pairs;
}
const TRIANGLE = [[0, 0], [1, 0], [.5, S3]];
export const UNIT_ARRANGEMENTS = {
  three: TRIANGLE,
  four: [[0, 0], [1, 0], [.5, S3], [1.5, S3]],
  seven: [[0, 0], ...range(0, 5, 5).map(k => [Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)])],
  nine: (() => {
    const th = 30 * Math.PI / 180;
    const turned = TRIANGLE.map(([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)]);
    return TRIANGLE.flatMap(([ax, ay]) => turned.map(([bx, by]) => [ax + bx, ay + by]));
  })(),
};
function arrangement(points, label) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1.5);
  const scale = 104 / span, mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const P = ([x, y]) => [65 + (x - mx) * scale, 65 - (y - my) * scale];
  let body = '';
  for (const [i, j] of unitPairs(points)) { const [a, b] = [P(points[i]), P(points[j])]; body += line(a[0], a[1], b[0], b[1], 'fig-line'); }
  for (const point of points) { const [x, y] = P(point); body += dot(x, y, 3.2); }
  return svg(130, 130, label, body);
}
export function unitSmall() {
  return [
    ['three', 3, 'A triangle'], ['four', 5, 'Two triangles that share an edge'], ['seven', 12, 'A regular hexagon and its center'], ['nine', 18, 'Three copies of a triangle, shifted along a second triangle'],
  ].map(([key, pairs, label]) => panel(`${UNIT_ARRANGEMENTS[key].length} points`, `${pairs} pairs`, arrangement(UNIT_ARRANGEMENTS[key], label))).join('');
}

// A grid with spacing 1/5 and the unit circle through its twelve grid points.
export function unitGrid() {
  const step = 20, C = 170, R = 8;
  let body = '';
  for (let p = -R; p <= R; p++) for (let q = -R; q <= R; q++) if (p * p + q * q !== 25 && (p || q)) body += dot(C + p * step, C + q * step, 1.6, 'fig-grid');
  body += `<circle class="fig-accent" cx="${C}" cy="${C}" r="${5 * step}"/>`;
  for (let p = -5; p <= 5; p++) for (let q = -5; q <= 5; q++) if (p * p + q * q === 25) body += line(C, C, C + p * step, C + q * step, 'fig-guide') + dot(C + p * step, C + q * step, 3.6, 'fig-dot-accent');
  body += dot(C, C, 3.6);
  return svg(340, 340, 'A square grid with a circle of radius one that passes through twelve grid points', body);
}

// Limits on the exponent of u(n).
export function unitRuler() {
  const X = e => 26 + (e - 1) * 1320, axis = 70;
  let body = polygon([[X(1.043), axis - 12], [X(4 / 3), axis - 12], [X(4 / 3), axis], [X(1.043), axis]]);
  body += line(X(1), axis, X(1.36), axis);
  for (const [e, label] of [[1, '1'], [1.1, '1.1'], [1.2, '1.2'], [1.3, '1.3']]) body += line(X(e), axis, X(e), axis + 6) + text(X(e), axis + 22, label, 'fig-label', 'middle');
  body += line(X(4 / 3), axis - 14, X(4 / 3), axis + 6, 'fig-accent') + text(X(4 / 3), axis - 20, '4/3 (1984)', 'fig-note', 'end');
  body += line(X(1.014), axis - 12, X(1.014), axis - 36, 'fig-guide') + text(X(1.014) - 4, axis - 40, '1.014 (Sawin)', 'fig-note') + dot(X(1.014), axis, 3);
  body += line(X(1.043), axis - 12, X(1.043), axis - 18, 'fig-guide') + text(X(1.043) + 4, axis - 20, '1.043 (Naslund)', 'fig-note') + dot(X(1.043), axis, 3);
  return svg(490, 100, 'A scale of exponents from 1 to 4 over 3, with lower limits 1.014 and 1.043 and an upper limit below 4 over 3', body);
}

// The example game. Each constraint says: label(to) = label(from) + constant, modulo 5.
export const UG_CONSTRAINTS = [['a', 'b', 2], ['b', 'c', 1], ['c', 'd', 4], ['d', 'e', 3], ['e', 'a', 0], ['a', 'c', 3], ['b', 'd', 0], ['c', 'e', 2]];
export const UG_LABELS = { a: 0, b: 2, c: 3, d: 2, e: 0 };
export function ugGraph() {
  const names = ['a', 'b', 'c', 'd', 'e'], C = [180, 138], R = 104;
  const at = Object.fromEntries(names.map((name, i) => { const th = -Math.PI / 2 + i * 2 * Math.PI / 5; return [name, [C[0] + R * Math.cos(th), C[1] + R * Math.sin(th)]]; }));
  let body = '';
  for (const [from, to, k] of UG_CONSTRAINTS) {
    const [x1, y1] = at[from], [x2, y2] = at[to], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    const ax = x2 - ux * 20, ay = y2 - uy * 20;
    body += line(x1 + ux * 18, y1 + uy * 18, ax, ay, 'fig-guide-strong');
    body += polygon([[ax, ay], [ax - ux * 9 - uy * 4, ay - uy * 9 + ux * 4], [ax - ux * 9 + uy * 4, ay - uy * 9 - ux * 4]], 'fig-solid');
    const f = from === 'a' && to === 'c' ? .3 : from === 'c' && to === 'e' ? .68 : from === 'b' && to === 'd' ? .3 : .5;
    const mx = x1 + (x2 - x1) * f, my = y1 + (y2 - y1) * f, side = 12;
    body += text(mx - uy * side, my + ux * side + 4, `+${k}`, 'fig-note', 'middle');
  }
  for (const name of names) {
    const [x, y] = at[name];
    body += `<circle class="fig-node" cx="${fmt(x)}" cy="${fmt(y)}" r="17"/>` + text(x, y + 5, `${name}=${UG_LABELS[name]}`, 'fig-node-label', 'middle');
  }
  return svg(360, 268, 'A graph on five variables with eight arrows and a labeling that satisfies all of them', body);
}

export function ugGap() {
  const X = v => 20 + v * 450, row = (y, from, to, label, anchor, x) => polygon([[X(from), y], [X(to), y], [X(to), y + 22], [X(from), y + 22]]) + line(X(from), y + 22, X(to), y + 22, 'fig-accent') + text(x, y - 7, label, 'fig-note', anchor);
  let body = line(X(0), 96, X(1), 96);
  for (const [v, label] of [[0, '0%'], [.25, '25%'], [.5, '50%'], [.75, '75%'], [1, '100%']]) body += line(X(v), 96, X(v), 102) + text(X(v), 118, label, 'fig-label', 'middle');
  body += row(60, 0, .05, 'Formula has no solution: value at most 5%', 'start', X(0));
  body += row(22, .95, 1, 'Formula has a solution: value at least 95%', 'end', X(1));
  return svg(490, 126, 'A scale of game values from zero to one hundred percent, with one band at most five percent and one band at least ninety-five percent', body);
}

// dy/dt = y² against dy/dt = y, both from y(0) = 1.
export function blowupFigure() {
  const X = t => 44 + t * 270, Y = y => 262 - y * 21;
  let body = line(X(0), Y(0), X(1.6), Y(0)) + line(X(0), Y(0), X(0), Y(11.6));
  for (const t of [0, .5, 1, 1.5]) body += line(X(t), Y(0), X(t), Y(0) + 6) + text(X(t), Y(0) + 22, String(t), 'fig-label', 'middle');
  for (const y of [0, 5, 10]) body += line(X(0) - 6, Y(y), X(0), Y(y)) + text(X(0) - 11, Y(y) + 5, String(y), 'fig-label', 'end');
  body += line(X(1), Y(0), X(1), Y(11.6), 'fig-dash');
  body += polyline(range(0, 1.6, 60).map(t => [X(t), Y(Math.exp(t))]));
  body += polyline(range(0, 1 - 1 / 11.4, 80).map(t => [X(t), Y(1 / (1 - t))]), 'fig-accent');
  body += text(X(.9) - 12, Y(9), 'dy/dt = y²', 'fig-note-accent', 'end') + text(X(1.6), Y(Math.exp(1.6)) - 8, 'dy/dt = y', 'fig-note', 'end');
  body += text(X(1) + 6, Y(11), 't = 1', 'fig-note') + text(X(1.6), Y(0) - 8, 't', 'fig-math', 'end');
  return svg(490, 296, 'Two curves from one: y equals one over one minus t rises without limit at t equals one, and y equals e to the t stays finite', body);
}

export const figures = {
  shadow: shadowFigure, strip: stripFigure, 'kakeya-shapes': kakeyaShapes, shear: shearFigure,
  'unit-small': unitSmall, 'unit-grid': unitGrid, 'unit-ruler': unitRuler, 'ug-graph': ugGraph, 'ug-gap': ugGap, blowup: blowupFigure,
};
