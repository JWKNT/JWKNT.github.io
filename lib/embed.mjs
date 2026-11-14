// The link preview of a page: Discord, Slack, Teams and other apps read these tags, without
// running scripts, when someone shares the link. The image is the page's symbol card from the
// site theme, an opaque 600px square.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const card = id => `https://jehlp.net/site-theme/v2/cards/${id}.png`;

export function embedTags({ title, description, url, image, alt, type = 'website' }, indent = '    ') {
  return [
    ['property', 'og:type', type],
    ['property', 'og:site_name', 'jehlp.net'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', image],
    ['property', 'og:image:width', 600],
    ['property', 'og:image:height', 600],
    ['property', 'og:image:alt', alt],
    ['name', 'twitter:card', 'summary'],
  ].map(([kind, key, value]) => `${indent}<meta ${kind}="${key}" content="${escape(value)}">`).join('\n');
}
