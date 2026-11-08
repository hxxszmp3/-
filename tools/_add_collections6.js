/**
 * 新增「合集」歌手 2 位：罗志祥 / TOP登陆少年
 *   合集板块：夸克合集 + 百度网盘备用 + 网易云官方人像 + 性别 + 热度
 *   单曲板块：共 114 首（罗志祥 100 / TOP登陆少年 14）
 *
 * 备注：
 *   - TOP登陆少年在网易云上的官方名是「TOP登陆少年组合」，单曲文件名也用这个前缀，
 *     但合集分享名是「TOP登陆少年」→ 主键用「TOP登陆少年」，另加别名「TOP登陆少年组合」
 *   - 该组合网易云的 artist 头像是纯文字 logo，改用官方专辑
 *     《SPARK TO FIRE 星火成焰》封面（5 人合照）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const LIST = [
  {
    key: '罗志祥',
    quark: 'https://pan.quark.cn/s/6c4f1ab44ab6',
    baidu: 'https://pan.baidu.com/s/1zw_iXBXkHUxwgTdR9_YJ7w?pwd=q43r',
    gender: 'm', pop: 64,
    img: 'https://p2.music.126.net/h0IAQ5qHH7QKoCOwoflJgw==/109951169138149829.jpg?param=300y300',
    aliases: [['小猪', '罗志祥'], ['Show Lo', '罗志祥'], ['Show Luo', '罗志祥']],
    file: '_raw_lzx2.txt', prefix: '罗志祥',
  },
  {
    key: 'TOP登陆少年',
    quark: 'https://pan.quark.cn/s/8b9d8182762f',
    baidu: 'https://pan.baidu.com/s/10W9vhvp6f6R9qmskkNe0Dw?pwd=q43r',
    gender: 'm', pop: 60,
    // 网易云 artist 头像是纯文字 logo，改用官方专辑《SPARK TO FIRE》封面（5 人合照）
    img: 'https://p1.music.126.net/Ps0DoONZ-jBmM4S9dsX_QQ==/109951173790766468.jpg?param=300y300',
    aliases: [['TOP登陆少年组合', 'TOP登陆少年'], ['登陆少年', 'TOP登陆少年'], ['Transform Project', 'TOP登陆少年']],
    file: '_raw_top.txt', prefix: 'TOP登陆少年组合',
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

/** 解析 raw 文件 → [{name, quark}]，去掉歌手前缀 */
function parseRaw(file, prefix) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8')
    .split(/\r?\n/).filter(l => l.trim());
  if (lines.length % 2 !== 0) throw new Error(file + ' 行数非偶数');
  const out = [];
  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);
    out.push({ name: name, quark: url });
  }
  return out;
}

// ================= 1. data.js =================
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

for (const cfg of LIST) {
  const songs = parseRaw(cfg.file, cfg.prefix);
  const hasKey = new RegExp("^  '" + esc(cfg.key) + "':", 'm').test(dj);
  if (hasKey) {
    const re = new RegExp("(^  '" + esc(cfg.key) + "': \\[)([\\s\\S]*?)(\\],\\r?\\n)", 'm');
    const m = re.exec(dj);
    if (!m) { console.error('✗ 定位 songDB 条目失败: ' + cfg.key); process.exit(1); }
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

  // 热度（幂等：检查该键是否已存在于 singerPopularity 对象里）
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
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + cfg.key.padEnd(10) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[cfg.key] +
    ' | ' + cx2.singerMeta[cfg.key] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

// 本批链接唯一性
const BATCH_KEYS = LIST.map(c => c.key);
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

// 别名/热度表无重复键
for (const [vName, obj] of [['singerAlias', cx2.singerAlias], ['singerPopularity', cx.singerPopularity]]) {
  const keys = Object.keys(obj);
  const dups = keys.filter(k => keys.filter(x => x === k).length > 1);
  console.log(vName + ' 键数: ' + keys.length + ' | 重复: ' + (dups.length ? dups.join(', ') : '无'));
  if (dups.length) bad++;
}

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('songDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
