// 刘欢 85 首入库 songDB + 更新计数
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const raw = fs.readFileSync('C:/Users/dellsq/Desktop/分享结果导出-1792302832904.txt', 'utf8');
const lines = raw.split(/\r?\n/);

const entries = [];
let cur = null;
lines.forEach(function (ln) {
  const t = ln.trim();
  if (!t) return;
  const m = t.match(/^\d+\.\s*(.+?)\.mp3$/i);
  if (m) { cur = { file: m[1].trim(), url: '' }; entries.push(cur); return; }
  if (/^https:\/\/pan\.quark\.cn\//.test(t) && cur && !cur.url) cur.url = t;
});
console.log('解析条目:', entries.length, '| 缺链接:', entries.filter(function (e) { return !e.url; }).length);

const songs = [];
const noArtist = [];
entries.forEach(function (e) {
  if (!e.url) { console.log('!! 无链接跳过:', e.file); return; }
  const mm = e.file.match(/^(.+?)\s*-\s*(.+)$/);
  let singer, name;
  if (mm && mm[1].trim()) { singer = mm[1].trim(); name = mm[2].trim(); }
  else {
    // 形如 "- Far Away" 或 "Far Away"：无歌手名，归入刘欢
    name = e.file.replace(/^-\s*/, '').trim();
    singer = '刘欢';
    noArtist.push(e.file);
  }
  songs.push({ singer: singer, name: name, quark: e.url });
});
console.log('解析出歌曲:', songs.length);
console.log('无歌手名归入刘欢:', noArtist.length ? noArtist.join(', ') : '无');
const others = songs.filter(function (s) { return s.singer !== '刘欢'; });
console.log('非刘欢歌手:', others.length ? others.map(function (s) { return s.singer + ' - ' + s.name; }).join(', ') : '无');

// 重名检查
const seen = {};
const dup = [];
songs.forEach(function (s) { if (seen[s.name]) dup.push(s.name); seen[s.name] = 1; });
console.log('清单内重名:', dup.length ? dup.join(', ') : '无');

// ===== 写入 data.js =====
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
const block = "  '刘欢': [" + songs.map(function (s) {
  return "{ name: '" + esc(s.name) + "', cover: '', quark: '" + s.quark + "' }";
}).join(', ') + "],\n";

if (/^  '刘欢':\s*\[/m.test(dj)) {
  console.log('!! songDB 已有刘欢，改用替换策略');
} else {
  dj = dj.replace(/var\s+songDB\s*=\s*\{\n/, function (m) { return m + block; });
}
fs.writeFileSync(DP, dj, 'utf8');

// 校验
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('songDB 键数:', Object.keys(cx.songDB).length);
console.log('刘欢曲数:', cx.songDB['刘欢'].length);
console.log('抽样:', JSON.stringify(cx.songDB['刘欢'].slice(0, 2)), '...', JSON.stringify(cx.songDB['刘欢'].slice(-2)));
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

// ===== 更新 singerSongCounts =====
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');
const re = /('刘欢'\s*:\s*)0(,)/;
if (re.test(html)) {
  html = html.replace(re, function (m, a, c) { return a + songs.length + c; });
  fs.writeFileSync(HP, html, 'utf8');
  console.log('singerSongCounts 刘欢 →', songs.length);
} else {
  console.log('!! singerSongCounts 未找到 "刘欢":0');
}

fs.writeFileSync(path.join(ROOT, 'tools', '_liuhuan_songs.json'), JSON.stringify(songs, null, 1), 'utf8');
