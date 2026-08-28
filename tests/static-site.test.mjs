import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

test("homepage provides a complete grouped fallback index", () => {
  for (const project of ["profile", "mystery-report", "ngu-idle-dashboard", "black-sheep-town", "links"]) {
    assert.match(index, new RegExp(`data-project="${project}"`));
  }
  assert.match(index, /site-theme\/v2\/base\.css/);
  assert.match(index, /favicons\/home\.png/);
  assert.match(index, /data-theme-toggle/);
  assert.doesNotMatch(index, /jwknt\.github\.io/i);
});

test("homepage discovers future Pages repositories", () => {
  assert.match(app, /api\.github\.com\/users\/\$\{owner\}\/repos/);
  assert.match(app, /repo\.has_pages/);
  assert.match(app, /https:\/\/jehlp\.net\/\$\{encodeURIComponent\(repo\.name\)\}/);
});
