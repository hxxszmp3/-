// 通用入库脚本（单人歌手）：解析 raw txt → songDB + 合集表 + 计数 + 热度
// 用法: node tools/_add_solo_singer.js <raw文件> <歌手名>
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const RAW = process.argv[2];
const SINGER = process.argv[3];
if (!RAW || !SINGER) { console.log('用法: node _add_solo_singer.js <rawTxt> <歌手名>'); process.exit(1); }

const QUARK = process.argv[4] || '';
const BAIDU = process.argv[5] || '';
const IMG = process.argv[6] || '';
const META = process.argv[7] || 'f';
const POP = parseInt(process.argv[8] || '85', 10);

const lines = fs.readFileSync(RAW, 'utf8').split(/\r?\n/).filter(function (l) { return l.trim(); });
const songs = [];
for (let i = 0; i < lines.length; i += 2) {
  const f = lines[i].trim().replace(/\.mp3$/i, '');
  const u = (lines[i + 1] || '').trim();
  if (!/^https:\/\/pan\.quark\.cn\//.test(u)) { console.log('!! 链接异常:', f, '→', u); continue; }
  const mm = f.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) { console.log('!! 无法解析:', f); continue; }
  const singer = mm[1].trim(), name = mm[2].trim();
  if (singer !== SINGER) { console.log('!! 歌手不符:', singer, '|', name); continue; }
  songs.push({ name: name, quark: u });
}
console.log('解析歌曲:', songs.length);
const seen = {};
songs.forEach(function (s) { if (seen[s.name]) console.log('!! 清单内重名:', s.name); seen[s.name] = 1; });

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
const re = new RegExp("^  '" + SINGER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':\\s*\\[", 'm');
if (re.test(dj)) { console.log('!! songDB 已有 ' + SINGER + '，终止'); process.exit(1); }

const block = "  '" + esc(SINGER) + "': [" + songs.map(function (s) {
  return "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }";
}).join(', ') + "],\n";
dj = dj.replace(/var\s+songDB\s*=\s*\{\n/, function (m) { return m + block; });
if (POP && !new RegExp("var singerPopularity=\\{'" + SINGER).test(dj)) {
  dj = dj.replace(/var singerPopularity=\{/, "var singerPopularity={'" + esc(SINGER) + "':" + POP + ",");
}
fs.writeFileSync(DP, dj, 'utf8');

const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('data.js: 键数', Object.keys(cx.songDB).length, '| ' + SINGER, cx.songDB[SINGER].length, '首 | 热度', cx.singerPopularity[SINGER]);
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

// index.html 各表
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');
function litLoc(h, v) {
  const m = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)').exec(h);
  if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return { start: s, end: e };
}
function insert(h, varName, text) {
  const loc = litLoc(h, varName);
  if (!loc) { console.log('!! 未找到 ' + varName); return h; }
  const body = h.slice(loc.start, loc.end + 1);
  return h.slice(0, loc.start) + body.replace(/^\{/, '{\n' + text) + h.slice(loc.end + 1);
}
const e0 = esc(SINGER);
if (QUARK) html = insert(html, 'singerCollection', "  '" + e0 + "': '" + QUARK + "',");
if (BAIDU) html = insert(html, 'singerBaidu', "  '" + e0 + "': '" + BAIDU + "',");
if (IMG) html = insert(html, 'singerImgs', "  '" + e0 + "': '" + IMG + "',");
html = insert(html, 'singerSongCounts', "  '" + e0 + "': " + songs.length + ",");
html = insert(html, 'singerMeta', "  '" + e0 + "': '" + META + "',");
fs.writeFileSync(HP, html, 'utf8');

const html2 = fs.readFileSync(HP, 'utf8');
function lit(v) {
  const m = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)').exec(html2);
  if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html2.indexOf('};', s);
  return html2.slice(s, e + 1);
}
const cx2 = {}; vm.createContext(cx2);
['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx2); });
console.log('index.html:', cx2.singerCollection[SINGER] || '(无合集)', '|', cx2.singerBaidu[SINGER] || '(无百度)', '| counts', cx2.singerSongCounts[SINGER], '| meta', cx2.singerMeta[SINGER]);
console.log('头像:', (cx2.singerImgs[SINGER] || '(无)').slice(0, 60));
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(function (sm) { try { new vm.Script(sm[1]); } catch (e) { err++; console.log('语法错误:', e.message); } });
console.log('内联脚本语法错误:', err);
