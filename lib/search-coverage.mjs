// Match the authored roots, not a fixed historical site count. Fail closed before
// replacing an artifact, while allowing legitimate content additions/removals.
export function validateSearchCoverage(coverage, directory) {
  const expected = directory.flatMap(group => group.pages.map(page => page.label));
  const sites = Object.keys(coverage.sites || {});
  if (!Number.isInteger(coverage.records) || coverage.records < expected.length ||
      !Number.isInteger(coverage.htmlPages) || coverage.htmlPages < expected.length ||
      sites.length !== expected.length || expected.some(label => !Number.isInteger(coverage.sites?.[label]) || coverage.sites[label] < 1) ||
      !Number.isFinite(Date.parse(coverage.generatedAt))) {
    throw new Error('Build a complete search artifact for every authored root before publishing');
  }
  if (directory.some(group => group.pages.some(page => page.href === '/readers/')) && !coverage.readers?.chapters) throw new Error('Missing Readers search passages');
}
