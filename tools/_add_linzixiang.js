// 林子祥入库：songDB（86 独唱 + 合唱键）+ 合集 + 计数 + 热度
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_linzixiang_parsed.json'), 'utf8'));
const QUARK = 'https://pan.quark.cn/s/21019a35a718';
const BAIDU = 'https://pan.baidu.com/s/1ybss1BgtQf2L1oyK-zyS-Q?pwd=ct5x';
const IMG = 'https://p1.music.126.net/qH-T8aOnaUWKpBdUm9E4jQ==/109951170065017697.jpg';
const OWNER = '林子祥';

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function entry(rec) { return "{ name: '" + esc(rec.name) + "', cover: '', quark: '" + rec.quark + "' }"; }

// 合唱键：同艺术家集合复用（林子祥&叶倩文 与 叶倩文&林子祥 合并）
const duoGroups = {};
const keySets = [];
parsed.multi.forEach(function (m) {
  let key = null;
  for (const ks of keySets) {
    if (ks.set.length === m.artists.length && m.artists.every(function (a) { return ks.set.indexOf(a) !== -1; })) { key = ks.key; break; }
  }
  if (!key) { key = m.artists.join('&'); keySets.push({ set: m.artists.slice(), key: key }); }
  (duoGroups[key] = duoGroups[key] || []).push({ name: m.name, quark: m.quark });
});
const duoKeys = Object.keys(duoGroups);
console.log('独唱:', parsed.solo.length, '| 合唱键:', duoKeys.length, '个', duoKeys.reduce(function (n, k) { return n + duoGroups[k].length; }, 0), '首');
duoKeys.forEach(function (k) { console.log('  ', k, '→', duoGroups[k].length, '首:', duoGroups[k].map(function (s) { return s.name; }).join(' / ')); });

// ---- data.js ----
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
if (/^  '林子祥':\s*\[/m.test(dj)) { console.log('!! songDB 已有林子祥'); process.exit(1); }
let block = "  '林子祥': [" + parsed.solo.map(entry).join(', ') + "],\n";
duoKeys.forEach(function (k) {
  block += "  '" + esc(k) + "': [" + duoGroups[k].map(entry).join(', ') + "],\n";
});
dj = dj.replace(/var\s+songDB\s*=\s*\{\n/, function (m) { return m + block; });
if (!/var singerPopularity=\{'林子祥'/.test(dj)) {
  dj = dj.replace(/var singerPopularity=\{/, "var singerPopularity={'林子祥':92,");
}
fs.writeFileSync(DP, dj, 'utf8');

const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('data.js 校验: 键数', Object.keys(cx.songDB).length, '| 林子祥', cx.songDB['林子祥'].length, '首 | 热度', cx.singerPopularity['林子祥']);
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

// ---- index.html ----
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');
function litLoc(h, v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(h); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return { start: s, end: e };
}
function insertIntoObj(h, varName, insertText) {
  const loc = litLoc(h, varName);
  if (!loc) { console.log('!! 未找到 ' + varName); process.exit(1); }
  const body = h.slice(loc.start, loc.end + 1);
  return h.slice(0, loc.start) + body.replace(/^\{/, '{\n' + insertText) + h.slice(loc.end + 1);
}
html = insertIntoObj(html, 'singerCollection', "  '林子祥': '" + QUARK + "',");
html = insertIntoObj(html, 'singerBaidu', "  '林子祥': '" + BAIDU + "',");
html = insertIntoObj(html, 'singerImgs', "  '林子祥': '" + IMG + "',");
html = insertIntoObj(html, 'singerSongCounts', "  '林子祥': " + parsed.solo.length + ",");
html = insertIntoObj(html, 'singerMeta', "  '林子祥': 'm',");
fs.writeFileSync(HP, html, 'utf8');

const html2 = fs.readFileSync(HP, 'utf8');
function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html2); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html2.indexOf('};', s);
  return html2.slice(s, e + 1);
}
const cx2 = {}; vm.createContext(cx2);
['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx2); });
console.log('index.html 校验:', cx2.singerCollection['林子祥'], '|', cx2.singerBaidu['林子祥'], '| counts', cx2.singerSongCounts['林子祥'], '| meta', cx2.singerMeta['林子祥']);
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(function (sm) { try { new vm.Script(sm[1]); } catch (e) { err++; console.log('语法错误:', e.message); } });
console.log('内联脚本语法错误:', err);
