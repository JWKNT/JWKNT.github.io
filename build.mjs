import { readFile, writeFile } from 'node:fs/promises';
import { renderDirectory } from './lib/directory.mjs';
const root = new URL('./', import.meta.url);
const categories = JSON.parse(await readFile(new URL('data/directory.json', root), 'utf8'));
await writeFile(new URL('index.html', root), renderDirectory(categories));
console.log(`Built ${categories.length} categories and ${categories.reduce((n, c) => n + c.pages.length, 0)} pages.`);
