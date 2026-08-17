import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../ngu-idle-autopilot/index.html", import.meta.url), "utf8");
const dashboardApp = await readFile(new URL("../ngu-idle-autopilot/assets/app.js", import.meta.url), "utf8");

test("homepage provides a fallback list and shared theme", () => {
  assert.match(index, /id="projects"/);
  assert.match(index, /data-project="black-sheep-town"/);
  assert.match(index, /data-project="links"/);
  assert.match(index, /data-project="ngu-idle-autopilot"/);
  assert.match(index, /\/site-theme\/v1\/base\.css/);
  assert.match(index, /data-theme-toggle/);
});

test("homepage discovers future Pages repositories", () => {
  assert.match(app, /api\.github\.com\/users\/\$\{owner\}\/repos/);
  assert.match(app, /repo\.has_pages/);
  assert.match(app, /site-theme/);
  assert.match(app, /projects\.push\(\{ name: "ngu-idle-autopilot"/);
});

test("NGU dashboard keeps live state on the loopback client", () => {
  assert.match(dashboard, /\/site-theme\/v1\/base\.css/);
  assert.match(dashboard, /id="metric-rebirth"/);
  assert.match(dashboard, /id="metric-boss"/);
  assert.match(dashboard, /id="metric-adventure"/);
  assert.match(dashboard, /id="metric-exp"/);
  assert.match(dashboardApp, /http:\/\/127\.0\.0\.1:47635\/api\/state/);
  assert.doesNotMatch(dashboardApp, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
});
