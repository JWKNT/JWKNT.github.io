import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { renderDirectory } from './lib/directory.mjs';
import { renderAccountsPage } from './lib/accounts.mjs';
import { renderAiMath } from './lib/ai-math.mjs';
const root = new URL('./', import.meta.url);
const categories = JSON.parse(await readFile(new URL('data/directory.json', root), 'utf8'));
await writeFile(new URL('index.html', root), renderDirectory(categories));
const accounts = JSON.parse(await readFile(new URL('data/accounts.json', root), 'utf8'));
await mkdir(new URL('accounts/', root), { recursive: true });
await writeFile(new URL('accounts/index.html', root), renderAccountsPage(accounts));
const aiMath = JSON.parse(await readFile(new URL('data/ai-math.json', root), 'utf8'));
const aiMathBodies = Object.fromEntries(await Promise.all(aiMath.map(async ({ slug }) => [slug, await readFile(new URL(`content/ai-math/${slug}.html`, root), 'utf8')])));
for (const [path, html] of renderAiMath(aiMath, aiMathBodies)) {
  const target = new URL(`ai-math/${path}`, root);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, html);
}
console.log(`Built ${categories.length} categories and ${categories.reduce((n, c) => n + c.pages.length, 0)} pages, ${accounts.length} accounts, and ${aiMath.length} math explainers.`);
