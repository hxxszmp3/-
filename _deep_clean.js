// songDB 深度去重 v3（修复 v2 方向bug + 分隔符扩展 + ED1 重叠计算改进）
// 规则0: 歌名嵌歌手名清理（提前，让后续重叠计算更准）
// 规则1: 多艺人键(& _ 、× feat with)的歌并入组成独唱歌手(canon优先、名字最长)，重复丢弃，键删除。绝不反向。
// 规则2: 包含变体合并，方向修复:
//        - 短键∈canon, 长键∉canon: 长键→短键 (G.E.M. 邓紫棋→邓紫棋) [v2此处漏并]
//        - 长键∈canon, 短键∉canon: 短键→长键
//        - 门槛: CJK/长键 ov>0 || len(from)<=2; 纯ASCII短键(<5)仅 ov>=50%*len(from) (A→A-LIN 144/145)
//        - 都不在canon: 不合并（保持v2行为，防误并）
// 规则3: 同长度ED1错别字(海明威→海鸣威): 恰好一方∈canon + ED1 + 双方含中文;
//        重叠计算剥离 变体键/规范键 前缀（嵌名前缀可能是正确写法）
// 规则4(终清): 合并完成后再次剥离 "歌手名 - " 前缀
// 规则5: (XX版)去重(语言版除外)。规则6: 精确同名去重。
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = blocks.find(b => b.indexOf('renderSingerCollection') > -1);
function fakeEl(){const t={_style:{}};return new Proxy(t,{get(tt,p){if(p==='style')return tt._style;if(p==='classList')return{add(){},remove(){},toggle(){},contains(){return false}};if(['addEventListener','removeEventListener','appendChild','removeChild','setAttribute','removeAttribute','scrollIntoView','focus','click','select','setSelectionRange','insertBefore'].includes(p))return function(){};if(['querySelectorAll','querySelector','getElementsByTagName'].includes(p))return function(){return [fakeEl()]};if(p==='children')return[];if(p==='parentNode'){tt._pn=tt._pn||fakeEl();return tt._pn;}return tt[p];},set(tt,p,v){tt[p]=v;return true;}});}
const docEls={};
global.document={getElementById(id){return docEls[id]||(docEls[id]=fakeEl());},querySelectorAll(){return[]},querySelector(){return fakeEl()},createElement(){return fakeEl()},addEventListener(){},removeEventListener(){},execCommand(){},getElementsByTagName(){return[fakeEl()]},body:fakeEl(),documentElement:fakeEl()};
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
global.window=global;global.addEventListener=function(){};global.removeEventListener=function(){};
global.matchMedia=function(){return{matches:false}};global.scrollTo=function(){};global.scrollY=0;global.location={href:'x'};global.navigator={userAgent:'node'};
eval(script);

var mergeMap = {};
const rawNk = s => (s || '').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
const _nkCache = {};
const nk = s => _nkCache[s] !== undefined ? _nkCache[s] : (_nkCache[s] = rawNk(s));
const hasCJK = s => /[一-鿿]/.test(s);
const SEP = /[&、×_]|feat\.?\s|\bwith\b/i; // 多艺人分隔符(不含空格和-)
const canonSet = new Set(Object.keys(singerCollection));
let before0 = Object.keys(songDB).reduce((a, k) => a + songDB[k].length, 0);
console.log('清理前: 歌手', Object.keys(songDB).length, '歌曲', before0);

// ===== 规则0: 歌名嵌歌手名清理（用键自身做前缀） =====
let emb = 0;
for (const k of Object.keys(songDB)) {
  const pre = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const sg of songDB[k]) {
    const m = sg.name.match(new RegExp('^' + pre + '\\s*[-_－—–]\\s*(.+)'));
    if (m && nk(m[1]).length >= 2) { sg.name = m[1].trim(); emb++; }
  }
}
console.log('规则0 歌名嵌名修复:', emb);

// ===== 规则1: 多艺人键 → 组成独唱 =====
let c1m = 0, c1d = 0, c1k = 0; const c1log = [];
for (const k of Object.keys(songDB)) {
  if (!SEP.test(k)) continue;
  const kn = nk(k);
  const consts = Object.keys(songDB)
    .filter(sk => sk !== k && !SEP.test(sk))
    .map(sk => [nk(sk), sk])
    .filter(([sn]) => sn.length >= 2 && kn.includes(sn) && (hasCJK(sn) || sn.length >= 5))
    .sort((a, b) => b[0].length - a[0].length);
  if (!consts.length) continue;
  const canonFirst = consts.filter(([sn, sk]) => canonSet.has(sk));
  const target = (canonFirst[0] || consts[0])[1];
  const tSet = new Set((songDB[target] || []).map(x => nk(x.name)));
  const moved = [];
  for (const sg of songDB[k]) { const n = nk(sg.name); if (tSet.has(n)) { c1d++; } else { moved.push(sg); tSet.add(n); } }
  songDB[target] = (songDB[target] || []).concat(moved);
  c1m += moved.length; c1k++;
  delete songDB[k];
  if (c1k <= 15) c1log.push(k + ' → ' + target + ' (并入' + moved.length + '/重复' + c1d + ')');
}
console.log('规则1 多艺人键移除:', c1k, '| 歌曲并入:', c1m, '| 重复丢弃:', c1d);
console.log(c1log.join('\n'));

// ===== 规则2: 包含变体合并（方向修复版） =====
let m2 = 0; const m2log = [];
const soloKeys = Object.keys(songDB).filter(k => !SEP.test(k));
const normMap = {}; for (const k of soloKeys) { const n = nk(k); (normMap[n] = normMap[n] || []).push(k); }
const ns = Object.keys(normMap);
const ovCache = {};
function ovOf(fromKey, toKey) {
  const ck = fromKey + '|' + toKey;
  if (ovCache[ck] !== undefined) return ovCache[ck];
  const toSet = new Set((songDB[toKey] || []).map(x => nk(x.name)));
  let ov = 0; for (const sg of songDB[fromKey] || []) if (toSet.has(nk(sg.name))) ov++;
  return (ovCache[ck] = ov);
}
for (let i = 0; i < ns.length; i++) for (let j = 0; j < ns.length; j++) {
  if (i === j) continue;
  const a = ns[i], b = ns[j]; // 归一化后 a 包含 b
  if (a === b || !a.includes(b)) continue;
  for (const kb of normMap[b]) {
    for (const ka of normMap[a]) {
      if (kb === ka) continue;
      const kcA = canonSet.has(ka), kcB = canonSet.has(kb);
      let from = null, to = null;
      if (kcA && !kcB) { from = kb; to = ka; }
      else if (kcB && !kcA) { from = ka; to = kb; } // v2 修复: 长变体并入短规范
      else continue; // 都不在canon(或都在): 不动
      if (mergeMap[from] || mergeMap[to] || !songDB[from] || !songDB[to]) continue;
      // 纯ASCII短键(b<5且无中文)走重叠率通道，防 v1 事故
      const shortAscii = !hasCJK(b) && b.length < 5;
      const ov = ovOf(from, to);
      const ok = shortAscii ? (ov >= 0.5 * songDB[from].length) : (ov > 0 || songDB[from].length <= 2);
      if (!ok) continue;
      mergeMap[from] = to; m2++;
      if (m2 <= 40) m2log.push(from + ' → ' + to + ' (重叠' + ov + '/' + songDB[from].length + '首)');
    }
  }
}
for (const [from, to] of Object.entries(mergeMap)) {
  songDB[to] = (songDB[to] || []).concat(songDB[from] || []); delete songDB[from];
}
console.log('规则2 变体合并:', m2);
console.log(m2log.join('\n'));

// ===== 规则3: 同长度错别字（重叠计算剥离变体/规范键前缀） =====
let m3 = 0; const m3log = [];
const stripPre = (arr, keys) => {
  const res = {};
  for (const sg of arr || []) {
    let hit = null;
    for (const pk of keys) {
      const m = sg.name.match(new RegExp('^' + pk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-_－—–]\\s*(.+)'));
      if (m) { hit = m[1]; break; }
    }
    res[nk(hit || sg.name)] = 1;
  }
  return res;
};
const soloN = Object.keys(songDB).filter(k => !SEP.test(k) && hasCJK(k) && k.length >= 2).map(k => [nk(k), k]);
for (let i = 0; i < soloN.length; i++) for (let j = i + 1; j < soloN.length; j++) {
  const [na, ka] = soloN[i], [nb, kb] = soloN[j];
  if (na.length !== nb.length) continue;
  let d = 0; for (let x = 0; x < na.length; x++) if (na[x] !== nb[x]) d++;
  if (d !== 1) continue;
  const ca = canonSet.has(ka), cb = canonSet.has(kb);
  if (ca === cb) continue;
  const variant = ca ? kb : ka, canon = ca ? ka : kb;
  if (mergeMap[variant] || mergeMap[canon]) continue;
  const vSet = stripPre(songDB[variant], [variant, canon]);
  const cSet = stripPre(songDB[canon], [variant, canon]);
  let ov = 0; for (const x of Object.keys(vSet)) if (cSet[x]) ov++;
  if (ov > 0 || (songDB[variant] || []).length <= 2) { mergeMap[variant] = canon; m3++; m3log.push(variant + ' → ' + canon + ' (重叠' + ov + ')'); }
}
for (const [from, to] of Object.entries(mergeMap)) { if (songDB[from]) { songDB[to] = (songDB[to] || []).concat(songDB[from]); delete songDB[from]; } }
console.log('规则3 错别字合并:', m3);
console.log(m3log.join('\n'));

// ===== 规则4(终清): 合并后再次剥离 "键名 - " 前缀 =====
let emb2 = 0;
for (const k of Object.keys(songDB)) {
  const pre = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const sg of songDB[k]) {
    const m = sg.name.match(new RegExp('^' + pre + '\\s*[-_－—–]\\s*(.+)'));
    if (m && nk(m[1]).length >= 2) { sg.name = m[1].trim(); emb2++; }
  }
}
console.log('规则4 终清嵌名:', emb2);

// ===== 规则5: (XX版) 去重 =====
const LANG = /国语|粤语|英语|日文|韩文|中文|闽南语|Remix|remix|混音/;
let v5 = 0; const v5log = [];
for (const k of Object.keys(songDB)) {
  const baseSet = new Set((songDB[k] || []).filter(sg => !/[(（][^()（）]*版[)）]\s*$/.test(sg.name)).map(sg => nk(sg.name)));
  const keep = [];
  for (const sg of songDB[k]) {
    const m = sg.name.match(/^(.*?)\s*[(（]([^()（）]*版)[)）]\s*$/);
    if (m && !LANG.test(m[2]) && baseSet.has(nk(m[1]))) { v5++; if (v5log.length < 10) v5log.push(k + '《' + sg.name + '》'); continue; }
    keep.push(sg);
  }
  songDB[k] = keep;
}
console.log('规则5 (XX版)去重:', v5);
console.log(v5log.join('\n'));

// ===== 规则6: 精确同名 =====
let b6 = 0, a6 = 0, d6 = 0;
for (const k of Object.keys(songDB)) {
  const g = new Map();
  for (const sg of songDB[k]) { b6++; const n = nk(sg.name); if (!g.has(n)) g.set(n, []); g.get(n).push(sg); }
  const kept = [];
  for (const [, arr] of g) {
    if (arr.length > 1) { d6 += arr.length - 1;
      arr.sort((a, b) => ((b.cover ? 2 : 0) + (b.baidu ? 1 : 0)) - ((a.cover ? 2 : 0) + (a.baidu ? 1 : 0)));
      const best = Object.assign({}, arr[0]);
      for (const o of arr) { if (!best.cover && o.cover) best.cover = o.cover; if (!best.baidu && o.baidu) best.baidu = o.baidu; }
      kept.push(best);
    } else kept.push(arr[0]);
  }
  songDB[k] = kept; a6 += kept.length;
}
console.log('规则6 精确去重: 前', b6, '后', a6, '删', d6);
console.log('清理后: 歌手', Object.keys(songDB).length, '歌曲', Object.keys(songDB).reduce((a, k) => a + songDB[k].length, 0));

// ===== 写回 =====
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<\/(script)/gi, '<\\/$1'); }
function serSong(sg) {
  let p = "name: '" + esc(sg.name) + "', cover: '" + esc(sg.cover || '') + "', quark: '" + esc(sg.quark || '') + "'";
  if (sg.baidu) p += ", baidu: '" + esc(sg.baidu) + "'";
  return '{ ' + p + ' }';
}
const l = ['var songDB = {'];
for (const k of Object.keys(songDB)) l.push("  '" + esc(k) + "': [" + songDB[k].map(serSong).join(', ') + "],");
l.push('};;;;;;');
let data = fs.readFileSync('data.js', 'utf8');
const s0 = data.indexOf('var songDB = {'), e0 = data.indexOf('};;;;;;', s0) + 7;
fs.writeFileSync('data.js', data.slice(0, s0) + l.join('\r\n') + data.slice(e0));
const cl = ['var singerSongCounts={'];
for (const k of Object.keys(songDB)) cl.push("'" + esc(k) + "':" + songDB[k].length + ",");
cl.push('};');
let h2 = fs.readFileSync('index.html', 'utf8');
const cs = h2.indexOf('var singerSongCounts={'), ce = h2.indexOf('};', cs) + 2;
fs.writeFileSync('index.html', h2.slice(0, cs) + cl.join('') + h2.slice(ce));
console.log('已写回 data.js + singerSongCounts');
console.log('验证老人与海:', Object.keys(songDB).filter(k => (songDB[k] || []).some(sg => sg.name.indexOf('老人与海') > -1)).join(' | '));
console.log('验证冒险的梦:', (songDB['林俊杰'] || []).filter(sg => sg.name.indexOf('冒险的梦') > -1).map(sg => sg.name).join(' | '));
console.log('验证邓紫棋歌曲数:', (songDB['邓紫棋'] || []).length, '| 海鸣威歌曲数:', (songDB['海鸣威'] || []).length);
console.log('验证A键(应并入A-LIN):', songDB['A'] ? '仍存在(' + songDB['A'].length + '首)' : '已并入', '| A-LIN:', (songDB['A-LIN'] || []).length);
