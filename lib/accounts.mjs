import { escapeHtml } from './directory.mjs';

// Profiles on other sites, in authored order. rel="me" marks each link as the
// same person, so services that verify identity links can read them.
export function validateAccounts(accounts) {
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('Add at least one account');
  const hrefs = new Set();
  for (const account of accounts) {
    if (typeof account?.site !== 'string' || !account.site.trim()) throw new Error('Each account needs a site name');
    let url;
    try { url = new URL(account.href); } catch { throw new Error(`Invalid account link: ${account.site}`); }
    if (url.protocol !== 'https:' || url.username || url.password || hrefs.has(url.href)) throw new Error(`Duplicate or non-HTTPS account link: ${account.site}`);
    for (const key of ['handle', 'kind']) if (account[key] !== undefined && (typeof account[key] !== 'string' || !account[key].trim())) throw new Error(`Invalid ${key}: ${account.site}`);
    hrefs.add(url.href);
  }
}

export function renderAccountsPage(accounts) {
  validateAccounts(accounts);
  const rows = accounts.map(account => `        <li><a class="account-site" href="${escapeHtml(account.href)}" rel="me">${escapeHtml(account.site)}<span class="ui-link-arrow" aria-hidden="true"></span></a>${account.handle ? `<span class="account-handle">${escapeHtml(account.handle)}</span>` : ''}${account.kind ? `<span class="account-kind">${escapeHtml(account.kind)}</span>` : ''}</li>`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="jehlp on ${escapeHtml(accounts.map(account => account.site).join(', '))}.">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="Accounts">
    <meta property="og:url" content="https://jehlp.net/accounts/">
    <meta property="og:site_name" content="jehlp.net">
    <meta name="theme-color" content="#fbfaf7">
    <link rel="canonical" href="https://jehlp.net/accounts/">
    <title>Accounts · jehlp.net</title>
    <link rel="icon" href="https://jehlp.net/site-theme/v2/favicons/home.png?v=20261107-seal" type="image/png">
    <script src="https://jehlp.net/site-theme/v2/theme.js?v=20261009-reading-folio"></script>
    <link rel="stylesheet" href="https://jehlp.net/site-theme/v2/base.css?v=20261108-justify">
    <link rel="stylesheet" href="../assets/accounts.css?v=20261102-accounts2">
  </head>
  <body data-site-tone="blue">
    <a class="skip-link" href="#accounts">Skip to accounts</a>
    <header class="site-header site-header--identity">
      <div class="site-brand"><img class="site-mark" src="https://jehlp.net/site-theme/v2/marks/home.png" width="32" height="32" alt=""><h1 class="site-title">Accounts</h1></div>
      <nav aria-label="Site links"><span class="site-utility-pair"><a class="site-home" href="https://jehlp.net/" aria-label="Home — jehlp.net" title="Home — jehlp.net"><span aria-hidden="true">✳</span></a><button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark theme" aria-pressed="false">◐</button></span></nav>
    </header>
    <main id="accounts" class="accounts-shell" tabindex="-1">
      <p class="lede">Profiles on other sites.</p>
      <ul class="accounts">
${rows}
      </ul>
    </main>
  </body>
</html>
`;
}
