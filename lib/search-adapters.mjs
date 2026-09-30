/*
 * Public, rendered-content adapters for sites whose HTML is a data-driven shell.
 * Inputs are deliberately allowlisted public URLs. No application code is run,
 * and no raw exports, audits, source repositories, or live telemetry are read.
 */

const requireShape = (condition, message) => {
  if (!condition) throw new Error(`Search source schema: ${message}`);
};
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const join = values => values.flat(Infinity).filter(value => value !== undefined && value !== null && value !== '').join('\n');
const plain = value => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[value]))
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => {
    const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
  })
  .replace(/\s+/g, ' ').trim();

// Locate a literal object/array and balance it without evaluating JavaScript.
function literalAt(source, start) {
  const opening = source[start];
  requireShape(opening === '{' || opening === '[', 'expected a JSON object or array literal');
  const stack = [];
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '[' || character === '{') stack.push(character);
    else if (character === ']' || character === '}') {
      const prior = stack.pop();
      requireShape((prior === '[' && character === ']') || (prior === '{' && character === '}'), 'unbalanced literal');
      if (!stack.length) return source.slice(start, index + 1);
    }
  }
  throw new Error('Search source schema: unterminated literal');
}

export function parseJSONAssignment(source, name) {
  requireShape(typeof source === 'string', `${name} source must be text`);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*=\\s*`).exec(source);
  requireShape(Boolean(match), `missing ${name} assignment`);
  return JSON.parse(literalAt(source, match.index + match[0].length));
}

async function orderedMap(values, action, concurrency = 6) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await action(values[index], index);
    }
  }));
  return results;
}

function chapterRecords(site, label, meta, chapter) {
  requireShape(typeof meta.slug === 'string' && /^[a-z\d-]+$/i.test(meta.slug), `${site} chapter slug`);
  requireShape(typeof meta.title === 'string' && Array.isArray(chapter.lines) && chapter.lines.length > 0, `${site}/${meta.slug} chapter lines`);
  const records = [];
  let lines = [];
  let words = 0;
  let characters = 0;
  const flush = () => {
    if (!lines.length) return;
    records.push({
      url: `/${site}/?chapter=${encodeURIComponent(meta.slug)}#line-${lines[0].id.replace(':', '-')}`,
      title: `${meta.title} · ${label} · ${lines[0].i}–${lines.at(-1).i}`,
      content: join(lines.map(line => line.enText)),
      japanese: join(lines.map(line => line.jpText)), site,
    });
    lines = []; words = 0; characters = 0;
  };
  for (const line of chapter.lines) {
    requireShape(typeof line.id === 'string' && line.id.toLowerCase().startsWith(`${meta.slug.toLowerCase()}:`) && /^[a-z\d-]+:\d+$/i.test(line.id), `${site}/${meta.slug} stable line ID`);
    requireShape(typeof line.en === 'string' && typeof line.jp === 'string', `${site}/${line.id} bilingual text`);
    const enText = join([plain(line.se), plain(line.en)]);
    const jpText = join([plain(line.sj), plain(line.jp)]);
    const text = join([jpText, enText]);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (lines.length && (words + wordCount > 350 || characters + text.length > 6500)) flush();
    lines.push({ id: line.id, i: line.i ?? line.id.split(':')[1], enText, jpText });
    words += wordCount; characters += text.length;
  }
  flush();
  return records;
}

async function collectVisualNovels({ getJSON, addRecord, coverage }) {
  const definitions = [
    ['albatross-koukairoku', 'Albatross Koukairoku'],
    ['black-sheep-town', 'Black Sheep Town'],
  ];
  let blackSheepIndex;
  for (const [site, label] of definitions) {
    const index = await getJSON(`/${site}/data/index.json`);
    requireShape(Array.isArray(index.chapters) && index.chapters.length > 0, `${site} chapter manifest`);
    if (site === 'black-sheep-town') blackSheepIndex = index;
    const batches = await orderedMap(index.chapters, async meta => {
      requireShape(typeof meta.slug === 'string' && /^[a-z\d-]+$/i.test(meta.slug), `${site} chapter slug`);
      const chapter = await getJSON(`/${site}/data/chapters/${encodeURIComponent(meta.slug)}.json`);
      return chapterRecords(site, label, meta, chapter);
    });
    for (const records of batches) for (const record of records) await addRecord(record);
    coverage[site] = { chapters: index.chapters.length, passages: batches.flat().length };
  }

  const site = 'black-sheep-town';
  const [glossary, progression] = await Promise.all([
    getJSON(`/${site}/data/glossary.json`), getJSON(`/${site}/data/scenario-progression.json`),
  ]);
  requireShape(Array.isArray(glossary.groups) && glossary.groups.length > 0 && isObject(progression.chapters) && Array.isArray(progression.vnOrder), 'Black Sheep Town glossary and progression');
  const chapters = new Set(blackSheepIndex.chapters.map(chapter => chapter.slug));
  const order = [...new Set([...progression.vnOrder, ...chapters])].filter(slug => chapters.has(slug));
  const completedAt = order.map(slug => {
    const completed = new Set();
    const visit = current => {
      if (completed.has(current)) return;
      completed.add(current);
      const required = progression.chapters[current] || [];
      requireShape(Array.isArray(required), `Black Sheep Town ${current} prerequisites`);
      required.forEach(visit);
    };
    visit(slug);
    return [slug, completed];
  });
  let entries = 0;
  let unreachable = 0;
  for (const group of glossary.groups) {
    requireShape(Number.isInteger(group.id) && typeof group.enTitle === 'string' && Array.isArray(group.records), 'Black Sheep Town glossary group');
    for (const record of group.records) requireShape(Array.isArray(record.requires) && typeof record.enDescription === 'string' && typeof record.jpDescription === 'string', `glossary ${group.id} record`);
    const destinations = new Map();
    for (const [chapter, completed] of completedAt) {
      const active = [...group.records].filter(record => {
        const requirements = record.requires.map(slug => completed.has(slug.toUpperCase()));
        return record.requireAll ? requirements.every(Boolean) : requirements.some(Boolean);
      }).sort((a, b) => b.priority - a.priority)[0];
      if (active && !destinations.has(active)) destinations.set(active, chapter);
    }
    for (const [record, chapter] of destinations) {
      await addRecord({
        url: `/${site}/glossary.html?chapter=${encodeURIComponent(chapter)}#tip-${group.id}`,
        title: `${group.enTitle} · Black Sheep Town glossary`, site,
        content: join([record.enTitle, record.enDescription].map(plain)),
        japanese: join([record.jpTitle, record.pronunciation, record.jpDescription].map(plain)),
      });
      entries += 1;
    }
    unreachable += group.records.length - destinations.size;
  }
  coverage[site].glossaryEntries = entries;
  coverage[site].unreachableGlossaryVersions = unreachable;
}

// This quiz embeds authored copy in two literal arrays of simple factory calls.
// Extract only JSON string tokens from those explicit arrays; never run the calls.
export function quizCopy(source) {
  const sections = [];
  for (const name of ['results', 'questions']) {
    const match = new RegExp(`const\\s+${name}\\s*=\\s*`).exec(source);
    requireShape(Boolean(match), `Black Sheep Town quiz ${name}`);
    const literal = literalAt(source, match.index + match[0].length);
    const strings = [...literal.matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => JSON.parse(match[0]))
      .filter(value => !/^(?:assets\/|\.\.\/)/.test(value) && !/^[a-z]+$/.test(value));
    requireShape(strings.length > 0, `Black Sheep Town quiz ${name} copy`);
    sections.push(join(strings));
  }
  return join(sections);
}

async function collectArmory({ getText, addRecord, coverage }) {
  const items = parseJSONAssignment(await getText('/bl2/data/items.js'), 'window.BL2_ITEMS');
  requireShape(Array.isArray(items) && items.length > 0, 'Borderlands 2 items');
  for (const item of items) {
    requireShape(typeof item.id === 'string' && /^[a-z\d-]+$/i.test(item.id) && typeof item.name === 'string' && Array.isArray(item.sources) && Array.isArray(item.rates), 'Borderlands 2 item');
    await addRecord({ url: `/bl2/#${item.id}`, title: `${item.name} · Borderlands 2 Armory`, site: 'bl2', content: join([
      item.name, item.category, item.content, item.rarity, item.type, item.manufacturer, item.character,
      item.elements, item.note,
      item.sources.map(source => join([source.name, source.type, source.location])),
      item.rates.map(rate => join([rate.name, rate.value])),
    ]).split('\n').map(plain).join('\n') });
  }
  coverage.bl2 = { items: items.length };
}

async function collectMystery({ getText, addRecord, coverage }) {
  coverage['mystery-report'] = [];
  for (const [publicVersion, internalVersion, path] of [
    ['v1', 'v3', '/mystery-report/data/v3/consensus-data.js'],
    ['v2', 'v4', '/mystery-report/data/consensus-data.js'],
  ]) {
    const dataset = parseJSONAssignment(await getText(path), `window.MYSTERY_CONSENSUS_DATASETS.${internalVersion}`);
    requireShape(Array.isArray(dataset.strings) && Array.isArray(dataset.works) && dataset.works.length > 0 && Array.isArray(dataset.selections) && Array.isArray(dataset.axes), `Mystery Consensus ${publicVersion}`);
    const text = index => {
      if (index === -1 || index == null) return '';
      requireShape(Number.isInteger(index) && typeof dataset.strings[index] === 'string', `Mystery Consensus ${publicVersion} string reference ${index}`);
      return dataset.strings[index];
    };
    const copy = new Set(dataset.axes.map(axis => join([axis.label, axis.short])));
    for (const row of dataset.works) {
      requireShape(Array.isArray(row) && row.length >= 12, `Mystery Consensus ${publicVersion} work row`);
      copy.add(join([text(row[1]), text(row[2]), text(row[3]), row[4], text(row[5]).replaceAll('_', ' '), `Rank ${row[0]}`, `Consensus score ${Number(row[6]).toFixed(2)}`]));
    }
    // The public "Selections" view exposes variant titles and creators which do
    // not all survive canonical work merging. Include that visible copy too.
    for (const row of dataset.selections) {
      requireShape(Array.isArray(row) && row.length >= 9 && dataset.works[row[8]], `Mystery Consensus ${publicVersion} selection row`);
      copy.add(join([text(row[4]), text(row[5]), row[6], text(row[7]).replaceAll('_', ' ')]));
    }
    await addRecord({ url: `/mystery-report/?dataset=${publicVersion}#results`, title: `Mystery Consensus · Version ${publicVersion.slice(1)}`, site: 'mystery-report', content: join([...copy]) });
    coverage['mystery-report'].push({ version: publicVersion, works: dataset.works.length, selections: dataset.selections.length });
  }
}

// This is a schema-level allowlist of fields the public Profile renderer uses.
// Never recursively walk the publication object: a future export may contain
// extra fields which the interface intentionally does not display.
const profileFields = (record, fields) => {
  requireShape(isObject(record), 'published Profile field container');
  return join(fields.map(field => {
    const value = record[field];
    requireShape(value == null || typeof value === 'string' || typeof value === 'number', `published Profile ${field} scalar`);
    return plain(value);
  }));
};
const profileRows = (rows, render, name) => {
  requireShape(Array.isArray(rows), `published Profile ${name} rows`);
  return join(rows.map(render));
};
const profileTextList = (rows, name) => profileRows(rows, value => {
  requireShape(typeof value === 'string', `published Profile ${name} text`);
  return plain(value);
}, name);

function publicProfileCopy(data) {
  const { ancestry, lineage, reports, privacy } = data;
  requireShape(isObject(ancestry.versionHistory) && isObject(ancestry.paintings) && isObject(lineage.maternal) && isObject(lineage.paternal) && isObject(lineage.neanderthal), 'published Profile nested sections');
  const composition = rows => profileRows(rows, row => profileFields(row, ['name', 'group', 'percent']), 'composition');
  const ancestryCopy = join([
    composition(ancestry.broad), composition(ancestry.detailed),
    profileRows(ancestry.regionalSignals, signal => join([profileFields(signal, ['name', 'additional']), profileTextList(signal.regions, 'regions')]), 'regional signals'),
    profileRows(ancestry.versionHistory.comparison, row => profileFields(row, ['population', 'current', 'previous', 'change', 'note']), 'version comparison'),
  ]);
  const timelineCopy = join([
    profileRows(ancestry.timeline, row => profileFields(row, ['name', 'description', 'generationRange', 'estimatedYears']), 'timeline'),
    profileRows(ancestry.timelineScale.slice(1), row => profileFields(row, ['generation', 'year']), 'timeline scale'),
  ]);
  const paintingsCopy = join(['Most likely', '50%', '60%', '70%', '80%', '90%'].map(confidence => {
    if (!(confidence in ancestry.paintings)) return '';
    return join([confidence, profileRows(ancestry.paintings[confidence], chromosome => join([
      profileFields(chromosome, ['number']),
      ...['a', 'b'].map(copy => {
        if (chromosome[copy] == null) return '';
        requireShape(isObject(chromosome[copy]), 'published Profile chromosome copy');
        return profileRows(chromosome[copy].segments, segment => {
          requireShape(typeof segment.left === 'number' && typeof segment.width === 'number', 'published Profile segment position');
          return join([profileFields(segment, ['name']), `Chromosome ${chromosome.number}${copy.toUpperCase()} ${segment.left.toFixed(2)}–${(segment.left + segment.width).toFixed(2)}%`]);
        }, 'chromosome segments');
      }),
    ]), 'chromosomes')]);
  }));
  const neanderthal = lineage.neanderthal;
  const lineageCopy = join([
    'Maternal haplogroup', profileFields(lineage.maternal, ['haplogroup', 'estimatedAgeYears', 'origin', 'ageRangeYears', 'frequency', 'presentDistribution']),
    'Paternal haplogroup', profileFields(lineage.paternal, ['haplogroup', 'branch', 'estimatedAgeYears', 'frequency', 'origin', 'presentDistribution']),
    'Neanderthal ancestry', profileFields(neanderthal, ['variantsFound', 'moreThanPercent', 'estimatedDnaPercent', 'variantsTested']),
    profileRows(neanderthal.locations, row => profileFields(row, ['chromosome', 'copy', 'positionPercent']), 'Neanderthal locations'),
    profileRows(neanderthal.traitMarkers, row => join([profileFields(row, ['marker', 'trait', 'genotype', 'association']), row.detected ? 'Detected' : 'Not detected']), 'Neanderthal markers'),
  ]);
  const reportsCopy = profileRows(reports, report => join([
    profileFields(report, ['title', 'category', 'description']),
    report.locked || /tasks required|complete tasks to view/i.test(report.result) ? 'Locked — account task required' : plain(report.result),
    profileTextList(report.personalNotes, 'report interpretation'),
    profileRows(report.variants, variant => profileFields(variant, ['name', 'gene', 'marker', 'genotype', 'status']), 'report variants'),
  ]), 'reports');
  const privacyCopy = join([
    profileFields(data.meta || {}, ['captured', 'ancestryVersion', 'genotypingChip']),
    ...['included', 'removed', 'processing'].map(key => profileTextList(privacy[key], `privacy ${key}`)),
  ]);
  return { ancestry: ancestryCopy, timeline: timelineCopy, chromosomes: paintingsCopy, lineage: lineageCopy, reports: reportsCopy, privacy: privacyCopy };
}

async function collectProfile({ getText, addRecord, coverage }) {
  const data = parseJSONAssignment(await getText('/profile/data/profile-data.js'), 'window.PROFILE_DATA');
  requireShape(isObject(data.ancestry) && isObject(data.lineage) && Array.isArray(data.reports) && data.reports.length > 0 && isObject(data.privacy), 'published Profile dataset');
  for (const report of data.reports) requireShape(typeof report.title === 'string' && typeof report.result === 'string' && Array.isArray(report.personalNotes) && Array.isArray(report.variants), 'published Profile report');
  requireShape(Array.isArray(data.ancestry.timelineScale), 'published Profile timeline scale');
  const copy = publicProfileCopy(data);
  const sections = [
    ['ancestry', 'Ancestry estimates'], ['timeline', 'Ancestry timeline'],
    ['chromosomes', 'Ancestry by segment'], ['lineage', 'Lineage'],
    ['reports', 'Genetic reports'], ['privacy', 'Privacy and method'],
  ];
  for (const [id, title] of sections) {
    await addRecord({ url: `/profile/#${id}`, title: `${title} · Profile`, site: 'profile', content: copy[id] });
  }
  coverage.profile = { reports: data.reports.length, sections: sections.length };
}

async function collectLinks({ getJSON, addRecord, coverage }) {
  const data = await getJSON('/links/data/links.json');
  requireShape(Array.isArray(data.links) && Array.isArray(data.categories), 'Links collection');
  for (const link of data.links) requireShape(typeof link.title === 'string' && typeof link.description === 'string' && typeof link.category === 'string', 'Links entry');
  // The collection has no individual-link internal routing. Keep results on the
  // owner's collection instead of replacing them with third-party destinations.
  if (data.links.length) await addRecord({ url: '/links/', title: 'Links', site: 'links', content: join([data.categories, data.links.map(link => join([link.title, link.description, link.category]))]) });
  coverage.links = { links: data.links.length };
}

async function puzzlePages({ getJSON, coverage }) {
  const puzzles = await getJSON('/puzzles/data/puzzles.json');
  requireShape(Array.isArray(puzzles) && puzzles.length > 0, 'published Puzzles catalogue');
  const paths = puzzles.map(puzzle => {
    requireShape(typeof puzzle.slug === 'string' && /^[a-z\d]+(?:-[a-z\d]+)*$/.test(puzzle.slug) && typeof puzzle.title === 'string', 'published Puzzle route');
    return `/puzzles/${puzzle.slug}/`;
  });
  requireShape(new Set(paths).size === paths.length, 'duplicate published Puzzle routes');
  coverage.puzzles = { pages: paths.length };
  return paths;
}

export async function collectDynamicRecords({ getJSON, getText, addRecord }) {
  requireShape(typeof getJSON === 'function' && typeof getText === 'function' && typeof addRecord === 'function', 'adapter callbacks');
  const coverage = {};
  const context = { getJSON, getText, addRecord, coverage };
  await collectVisualNovels(context);
  await addRecord({ url: '/black-sheep-town/quiz/', title: 'Character quiz · Black Sheep Town', site: 'black-sheep-town', content: quizCopy(await getText('/black-sheep-town/quiz/quiz.js')) });
  await collectArmory(context);
  await collectMystery(context);
  await collectProfile(context);
  await collectLinks(context);
  const htmlPaths = await puzzlePages(context);
  return {
    coverage, htmlPaths,
    limits: [
      'Mystery Consensus and Profile expose section/dataset routes, not individual work/report routes.',
      'Glossary versions are indexed only when selectable by an actual published chapter state.',
      'NGU live telemetry is transient and is intentionally not captured in the static search corpus.',
      'NDB Idle and Box Logic published interface help and labels are captured separately from bundled JSX; dynamic game-state and story datasets are intentionally excluded.',
    ],
  };
}
