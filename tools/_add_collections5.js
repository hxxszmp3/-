/**
 * 新增「合集」歌手 3 位：张震岳 / 苏芮 / 刘文正
 *   合集板块：夸克合集 + 百度网盘备用 + 网易云官方人像 + 性别 + 热度
 *   单曲板块：共 154 首（张震岳 100 / 苏芮 32 / 刘文正 10 + 苏芮合唱 12）
 *
 * 合唱识别支持三种命名格式（都出现在实际数据里）：
 *   A. 「歌名-歌手A&歌手B」        上批谢霆锋的格式 → 键 歌手A&歌手B
 *   B. 「歌手A-歌名」              本批苏芮的格式   → 键 歌手A&苏芮
 *   C. 「歌手A^歌手B-歌名」        本批苏芮的格式   → 键 歌手A&歌手B
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const LIST = [
  {
    key: '张震岳',
    quark: 'https://pan.quark.cn/s/e80e659f4e21',
    baidu: 'https://pan.baidu.com/s/1-9VIp5XLv_U-omDE1GNL0A?pwd=vfqg',
    gender: 'm', pop: 72,
    img: 'https://p2.music.126.net/lZkH6tfmc9de2skBTfNNng==/109951170927210866.jpg?param=300y300',
    aliases: [['阿岳', '张震岳'], ['Chang chen-yue', '张震岳']],
    file: '_raw_zyy.txt', prefix: '张震岳',
  },
  {
    key: '苏芮',
    quark: 'https://pan.quark.cn/s/06b803b6396f',
    baidu: 'https://pan.baidu.com/s/160XqBt1GyOSCw5K8lz4UEA?pwd=vfqg',
    gender: 'f', pop: 66,
    img: 'https://p1.music.126.net/WVxMQu-K-Y9oZyyJdLMnUA==/109951170540269938.jpg?param=300y300',
    aliases: [['Julie Su', '苏芮']],
    file: '_raw_sr.txt', prefix: '苏芮',
  },
  {
    key: '刘文正',
    quark: 'https://pan.quark.cn/s/c0854807bf62',
    baidu: 'https://pan.baidu.com/s/1D0tRoycs7oUVxvx09zwDPg?pwd=vfqg',
    gender: 'm', pop: 58,
    img: 'https://p2.music.126.net/UtBcXgEYiCcPT63F1lGQ4w==/910395627827793.jpg?param=300y300',
    aliases: [['Steven Liu', '刘文正']],
    file: '_raw_lwz.txt', prefix: '刘文正',
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
 * 解析歌名 → { key, name }，识别合唱。
 * 三种格式见文件头说明。返回 null 表示纯独唱。
 */
function splitCollab(rawName, selfName) {
  // C. 「歌手A^歌手B-歌名」—— 先匹配 ^ 版本（更具体）
  let m = rawName.match(/^(.+?)\^(.+?)-(.+)$/);
  if (m) {
    const a = m[1].trim(), b = m[2].trim(), song = m[3].trim();
    // 主歌手本身必须出现在合唱串里（去重后仍要保留一位 selfName）
    const parts = [];
    for (const x of [a, b]) {
      if (!x) continue;
      if (x === selfName) { if (parts.indexOf(selfName) === -1) parts.push(selfName); }
      else parts.push(x);
    }
    if (parts.indexOf(selfName) === -1) parts.push(selfName);
    return { key: parts.join('&'), name: song };
  }
  // A. 「歌名-歌手串」（歌手串含 &）
  m = rawName.match(/^(.+?)-([^-]*&[^-]*)$/);
  if (m) {
    return { key: m[2].trim().split('&').map(s => s.trim()).filter(Boolean).join('&'), name: m[1].trim() };
  }
  // B. 「歌手-歌名」（歌手在前，无 &）
  m = rawName.match(/^(.+?)-(.+)$/);
  if (m) {
    const singerPart = m[1].trim();
    const song = m[2].trim();
    // 歌手名不应含空格/标点（真实歌手名都是纯中文或英文单词）
    if (/^[\u4e00-\u9fa5A-Za-z·&.']+$/.test(singerPart)) {
      // 合唱键必须包含主歌手，否则会与该歌手的独唱键混淆
      const parts = singerPart.split('&').map(s => s.trim()).filter(Boolean);
      if (parts.indexOf(selfName) === -1) parts.push(selfName);
      return { key: parts.join('&'), name: song };
    }
  }
  return null;
}

function parseRaw(file, prefix) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8')
    .split(/\r?\n/).filter(l => l.trim());
  if (lines.length % 2 !== 0) throw new Error(file + ' 行数非偶数');

  const solo = [];
  const collabs = {};

  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);

    const c = splitCollab(name, prefix);
    if (c && c.key) {
      if (!collabs[c.key]) collabs[c.key] = [];
      collabs[c.key].push({ name: c.name, quark: url });
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
    // 幂等：库中已存在的链接不重复追加
    const existLinks = new Set((m[2].match(/quark: '([^']+)'/g) || [])
      .map(x => /'([^']+)'/.exec(x)[1]));
    const fresh = songs.filter(s => !existLinks.has(s.quark));
    if (fresh.length === 0) {
      console.log('  · ' + cfg.key + ' → 已入库 ' + songs.length + ' 首，跳过');
    } else {
      const add = fresh.map(s => "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }").join(', ');
      dj = dj.replace(re, '$1' + (m[2].trim() ? m[2].trim() + ', ' + add : add) + '$3');
      console.log('  ✓ ' + cfg.key + ' → songDB 追加独唱 ' + fresh.length + ' 首');
    }
  } else {
    const block = "  '" + esc(cfg.key) + "': [" + songs.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('  ✓ ' + cfg.key + ' → songDB 新建 ' + songs.length + ' 首');
  }

  // 幂等：检查该歌手是否已在 singerPopularity 对象里。
  // 不能只看前缀字符串——重跑时前缀已变（前面插了新的），会重复插入同一个键。
  const popRe = /var\s+singerPopularity\s*=\s*\{([^}]*)\}/;
  const popM = popRe.exec(dj);
  const inPopularity = !!popM && new RegExp("'" + esc(cfg.key) + "':").test(popM[1]);
  if (!inPopularity) {
    dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(cfg.key) + "':" + cfg.pop + ",");
    console.log('    ✓ 热度 ' + cfg.pop);
  } else {
    console.log('    · 热度已存在，跳过');
  }
}

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

  const cx0 = {}; vm.createContext(cx0);
  vm.runInContext(fs.readFileSync(DP, 'utf8'), cx0);
  const total = (cx0.songDB[cfg.key] || []).length;
  const re = new RegExp("('" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*)(\\d+)");
  if (re.test(html)) html = html.replace(re, '$1' + total);
  else html = insertEntry(html, 'singerSongCounts', "  '" + e + "': " + total + ",");
  console.log('    ✓ singerSongCounts = ' + total);

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
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + cfg.key.padEnd(8) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[cfg.key] +
    ' | ' + cx2.singerMeta[cfg.key] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

console.log('\n=== 新建合唱键 ===');
for (const [key, songs] of Object.entries(allCollabs)) {
  const ok = cx.songDB[key] && cx.songDB[key].length === songs.length;
  if (!ok) bad++;
  const detail = cx.songDB[key] ? cx.songDB[key].map(s => s.name).join(', ') : '';
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + key.padEnd(20) +
    (cx.songDB[key] || []).length + ' 首  ' + detail);
}

// 本批链接唯一性
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
