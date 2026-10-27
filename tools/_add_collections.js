/**
 * 批量新增「纯合集」歌手到歌手合集板块。
 * 参照历史做法（刘欢/罗大佑提交）：五表同加 + data.js 补热度 + songDB 建空条目。
 *
 * 用法：node tools/_add_collections.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手名 / 夸克合集 / 百度备用 / 性别(m|f|g) / 热度
const LIST = [
  ['孙楠',    'https://pan.quark.cn/s/74d5bd8a966c', 'https://pan.baidu.com/s/1Gc2Cljvy2sPWKMbSSBQorA?pwd=zf6d', 'm', 88],
  ['杨坤',    'https://pan.quark.cn/s/18dcfb2cf557', 'https://pan.baidu.com/s/1dRo-e7m14X85VO7DQperLg?pwd=zf6d', 'm', 86],
  ['汪峰',    'https://pan.quark.cn/s/4290ac6aa495', 'https://pan.baidu.com/s/1TWnuObdBM1OgSX8uuhpHqw?pwd=zf6d', 'm', 88],
  ['肖战',    'https://pan.quark.cn/s/22ab15d19575', 'https://pan.baidu.com/s/1fDBXuJ-w-JhGNGK7T608mg?pwd=zf6d', 'm', 85],
  ['田震',    'https://pan.quark.cn/s/e9b3eec38e6f', 'https://pan.baidu.com/s/1OM688tfoJ2hqPVBWB1TOtQ?pwd=zf6d', 'f', 84],
  ['韩磊',    'https://pan.quark.cn/s/9b6bde42cffe', 'https://pan.baidu.com/s/18G7xK6y-pV-t-bbGvoQn7g?pwd=zf6d', 'm', 76],
  ['腾格尔',  'https://pan.quark.cn/s/6434a5387301', 'https://pan.baidu.com/s/1RFVp9Op8L-J1M9aYcfnRYQ?pwd=zf6d', 'm', 82],
  ['刘宇宁',  'https://pan.quark.cn/s/65030f0b894d', 'https://pan.baidu.com/s/1hnCfEyZRBnYrLwUH1kmshw?pwd=zf6d', 'm', 78],
  ['邓丽欣',  'https://pan.quark.cn/s/2b3e1bcb5cb1', 'https://pan.baidu.com/s/1gp-4Vjij771EVqjyVirNnQ?pwd=zf6d', 'f', 74],
  ['杨千嬅',  'https://pan.quark.cn/s/e0444931ed43', 'https://pan.baidu.com/s/1c1H3OflU1pyFt0UXjdvAeA?pwd=zf6d', 'f', 80],
  ['李克勤',  'https://pan.quark.cn/s/790727a90c86', 'https://pan.baidu.com/s/1yUibBThZHmsWfZVqlJr0Rg?pwd=zf6d', 'm', 84],
];

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/** 定位 `var <name> = {` 的对象字面量范围（字符串感知） */
function litLoc(h, varName) {
  const re = new RegExp('var\\s+' + varName + '\\s*=\\s*\\{');
  const m = re.exec(h);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0, inStr = false, q = '';
  for (let i = start; i < h.length; i++) {
    const c = h[i];
    if (inStr) { if (c === q && h[i - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return { start: start, end: i }; }
  }
  return null;
}

/** 在对象字面量开头插入一条 "key": value, */
function insertEntry(h, varName, entry) {
  const loc = litLoc(h, varName);
  if (!loc) { console.log('  !! 未找到 ' + varName); return h; }
  return h.slice(0, loc.start + 1) + '\n' + entry + h.slice(loc.start + 1);
}

// ---------- data.js：只补热度，不建 songDB 条目 ----------
// 口径参照历史提交（刘欢纯合集阶段 161bd31）：
//   纯合集歌手只进首页 A-Z 目录（singerCollection），不进入 songDB，
//   因此不生成 singer/*.html 静态页、也不进 sitemap。
//   静态页等补齐单曲后再由 build-singers.js 自动生成。
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

for (const [name, quark, baidu, meta, pop] of LIST) {
  if (new RegExp("var singerPopularity=\\{'" + esc(name) + "'").test(dj)) {
    console.log('  · ' + name + ' 热度已存在，跳过');
    continue;
  }
  dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(name) + "':" + pop + ",");
}
fs.writeFileSync(DP, dj, 'utf8');

// ---------- index.html：五表 ----------
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const [name, quark, baidu, meta, pop] of LIST) {
  const e = esc(name);
  const collHas = new RegExp("'" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':").test(
    (litLoc(html, 'singerCollection') ? html.slice(litLoc(html, 'singerCollection').start, litLoc(html, 'singerCollection').end) : ''));
  if (collHas) { console.log('  · ' + name + ' 已存在于 singerCollection，跳过'); continue; }

  html = insertEntry(html, 'singerCollection', "  '" + e + "': '" + quark + "',");
  html = insertEntry(html, 'singerBaidu',    "  '" + e + "': '" + baidu + "',");
  html = insertEntry(html, 'singerImgs',     "  '" + e + "': '',");
  html = insertEntry(html, 'singerSongCounts', "  '" + e + "': 0,");
  html = insertEntry(html, 'singerMeta',     "  '" + e + "': '" + meta + "',");
}
fs.writeFileSync(HP, html, 'utf8');

// ---------- 校验 ----------
const cx = {};
vm.createContext(cx);
vm.runInContext(fs.readFileSync(DP, 'utf8'), cx);
const html2 = fs.readFileSync(HP, 'utf8');
const cx2 = {}; vm.createContext(cx2);
for (const v of ['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta']) {
  const loc = litLoc(html2, v);
  vm.runInContext(v + ' = ' + html2.slice(loc.start, loc.end + 1), cx2);
}

console.log('\n=== 入库结果 ===');
let bad = 0;
for (const [name] of LIST) {
  const ok = cx2.singerCollection[name] && cx2.singerBaidu[name] && cx2.singerMeta[name] &&
             (cx2.singerSongCounts[name] === 0) && cx.singerPopularity[name] &&
             !cx.songDB[name];   // 纯合集：不应有 songDB 条目（否则会生成空静态页）
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name +
    ' | 热度 ' + (cx.singerPopularity[name] || '-') +
    ' | ' + (cx2.singerMeta[name] || '-') +
    ' | 夸克 ' + (cx2.singerCollection[name] ? '有' : '缺') +
    ' | 百度 ' + (cx2.singerBaidu[name] ? '有' : '缺') +
    ' | 头像 ' + (cx2.singerImgs[name] ? '有' : '缺'));
}
console.log('songDB 键数: ' + Object.keys(cx.songDB).length +
  ' | singerCollection: ' + Object.keys(cx2.singerCollection).length);

// 内联脚本语法检查
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
