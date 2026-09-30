import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDynamicRecords, parseJSONAssignment, quizCopy } from '../lib/search-adapters.mjs';

test('static assignments are parsed as JSON, never executed', () => {
  globalThis.searchAdapterExecuted = false;
  const source = 'window.DATA = {"text":"a } bracket and \\\" quote", "list":[1,{"x":2}]}; globalThis.searchAdapterExecuted = true;';
  assert.deepEqual(parseJSONAssignment(source, 'window.DATA'), { text: 'a } bracket and " quote', list: [1, { x: 2 }] });
  assert.equal(globalThis.searchAdapterExecuted, false);
  assert.throws(() => parseJSONAssignment('window.DATA = (() => ({}))();', 'window.DATA'), /literal/);
  assert.throws(() => parseJSONAssignment('window.DATA = {"value": (() => 3)()};', 'window.DATA'), SyntaxError);
  assert.throws(() => parseJSONAssignment('window.OTHER = {};', 'window.DATA'), /missing/);
  delete globalThis.searchAdapterExecuted;
});

test('quiz adapter includes authored outcomes and answers without code or asset paths', () => {
  const copy = quizCopy('const results = [result("Xie Liang", "assets/portrait.webp", "A quiet strategist.", [1,2])]; const questions = [q("Care", "How do you help?", [["Ask a thoughtful question.", ["empathy"]]])];');
  assert.match(copy, /quiet strategist/);
  assert.match(copy, /thoughtful question/);
  assert.doesNotMatch(copy, /portrait|empathy|result\(/);
});

function fixture() {
  const sources = new Map();
  for (const [site, slug] of [['albatross-koukairoku', '1001'], ['black-sheep-town', 'A8']]) {
    sources.set(`/${site}/data/index.json`, { chapters: [{ slug, title: 'Chapter heading' }] });
    sources.set(`/${site}/data/chapters/${slug}.json`, {
      lines: [
        { id: `${slug.toLowerCase()}:0014`, i: 1, sj: '人物', se: 'Speaker', jp: '<tips=9>場所</tips>', en: 'A body-only phrase &amp; another sentence.' },
        { id: `${slug.toLowerCase()}:0083`, i: 2, sj: '', se: '', jp: '文', en: 'A second line with a source number unlike its index.' },
      ],
    });
  }
  sources.set('/black-sheep-town/data/glossary.json', { groups: [{ id: 9, enTitle: 'District Y', records: [
    { priority: 1, requires: ['A8'], requireAll: true, enTitle: 'District Y', jpTitle: 'Y地区', pronunciation: 'わいちく', enDescription: 'Rendered glossary body.', jpDescription: '辞典本文' },
    { priority: 0, requires: ['A8'], requireAll: true, enDescription: 'Superseded unreachable glossary text.', jpDescription: '過去' },
  ] }] });
  sources.set('/black-sheep-town/data/scenario-progression.json', { vnOrder: ['A8'], chapters: { A8: [] } });
  sources.set('/black-sheep-town/quiz/quiz.js', 'const results = [result("Xie Liang", "Thoughtful planning.")]; const questions = [q("Care", "How do you help?")];');
  sources.set('/bl2/data/items.js', 'window.BL2_ITEMS=' + JSON.stringify([{ id: 'bad-touch', name: 'Bad Touch', note: 'Tip-jar acquisition.', sources: [{ name: 'Moxxi', location: 'Sanctuary' }], rates: [{ value: '100%' }] }]) + ';');
  const dataset = {
    strings: ['Canonical work', 'Original work', 'Author Name', 'visual_novel', 'Selection-only title', 'Variant author'],
    works: [[1, 0, 1, 2, 2007, 3, 91.25, 93, 95, 2, 100, 1]],
    selections: [[1, 0, 0, 1, 4, 5, 2007, 3, 0]],
    axes: [{ label: 'Ambition', short: 'Ambition' }],
  };
  sources.set('/mystery-report/data/v3/consensus-data.js', `window.MYSTERY_CONSENSUS_DATASETS.v3=${JSON.stringify(dataset)};`);
  sources.set('/mystery-report/data/consensus-data.js', `window.MYSTERY_CONSENSUS_DATASETS.v4=${JSON.stringify(dataset)};`);
  sources.set('/profile/data/profile-data.js', `window.PROFILE_DATA=${JSON.stringify({
    ancestry: { total: { name: 'European', color: 'rgb(1,2,3)' }, broad: [], detailed: [], regionalSignals: [], versionHistory: { comparison: [] }, timeline: [], timelineScale: [], paintings: {} },
    lineage: { maternal: {}, paternal: {}, neanderthal: { locations: [], traitMarkers: [] } },
    reports: [{ id: 'private-implementation-id', title: 'Published report', result: 'Published result', description: 'Public body copy.', personalNotes: [], variants: [] }],
    privacy: { included: [], removed: ['Direct identifiers are excluded.'], processing: [] },
  })};`);
  sources.set('/links/data/links.json', { categories: ['Reading'], links: [{ title: 'A saved reference', description: 'Useful collected context.', category: 'Reading', url: 'https://example.org/' }] });
  sources.set('/puzzles/data/puzzles.json', [{ slug: 'a-38-000tos', title: 'A 38' }]);
  return sources;
}

test('all public adapters preserve body text and canonical supported routes', async () => {
  const sources = fixture();
  const requested = [];
  const records = [];
  const read = path => {
    requested.push(path);
    assert.ok(sources.has(path), `Unexpected source URL ${path}`);
    return sources.get(path);
  };
  const result = await collectDynamicRecords({ getJSON: async path => read(path), getText: async path => read(path), addRecord: async record => records.push(record) });
  assert.equal(records.length, 14);
  assert.deepEqual(result.htmlPaths, ['/puzzles/a-38-000tos/']);
  const passage = records.find(record => record.url === '/black-sheep-town/?chapter=A8#line-a8-0014');
  assert.ok(passage, 'Keep the exact source line ID, including lowercase and padding');
  assert.match(passage.content, /body-only phrase & another/);
  assert.match(passage.japanese, /場所/);
  assert.doesNotMatch(passage.content, /tips=/);
  assert.ok(records.find(record => record.url === '/black-sheep-town/glossary.html?chapter=A8#tip-9'));
  assert.equal(result.coverage['black-sheep-town'].unreachableGlossaryVersions, 1);
  assert.doesNotMatch(records.map(record => record.content).join('\n'), /unreachable glossary|private-implementation-id|rgb\(/);
  assert.ok(records.find(record => record.url === '/bl2/#bad-touch').content.includes('Tip-jar acquisition'));
  for (const version of ['v1', 'v2']) assert.match(records.find(record => record.url === `/mystery-report/?dataset=${version}#results`).content, /Selection-only title/);
  assert.ok(records.find(record => record.url === '/profile/#reports').content.includes('Public body copy'));
  assert.ok(records.every(record => record.url.startsWith('/')));
  assert.ok(requested.every(path => !/raw_agents|aggregate|methodology|audit|api\/state|github/.test(path)));
});

test('bilingual records keep English and Japanese in separate fields on one canonical URL', async () => {
  const sources = fixture();
  const records = [];
  await collectDynamicRecords({ getJSON: async path => sources.get(path), getText: async path => sources.get(path), addRecord: async record => records.push(record) });
  for (const site of ['albatross-koukairoku', 'black-sheep-town']) {
    const passages = records.filter(record => record.site === site && record.url.includes('?chapter=') && record.url.includes('#line-'));
    assert.equal(passages.length, 1);
    assert.match(passages[0].content, /Speaker\nA body-only phrase/);
    assert.doesNotMatch(passages[0].content, /人物|場所|文/);
    assert.match(passages[0].japanese, /人物\n場所\n文/);
    assert.doesNotMatch(passages[0].japanese, /Speaker|body-only|tips=/);
  }
  const glossary = records.find(record => record.url === '/black-sheep-town/glossary.html?chapter=A8#tip-9');
  assert.equal(glossary.content, 'District Y\nRendered glossary body.');
  assert.equal(glossary.japanese, 'Y地区\nわいちく\n辞典本文');
  assert.equal(records.filter(record => record.url === glossary.url).length, 1);
});

test('schema failures reject rather than returning an incomplete successful corpus', async () => {
  await assert.rejects(collectDynamicRecords({ getJSON: async () => ({}), getText: async () => '', addRecord: async () => {} }), /chapter manifest/);
});

test('Profile allowlists rendered fields and ignores new raw or internal fields at every depth', async () => {
  const sources = fixture();
  const data = parseJSONAssignment(sources.get('/profile/data/profile-data.js'), 'window.PROFILE_DATA');
  data.ancestry.broad = [{ name: 'Visible population', percent: 31, color: 'NOT_RENDERED_COLOUR' }];
  data.ancestry.regionalSignals = [{ name: 'Visible region label', regions: ['Visible place'], additional: 1 }];
  data.ancestry.versionHistory.comparison = [{ population: 'Visible comparison', current: '10%', previous: '9%', change: '+1%', note: 'Visible comparison note' }];
  data.ancestry.versionHistory.events = [{ description: 'SECRET_UNRENDERED_HISTORY' }];
  data.ancestry.timeline = [{ name: 'Visible timeline', description: 'Visible date estimate', generationRange: '2–4', estimatedYears: '1880 and 1940' }];
  data.ancestry.paintings['Most likely'] = [{ number: '1', a: { segments: [{ name: 'Visible segment', left: 10, width: 20 }] } }];
  data.ancestry.paintings['Private future view'] = [{ name: 'SECRET_FUTURE_PAINTING' }];
  data.lineage.paternal.haplogroup = 'Visible haplogroup';
  data.lineage.paternal.historicalConnection = 'SECRET_UNRENDERED_ASSOCIATION';
  data.lineage.neanderthal.traitMarkers = [{ marker: 'Visible marker', trait: 'Visible trait', genotype: 'C/T', association: 'Visible association', detected: true }];
  data.reports[0].variants = [{ name: 'Visible variant', gene: 'Visible gene', marker: 'rs123', genotype: 'A/G', status: 'tested' }];
  const addUnknownFields = value => {
    if (Array.isArray(value)) { value.forEach(addUnknownFields); return; }
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach(addUnknownFields);
    value.newInternalField = 'SECRET_UNKNOWN_FIELD';
    value.rawGenome = { name: 'SECRET_RAW_GENOME', description: 'SECRET_RAW_DESCRIPTION' };
  };
  addUnknownFields(data);
  sources.set('/profile/data/profile-data.js', `window.PROFILE_DATA=${JSON.stringify(data)};`);
  const records = [];
  await collectDynamicRecords({ getJSON: async path => sources.get(path), getText: async path => sources.get(path), addRecord: async record => records.push(record) });
  const content = records.filter(record => record.site === 'profile').map(record => record.content).join('\n');
  assert.doesNotMatch(content, /SECRET_|NOT_RENDERED_COLOUR/);
  for (const copy of ['Visible population', 'Visible place', 'Visible comparison note', 'Visible date estimate', 'Visible segment', 'Visible haplogroup', 'Visible association', 'Visible variant', 'Visible gene']) assert.ok(content.includes(copy), copy);
});

test('long VN chapters are divided into bounded, line-addressable passages', async () => {
  const sources = fixture();
  sources.set('/albatross-koukairoku/data/chapters/1001.json', { lines: Array.from({ length: 50 }, (_, index) => ({
    id: `1001:${String(index + 1).padStart(5, '0')}`, i: index + 1, jp: '原文', en: `Unique line ${index + 1}. ${'body '.repeat(30)}`,
  })) });
  const records = [];
  await collectDynamicRecords({ getJSON: async path => sources.get(path), getText: async path => sources.get(path), addRecord: async record => records.push(record) });
  const passages = records.filter(record => record.site === 'albatross-koukairoku');
  assert.ok(passages.length > 1);
  assert.equal(new Set(passages.map(record => record.url)).size, passages.length);
  assert.ok(passages.every(record => record.content.split(/\s+/).length <= 350));
  for (let line = 1; line <= 50; line += 1) assert.ok(passages.some(record => record.content.includes(`Unique line ${line}.`)));
});
