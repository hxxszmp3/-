// 第二轮修正：应用人工选定的候选
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const P = path.join(ROOT, 'index.html');
let src = fs.readFileSync(P, 'utf8');

const cands = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_fix_candidates.json'), 'utf8'));

// name -> 'ne' | 'qq'
const CHOOSE = {
  'A-LIN': 'qq',
  '付豪': 'ne',
  '河图': 'ne',
  '高胜美': 'ne',
  'Avril Lavigne': 'ne',
  '柒玥': 'ne',
  'Ella陈嘉桦': 'ne',
  '半吨兄弟': 'ne',
  '艾热': 'ne',
  '艾福杰尼': 'qq',
  '蒋雪儿': 'ne',
  '蔡国庆': 'ne',
  '马旭东': 'qq',
  '希林娜依高': 'ne',
  '邓寓君(等什么君)': 'ne',
  '毕夏': 'ne',
  'EXO&유재석': 'qq'
};

const decl = src.match(/var\s+singerImgs\s*=\s*\{/);
const start = decl.index + decl[0].length - 1;
const end = src.indexOf('};', start);
let block = src.slice(start, end + 1);

const changed = [], errors = [];
Object.keys(CHOOSE).forEach(function (k) {
  const rec = cands[k];
  if (!rec) { errors.push(k + '(无候选)'); return; }
  const url = CHOOSE[k] === 'ne' ? rec.neteaseImg : rec.qqImg;
  if (!url) { errors.push(k + '(候选无url)'); return; }
  const re = new RegExp("('" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*')([^']*)(')");
  if (!re.test(block)) { errors.push(k + '(块内无此键)'); return; }
  block = block.replace(re, '$1' + url + '$3');
  changed.push({ key: k, url: url, action: 'fix2-' + CHOOSE[k], source: k });
});

src = src.slice(0, start) + block + src.slice(end + 1);
fs.writeFileSync(P, src, 'utf8');

console.log('第二轮替换:', changed.length, '| 失败:', errors.length);
errors.forEach(function (e) { console.log('  ✗', e); });

// 校验
const html = fs.readFileSync(P, 'utf8');
const d2 = html.match(/var\s+singerImgs\s*=\s*\{/);
const s2 = d2.index + d2[0].length - 1;
const e2 = html.indexOf('};', s2);
const cx = {}; vm.createContext(cx);
vm.runInContext('imgs = ' + html.slice(s2, e2 + 1), cx);
let bad = 0;
changed.forEach(function (c) {
  if (cx.imgs[c.key] !== c.url) { console.log('  ✗ 未生效:', c.key); bad++; }
});
console.log('未生效:', bad);

fs.appendFileSync(path.join(ROOT, 'tools', '_changed.json'), '\n/* round2 */\n' + JSON.stringify(changed, null, 1), 'utf8');
console.log('追加到 _changed.json 完成');
