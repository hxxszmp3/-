// 批量补占位封面维护脚本(2026-10 改造: songDB 已拆分到 data.js)
// 用法: node _batch.js  —— 找出 songDB 中占位封面(softhead/400/数字.jpg), 用网易云/酷狗 API 换真封面
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));   // 提供 songDB / singerPopularity

function clean(s){ return String(s).replace(/[^a-z0-9一-鿿]/gi,'').toLowerCase(); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA163 = { 'User-Agent':'Mozilla/5.0', 'Referer':'https://music.163.com' };
const UAKG = { 'User-Agent':'Mozilla/5.0' };

function isPlaceholder(c){ return /\/softhead\/400\/\d+\.jpg$/.test(c || ''); }
const all = [];
for (const k of Object.keys(songDB)) for (const sg of songDB[k]) if (isPlaceholder(sg.cover)) all.push({ singer:k, name:sg.name });
console.log('剩余占位封面总数:', all.length);
const target = all;
console.log('本批处理:', target.length);

async function netease(singer, name){
  const cn = clean(name), cs = clean(singer);
  try {
    const r = await fetch('http://music.163.com/api/search/get?type=1&limit=8&s=' + encodeURIComponent(name), { headers: UA163 });
    if (!r.ok) return null;
    const j = await r.json();
    const list = (j.result && j.result.songs) || [];
    let pick = null;
    for (const s of list) {
      const sn = clean(s.name || '');
      if (!sn) continue;
      if (sn === cn || sn.indexOf(cn) === 0 || cn.indexOf(sn) === 0) {
        const arts = (s.artists || []).map(a => clean(a.name));
        if (arts.some(x => x && (cs.indexOf(x) >= 0 || x.indexOf(cs) >= 0))) { pick = s; break; }
        if (!pick) pick = s;
      }
    }
    if (!pick) return null;
    const d = await fetch('http://music.163.com/api/song/detail?ids=' + encodeURIComponent('[' + pick.id + ']'), { headers: UA163 });
    const dj = await d.json();
    const album = dj.songs && dj.songs[0] && dj.songs[0].album;
    if (album && album.picUrl) return String(album.picUrl).replace('http://','https://');
  } catch (e) {}
  return null;
}
async function kugou(singer, name){
  const cs = clean(singer);
  try {
    const r = await fetch('http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=' + encodeURIComponent(name) + '&page=1&pagesize=8', { headers: UAKG });
    if (!r.ok) return null;
    const j = await r.json();
    const list = (j.data && j.data.info) || [];
    let hash = null;
    for (const s of list) { if (s.hash && (clean(s.singername||'').indexOf(cs)>=0 || cs.indexOf(clean(s.singername||''))>=0)) { hash=s.hash; break; } }
    if (!hash && list[0]) hash = list[0].hash;
    if (!hash) return null;
    const d = await fetch('http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + hash, { headers: UAKG });
    const dj = await d.json();
    if (dj.imgUrl) return String(dj.imgUrl).replace('{size}','400').replace('http://','https://');
  } catch (e) {}
  return null;
}

(async function(){
  let idx = 0, filled = 0;
  async function worker(){
    while (idx < target.length) {
      const i = idx++; const t = target[i];
      await sleep(300);
      let u = await netease(t.singer, t.name);
      if (!u) u = await kugou(t.singer, t.name);
      if (u) { for (const sg of songDB[t.singer]) if (sg.name === t.name) { sg.cover = u; filled++; } }
    }
  }
  await Promise.all([worker(), worker()]);

  // 转义 \ ' 以及 </script>，防止数据截断
  function esc(s){ return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<\/(script)/gi, '<\\/$1'); }
  function serSong(sg){ let p="name: '"+esc(sg.name)+"', cover: '"+esc(sg.cover||'')+"', quark: '"+esc(sg.quark||'')+"'"; if(sg.baidu)p+=", baidu: '"+esc(sg.baidu)+"'"; return "{ "+p+" }"; }
  function serSongDB(obj){ const l=["var songDB = {"]; for(const k of Object.keys(obj)) l.push("  '"+esc(k)+"': ["+obj[k].map(serSong).join(', ')+"],"); l.push("};;;;;;"); return l.join("\r\n"); }

  // 写回 data.js(只替换 songDB 块, 保留 singerPopularity)
  let data = fs.readFileSync('data.js', 'utf8');
  const s0 = data.indexOf('var songDB = {');
  const e0 = data.indexOf('};;;;;;', s0) + '};;;;;;'.length;
  fs.writeFileSync('data.js', data.slice(0, s0) + serSongDB(songDB) + data.slice(e0));

  let remain = 0; for (const k of Object.keys(songDB)) for (const sg of songDB[k]) if (isPlaceholder(sg.cover)) remain++;
  console.log('本批命中:', filled, '| 剩余占位:', remain);
  process.exit(0);
})();
