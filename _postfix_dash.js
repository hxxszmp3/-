// 后缀清理: 剥除"艺人前缀 - 标题"中残留的合作艺人前缀, 并按键内归一化去重合并
// 规则: 首段(" - "之前)的nk包含任一别名部件nk(歌手键部件/文档名部件/singerAlias键) → 剥除, 至多3轮
// 然后: 键内按nk(name)去重, 保留优先(有封面>有quark>原序), 缺失属性从被合并项补齐
const fs = require('fs'), path = require('path');
const DIR = 'C:/Users/dellsq/Desktop/夸克歌曲';
eval(fs.readFileSync('data.js', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const nk = s => (s || '').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
const hasCJK = s => /[一-鿿]/.test(s);
const lev1 = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d === 1; };
const parenStrip = s => s.replace(/\s*[（(][^()（）]*[)）]\s*/g, ' ').trim();

const cs = html.indexOf('var singerCollection = {');
let singerCollection; eval('singerCollection=' + html.slice(cs, html.indexOf('};', cs) + 2).replace('var singerCollection = ', '').replace(/;$/, ''));
const as = html.indexOf('var singerAlias={');
let singerAlias = {};
if (as > -1) eval('singerAlias=' + html.slice(as, html.indexOf('};', as) + 2).replace('var singerAlias=', '').replace(/;$/, ''));
const canonSet = new Set(Object.keys(singerCollection));
const dbKeys = Object.keys(songDB).filter(k => k !== '歌单');
const nk2key = {}; for (const k of dbKeys) nk2key[nk(k)] = k;

// 名字部件: 整体 + parenStrip + 括号内容 + 按分隔符再拆
function nameParts(s) {
  const out = new Set();
  const push = x => { const n = nk(x); if (n && n.length >= 2) out.add(n); };
  push(s); push(parenStrip(s));
  const inner = s.match(/[（(]([^()（）]*)[)）]/g) || [];
  for (const seg of inner) push(seg.replace(/^[（(]|[)）]$/g, ''));
  for (const piece of s.split(/[&、×_]|feat\.?\s|\bwith\b/i)) { push(piece); push(parenStrip(piece)); }
  return out;
}

// 文档→canon(与 _fill_links.js 相同的解析逻辑)
function resolveSingerDoc(docName, entries) {
  const n = nk(docName);
  if (nk2key[n]) return nk2key[n];
  if (singerAlias[docName] && songDB[singerAlias[docName]]) return singerAlias[docName];
  const cands = [];
  for (const k of dbKeys) {
    const kn = nk(k);
    if (kn.length < 2 || kn === n) continue;
    const short = n.length <= kn.length ? n : kn, long = n.length <= kn.length ? kn : n;
    if (!long.includes(short)) continue;
    if (!(hasCJK(short) || short.length >= 5)) continue;
    cands.push([canonSet.has(k) ? 1 : 0, kn.length, k]);
  }
  if (cands.length) { cands.sort((a, b) => b[0] - a[0] || b[1] - a[1]); return cands[0][2]; }
  for (const k of dbKeys) {
    const kn = nk(k);
    if (kn.length === n.length && kn.length >= 3 && lev1(n, kn) && canonSet.has(k)) return k;
  }
  return docName;
}
const aliasParts = {}; // canon -> Set(nk部件)
const addParts = (canon, name) => { if (!aliasParts[canon]) aliasParts[canon] = new Set(); for (const p of nameParts(name)) aliasParts[canon].add(p); };
for (const k of dbKeys) addParts(k, k);
const dirs = fs.readdirSync(DIR).filter(d => { try { return fs.statSync(path.join(DIR, d)).isDirectory(); } catch (e) { return false; } });
for (const d of dirs) for (const f of fs.readdirSync(path.join(DIR, d))) {
  if (!f.toLowerCase().endsWith('.txt')) continue;
  const docName = f.replace(/\.txt$/i, '');
  const canon = resolveSingerDoc(docName, []);
  if (songDB[canon]) addParts(canon, docName);
}
for (const a of Object.keys(singerAlias)) { const t = singerAlias[a]; if (songDB[t]) addParts(t, a); }

// 剥前缀
function stripPrefix(name, canon) {
  let t = name;
  const parts = aliasParts[canon] || new Set();
  for (let i = 0; i < 3; i++) {
    const m = t.match(/^(.{1,60}?)\s+-\s+(.+)$/);
    if (!m) break;
    const fn = nk(m[1]);
    let hit = false;
    for (const p of parts) { if (fn.indexOf(p) > -1) { hit = true; break; } }
    if (hit) t = m[2].trim(); else break;
  }
  return t;
}

let renamed = 0, merged = 0, coverFixed = 0, quarkKept = 0;
const mergeSamples = [];
for (const k of dbKeys) {
  const arr = songDB[k];
  // 1) 原地改名
  for (const s of arr) {
    if (s.name.indexOf(' - ') === -1) continue;
    const t = stripPrefix(s.name, k);
    if (t && t !== s.name) { s.name = t; renamed++; }
  }
  // 2) 键内去重: 稳定排序 有封面>有quark>原序, 合并缺失属性
  const idx = arr.map((s, i) => i);
  idx.sort((a, b) => {
    const A = arr[a], B = arr[b];
    const ca = A.cover ? 0 : 1, cb = B.cover ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const qa = A.quark ? 0 : 1, qb = B.quark ? 0 : 1;
    if (qa !== qb) return qa - qb;
    return a - b;
  });
  const seen = new Map(); const keepIdx = new Set();
  for (const i of idx) {
    const n = nk(arr[i].name);
    if (!seen.has(n)) { seen.set(n, i); keepIdx.add(i); continue; }
    const tgt = arr[seen.get(n)], src = arr[i];
    if (!tgt.quark && src.quark) { tgt.quark = src.quark; quarkKept++; }
    if (!tgt.cover && src.cover) { tgt.cover = src.cover; coverFixed++; }
    if (!tgt.baidu && src.baidu) tgt.baidu = src.baidu;
    merged++;
    if (mergeSamples.length < 10) mergeSamples.push(k + '《' + src.name + '》(并入保留项)');
  }
  if (merged || true) songDB[k] = arr.filter((_, i) => keepIdx.has(i));
}
console.log('剥前缀改名:', renamed, '| 键内合并去重:', merged, '(补回quark:', quarkKept, ', 补回封面:', coverFixed, ')');
mergeSamples.forEach(x => console.log('  合并示例:', x));

// 写回
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
fs.writeFileSync('data.js', data.slice(0, s0) + l.join('\r\n') + data.slice(e0));
const cl = ['var singerSongCounts={'];
for (const k of Object.keys(songDB)) cl.push("'" + esc(k) + "':" + songDB[k].length + ",");
cl.push('};');
let h2 = fs.readFileSync('index.html', 'utf8');
const cs2 = h2.indexOf('var singerSongCounts={'), ce2 = h2.indexOf('};', cs2) + 2;
fs.writeFileSync('index.html', h2.slice(0, cs2) + cl.join('') + h2.slice(ce2));

// 终验
delete global.songDB; delete global.singerPopularity;
eval(fs.readFileSync('data.js', 'utf8'));
let q = 0, c = 0, t = 0, plQ = 0, dash = 0;
for (const k of Object.keys(songDB)) for (const s of songDB[k]) { if (k === '歌单') { if (s.quark) plQ++; continue; } t++; if (s.quark) q++; if (s.cover) c++; if (s.name.indexOf(' - ') > -1) dash++; }
console.log('\n终验: 单曲', t, '| quark', q, '| 封面', c, '| 歌单quark', plQ + '/69 | 仍含" - "标题', dash);
