// Pagefind 1.5.2 logs and swallows an index-chunk failure, which otherwise looks
// like a legitimate zero-result search. Keep this small, version-checked generated
// runtime patch until upstream propagates the failure. No global fetch hooks.
export function hardenPagefind(source) {
  const patches = [
    ['queued.resolve(await fetch(queued.input));', 'const response=await fetch(queued.input);if(!response.ok)throw new Error(`Search request failed: HTTP ${response.status}`);queued.resolve(response);'],
    ['console.error(`Failed to load the index chunk ${url}:\n${e?.toString()}`);', 'throw e;'],
    ['console.error(`Failed to load the meta index:\n${e?.toString()}`);', 'throw e;'],
    [source.includes('this.init(options2?.language);') ? 'this.init(options2?.language);' : 'this.init(options?.language);', source.includes('this.init(options2?.language);') ? 'this.init(options2?.language).catch(()=>{});' : 'this.init(options?.language).catch(()=>{});'],
  ];
  if (!source.includes('pagefind_version="1.5.2"')) throw new Error('Review search-runtime patch before upgrading Pagefind');
  for (const [before, after] of patches) {
    if (source.split(before).length !== 2) throw new Error(`Pagefind failure-handling patch no longer matches exactly: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
