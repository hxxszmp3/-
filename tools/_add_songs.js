/**
 * 批量把「纯合集歌手」补充为「合集 + 单曲」：
 *   1. data.js 的 songDB 新增这批单曲（歌手名作为键）
 *   2. index.html 的 singerSongCounts 从 0 更新为实际首数
 *   3. singerCollection / singerBaidu / singerImgs / singerMeta / singerPopularity 已在上一轮建好，本脚本只做存在性校验
 *
 * 用法：node tools/_add_songs.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 原始文件 → 歌手名
const FILES = [
  ['_raw_lkq.txt', '李克勤'],
  ['_raw_yqh.txt', '杨千嬅'],
  ['_raw_dlx.txt', '邓丽欣'],
  ['_raw_lyn.txt', '刘宇宁'],
  ['_raw_tge.txt', '腾格尔'],
  ['_raw_hl.txt',  '韩磊'],
  ['_raw_tz.txt',  '田震'],
  ['_raw_xz.txt',  '肖战'],
  ['_raw_wf.txt',  '汪峰'],
  ['_raw_yk.txt',  '杨坤'],
  ['_raw_sn.txt',  '孙楠'],
];

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/** 定位 `var <name> = {` 的对象字面量范围（字符串感知） */
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

/** 在对象字面量开头插入一条 "key": value, */
function insertEntry(h, varName, entry) {
  const loc = litLoc(h, varName);
  if (!loc) return h;
  return h.slice(0, loc.start + 1) + '\n' + entry + h.slice(loc.start + 1);
}

// ---------- 1. 解析原始文件 ----------
const songsBySinger = {};
const order = [];
for (const [file, singer] of FILES) {
  const p = path.join(ROOT, 'tools', file);
  if (!fs.existsSync(p)) { console.error('缺文件: ' + file); process.exit(1); }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const list = [];
  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(singer + ' - ')) name = name.slice(singer.length + 3);
    else if (name === singer) name = singer;   // 「杨千嬅.mp3」：文件名即歌名
    list.push({ name: name, quark: url });
  }
  songsBySinger[singer] = list;
  order.push(singer);
}
const totalNew = order.reduce((s, k) => s + songsBySinger[k].length, 0);
console.log('解析: ' + order.length + ' 位歌手，共 ' + totalNew + ' 首');

// ---------- 2. data.js：songDB 写入 ----------
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

for (const singer of order) {
  const songs = songsBySinger[singer];
  if (new RegExp("^  '" + esc(singer) + "':", 'm').test(dj)) {
    console.log('  · ' + singer + ' songDB 已有条目，跳过');
    continue;
  }
  // 与现有格式一致：每个歌手一行，歌曲对象紧凑排列在同一行
  // 注意 data.js 用 CRLF 行尾，锚点只匹配到 `{`，不依赖换行符
  const block = "  '" + esc(singer) + "': [" + songs.map(s =>
    "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
  ).join(', ') + "],\r\n";
  const before = dj;
  dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
  if (dj === before) { console.error('✗ songDB 插入失败: ' + singer); process.exit(1); }
  console.log('  ✓ ' + singer + ' → songDB ' + songs.length + ' 首');
}
fs.writeFileSync(DP, dj, 'utf8');

// ---------- 3. index.html：singerSongCounts 更新 ----------
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const singer of order) {
  const count = songsBySinger[singer].length;
  const re = new RegExp("('" + esc(singer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*)(\\d+)");
  if (!re.test(html)) { console.error('✗ singerSongCounts 未找到 ' + singer); process.exit(1); }
  html = html.replace(re, '$1' + count);
}
fs.writeFileSync(HP, html, 'utf8');
console.log('  ✓ singerSongCounts 已更新');

// ---------- 4. 校验 ----------
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
for (const singer of order) {
  const songs = cx.songDB[singer] || [];
  const issues = [];
  if (songs.length !== songsBySinger[singer].length) issues.push('曲数不符');
  if (cx2.singerSongCounts[singer] !== songs.length) issues.push('counts 不符');
  if (!cx2.singerCollection[singer]) issues.push('缺合集链接');
  if (!cx2.singerBaidu[singer]) issues.push('缺百度链接');
  if (!cx2.singerImgs[singer]) issues.push('缺头像');
  if (!cx2.singerMeta[singer]) issues.push('缺性别');
  if (!cx.singerPopularity[singer]) issues.push('缺热度');
  if (songs.some(s => !s.quark || !/^https:\/\/pan\.quark\.cn\/s\//.test(s.quark))) issues.push('链接异常');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + singer.padEnd(4) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[singer] +
    ' | ' + cx2.singerMeta[singer] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('\nsongDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

// 内联脚本语法检查
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
