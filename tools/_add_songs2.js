/**
 * 批量入库三批单曲：
 *   Tank      70 首（其中 3 首为合唱，另立 & 键）
 *   MC張天賦  54 首（新歌手/新艺名键）
 *   李幸倪     51 首（Gin Lee 李幸倪，歌名归到既有的「李幸倪」键）
 *
 * 口径：
 *   - 已存在的歌手（Tank / 李幸倪）→ 追加到其 songDB 条目，singerSongCounts 同步更新
 *   - 新歌手 MC張天賦 → 新建 songDB 条目 + 五表 + 热度 + 别名
 *   - 合唱条目 → 拆成「歌手A&歌手B」独立键，只参与单曲搜索、不生成静态页
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手键 / 原始文件 / 文件名前缀 / 性别 / 热度 / 头像 / 别名
const LIST = [
  {
    key: 'Tank', file: '_raw_tank2.txt', prefix: 'Tank',
    gender: 'f', pop: 62,
    img: 'https://p1.music.126.net/cesMisgjzJKBgvYsJcZW3A==/109951173563267232.jpg?param=300y300',
    aliases: [['吕建忠', 'Tank']],
  },
  {
    key: 'MC張天賦', file: '_raw_mctt.txt', prefix: 'MC張天賦',
    gender: 'm', pop: 64,
    // MC張天賦 是張天賦 的 MC 艺名（同一作品集），沿用其合集链接，避免目录里出现空 href 死链
    quark: 'https://pan.quark.cn/s/4213efd1c438',
    img: 'https://p2.music.126.net/WR620xkQIuxm0Fb9rpzyog==/109951168550982719.jpg?param=300y300',
    aliases: [['MC张天赋', 'MC張天賦'], ['MC Cheung', 'MC張天賦']],
  },
  {
    key: '李幸倪', file: '_raw_ginlee.txt', prefix: 'Gin Lee 李幸倪',
    gender: 'f', pop: 70,
    img: 'https://p2.music.126.net/zuk8-xVxlfXI1sMeyj4eCA==/109951168229977747.jpg?param=300y300',
    aliases: [['Gin Lee', '李幸倪']],
  },
];

// 合唱映射：剥离歌手前缀后的歌名片段 → 新键名（只参与单曲搜索）
const COLLABS = {
  'Tank': [
    ['无罪之罪 - 阎奕格、Tank', 'Tank&阎奕格'],
    ['我就是这样 - 刘力扬、Tank', '刘力扬&Tank'],
    ['懂我再爱我 - Ella陈嘉桦、Tank', 'Ella陈嘉桦&Tank'],
  ],
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

/** 读取 raw，拆成独唱与合唱 */
function parseRaw(file, prefix, collabMap) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8')
    .split(/\r?\n/).filter(l => l.trim());
  const solo = [], collabs = {};
  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);

    // 命中合唱映射（比对的是剥离歌手前缀后的歌名）
    // 注意：collabMap 是 [[片段, 键名], ...] 数组，要用 for...of 遍历，
    // 不能用 Object.entries（那样拿到的是下标→元组，解构后 frag 会变成 "0"）
    let hit = null;
    for (const [frag, key] of (collabMap || [])) {
      if (name === frag) { hit = key; break; }
    }
    if (hit) {
      if (!collabs[hit]) collabs[hit] = [];
      collabs[hit].push({ name: name, quark: url });
      continue;
    }
    solo.push({ name: name, quark: url });
  }
  return { solo: solo, collabs: collabs };
}

// ---------- 1. data.js ----------
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

for (const cfg of LIST) {
  const r = parseRaw(cfg.file, cfg.prefix, COLLABS[cfg.key]);

  // 独唱：已有则追加，无则新建
  const hasKey = new RegExp("^  '" + esc(cfg.key) + "':", 'm').test(dj);
  if (hasKey) {
    // 定位现有条目，追加单曲
    const re = new RegExp("(^  '" + esc(cfg.key) + "': \\[)([\\s\\S]*?)(\\],\\r?\\n)", 'm');
    const m = re.exec(dj);
    if (!m) { console.error('✗ 定位 songDB 条目失败: ' + cfg.key); process.exit(1); }
    const add = r.solo.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ');
    const existing = m[2].trim();
    const merged = existing ? existing + ', ' + add : add;
    dj = dj.replace(re, '$1' + merged + '$3');
    console.log('  ✓ ' + cfg.key + ' → 追加独唱 ' + r.solo.length + ' 首');
  } else {
    const block = "  '" + esc(cfg.key) + "': [" + r.solo.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('  ✓ ' + cfg.key + ' → 新建 songDB 条目，独唱 ' + r.solo.length + ' 首');
  }

  // 合唱条目
  for (const [ck, songs] of Object.entries(r.collabs)) {
    if (new RegExp("^  '" + esc(ck) + "':", 'm').test(dj)) {
      console.log('    · 合唱 ' + ck + ' 已存在，跳过');
      continue;
    }
    const block = "  '" + esc(ck) + "': [" + songs.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('    ✓ 合唱 ' + ck + ' → ' + songs.length + ' 首');
  }

  // 热度
  if (!new RegExp("var singerPopularity=\\{'" + esc(cfg.key) + "'").test(dj)) {
    dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(cfg.key) + "':" + cfg.pop + ",");
    console.log('    ✓ 热度 ' + cfg.pop);
  }
}
fs.writeFileSync(DP, dj, 'utf8');

// ---------- 2. index.html ----------
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

for (const cfg of LIST) {
  const e = esc(cfg.key);
  const collLoc = litLoc(html, 'singerCollection');
  const collBlock = html.slice(collLoc.start, collLoc.end);
  const isNew = !new RegExp("'" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:").test(collBlock);

  if (isNew) {
    // 空合集链接会在目录里产生 href="" 死链，直接拦下
    if (!cfg.quark) {
      console.error('✗ ' + cfg.key + ' 缺少合集链接（cfg.quark），目录里会出现空 href 死链');
      process.exit(1);
    }
    html = insertEntry(html, 'singerCollection', "  '" + e + "': '" + cfg.quark + "',");
    html = insertEntry(html, 'singerImgs',     "  '" + e + "': '" + cfg.img + "',");
    html = insertEntry(html, 'singerMeta',     "  '" + e + "': '" + cfg.gender + "',");
    console.log('  ✓ ' + cfg.key + ' → 新增五表条目');
  } else {
    console.log('  · ' + cfg.key + ' 五表已存在，跳过');
  }

  // singerSongCounts 同步为实际首数
  const cx0 = {}; vm.createContext(cx0);
  vm.runInContext(fs.readFileSync(DP, 'utf8'), cx0);
  const total = (cx0.songDB[cfg.key] || []).length;
  const re = new RegExp("('" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*)(\\d+)");
  if (re.test(html)) {
    html = html.replace(re, '$1' + total);
  } else {
    html = insertEntry(html, 'singerSongCounts', "  '" + e + "': " + total + ",");
  }
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

// ---------- 3. 校验 ----------
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
  if (cx2.singerSongCounts[cfg.key] !== songs.length) issues.push('counts 不符(' + cx2.singerSongCounts[cfg.key] + ' vs ' + songs.length + ')');
  if (!cx2.singerImgs[cfg.key]) issues.push('缺头像');
  if (!cx2.singerMeta[cfg.key]) issues.push('缺性别');
  if (!cx.singerPopularity[cfg.key]) issues.push('缺热度');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + cfg.key.padEnd(10) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[cfg.key] +
    ' | ' + cx2.singerMeta[cfg.key] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

console.log('\n本批新建的合唱键:');
const newCollab = Object.values(COLLABS).flat().map(x => x[1]);
for (const ck of newCollab) {
  console.log('  ' + (cx.songDB[ck] ? '✓' : '✗') + ' ' + ck.padEnd(20) + (cx.songDB[ck] || []).length + ' 首');
  if (!cx.songDB[ck]) bad++;
}

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('\nsongDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
