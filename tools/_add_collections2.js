/**
 * 新增「合集」歌手：李幸倪 / 張天賦 / Tank
 *
 * 三位都只给了合集链接（无单曲清单），因此：
 *   - 李幸倪 / 張天賦：纯合集，不进 songDB，不生成静态页（与历史纯合集口径一致）
 *   - Tank：原本在 SINGLE_ONLY_KEYS（仅单曲收录，已有 1 首《专属天使》），
 *           现在有合集了 → 升级为正式合集歌手：
 *             ① 从 build-singers.js 的 SINGLE_ONLY_KEYS 移除
 *             ② songDB 保留那首单曲
 *             ③ 新增静态页
 *
 * 繁体名处理：项目惯例是繁体原样保留（如「黄霄雲」），不另建简体键；
 *              但补 singerAlias 让简体写法也能搜到（参照「黄丽玲」→「A-LIN」）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手 / 夸克合集 / 百度备用 / 性别 / 热度 / 头像
const LIST = [
  ['李幸倪', 'https://pan.quark.cn/s/cc8f3cdde9da', 'https://pan.baidu.com/s/11p_eJuZuqwVn0o4hhCDyBg?pwd=u8g4', 'f', 70,
   'https://p2.music.126.net/zuk8-xVxlfXI1sMeyj4eCA==/109951168229977747.jpg?param=300y300'],
  ['張天賦', 'https://pan.quark.cn/s/4213efd1c438', 'https://pan.baidu.com/s/14Gsqb_DDkBoElKt6okpVSA?pwd=u8g4', 'm', 66,
   'https://p2.music.126.net/MwL36uH0LmEyl_G3R82rEA==/109951169266039654.jpg?param=300y300'],
  ['Tank',   'https://pan.quark.cn/s/e0781ebd32a7', 'https://pan.baidu.com/s/16xbF-zJLcxI92gPTri3tyg?pwd=u8g4', 'f', 62,
   'https://p1.music.126.net/cesMisgjzJKBgvYsJcZW3A==/109951173563267232.jpg?param=300y300'],
];

// 简体别名 → 规范名（让搜「张天赋」能命中「張天賦」）
const ALIASES = [['张天赋', '張天賦'], ['Gin Lee', '李幸倪'], ['吕建忠', 'Tank']];

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

// ---------- 1. index.html 五表 ----------
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const [singer, quark, baidu, meta, pop, img] of LIST) {
  const e = esc(singer);
  const collLoc = litLoc(html, 'singerCollection');
  const collBlock = html.slice(collLoc.start, collLoc.end);
  if (new RegExp("'" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(collBlock)) {
    console.log('  · ' + singer + ' singerCollection 已有，跳过');
    continue;
  }
  // 合集歌手的曲数：Tank 已有 1 首单曲，其余为 0
  const cx0 = {}; vm.createContext(cx0);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), cx0);
  const count = cx0.songDB[singer] ? cx0.songDB[singer].length : 0;

  html = insertEntry(html, 'singerCollection', "  '" + e + "': '" + quark + "',");
  html = insertEntry(html, 'singerBaidu',    "  '" + e + "': '" + baidu + "',");
  html = insertEntry(html, 'singerImgs',     "  '" + e + "': '" + img + "',");
  html = insertEntry(html, 'singerSongCounts', "  '" + e + "': " + count + ",");
  html = insertEntry(html, 'singerMeta',     "  '" + e + "': '" + meta + "',");
  console.log('  ✓ ' + singer + ' → index.html 五表已加（单曲 ' + count + ' 首）');
}

// ---------- 2. singerAlias 别名 ----------
for (const [alias, target] of ALIASES) {
  const ae = esc(alias);
  const aliasLoc = litLoc(html, 'singerAlias');
  const aliasBlock = html.slice(aliasLoc.start, aliasLoc.end);
  if (new RegExp("'" + ae.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(aliasBlock)) {
    console.log('  · 别名 ' + alias + ' 已存在，跳过');
    continue;
  }
  html = insertEntry(html, 'singerAlias', "  '" + ae + "': '" + esc(target) + "',");
  console.log('  ✓ 别名 ' + alias + ' → ' + target);
}
fs.writeFileSync(HP, html, 'utf8');

// ---------- 3. data.js：热度 ----------
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
for (const [singer, quark, baidu, meta, pop, img] of LIST) {
  if (new RegExp("var singerPopularity=\\{'" + esc(singer) + "'").test(dj)) {
    console.log('  · ' + singer + ' 热度已存在，跳过');
    continue;
  }
  dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(singer) + "':" + pop + ",");
  console.log('  ✓ ' + singer + ' → 热度 ' + pop);
}
fs.writeFileSync(DP, dj, 'utf8');

// ---------- 4. build-singers.js：Tank 升级为正式合集歌手 ----------
const BP = path.join(ROOT, 'tools', 'build-singers.js');
let bs = fs.readFileSync(BP, 'utf8');
if (/const SINGLE_ONLY_KEYS = \[[^\]]*'Tank'/.test(bs)) {
  bs = bs.replace(/const SINGLE_ONLY_KEYS = \[[^\]]*\];/, "const SINGLE_ONLY_KEYS = ['于春洋'];");
  fs.writeFileSync(BP, bs, 'utf8');
  console.log('  ✓ Tank 已从 SINGLE_ONLY_KEYS 移除（升级为正式合集歌手）');
} else {
  console.log('  · Tank 不在 SINGLE_ONLY_KEYS，无需调整');
}

// ---------- 5. 校验 ----------
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(DP, 'utf8'), cx);
const html2 = fs.readFileSync(HP, 'utf8');
const cx2 = {}; vm.createContext(cx2);
for (const v of ['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta', 'singerAlias']) {
  const loc = litLoc(html2, v);
  vm.runInContext(v + ' = ' + html2.slice(loc.start, loc.end + 1), cx2);
}

console.log('\n=== 入库校验 ===');
let bad = 0;
for (const [singer] of LIST) {
  const issues = [];
  if (!cx2.singerCollection[singer]) issues.push('缺合集链接');
  if (!cx2.singerBaidu[singer]) issues.push('缺百度链接');
  if (!cx2.singerImgs[singer]) issues.push('缺头像');
  if (!cx2.singerMeta[singer]) issues.push('缺性别');
  if (!cx.singerPopularity[singer]) issues.push('缺热度');
  if (cx2.singerSongCounts[singer] !== (cx.songDB[singer] || []).length) issues.push('counts 不符');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + singer.padEnd(6) +
    ' | 单曲 ' + String((cx.songDB[singer] || []).length).padStart(2) + ' 首' +
    ' | 热度 ' + cx.singerPopularity[singer] +
    ' | ' + cx2.singerMeta[singer] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

console.log('\n别名:');
for (const k of Object.keys(cx2.singerAlias)) console.log('  ' + k + ' → ' + cx2.singerAlias[k]);

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('\nsongDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
