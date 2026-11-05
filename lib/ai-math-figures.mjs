// Margin figures for /ai-math/. The build calculates every shape from its formula,
// so a figure cannot drift from the mathematics. Each viewBox is about as wide as
// the margin column, so labels stay near their stated size. Colors come from
// theme tokens through the fig-* classes in assets/ai-math.css.

const fmt = value => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};
const svg = (width, height, label, body) => `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" preserveAspectRatio="xMinYMin meet">${body}</svg>`;
const line = (x1, y1, x2, y2, cls = 'fig-line') => `<line class="${cls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
const dot = (x, y, r = 3, cls = 'fig-dot') => `<circle class="${cls}" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/>`;
const text = (x, y, value, cls = 'fig-label', anchor = 'start') => `<text class="${cls}" x="${fmt(x)}" y="${fmt(y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${value}</text>`;
const polyline = (points, cls = 'fig-line') => `<polyline class="${cls}" points="${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}"/>`;
const polygon = (points, cls = 'fig-band') => `<polygon class="${cls}" points="${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}"/>`;
const range = (from, to, count) => Array.from({ length: count + 1 }, (_, i) => from + (to - from) * i / count);

// The curve q = w² with rational w, and the projection of each point on the q axis.
export function shadowFigure() {
  const X = q => 26 + q * 76, Y = w => 204 - w * 84;
  const fractions = [[0, 1], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [2, 1]];
  const curve = range(0, 2.12, 60).map(w => [X(w * w), Y(w)]);
  let body = line(X(0) - 10, Y(0), X(4.5), Y(0)) + line(X(0), Y(0) + 6, X(0), Y(2.2));
  for (const q of [0, 1, 2, 3, 4]) body += line(X(q), Y(0), X(q), Y(0) + 5) + text(X(q), Y(0) + 20, q, 'fig-label', 'middle');
  body += text(X(4.5) - 2, Y(0) - 7, 'q', 'fig-math', 'end') + text(X(0) - 9, Y(2.2) + 6, 'w', 'fig-math', 'end');
  body += polyline(curve);
  for (const [a, b] of fractions) {
    const w = a / b, q = w * w;
    if (a) body += line(X(q), Y(w), X(q), Y(0), 'fig-guide');
    body += dot(X(q), Y(w), 2.8) + dot(X(q), Y(0), 2, 'fig-dot-accent');
  }
  body += `<circle class="fig-open" cx="${fmt(X(2))}" cy="${fmt(Y(Math.SQRT2))}" r="3.6"/>`;
  return svg(380, 232, 'The curve q equals w squared, with rational points and their projections on the q axis', body);
}

export const ZETA_ZEROS = [14.134725, 21.022040, 25.010858, 30.424876, 32.935062];

// The upper half of the critical strip, with the zero-free bands.
export function stripFigure() {
  const X = re => 50 + (re + .2) * 200, top = 18, bottom = 256, Y = im => bottom - im * 6.5;
  let body = polygon([[X(0), top], [X(1 / 8), top], [X(1 / 8), bottom], [X(0), bottom]]) + polygon([[X(7 / 8), top], [X(1), top], [X(1), bottom], [X(7 / 8), bottom]]);
  for (const re of [0, 1]) body += line(X(re), top, X(re), bottom);
  body += line(X(1 / 2), top, X(1 / 2), bottom, 'fig-accent') + line(X(-.2), bottom, X(1.2), bottom);
  for (const [re, label] of [[0, '0'], [1 / 8, '1/8'], [1 / 2, '1/2'], [7 / 8, '7/8'], [1, '1']]) body += line(X(re), bottom, X(re), bottom + 5) + text(X(re), bottom + 20, label, 'fig-label', 'middle');
  for (const im of ZETA_ZEROS) body += dot(X(1 / 2), Y(im), 3.2, 'fig-dot-accent') + text(X(1 / 2) + 8, Y(im) + 4, im.toFixed(2), 'fig-note');
  body += text(X(1.2), bottom - 7, 'Re s', 'fig-note', 'end');
  return svg(380, 284, 'The strip between real part 0 and real part 1, with zeros on the line at one half and shaded bands free of zeros', body);
}

// A needle of length 1 in a deltoid. With a = 1/4, every tangent chord has length 1.
export function deltoidNeedle(a, t) {
  const mx = a * Math.cos(t), my = a * Math.sin(t), dx = 2 * a * Math.cos(t / 2), dy = -2 * a * Math.sin(t / 2);
  return [[mx - dx, my - dy], [mx + dx, my + dy]];
}
export function deltoidPoint(a, t) {
  return [2 * a * Math.cos(t) + a * Math.cos(2 * t), 2 * a * Math.sin(t) - a * Math.sin(2 * t)];
}
export function deltoidFigure() {
  const a = 50, cx = 150, cy = 165;
  const turn = ([x, y]) => [cx + y, cy - x];
  let body = polygon(range(0, 2 * Math.PI, 240).slice(0, -1).map(t => turn(deltoidPoint(a, t))), 'fig-line-closed');
  for (let k = 0; k < 12; k++) {
    const [p, q] = deltoidNeedle(a, k * 2 * Math.PI / 12 + .13).map(turn);
    body += line(p[0], p[1], q[0], q[1], k === 2 ? 'fig-accent' : 'fig-guide');
  }
  return svg(300, 250, 'A three-pointed deltoid with needles that touch its boundary at both ends', body);
}

// A grid with spacing 1/5 and the unit circle through its twelve grid points.
export function unitGrid() {
  const step = 20, C = 150, R = 7;
  let body = '';
  for (let p = -R; p <= R; p++) for (let q = -R; q <= R; q++) if (p * p + q * q !== 25 && (p || q)) body += dot(C + p * step, C + q * step, 1.6, 'fig-grid');
  body += `<circle class="fig-accent" cx="${C}" cy="${C}" r="${5 * step}"/>`;
  for (let p = -5; p <= 5; p++) for (let q = -5; q <= 5; q++) if (p * p + q * q === 25) body += line(C, C, C + p * step, C + q * step, 'fig-guide') + dot(C + p * step, C + q * step, 3.6, 'fig-dot-accent');
  body += dot(C, C, 3.6);
  return svg(300, 300, 'A square grid with a circle of radius one that passes through twelve grid points', body);
}

// The example game. Each constraint says: value(to) = value(from) + constant, modulo 5.
export const UG_CONSTRAINTS = [['a', 'b', 2], ['b', 'c', 1], ['c', 'd', 4], ['d', 'e', 3], ['e', 'a', 0], ['a', 'c', 3], ['b', 'd', 0], ['c', 'e', 2]];
export const UG_VALUES = { a: 0, b: 2, c: 3, d: 2, e: 0 };
export function ugGraph() {
  const names = ['a', 'b', 'c', 'd', 'e'], C = [150, 128], R = 98;
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
    body += `<circle class="fig-node" cx="${fmt(x)}" cy="${fmt(y)}" r="17"/>` + text(x, y + 4, `${name}=${UG_VALUES[name]}`, 'fig-node-label', 'middle');
  }
  return svg(300, 248, 'A graph on five variables with eight arrows and values that satisfy all of them', body);
}

// dy/dt = y² against dy/dt = y, both from y(0) = 1.
export function blowupFigure() {
  const X = t => 34 + t * 205, Y = y => 206 - y * 16.5;
  let body = line(X(0), Y(0), X(1.6), Y(0)) + line(X(0), Y(0), X(0), Y(11.6));
  for (const t of [0, .5, 1, 1.5]) body += line(X(t), Y(0), X(t), Y(0) + 5) + text(X(t), Y(0) + 20, String(t), 'fig-label', 'middle');
  for (const y of [0, 5, 10]) body += line(X(0) - 5, Y(y), X(0), Y(y)) + text(X(0) - 9, Y(y) + 4, String(y), 'fig-label', 'end');
  body += line(X(1), Y(0), X(1), Y(11.6), 'fig-dash');
  body += polyline(range(0, 1.6, 60).map(t => [X(t), Y(Math.exp(t))]));
  body += polyline(range(0, 1 - 1 / 11.4, 80).map(t => [X(t), Y(1 / (1 - t))]), 'fig-accent');
  body += text(X(.88) - 10, Y(9), 'dy/dt = y²', 'fig-note-accent', 'end') + text(X(1.6), Y(Math.exp(1.6)) - 8, 'dy/dt = y', 'fig-note', 'end');
  body += text(X(1) + 6, Y(11), 't = 1', 'fig-note') + text(X(1.6), Y(0) - 7, 't', 'fig-math', 'end');
  return svg(380, 236, 'Two curves from one: y equals one over one minus t rises without limit at t equals one, and y equals e to the t stays finite', body);
}

export const figures = { shadow: shadowFigure, strip: stripFigure, deltoid: deltoidFigure, 'unit-grid': unitGrid, 'ug-graph': ugGraph, blowup: blowupFigure };
