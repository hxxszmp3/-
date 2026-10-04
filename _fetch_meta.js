const fs = require('fs');
const SITE = 'C:/Users/dellsq/Desktop/123/music-site';
const STATE_FILE = SITE + '/_cover_state.json';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://music.163.com/' };

// ---- 环境 ----
const html = fs.readFileSync(SITE + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fakeEl() { const t = { _style: {} }; return new Proxy(t, { get(tt, p) { if (p === 'style') return tt._style; if (p === 'classList') return { add() { }, remove() { }, toggle() { }, contains() { return false } }; if (['addEventListener', 'removeEventListener', 'appendChild', 'removeChild', 'setAttribute', 'removeAttribute', 'scrollIntoView', 'focus', 'click', 'select', 'setSelectionRange', 'insertBefore'].includes(p)) return function () { }; if (['querySelectorAll', 'querySelector', 'getElementsByTagName'].includes(p)) return function () { return [fakeEl()] }; if (p === 'children') return []; if (p === 'parentNode') { tt._pn = tt._pn || fakeEl(); return tt._pn; } return tt[p]; }, set(tt, p, v) { tt[p] = v; return true; } }); }
const docEls = {};
global.document = { getElementById(id) { return docEls[id] || (docEls[id] = fakeEl()); }, querySelectorAll() { return [] }, querySelector() { return fakeEl() }, createElement() { return fakeEl() }, addEventListener() { }, removeEventListener() { }, execCommand() { }, getElementsByTagName() { return [fakeEl()] }, body: fakeEl(), documentElement: fakeEl() };
global.localStorage = { getItem() { return null }, setItem() { }, removeItem() { } };
global.window = global; global.addEventListener = function () { }; global.removeEventListener = function () { };
global.matchMedia = function () { return { matches: false } }; global.scrollTo = function () { }; global.scrollY = 0; global.location = { href: 'x' }; global.navigator = { userAgent: 'node' };
eval(fs.readFileSync(SITE + '/data.js', 'utf8'));
eval(script);

function cleanStr(s) { return s.replace(/[^a-z0-9一-鿿]/gi, '').toLowerCase(); }
function mainSinger(s) { return /&|＆/.test(s) ? s.split(/&|＆/)[0].trim() : s; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 限流保护 ----
let consecFail = 0;
async function jget(url, opts, tries) {
  for (let i = 0; i <= (tries || 1); i++) {
    try {
      const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(10000) }, opts || {}));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      consecFail = 0;
      return j;
    } catch (e) {
      if (i < (tries || 1)) { await sleep(1500); continue; }
      consecFail++;
      if (consecFail >= 5) { console.log('[限流冷却] 最近错误:', e.message); await sleep(15000); consecFail = 0; }
      throw e;
    }
  }
}

// ---- 网易云（两步：搜索ID -> 详情批量取图）----
async function neteasePick(song, singer) {
  const sc = cleanStr(mainSinger(singer));
  const j = await jget('http://music.163.com/api/search/get?type=1&limit=10&s=' + encodeURIComponent(song + ' ' + mainSinger(singer)), { headers: UA });
  const songs = (j.result && j.result.songs) || [];
  const ids = [];
  for (const s of songs) {
    const arts = (s.artists || []).map(a => cleanStr(a.name));
    if (arts.some(a => a && (a === sc || (a.length > 1 && (a.includes(sc) || sc.includes(a)))))) ids.push({ id: s.id });
  }
  if (!ids.length) return null;
  const j2 = await jget('http://music.163.com/api/v3/song/detail?c=' + encodeURIComponent(JSON.stringify(ids.slice(0, 10))), { headers: UA });
  for (const s of (j2.songs || [])) {
    if (s.al && s.al.picUrl) return String(s.al.picUrl).replace('http://', 'https://').replace('p1.music', 'p2.music').replace('p3.music', 'p2.music');
  }
  return null;
}
// ---- 酷我（旧接口，单次请求）----
async function kuwoPick(song, singer) {
  const sc = cleanStr(mainSinger(singer));
  const r = await fetch('http://search.kuwo.cn/r.s?all=' + encodeURIComponent(song + ' ' + mainSinger(singer)) + '&ft=music&itemset=web_2013&client=kt&pn=0&rn=8&rformat=json&encoding=utf8&vipver=MUSIC_8.0.3.0_BCS2', { headers: { 'User-Agent': UA['User-Agent'] }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  const re = /'ARTIST':'((?:[^'\\]|\\.)*)'[\s\S]*?'web_albumpic_short':'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(t))) {
    const a = cleanStr(m[1].replace(/\\u/g, '%u'));
    if (a && (a === sc || (a.length > 1 && (a.includes(sc) || sc.includes(a))))) {
      if (m[2]) return 'https://img4.kuwo.cn/album/' + m[2].replace(/^\d+\//, '500/');
    }
  }
  return null;
}
// ---- 酷狗（hash -> playInfo）----
async function kugouPick(song, singer) {
  const sc = cleanStr(mainSinger(singer));
  const j = await jget('http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=' + encodeURIComponent(song + ' ' + mainSinger(singer)) + '&page=1&pagesize=8', { headers: { 'User-Agent': UA['User-Agent'] } });
  const list = (j.data && j.data.info) || [];
  for (const s of list) {
    const a = cleanStr(s.singername || '');
    if (!(a && (a === sc || (a.length > 1 && (a.includes(sc) || sc.includes(a)))))) continue;
    try {
      const j2 = await jget('http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + s.hash, { headers: { 'User-Agent': UA['User-Agent'] } });
      const img = j2.imgUrl || j2.img || '';
      if (img && img.indexOf('imge.kugou.com') >= 0) return String(img).replace('http://', 'https://').replace(/\/(\d+)\//, '/480/');
    } catch (e) { }
  }
  return null;
}
// ---- QQ 音乐（musicu.fcg；本环境常返回空，尽力而为）----
async function qqPick(song, singer) {
  const sc = cleanStr(mainSinger(singer));
  const body = { req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { search_type: 0, query: song + ' ' + mainSinger(singer), page_num: 1, num_per_page: 8 } } };
  const j = await jget('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA['User-Agent'], 'Referer': 'https://y.qq.com/' }, body: JSON.stringify(body) });
  const list = (((j.req || {}).data || {}).body || {}).song || {};
  for (const s of (list.list || [])) {
    const arts = (s.singer || []).map(a => cleanStr(a.name || ''));
    if (arts.some(a => a && (a === sc || (a.length > 1 && (a.includes(sc) || sc.includes(a)))))) {
      const mid = (s.album && s.album.mid) || s.albumMid || '';
      if (mid) return 'https://y.gtimg.cn/music/photo_new/T002R500x500M000' + mid + '.jpg';
    }
  }
  return null;
}
const PLATFORMS = [['netease', neteasePick], ['kuwo', kuwoPick], ['kugou', kugouPick], ['qq', qqPick]];

async function getAvatar(singer) {
  try {
    const j = await jget('http://music.163.com/api/search/get?type=100&limit=1&s=' + encodeURIComponent(singer), { headers: UA }, 2);
    const a = (j.result && j.result.artists) || [];
    if (a.length) { const u = String(a[0].img1v1Url || a[0].picUrl || '').replace('http://', 'https://'); return u || ''; }
  } catch (e) { }
  return '';
}
async function getGender(singer) {
  try {
    const j = await jget('http://mobilecdn.kugou.com/api/v3/search/singer?format=json&keyword=' + encodeURIComponent(singer) + '&page=1&pagesize=1', { headers: { 'User-Agent': UA['User-Agent'] } }, 2);
    const info = (j.data && j.data.info) || [];
    if (info.length && typeof info[0].gender === 'number') return info[0].gender;
  } catch (e) { }
  return -1;
}

// ---- 状态 ----
let state = { covers: {}, avatars: {}, gender: {} };
if (fs.existsSync(STATE_FILE)) { try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { } }
// 清掉上次失败的空头像/无效性别，重抓
let clearedA = 0, clearedG = 0;
for (const k of Object.keys(state.avatars)) if (!state.avatars[k]) { delete state.avatars[k]; clearedA++; }
for (const k of Object.keys(state.gender)) if (state.gender[k] === undefined || state.gender[k] < 0) { delete state.gender[k]; clearedG++; }
console.log('清理旧空头像:', clearedA, '| 清理无效性别:', clearedG);
let dirty = 0;
function saveState(force) { dirty++; if (force || dirty >= 200) { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); dirty = 0; } }

async function pool(items, worker, n) {
  let i = 0; await Promise.all(Array(n).fill(0).map(async () => { while (i < items.length) { const idx = i++; try { await worker(items[idx], idx); } catch (e) { } await sleep(60); } }));
}

(async () => {
  // Phase A: 新歌手 头像+性别
  const newSingers = JSON.parse(fs.readFileSync(SITE + '/_new_singers.json', 'utf8'));
  const metaTasks = newSingers.filter(s => !state.avatars[s] || !(s in state.gender));
  console.log('[Phase A] 待补头像/性别:', metaTasks.length);
  let errA = 0;
  await pool(metaTasks, async (s) => {
    try {
      if (!state.avatars[s]) { state.avatars[s] = await getAvatar(s); }
      if (!(s in state.gender)) { state.gender[s] = await getGender(s); }
    } catch (e) { errA++; }
    saveState(false);
  }, 3);
  saveState(true);
  const av = Object.values(state.avatars).filter(Boolean).length;
  const gv = {}; for (const v of Object.values(state.gender)) gv[v] = (gv[v] || 0) + 1;
  console.log('[Phase A 完成] 有效头像:', av, '/', Object.keys(state.avatars).length, '| 性别分布:', JSON.stringify(gv), '| 错误:', errA);

  // Phase B: 封面
  const needCover = [];
  for (const [k, list] of Object.entries(songDB)) for (const sg of list) if (!sg.cover) needCover.push([k, sg.name]);
  const coverTasks = needCover.filter(([k, n]) => !state.covers[k + '||' + n]);
  console.log('[Phase B] 无封面歌曲:', needCover.length, '| 待抓:', coverTasks.length);
  let done = 0; const hit = {};
  await pool(coverTasks, async ([singer, song]) => {
    const key = singer + '||' + song;
    for (const [pname, fn] of PLATFORMS) {
      try {
        const url = await fn(song, singer);
        if (url) { state.covers[key] = url; hit[pname] = (hit[pname] || 0) + 1; break; }
      } catch (e) { }
    }
    done++;
    if (done % 200 === 0) { console.log('[进度] ' + done + '/' + coverTasks.length + ' 命中:' + JSON.stringify(hit)); saveState(true); }
    await sleep(40);
  }, 3);
  saveState(true);
  const totalHit = Object.values(hit).reduce((a, b) => a + b, 0);
  console.log('[Phase B 完成] 命中:', JSON.stringify(hit), '| 未命中(头像兜底):', coverTasks.length - totalHit);
  fs.writeFileSync(SITE + '/_cover_done.flag', 'done');
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
