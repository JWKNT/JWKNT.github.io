import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');

test('destination direction marks are decorative geometry, never platform emoji', () => {
  const links = [...index.matchAll(/<li data-project=/g)];
  const marks = [...index.matchAll(/<span class="link-point" aria-hidden="true"><\/span>/g)];
  assert.equal(marks.length, links.length);
  assert.ok(marks.length > 0);
  assert.doesNotMatch(index, /↗|\uFE0F/);
  assert.match(styles, /\.link-point::before/);
  assert.match(styles, /\.link-point::after/);
  assert.match(styles, /border-top: 1px solid currentColor/);
  assert.match(styles, /border-right: 1px solid currentColor/);
  assert.match(styles, /transform: rotate\(-45deg\)/);
});
