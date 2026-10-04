// 清空单曲板块的 quark 链接 与 cover 封面(单曲搜索板块)
// 保留: 歌名、歌手键、歌单('歌单')、搜索规则/别名/合集、baidu 链接
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));
let tot = 0, qdel = 0, cdel = 0, plQ = 0, plC = 0;
for (const k of Object.keys(songDB)) {
  if (k === '歌单') { for (const s of songDB[k]) { if (s.quark) plQ++; if (s.cover) plC++; } continue; }
  for (const s of songDB[k]) {
    tot++;
    if (s.quark) { delete s.quark; qdel++; }
    if (s.cover) { delete s.cover; cdel++; }
  }
}
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<\/(script)/gi, '<\\/$1'); }
function serSong(sg) {
  let p = "name: '" + esc(sg.name) + "', cover: ''";
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
console.log('单曲处理:', tot, '| 删除 quark:', qdel, '| 删除封面:', cdel);
console.log('歌单保护: quark', plQ, '封面', plC, '(应 69/69, 未被动)');

// 终验
delete global.songDB; delete global.singerPopularity;
eval(fs.readFileSync('data.js', 'utf8'));
let t = 0, q = 0, c = 0, q2 = 0, c2 = 0;
for (const k of Object.keys(songDB)) for (const s of songDB[k]) { if (k === '歌单') { if (s.quark) q2++; if (s.cover) c2++; continue; } t++; if (s.quark) q++; if (s.cover) c++; }
console.log('终验: 单曲', t, '| quark', q, '| cover', c, '| 歌单 quark', q2 + '/69', '封面', c2 + '/69');
console.log('终验: file size', (fs.statSync('data.js').size / 1024).toFixed(0) + 'KB');
