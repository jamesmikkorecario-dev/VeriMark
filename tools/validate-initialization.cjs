// Documentation/artifact checks only; does not test application security.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const errors = [];
let links = 0;
for (const file of files.filter(f => f.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:|^\//i.test(target)) continue;
    target = decodeURIComponent(target);
    links++;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) errors.push(`${file}: missing ${target}`);
  }
}
for (const file of files.filter(f => /^docs\/(product|frontend|architecture|backend|database)\//.test(f))) {
  if (/\[REPLACE\]|\[hex\]|\[\.\.\]|\[WHO|\[ID\]/.test(fs.readFileSync(path.join(root, file), 'utf8'))) errors.push(`${file}: unresolved starter marker`);
}
for (const direction of ['ledger', 'signal', 'commons']) {
  if (!fs.existsSync(path.join(root, 'prototypes/design', direction, 'index.html'))) errors.push(`missing ${direction} preview`);
}
if (files.some(f => /^\.github\/workflows\/.*\.ya?ml$/.test(f))) errors.push('CI activated before application gates exist');
if (files.some(f => /(^|\/)(node_modules|\.git)\/|(^|\/)\.env$/.test(f))) errors.push('forbidden tracked export content');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`PASS: ${links} local Markdown targets, starter markers, three previews, inactive CI and tracked-content boundaries. Application tests not configured.`);
