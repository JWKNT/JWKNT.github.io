import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

test("homepage provides a fallback list and shared theme", () => {
  assert.match(index, /id="projects"/);
  assert.match(index, /data-project="black-sheep-town"/);
  assert.match(index, /data-project="links"/);
  assert.match(index, /\/site-theme\/v1\/base\.css/);
  assert.match(index, /data-theme-toggle/);
});

test("homepage discovers future Pages repositories", () => {
  assert.match(app, /api\.github\.com\/users\/\$\{owner\}\/repos/);
  assert.match(app, /repo\.has_pages/);
  assert.match(app, /site-theme/);
});
