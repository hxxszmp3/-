// 依据 dead-links.json 删除失效歌曲/合集入口, 同步 singerSongCounts, 重新生成SEO
// 规则: quark失效 且 无百度备用 → 整首歌删除; 有百度备用 → 保留歌曲但清除失效quark字段
//       歌手合集入口失效 → 从 singerCollection 移除该入口
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('dead-links.json', 'utf8'));
eval(fs.readFileSync('data.js', 'utf8'));
const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const deadSongLinks = new Set(), deadCollLinks = new Set();
for (const d of report.deadList || []) {
  if (d.songs && d.songs.length && d.songs[0].coll) deadCollLinks.add(d.link);
  else deadSongLinks.add(d.link);
}
console.log('失效歌曲链接:', deadSongLinks.size, '| 失效合集入口:', deadCollLinks.size);
console.log('未知(不动):', (report.unknownList || []).length, '| 需提取码(保留):', report.locked);

// ===== 1. 删除/修剪歌曲 =====
let delSongs = 0, trimSongs = 0;
const perSinger = {};
for (const k of Object.keys(songDB)) {
  const kept = [];
  for (const sg of songDB[k]) {
    if (sg.quark && deadSongLinks.has(sg.quark.split('?')[0])) {
      if (sg.baidu) { const c = Object.assign({}, sg); delete c.quark; kept.push(c); trimSongs++; }
      else { delSongs++; perSinger[k] = (perSinger[k] || 0) + 1; }
    } else kept.push(sg);
  }
  songDB[k] = kept;
}
const emptied = Object.keys(songDB).filter(k => songDB[k].length === 0);
for (const k of emptied) delete songDB[k];
console.log('删除歌曲:', delSongs, '| 保留但清除quark(有百度备用):', trimSongs, '| 变空歌手移除:', emptied.length);
const top = Object.entries(perSinger).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('删除最多:', top.map(([k, v]) => k + '(' + v + ')').join(', '));

// ===== 2. 移除失效合集入口 =====
const removedColl = [];
{
  const cs = html.indexOf('var singerCollection = {');
  const ce = html.indexOf('};', cs) + 2;
  let sc;
  eval('sc=' + html.slice(cs, ce).replace('var singerCollection = ', '').replace(/;$/, ''));
  for (const [k, v] of Object.entries(sc)) {
    const link = String(v).split('?')[0];
    if (deadCollLinks.has(link)) { delete sc[k]; removedColl.push(k); }
  }
  const ser = [];
  for (const [k, v] of Object.entries(sc)) ser.push("'" + k.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "': '" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
  const block = 'var singerCollection = {\n  ' + ser.join(',\n  ') + '\n};';
  html = html.slice(0, cs) + block + html.slice(ce);
}
console.log('移除失效合集入口:', removedColl.length, removedColl.join(', '));

// ===== 3. 写回 data.js =====
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
let data = fs.readFileSync('data.js', 'utf8');
const s0 = data.indexOf('var songDB = {'), e0 = data.indexOf('};;;;;;', s0) + 7;
data = data.slice(0, s0) + l.join('\r\n') + data.slice(e0);
fs.writeFileSync('data.js', data);

// ===== 4. 同步 singerSongCounts =====
const cl = ['var singerSongCounts={'];
for (const k of Object.keys(songDB)) cl.push("'" + esc(k) + "':" + songDB[k].length + ",");
cl.push('};');
const cs2 = html.indexOf('var singerSongCounts={'), ce2 = html.indexOf('};', cs2) + 2;
html = html.slice(0, cs2) + cl.join('') + html.slice(ce2);
fs.writeFileSync(htmlPath, html);
console.log('已写回 data.js + singerSongCounts + singerCollection');
console.log('终态: 歌手', Object.keys(songDB).length, '歌曲', Object.keys(songDB).reduce((a, k) => a + songDB[k].length, 0));
