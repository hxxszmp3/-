// 删除 songDB 所有单曲的 quark 字段(封面/baidu/歌名保留), 只重写 songDB 块
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));

let totalSongs = 0, hadQuark = 0, hadCover = 0, hadBaidu = 0;
for (const k of Object.keys(songDB)) {
  if (k === '歌单') continue; // 歌单板块不是单曲, 链接保留
  for (const sg of songDB[k]) {
    totalSongs++;
    if (sg.quark) { hadQuark++; delete sg.quark; }
    if (sg.cover) hadCover++;
    if (sg.baidu) hadBaidu++;
  }
}
console.log('处理前: 歌曲', totalSongs, '| 有quark', hadQuark, '(将删除) | 有封面', hadCover, '(保留) | 有baidu', hadBaidu, '(保留)');

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
console.log('已写回 data.js');
