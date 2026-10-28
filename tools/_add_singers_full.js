/**
 * 新增「合集 + 单曲」完整形态的歌手：
 *   1. data.js: songDB 新增单曲（独唱）+ 合唱条目（& 键）+ singerPopularity 热度
 *   2. index.html: 五表（singerCollection 夸克 / singerBaidu 百度 / singerImgs 头像 /
 *      singerSongCounts / singerMeta）全部新增
 *   3. 静态页与 sitemap 由 build-singers.js 自动生成
 *
 * 用法：node tools/_add_singers_full.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手 / 夸克合集 / 百度备用 / 性别 / 热度 / 原始单曲文件
const LIST = [
  ['吴雨霏', 'https://pan.quark.cn/s/f49b99d952ab', 'https://pan.baidu.com/s/1b26YBhXEBhzCmVYtaxlErg?pwd=w1ft', 'f', 72, '_raw_wyf.txt'],
  ['郑秀文', 'https://pan.quark.cn/s/93e1c32cedd4', 'https://pan.baidu.com/s/11UFCseAT9Ka0Z0NlCSoSQA?pwd=w1ft', 'f', 84, '_raw_zxw.txt'],
  ['宋亚轩', 'https://pan.quark.cn/s/c88814d4e483', 'https://pan.baidu.com/s/13AK3s-4vH_5mDEttBtH0Bg?pwd=w1ft', 'm', 82, '_raw_syy.txt'],
];

// 合唱条目：原始文件名里带「其他歌手 - 」前缀的，拆成 & 键单列
// [原始文件名中的前缀, 归到谁名下, 新键名]
const COLLABS = {
  '_raw_wyf.txt': [['方力申 - 三位一体', '吴雨霏&方力申']],
};

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function litLoc(h, varName) {
  const m = new RegExp('var\\s+' + varName + '\\s*=\\s*\\{').exec(h);
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

function insertEntry(h, varName, entry) {
  const loc = litLoc(h, varName);
  if (!loc) return h;
  return h.slice(0, loc.start + 1) + '\n' + entry + h.slice(loc.start + 1);
}

/** 读取原始文件，拆成独唱与合唱两组 */
function parseRaw(file, singer) {
  const p = path.join(ROOT, 'tools', file);
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const collabMap = {};
  (COLLABS[file] || []).forEach(([prefix, key]) => { collabMap[prefix] = key; });

  const solo = [], collabs = {};
  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');

    // 命中合唱前缀：如「吴雨霏 - 方力申 - 三位一体」
    let hitCollab = false;
    for (const [prefix, key] of Object.entries(collabMap)) {
      const full = singer + ' - ' + prefix;
      if (name === full) {
        if (!collabs[key]) collabs[key] = [];
        collabs[key].push({ name: name.slice((singer + ' - ').length), quark: url });
        hitCollab = true;
        break;
      }
    }
    if (hitCollab) continue;

    if (name.startsWith(singer + ' - ')) name = name.slice(singer.length + 3);
    else if (name === singer) name = singer;
    solo.push({ name: name, quark: url });
  }
  return { solo: solo, collabs: collabs };
}

// ---------- 1. data.js ----------
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
const parsed = {};

for (const [singer, quark, baidu, meta, pop, file] of LIST) {
  const r = parseRaw(file, singer);
  parsed[singer] = r;

  // 独唱条目
  const soloKeys = Object.keys(r.collabs);
  const hasSolo = new RegExp("^  '" + esc(singer) + "':", 'm').test(dj);
  if (!hasSolo) {
    const block = "  '" + esc(singer) + "': [" + r.solo.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('  ✓ ' + singer + ' → songDB 独唱 ' + r.solo.length + ' 首');
  } else {
    console.log('  · ' + singer + ' songDB 已有独唱条目，跳过');
  }

  // 合唱条目（& 键）
  for (const key of soloKeys) {
    if (new RegExp("^  '" + esc(key) + "':", 'm').test(dj)) continue;
    const block = "  '" + esc(key) + "': [" + r.collabs[key].map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('    ✓ 合唱 ' + key + ' → ' + r.collabs[key].length + ' 首');
  }

  // 热度
  if (!new RegExp("var singerPopularity=\\{'" + esc(singer) + "'").test(dj)) {
    dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(singer) + "':" + pop + ",");
  }
}
fs.writeFileSync(DP, dj, 'utf8');

// ---------- 2. index.html 五表 ----------
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const [singer, quark, baidu, meta, pop, file] of LIST) {
  const e = esc(singer);
  const collLoc = litLoc(html, 'singerCollection');
  const collBlock = html.slice(collLoc.start, collLoc.end);
  if (new RegExp("'" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(collBlock)) {
    console.log('  · ' + singer + ' singerCollection 已有，跳过');
    continue;
  }
  const count = parsed[singer].solo.length;
  html = insertEntry(html, 'singerCollection', "  '" + e + "': '" + quark + "',");
  html = insertEntry(html, 'singerBaidu',    "  '" + e + "': '" + baidu + "',");
  html = insertEntry(html, 'singerImgs',     "  '" + e + "': '',");
  html = insertEntry(html, 'singerSongCounts', "  '" + e + "': " + count + ",");
  html = insertEntry(html, 'singerMeta',     "  '" + e + "': '" + meta + "',");
  console.log('  ✓ ' + singer + ' → index.html 五表已加（单曲 ' + count + ' 首）');
}
fs.writeFileSync(HP, html, 'utf8');

// ---------- 3. 校验 ----------
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(DP, 'utf8'), cx);
const html2 = fs.readFileSync(HP, 'utf8');
const cx2 = {}; vm.createContext(cx2);
for (const v of ['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta']) {
  const loc = litLoc(html2, v);
  vm.runInContext(v + ' = ' + html2.slice(loc.start, loc.end + 1), cx2);
}

console.log('\n=== 入库校验 ===');
let bad = 0;
for (const [singer] of LIST) {
  const issues = [];
  if (!cx.songDB[singer] || !cx.songDB[singer].length) issues.push('缺单曲');
  if (cx2.singerSongCounts[singer] !== (cx.songDB[singer] || []).length) issues.push('counts 不符');
  if (!cx2.singerCollection[singer]) issues.push('缺合集链接');
  if (!cx2.singerBaidu[singer]) issues.push('缺百度链接');
  if (!cx2.singerMeta[singer]) issues.push('缺性别');
  if (!cx.singerPopularity[singer]) issues.push('缺热度');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + singer.padEnd(4) +
    String((cx.songDB[singer] || []).length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[singer] +
    ' | ' + cx2.singerMeta[singer] + (issues.length ? ' | ' + issues.join(', ') : ''));
}
const collabKeys = Object.keys(cx.songDB).filter(k => k.includes('&'));
console.log('合唱键总数: ' + collabKeys.length + '（含 & 的条目不生成静态页）');

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('songDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
