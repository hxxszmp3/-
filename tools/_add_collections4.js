/**
 * 新增「合集」歌手 5 位：萧敬腾 / 林志炫 / 费翔 / 谢霆锋 / 黎明
 *   合集板块：夸克合集 + 百度网盘备用 + 网易云官方人像 + 性别 + 热度
 *   单曲板块：共 592 首
 *
 * 合唱处理：歌名形如「阿门-容祖儿&谢霆锋」的条目，
 *   拆成独立键「容祖儿&谢霆锋」，歌名只保留前半段「阿门」，
 *   与项目既有惯例一致（含 & 的键只参与单曲搜索、不生成静态页）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手键 / 夸克合集 / 百度备用 / 性别 / 热度 / 头像 / 别名 / raw 文件
const LIST = [
  {
    key: '萧敬腾',
    quark: 'https://pan.quark.cn/s/8d9095999749',
    baidu: 'https://pan.baidu.com/s/11Eq8JOI6cCak4vWcrjnl_w?pwd=4xuj',
    gender: 'm', pop: 80,
    img: 'https://p1.music.126.net/tiJFgnxU4lSbsEHoUpjxbA==/109951169108541147.jpg?param=300y300',
    aliases: [['Jam Hsiao', '萧敬腾'], ['小老板', '萧敬腾']],
    file: '_raw_xjtt.txt', prefix: '萧敬腾',
  },
  {
    key: '林志炫',
    quark: 'https://pan.quark.cn/s/02a11f9d4200',
    baidu: 'https://pan.baidu.com/s/1j4g638BcNTCpC57VmQ9sjg?pwd=4xuj',
    gender: 'm', pop: 74,
    img: 'https://p2.music.126.net/qH1pn2MK6tAtPBm-1JXQTg==/109951173481195385.jpg?param=300y300',
    aliases: [['Terry Lin', '林志炫']],
    file: '_raw_lzx.txt', prefix: '林志炫',
  },
  {
    key: '费翔',
    quark: 'https://pan.quark.cn/s/f9c9764bf541',
    baidu: 'https://pan.baidu.com/s/1M9e2l6tJ0zpKRCytSTFg4A?pwd=4xuj',
    gender: 'm', pop: 68,
    img: 'https://p1.music.126.net/M2wWar62JL_EBh0cdDs52g==/274877906965565.jpg?param=300y300',
    aliases: [['Kris Phillips', '费翔']],
    file: '_raw_fx.txt', prefix: '费翔',
  },
  {
    key: '谢霆锋',
    quark: 'https://pan.quark.cn/s/f31bf0412922',
    baidu: 'https://pan.baidu.com/s/1DM1WZ7D4XbY12azhbsg-dQ?pwd=4xuj',
    gender: 'm', pop: 76,
    img: 'https://p1.music.126.net/c8G-p-KJz72unSx02DeMqw==/109951168978216050.jpg?param=300y300',
    aliases: [['Nicholas Tse', '谢霆锋']],
    file: '_raw_xtc.txt', prefix: '谢霆锋',
  },
  {
    key: '黎明',
    quark: 'https://pan.quark.cn/s/e3b2bb654e57',
    baidu: 'https://pan.baidu.com/s/1wJy1fVLtjPZTlXyYv_o5TA?pwd=4xuj',
    gender: 'm', pop: 70,
    img: 'https://p2.music.126.net/swjCZvmZUox_sa39DHIQuQ==/109951166129231763.jpg?param=300y300',
    aliases: [['Leon Lai', '黎明']],
    file: '_raw_lm.txt', prefix: '黎明',
  },
];

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

/**
 * 读取 raw 并拆分独唱 / 合唱。
 * 合唱识别：歌名形如「歌名-歌手A&歌手B&...」，
 *   键 = 歌手串（去掉前缀歌手名重复），歌名 = 前半段
 */
function parseRaw(file, prefix) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8')
    .split(/\r?\n/).filter(l => l.trim());
  if (lines.length % 2 !== 0) throw new Error(file + ' 行数非偶数');

  const solo = [];
  const collabs = {};   // key → [{name, quark}]

  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);

    // 合唱：最后一个「-」之后是歌手串（含 &）
    const m = name.match(/^(.+?)-([^-]*&[^-]*)$/);
    if (m) {
      const songName = m[1].trim();
      let singerPart = m[2].trim();
      // 去掉与主歌手重复的成分，保持 & 串简洁
      const parts = singerPart.split('&').map(s => s.trim()).filter(Boolean);
      const key = parts.join('&');
      if (!collabs[key]) collabs[key] = [];
      collabs[key].push({ name: songName, quark: url });
      continue;
    }
    solo.push({ name: name, quark: url });
  }
  return { solo: solo, collabs: collabs };
}

// ================= 1. data.js =================
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

const allCollabs = {};

for (const cfg of LIST) {
  const r = parseRaw(cfg.file, cfg.prefix);
  Object.assign(allCollabs, r.collabs);

  const songs = r.solo;
  const hasKey = new RegExp("^  '" + esc(cfg.key) + "':", 'm').test(dj);
  if (hasKey) {
    const re = new RegExp("(^  '" + esc(cfg.key) + "': \\[)([\\s\\S]*?)(\\],\\r?\\n)", 'm');
    const m = re.exec(dj);
    if (!m) { console.error('✗ 定位 songDB 条目失败: ' + cfg.key); process.exit(1); }
    const add = songs.map(s => "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }").join(', ');
    const existing = m[2].trim();
    dj = dj.replace(re, '$1' + (existing ? existing + ', ' + add : add) + '$3');
    console.log('  ✓ ' + cfg.key + ' → songDB 追加独唱 ' + songs.length + ' 首');
  } else {
    const block = "  '" + esc(cfg.key) + "': [" + songs.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('  ✓ ' + cfg.key + ' → songDB 新建 ' + songs.length + ' 首');
  }

  if (!new RegExp("var singerPopularity=\\{'" + esc(cfg.key) + "'").test(dj)) {
    dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(cfg.key) + "':" + cfg.pop + ",");
    console.log('    ✓ 热度 ' + cfg.pop);
  }
}

// 合唱条目：独立键
for (const [key, songs] of Object.entries(allCollabs)) {
  if (new RegExp("^  '" + esc(key) + "':", 'm').test(dj)) {
    console.log('    · 合唱 ' + key + ' 已存在，跳过');
    continue;
  }
  const block = "  '" + esc(key) + "': [" + songs.map(s =>
    "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
  ).join(', ') + "],\r\n";
  dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
  console.log('    ✓ 合唱键 ' + key + ' → ' + songs.length + ' 首');
}
fs.writeFileSync(DP, dj, 'utf8');

// ================= 2. index.html =================
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const cfg of LIST) {
  const e = esc(cfg.key);
  const collLoc = litLoc(html, 'singerCollection');
  const collBlock = html.slice(collLoc.start, collLoc.end);
  const isNew = !new RegExp("'" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(collBlock);

  if (isNew) {
    html = insertEntry(html, 'singerCollection', "  '" + e + "': '" + cfg.quark + "',");
    html = insertEntry(html, 'singerBaidu',    "  '" + e + "': '" + cfg.baidu + "',");
    html = insertEntry(html, 'singerImgs',     "  '" + e + "': '" + cfg.img + "',");
    html = insertEntry(html, 'singerMeta',     "  '" + e + "': '" + cfg.gender + "',");
    console.log('  ✓ ' + cfg.key + ' → index.html 五表已加');
  } else {
    console.log('  · ' + cfg.key + ' 五表已存在，跳过');
  }

  // singerSongCounts
  const cx0 = {}; vm.createContext(cx0);
  vm.runInContext(fs.readFileSync(DP, 'utf8'), cx0);
  const total = (cx0.songDB[cfg.key] || []).length;
  const re = new RegExp("('" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*)(\\d+)");
  if (re.test(html)) html = html.replace(re, '$1' + total);
  else html = insertEntry(html, 'singerSongCounts', "  '" + e + "': " + total + ",");
  console.log('    ✓ singerSongCounts = ' + total);

  // 别名
  for (const [alias, target] of (cfg.aliases || [])) {
    const ae = esc(alias);
    const aliasLoc = litLoc(html, 'singerAlias');
    const aliasBlock = html.slice(aliasLoc.start, aliasLoc.end);
    if (new RegExp("'" + ae.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(aliasBlock)) continue;
    html = insertEntry(html, 'singerAlias', "  '" + ae + "': '" + esc(target) + "',");
    console.log('    ✓ 别名 ' + alias + ' → ' + target);
  }
}
fs.writeFileSync(HP, html, 'utf8');

// ================= 3. 校验 =================
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
for (const cfg of LIST) {
  const songs = cx.songDB[cfg.key] || [];
  const issues = [];
  if (!songs.length) issues.push('无单曲');
  if (!cx2.singerCollection[cfg.key]) issues.push('缺合集链接');
  if (!cx2.singerBaidu[cfg.key]) issues.push('缺百度链接');
  if (!cx2.singerImgs[cfg.key]) issues.push('缺头像');
  if (!cx2.singerMeta[cfg.key]) issues.push('缺性别');
  if (!cx.singerPopularity[cfg.key]) issues.push('缺热度');
  if (cx2.singerSongCounts[cfg.key] !== songs.length) issues.push('counts 不符');
  const links = songs.map(s => s.quark);
  if (new Set(links).size !== links.length) issues.push('链接重复');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + cfg.key.padEnd(10) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[cfg.key] +
    ' | ' + cx2.singerMeta[cfg.key] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

console.log('\n=== 新建合唱键 ===');
for (const [key, songs] of Object.entries(allCollabs)) {
  const ok = cx.songDB[key] && cx.songDB[key].length === songs.length;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + key.padEnd(42) + (cx.songDB[key] || []).length + ' 首');
}

// 本批链接唯一性（只检查本批涉及的歌手 + 新建合唱键，
// 全库存在历史遗留重复 —— 韩团同一首歌同时收录在独唱键与合唱键下，与本批无关）
const BATCH_KEYS = LIST.map(c => c.key).concat(Object.keys(allCollabs));
const batchLinks = new Set();
let dupLinks = 0;
for (const k of BATCH_KEYS) {
  for (const s of (cx.songDB[k] || [])) {
    if (!s.quark) continue;
    if (batchLinks.has(s.quark)) { dupLinks++; console.log('  ⚠ 本批链接重复: ' + s.quark + ' (' + k + ')'); }
    else batchLinks.add(s.quark);
  }
}
// 与库中其他歌手的交叉检查
const otherMap = new Map();
for (const k of Object.keys(cx.songDB)) {
  if (BATCH_KEYS.includes(k)) continue;
  for (const s of cx.songDB[k]) if (s.quark) otherMap.set(s.quark, k);
}
let crossDup = 0;
for (const k of BATCH_KEYS) {
  for (const s of (cx.songDB[k] || [])) {
    if (s.quark && otherMap.has(s.quark)) { crossDup++; if (crossDup <= 5) console.log('  ⚠ 与既有歌手重复: ' + s.quark + ' (' + otherMap.get(s.quark) + ' vs ' + k + ')'); }
  }
}
console.log('\n本批内部链接重复: ' + dupLinks + (dupLinks ? ' ← 需处理' : ' ✓'));
console.log('本批与既有歌手链接重复: ' + crossDup + (crossDup ? ' ← 需处理' : ' ✓'));
if (dupLinks || crossDup) bad++;

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('songDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
