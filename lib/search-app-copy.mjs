import { parse as parseJS } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { walk, attr, ORIGIN } from './search-content.mjs';

function jsxCall(callee) {
  if (callee?.type === 'SequenceExpression') return jsxCall(callee.expressions.at(-1));
  return callee?.type === 'MemberExpression' && ['jsx', 'jsxs'].includes(callee.property.name);
}
function literalText(value) {
  if (!value) return [];
  if (value.type === 'Literal' && typeof value.value === 'string') return [value.value];
  if (value.type === 'TemplateLiteral') return value.quasis.map(q => q.value.cooked || '');
  if (value.type === 'ArrayExpression') return value.elements.flatMap(literalText);
  if (value.type === 'ConditionalExpression') return [...literalText(value.consequent), ...literalText(value.alternate)];
  if (value.type === 'LogicalExpression') return literalText(value.right);
  if (value.type === 'BinaryExpression' && value.operator === '+') return [...literalText(value.left), ...literalText(value.right)];
  return [];
}
export function publishedInterfaceCopy(source) {
  const ast = parseJS(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const copy = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && jsxCall(node.callee)) {
      const [element, props] = node.arguments;
      // Only literal intrinsic HTML elements: never execute app logic or search
      // arbitrary bundle strings, story datasets, saved games, or framework code.
      if (literalText(element).length === 1 && props?.type === 'ObjectExpression') {
        for (const property of props.properties) {
          if (property.type === 'Property' && (property.key.name || property.key.value) === 'children') {
            for (const text of literalText(property.value)) {
              if (/[\p{L}]{3}/u.test(text)) copy.add(text.trim());
            }
          }
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return [...copy];
}

export async function collectAppCopy({ getText, addRecord, paths = null }) {
  const coverage = {};
  for (const [id, title] of [['box-puzzles', 'Box Logic'], ['ndb-idle', 'NDB Idle']]) {
    const root = `/${id}/`;
    if (paths !== null && !paths.includes(root)) continue;
    const html = parseHTML(await getText(root));
    const modules = [];
    walk(html, node => {
      if (node.tagName === 'script' && attr(node, 'type') === 'module' && attr(node, 'src')) {
        const url = new URL(attr(node, 'src'), ORIGIN + root);
        if (url.origin !== ORIGIN || !url.pathname.startsWith(root + 'assets/') || !url.pathname.endsWith('.js')) throw new Error(`Unexpected ${title} module URL`);
        modules.push(url.pathname);
      }
    });
    if (!modules.length) throw new Error(`${title} published entry module was not found`);
    const copy = new Set();
    for (const path of modules) for (const text of publishedInterfaceCopy(await getText(path))) copy.add(text);
    if (copy.size < 10) throw new Error(`${title} published interface copy changed format`);
    await addRecord({ url: root, title, site: title, content: [...copy].join('\n') });
    coverage[title] = { interfaceTextFragments: copy.size, scope: 'Published interface instructions and labels; dynamic game state and story datasets are excluded.' };
  }
  return coverage;
}
