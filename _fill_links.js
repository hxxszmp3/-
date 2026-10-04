// 将 夸克歌曲/*.txt 的夸克链接填回 songDB(单曲) v2
// 修复: ①前缀清洗改为"候选前缀字面匹配"(修复(G)I-DLE内含短横线被误切)
//       ②ED1错别字映射加"歌曲重叠验证"(防 丁薇→丁当 误并)
//       ③输出全部非精确映射供审计; ④统计每文档解析损耗
const fs = require('fs'), path = require('path');
const DIR = 'C:/Users/dellsq/Desktop/夸克歌曲';
eval(fs.readFileSync('data.js', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');

const nk = s => (s || '').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
const hasCJK = s => /[一-鿿]/.test(s);
const lev1 = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d === 1; };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parenStrip = s => s.replace(/\s*[（(][^()（）]*[)）]\s*/g, ' ').trim();

const cs = html.indexOf('var singerCollection = {');
let singerCollection; eval('singerCollection=' + html.slice(cs, html.indexOf('};', cs) + 2).replace('var singerCollection = ', '').replace(/;$/, ''));
const as = html.indexOf('var singerAlias={');
let singerAlias = {};
if (as > -1) eval('singerAlias=' + html.slice(as, html.indexOf('};', as) + 2).replace('var singerAlias=', '').replace(/;$/, ''));
const canonSet = new Set(Object.keys(singerCollection));
const dbKeys = Object.keys(songDB).filter(k => k !== '歌单');
const nk2key = {}; for (const k of dbKeys) nk2key[nk(k)] = k;

// 歌名清洗: 候选前缀(长到短)字面匹配 "前缀 - 标题", 循环至多3次; 然后ED1错别字兜底
function cleanTitle(rawTitle, docName, canon) {
  let t = rawTitle.replace(/\.(mp3|flac|wav|m4a|ogg|aac|wma|ape)$/i, '').trim();
  const cands = new Set([docName, parenStrip(docName)]);
  if (canon) { cands.add(canon); cands.add(parenStrip(canon)); }
  for (const a of Object.keys(singerAlias)) if (canon && nk(singerAlias[a]) === nk(canon)) cands.add(a);
  const sorted = [...cands].filter(x => x && x.length >= 2).sort((a, b) => b.length - a.length);
  for (let i = 0; i < 3; i++) {
    let hit = false;
    for (const c of sorted) {
      const m = t.match(new RegExp('^' + escRe(c) + '\\s*[-_－—]\\s*(.+)$'));
      if (m && m[1]) { t = m[1].trim(); hit = true; break; }
    }
    if (!hit) break;
  }
  // 兜底: 首段与 doc/canon 归一化相同或等长ED1 (如 海明威)
  for (let i = 0; i < 2; i++) {
    const m = t.match(/^(.{1,30}?)\s*[-_－—]\s*(.+)$/);
    if (!m) break;
    const xn = nk(m[1]), refs = new Set([nk(docName), canon ? nk(canon) : '']);
    let ok = refs.has(xn);
    if (!ok) for (const r of refs) if (r && xn.length === r.length && xn.length >= 2 && lev1(xn, r)) { ok = true; break; }
    if (ok) t = m[2].trim(); else break;
  }
  return t;
}

// ===== 1. 解析全部文档 =====
const dirs = fs.readdirSync(DIR).filter(d => { try { return fs.statSync(path.join(DIR, d)).isDirectory(); } catch (e) { return false; } });
const docs = [];
for (const d of dirs) {
  for (const f of fs.readdirSync(path.join(DIR, d))) {
    if (!f.toLowerCase().endsWith('.txt')) continue;
    const docName = f.replace(/\.txt$/i, '');
    const txt = fs.readFileSync(path.join(DIR, d, f), 'utf8');
    const rawLinks = (txt.match(/pan\.quark\.cn\/s\//g) || []).length;
    const entries = [];
    let cur = null;
    for (const ln of txt.split(/\r?\n/)) {
      const m = ln.match(/^\s*\d+\s*[.、．]\s*(.+)$/);
      if (m) { cur = m[1].trim(); continue; }
      const u = ln.match(/(https?:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9]+)/);
      if (u && cur) { entries.push({ raw: cur, link: u[1] }); cur = null; }
    }
    docs.push({ docName, entries, rawLinks, lost: rawLinks - entries.length });
  }
}
console.log('解析文档:', docs.length, '| 解析链接:', docs.reduce((a, d) => a + d.entries.length, 0), '| 原始链接:', docs.reduce((a, d) => a + d.rawLinks, 0));
const lossDocs = docs.filter(d => d.lost > 0);
if (lossDocs.length) console.log('解析损耗文档:', lossDocs.length, lossDocs.slice(0, 8).map(d => d.docName + '(丢' + d.lost + ')').join(' '));

// ===== 2. canonical 解析 =====
function overlapWith(key, titles) {
  const set = new Set((songDB[key] || []).map(s => nk(s.name)));
  let ov = 0; for (const t of titles) if (set.has(nk(t))) ov++;
  return ov;
}
const mappings = []; // 非精确映射审计
function resolveSinger(doc) {
  const docName = doc.docName, n = nk(docName);
  if (nk2key[n]) return nk2key[n];
  if (singerAlias[docName] && songDB[singerAlias[docName]]) { mappings.push(docName + ' → ' + singerAlias[docName] + ' (别名)'); return singerAlias[docName]; }
  // 包含
  const cands = [];
  for (const k of dbKeys) {
    const kn = nk(k);
    if (kn.length < 2 || kn === n) continue;
    const short = n.length <= kn.length ? n : kn, long = n.length <= kn.length ? kn : n;
    if (!long.includes(short)) continue;
    if (!(hasCJK(short) || short.length >= 5)) continue;
    cands.push([canonSet.has(k) ? 1 : 0, kn.length, k]);
  }
  if (cands.length) {
    cands.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    mappings.push(docName + ' → ' + cands[0][2] + ' (包含' + (cands[0][0] ? '/合集' : '') + ')');
    return cands[0][2];
  }
  // ED1: 需歌曲重叠验证
  const cleaned = doc.entries.map(e => cleanTitle(e.raw, docName, null));
  for (const k of dbKeys) {
    const kn = nk(k);
    if (kn.length === n.length && kn.length >= 3 && lev1(n, kn) && canonSet.has(k)) {
      const ov = overlapWith(k, cleaned);
      if (ov >= Math.max(2, Math.ceil(doc.entries.length * 0.3))) { mappings.push(docName + ' → ' + k + ' (ED1,重叠' + ov + ')'); return k; }
    }
  }
  return docName;
}
for (const d of docs) { d.canon = resolveSinger(d); d.titles = d.entries.map(e => cleanTitle(e.raw, d.docName, d.canon)); }
console.log('\n=== 非精确映射审计(' + mappings.length + ') ===');
mappings.forEach(m => console.log('  ' + m));
const news = docs.filter(d => !songDB[d.canon]).map(d => d.canon);
console.log('新歌手(库中无,将新建):', news.length, news.join('、'));

// ===== 3. 归组填充(同canonical多文档合并, 文档内/跨文档同歌先去重) =====
const groups = new Map();
for (const d of docs) {
  if (!groups.has(d.canon)) groups.set(d.canon, new Map());
  const g = groups.get(d.canon);
  for (let i = 0; i < d.entries.length; i++) {
    const t = d.titles[i];
    if (!t) continue;
    const n = nk(t);
    if (!g.has(n)) g.set(n, { title: t, link: d.entries[i].link });
  }
}
let filled = 0, filledCovered = 0, added = 0;
const badTitles = [];
for (const [canon, g] of groups) {
  if (!songDB[canon]) songDB[canon] = [];
  const exist = new Map();
  for (const s of songDB[canon]) { const n = nk(s.name); if (!exist.has(n)) exist.set(n, s); }
  for (const [, sg] of g) {
    if (sg.title.indexOf(' - ') > -1 && badTitles.length < 15) badTitles.push(canon + '《' + sg.title + '》');
    const ex = exist.get(nk(sg.title));
    if (ex) { if (!ex.quark) { ex.quark = sg.link; filled++; if (ex.cover) filledCovered++; } }
    else { const ns = { name: sg.title, cover: '', quark: sg.link }; songDB[canon].push(ns); exist.set(nk(sg.title), ns); added++; }
  }
}
console.log('\n填充已有歌曲:', filled, '(有封面:', filledCovered, ') | 新增歌曲:', added);
console.log('仍含" - "的标题(人工抽查):', badTitles.length, badTitles.join('、'));

// ===== 4. 写回 + counts =====
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<\/(script)/gi, '<\\/$1'); }
function serSong(sg) {
  let p = "name: '" + esc(sg.name) + "', cover: '" + esc(sg.cover || '') + "'";
  if (sg.quark) p += ", quark: '" + esc(sg.quark) + "'";
  if (sg.baidu) p += ", baidu: '" + esc(sg.baidu) + "'";
  return '{ ' + p + ' }';
}
const l = ['var songDB = {'];
for (const k of Object.keys(songDB)) l.push("  '" + esc(k) + "': [" + songDB[k].map(serSong).join(', ') + "],");
l.push('};;;;;;');
const data = fs.readFileSync('data.js', 'utf8');
const s0 = data.indexOf('var songDB = {'), e0 = data.indexOf('};;;;;;', s0) + 7;
if (s0 < 0 || e0 < 7) { console.log('未找到 songDB 块, 中止'); process.exit(1); }
fs.writeFileSync('data.js', data.slice(0, s0) + l.join('\r\n') + data.slice(e0));
const cl = ['var singerSongCounts={'];
for (const k of Object.keys(songDB)) cl.push("'" + esc(k) + "':" + songDB[k].length + ",");
cl.push('};');
let h2 = fs.readFileSync('index.html', 'utf8');
const cs2 = h2.indexOf('var singerSongCounts={'), ce2 = h2.indexOf('};', cs2) + 2;
fs.writeFileSync('index.html', h2.slice(0, cs2) + cl.join('') + h2.slice(ce2));
console.log('已写回 data.js + singerSongCounts');

// ===== 5. 终验 =====
delete global.songDB; delete global.singerPopularity;
eval(fs.readFileSync('data.js', 'utf8'));
let q = 0, c = 0, t = 0, plQ = 0;
for (const k of Object.keys(songDB)) for (const s of songDB[k]) { if (k === '歌单') { if (s.quark) plQ++; continue; } t++; if (s.quark) q++; if (s.cover) c++; }
console.log('\n终验: 单曲', t, '| 已填quark', q, '| 封面', c, '(应15967) | 歌单quark', plQ + '/69');
console.log('终验: 含邓紫棋的键:', Object.keys(songDB).filter(k => k.indexOf('邓紫棋') > -1).join(','));
console.log('终验: 丁当歌曲数:', (songDB['丁当'] || []).length, '| 丁薇歌曲数:', (songDB['丁薇'] || []).length, '(丁薇应独立成键)');
const gid = songDB['(G)I-DLE'] || [];
console.log('终验: (G)I-DLE', gid.length, '首, 抽查:', gid.slice(0, 3).map(s => s.name).join(' / '));
console.log('终验: 海鸣威quark:', (songDB['海鸣威'] || []).filter(s => s.quark).length + '/' + (songDB['海鸣威'] || []).length, '| 示例:', (songDB['海鸣威'] || []).slice(0, 3).map(s => s.name).join(' / '));
