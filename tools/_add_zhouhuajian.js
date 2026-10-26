// 周华健入库：清洗 (1)/(数字) 后缀并去重，含 1 首合唱
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const SINGER = '周华健';
const QUARK = 'https://pan.quark.cn/s/9466f89dc463';
const BAIDU = 'https://pan.baidu.com/s/1WVXFCJ0CSIGP_BrH16OQnw?pwd=kvci';
const IMG = process.argv[2] || '';
const POP = 93;
const META = 'm';

const lines = fs.readFileSync(path.join(ROOT, 'tools', '_zhouhuajian_raw.txt'), 'utf8')
  .split(/\r?\n/).filter(function (l) { return l.trim(); });

const raw = [];
for (let i = 0; i < lines.length; i += 2) {
  const f = lines[i].trim().replace(/\.mp3$/i, '');
  const u = (lines[i + 1] || '').trim();
  if (!/^https:\/\/pan\.quark\.cn\//.test(u)) { console.log('!! 链接异常:', f, '→', u); continue; }
  const mm = f.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) { console.log('!! 无法解析:', f); continue; }
  raw.push({ artists: mm[1].split(/\s*&\s*/).map(function (s) { return s.trim(); }), name: mm[2].trim(), quark: u });
}
console.log('原始条目:', raw.length);

// 名称清洗: 去掉 (1)/(2) 这类重复标记，以及 (数字) 前缀
function cleanName(n) {
  let s = n;
  s = s.replace(/^\(\d+\)/, '');          // 前缀 (1754015707)
  s = s.replace(/\(\d+\)\s*$/, '');       // 后缀 (1)
  return s.trim();
}

const soloSeen = {};
const solo = [];
const collabGroups = {};
let deduped = 0;
raw.forEach(function (r) {
  const name = cleanName(r.name);
  if (r.artists.length === 1) {
    if (soloSeen[name]) { deduped++; return; }
    soloSeen[name] = 1;
    solo.push({ name: name, quark: r.quark });
  } else {
    const key = r.artists.join('&');
    collabGroups[key] = collabGroups[key] || [];
    if (collabGroups[key].some(function (x) { return x.name === name; })) { deduped++; return; }
    collabGroups[key].push({ name: name, quark: r.quark });
  }
});
console.log('独唱:', solo.length, '| 合唱键:', Object.keys(collabGroups).length, '| 清洗去重:', deduped);

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function entry(s) { return "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"; }

const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
if (new RegExp("^  '" + SINGER + "':\\s*\\[", 'm').test(dj)) { console.log('!! songDB 已有周华健'); process.exit(1); }

let block = "  '" + SINGER + "': [" + solo.map(entry).join(', ') + "],\n";
Object.keys(collabGroups).forEach(function (k) {
  block += "  '" + esc(k) + "': [" + collabGroups[k].map(entry).join(', ') + "],\n";
});
dj = dj.replace(/var\s+songDB\s*=\s*\{\n/, function (m) { return m + block; });
if (!/var singerPopularity=\{'周华健'/.test(dj)) {
  dj = dj.replace(/var singerPopularity=\{/, "var singerPopularity={'周华健':" + POP + ",");
}
fs.writeFileSync(DP, dj, 'utf8');

const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('data.js: 键数', Object.keys(cx.songDB).length, '| 周华健', cx.songDB[SINGER].length, '首 | 热度', cx.singerPopularity[SINGER]);
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

// index.html
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');
function litLoc(h, v) {
  const m = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)').exec(h);
  if (!m) return null;
  const s = m.index + m[0].length - 1;
  return { start: s, end: h.indexOf('};', s) };
}
function insert(h, v, text) {
  const loc = litLoc(h, v);
  if (!loc) { console.log('!! 未找到 ' + v); return h; }
  const body = h.slice(loc.start, loc.end + 1);
  return h.slice(0, loc.start) + body.replace(/^\{/, '{\n' + text) + h.slice(loc.end + 1);
}
html = insert(html, 'singerCollection', "  '" + SINGER + "': '" + QUARK + "',");
html = insert(html, 'singerBaidu', "  '" + SINGER + "': '" + BAIDU + "',");
if (IMG) html = insert(html, 'singerImgs', "  '" + SINGER + "': '" + IMG + "',");
html = insert(html, 'singerSongCounts', "  '" + SINGER + "': " + solo.length + ",");
html = insert(html, 'singerMeta', "  '" + SINGER + "': '" + META + "',");
fs.writeFileSync(HP, html, 'utf8');

const html2 = fs.readFileSync(HP, 'utf8');
function lit(v) {
  const m = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)').exec(html2);
  if (!m) return null;
  const s = m.index + m[0].length - 1;
  return html2.slice(s, html2.indexOf('};', s) + 1);
}
const cx2 = {}; vm.createContext(cx2);
['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx2); });
console.log('index.html:', cx2.singerCollection[SINGER], '|', cx2.singerBaidu[SINGER], '| counts', cx2.singerSongCounts[SINGER], '| meta', cx2.singerMeta[SINGER]);
console.log('头像:', (cx2.singerImgs[SINGER] || '(无)').slice(0, 60));
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(function (sm) { try { new vm.Script(sm[1]); } catch (e) { err++; } });
console.log('内联脚本语法错误:', err);
