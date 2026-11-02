// Regenerate skills/index.html from the skills that site-theme publishes.
// Pass --from <site-theme checkout> to preview unpublished local skill edits.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SKILLS_SOURCE, catalogSkills, parseSkill, renderSkillsPage } from '../lib/skills.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const from = process.argv.indexOf('--from');
const checkout = from > 0 ? resolve(process.argv[from + 1] || '') : null;

async function read(path) {
  if (checkout) return readFile(resolve(checkout, path), 'utf8');
  const url = new URL(path, SKILLS_SOURCE);
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'error', headers: { 'User-Agent': 'jehlp-skills/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim()) throw new Error('Empty response');
      return text;
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`Cannot read ${url.href}: ${last.message}`);
}

const names = catalogSkills(await read('SKILLS.md'));
const skills = await Promise.all(names.map(async name => parseSkill(await read(`skills/${name}/SKILL.md`), name)));
await mkdir(resolve(root, 'skills'), { recursive: true });
await writeFile(resolve(root, 'skills/index.html'), renderSkillsPage(skills));
console.log(`Built ${skills.length} skills from ${checkout || SKILLS_SOURCE}.`);
