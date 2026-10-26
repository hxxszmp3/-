// 那英入库：songDB（76 独唱 + 合唱键）+ 合集 + 计数 + 热度
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_naying_parsed.json'), 'utf8'));
const QUARK = 'https://pan.quark.cn/s/5a685b6fd8d3';
const BAIDU = 'https://pan.baidu.com/s/1y2aTgPMEhml3ry11R6DCOQ?pwd=2q51';
const IMG = 'https://p2.music.126.net/0CloH0zYZ8rOF_dyEc8kJg==/109951169164936011.jpg';
const OWNER = '那英';

// ---- 组装歌曲 ----
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function entry(rec) { return "{ name: '" + esc(rec.name) + "', cover: '', quark: '" + rec.quark + "' }"; }

const soloSongs = [];
const duoGroups = {};   // key -> songs[]
const keySets = [];     // [{set, key}]
const attributed = [];  // 大合唱归入那英

function getKey(artists) {
  // 同集合已有键则复用
  for (const ks of keySets) {
    if (ks.set.length === artists.length && artists.every(function (a) { return ks.set.indexOf(a) !== -1; })) return ks.key;
  }
  const key = artists.join('&');
  keySets.push({ set: artists.slice(), key: key });
  return key;
}

parsed.solo.forEach(function (s) { soloSongs.push({ name: s.name, quark: s.quark }); });
parsed.multi.forEach(function (m) {
  if (m.artists.length <= 4) {
    const key = getKey(m.artists);
    (duoGroups[key] = duoGroups[key] || []).push({ name: m.name, quark: m.quark });
  } else {
    attributed.push({ name: m.name, quark: m.quark, n: m.artists.length });
  }
});

const naSongs = soloSongs.concat(attributed.map(function (a) { return { name: a.name, quark: a.quark }; }));
console.log('那英名下:', naSongs.length, '首（含大合唱归入', attributed.length, '首）');
const duoKeys = Object.keys(duoGroups);
console.log('合唱键:', duoKeys.length, '个,', duoKeys.reduce(function (n, k) { return n + duoGroups[k].length; }, 0), '首');
duoKeys.forEach(function (k) { console.log('  ', k, '→', duoGroups[k].length, '首'); });

// ---- 写 data.js ----
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
if (/^  '那英':\s*\[/m.test(dj)) { console.log('!! songDB 已有那英'); process.exit(1); }

let block = "  '那英': [" + naSongs.map(entry).join(', ') + "],\n";
duoKeys.forEach(function (k) {
  block += "  '" + esc(k) + "': [" + duoGroups[k].map(entry).join(', ') + "],\n";
});
dj = dj.replace(/var\s+songDB\s*=\s*\{\n/, function (m) { return m + block; });

// 热度
if (!/var singerPopularity=\{'那英'/.test(dj)) {
  dj = dj.replace(/var singerPopularity=\{/, "var singerPopularity={'那英':93,");
}
fs.writeFileSync(DP, dj, 'utf8');

// 校验 data.js
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('校验: songDB 键数', Object.keys(cx.songDB).length, '| 那英', cx.songDB['那英'].length, '首 | 热度', cx.singerPopularity['那英']);
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

// ---- 写 index.html ----
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
html = insertIntoObj(html, 'singerCollection', "  '那英': '" + QUARK + "',");
html = insertIntoObj(html, 'singerBaidu', "  '那英': '" + BAIDU + "',");
html = insertIntoObj(html, 'singerImgs', "  '那英': '" + IMG + "',");
html = insertIntoObj(html, 'singerSongCounts', "  '那英': " + naSongs.length + ",");
html = insertIntoObj(html, 'singerMeta', "  '那英': 'f',");
fs.writeFileSync(HP, html, 'utf8');

// 校验 index.html
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
console.log('index.html 校验:', cx2.singerCollection['那英'], '|', cx2.singerBaidu['那英'], '| counts', cx2.singerSongCounts['那英'], '| meta', cx2.singerMeta['那英']);
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(function (sm) { try { new vm.Script(sm[1]); } catch (e) { err++; console.log('语法错误:', e.message); } });
console.log('内联脚本语法错误:', err);
