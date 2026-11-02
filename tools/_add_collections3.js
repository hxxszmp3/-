/**
 * 新增「合集」歌手 2 位：LBI利比 / 时代少年团
 *   合集板块：夸克合集 + 百度网盘备用 + 网易云官方人像 + 性别 + 热度
 *   单曲板块：分别 30 首 / 47 首，共 77 首
 *
 * 口径：
 *   - 两位都是新歌手 → 新建 songDB 条目 + 五表 + 热度 + 别名 + 静态页
 *   - LBI利比 本名「时柏尘」，加别名
 *   - 时代少年团 别名 Teens in Times / TNT，加别名
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 歌手键 / 夸克合集 / 百度备用 / 性别 / 热度 / 头像 / 别名 / raw 文件
const LIST = [
  {
    key: 'LBI利比',
    quark: 'https://pan.quark.cn/s/60cacd9b1c4d',
    baidu: 'https://pan.baidu.com/s/1-wWWam260Dvux-ah4tO7Gg?pwd=cwee',
    gender: 'm', pop: 72,
    img: 'https://p1.music.126.net/Ykd5K_gklG5P090hiKMing==/109951167304936804.jpg?param=300y300',
    aliases: [['时柏尘', 'LBI利比'], ['LBI', 'LBI利比']],
    file: '_raw_lbi.txt', prefix: 'LBI利比',
  },
  {
    key: '时代少年团',
    quark: 'https://pan.quark.cn/s/02bcc25e38f5',
    baidu: 'https://pan.baidu.com/s/1kgoYAf8_MB7HmM0EFs-j3A?pwd=cwee',
    gender: 'm', pop: 78,
    img: 'https://p1.music.126.net/zfX5bzdzPBSflfDMA2o0TA==/109951173207132556.jpg?param=300y300',
    aliases: [['Teens in Times', '时代少年团'], ['TNT', '时代少年团']],
    file: '_raw_tnt.txt', prefix: '时代少年团',
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

/** 读取 raw 文件 → [{name, quark}] */
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

// ================= 1. data.js：songDB + 热度 =================
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

for (const cfg of LIST) {
  const songs = parseRaw(cfg.file, cfg.prefix);

  // songDB
  const hasKey = new RegExp("^  '" + esc(cfg.key) + "':", 'm').test(dj);
  if (hasKey) {
    const re = new RegExp("(^  '" + esc(cfg.key) + "': \\[)([\\s\\S]*?)(\\],\\r?\\n)", 'm');
    const m = re.exec(dj);
    if (!m) { console.error('✗ 定位 songDB 条目失败: ' + cfg.key); process.exit(1); }
    const add = songs.map(s => "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }").join(', ');
    const existing = m[2].trim();
    dj = dj.replace(re, '$1' + (existing ? existing + ', ' + add : add) + '$3');
    console.log('  ✓ ' + cfg.key + ' → songDB 追加 ' + songs.length + ' 首');
  } else {
    const block = "  '" + esc(cfg.key) + "': [" + songs.map(s =>
      "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }"
    ).join(', ') + "],\r\n";
    dj = dj.replace(/var\s+songDB\s*=\s*\{/, m => m + '\r\n' + block);
    console.log('  ✓ ' + cfg.key + ' → songDB 新建 ' + songs.length + ' 首');
  }

  // 热度
  if (!new RegExp("var singerPopularity=\\{'" + esc(cfg.key) + "'").test(dj)) {
    dj = dj.replace(/var\s+singerPopularity\s*=\s*\{/, "var singerPopularity={'" + esc(cfg.key) + "':" + cfg.pop + ",");
    console.log('    ✓ 热度 ' + cfg.pop);
  }
}
fs.writeFileSync(DP, dj, 'utf8');

// ================= 2. index.html：五表 + 别名 =================
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
  // 链接唯一性
  const links = songs.map(s => s.quark);
  if (new Set(links).size !== links.length) issues.push('链接重复');
  if (issues.length) bad++;
  console.log('  ' + (issues.length ? '✗' : '✓') + ' ' + cfg.key.padEnd(10) +
    String(songs.length).padStart(3) + ' 首 | 热度 ' + cx.singerPopularity[cfg.key] +
    ' | ' + cx2.singerMeta[cfg.key] + (issues.length ? ' | ' + issues.join(', ') : ''));
}

const grand = Object.keys(cx.songDB).reduce((s, k) => s + cx.songDB[k].length, 0);
console.log('\nsongDB 键数: ' + Object.keys(cx.songDB).length + ' | 总曲数: ' + grand);

let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(sm => {
  try { new vm.Script(sm[1]); } catch (e) { err++; console.log('  ✗ 内联脚本语法错误: ' + e.message); }
});
console.log('内联脚本语法错误: ' + err);
if (bad || err) process.exit(1);
