// 将解析结果应用到 index.html 的 singerImgs
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const P = path.join(ROOT, 'index.html');
let src = fs.readFileSync(P, 'utf8');

const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_avatar_result.json'), 'utf8'));
const resolved = result.resolved || {};

const decl = src.match(/var\s+singerImgs\s*=\s*\{/);
if (!decl) { console.log('!! 未找到 singerImgs'); process.exit(1); }
const start = decl.index + decl[0].length - 1;
const end = src.indexOf('};', start);
let block = src.slice(start, end + 1);

const changed = [], skipped = [];
Object.keys(resolved).forEach(function (k) {
  const rec = resolved[k];
  if (!rec.url) { skipped.push(k); return; }
  const re = new RegExp("('" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*')([^']*)(')");
  if (!re.test(block)) { skipped.push(k + '(块内无此键)'); return; }
  block = block.replace(re, '$1' + rec.url + '$3');
  changed.push({ key: k, url: rec.url, action: rec.action, source: rec.source });
});

src = src.slice(0, start) + block + src.slice(end + 1);
fs.writeFileSync(P, src, 'utf8');

console.log('已替换:', changed.length, '| 跳过:', skipped.length);
if (skipped.length) console.log('  跳过列表:', skipped.join(', '));

// 校验
const html = fs.readFileSync(P, 'utf8');
const d2 = html.match(/var\s+singerImgs\s*=\s*\{/);
const s2 = d2.index + d2[0].length - 1;
const e2 = html.indexOf('};', s2);
const cx = {}; vm.createContext(cx);
vm.runInContext('imgs = ' + html.slice(s2, e2 + 1), cx);
const imgs = cx.imgs;

let mismatch = 0;
changed.forEach(function (c) {
  if (imgs[c.key] !== c.url) { console.log('  ✗ 未生效:', c.key); mismatch++; }
});
const PLACEHOLDER_RE = [/6y-UleORITEDbvrOLV0Q8A/, /VnZiScyynLG7atLIZ2YPkw==\/18686200114669622/];
const ph = Object.keys(imgs).filter(function (k) { return PLACEHOLDER_RE.some(function (r) { return r.test(imgs[k] || ''); }); });

console.log('替换未生效:', mismatch, '| 仍含占位图:', ph.length ? ph.join(', ') : '无');

// 供拼联络表用
fs.writeFileSync(path.join(ROOT, 'tools', '_changed.json'), JSON.stringify(changed, null, 1));
console.log('变更清单已存 tools/_changed.json');
