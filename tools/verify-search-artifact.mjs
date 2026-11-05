import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSearchCoverage } from '../lib/search-coverage.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = JSON.parse(await readFile(resolve(root, 'data/directory.json'), 'utf8'));
const coverage = JSON.parse(await readFile(resolve(root, '_site/search-coverage.json'), 'utf8'));
validateSearchCoverage(coverage, directory);
if (coverage.refresh?.cached !== false) throw new Error('Deployment requires a fresh uncached crawl');
if (process.env.GITHUB_SHA && coverage.sourceCommit !== process.env.GITHUB_SHA) throw new Error('Search artifact belongs to a different source commit');
for (const [folder, language] of [['pagefind', 'en'], ['pagefind-ja', 'ja']]) {
  const entry = JSON.parse(await readFile(resolve(root, '_site', folder, 'pagefind-entry.json'), 'utf8'));
  const expected = coverage.languages?.[language];
  const actual = entry.languages?.[language]?.page_count || 0;
  if (!Number.isInteger(expected) || expected < 0 || actual !== expected) throw new Error(`Incomplete language index: ${folder}`);
}
if ((await readFile(resolve(root, '_site/CNAME'), 'utf8')).trim() !== 'jehlp.net') throw new Error('Custom domain changed');
const skills = await readFile(resolve(root, '_site/skills/index.html'), 'utf8');
if (!skills.includes('<link rel="canonical" href="https://jehlp.net/skills/">') || !skills.includes('<article class="skill"')) throw new Error('Incomplete skills page');
const accounts = await readFile(resolve(root, '_site/accounts/index.html'), 'utf8');
if (!accounts.includes('<link rel="canonical" href="https://jehlp.net/accounts/">') || !accounts.includes('rel="me"')) throw new Error('Incomplete accounts page');
const aiMath = await readFile(resolve(root, '_site/ai-math/index.html'), 'utf8');
if (!aiMath.includes('<link rel="canonical" href="https://jehlp.net/ai-math/">') || !aiMath.includes('class="ai-math-result"')) throw new Error('Incomplete AI math page');
console.log(`Verified ${coverage.records} search targets in ${Object.keys(coverage.sites).length} sites at ${coverage.generatedAt}`);
