// 解析那英清单（多歌手用 _ 分隔）
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const raw = fs.readFileSync('C:/Users/dellsq/Desktop/分享结果导出-1792308050196.txt', 'utf8');
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
console.log('条目:', entries.length, '| 缺链接:', entries.filter(function (e) { return !e.url; }).length);

const solo = [], multi = [], bad = [];
entries.forEach(function (e) {
  if (!e.url) { bad.push(e.file); return; }
  const mm = e.file.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) { bad.push(e.file); return; }
  const artistPart = mm[1].trim(), name = mm[2].trim();
  // 分隔符兼容 _ 和 &（文件名里 _ 两边有空格）
  const artists = artistPart.split(/\s*_\s*|\s*&\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
  const rec = { artists: artists, name: name, quark: e.url, file: e.file };
  if (artists.length === 1) solo.push(rec); else multi.push(rec);
});

console.log('单人:', solo.length, '| 多人:', multi.length, '| 异常:', bad.length ? bad.join(' / ') : '无');
console.log('\n单人歌手分布:');
const map = {};
solo.forEach(function (s) { map[s.artists[0]] = (map[s.artists[0]] || 0) + 1; });
Object.keys(map).forEach(function (k) { console.log('  ', k, map[k]); });

console.log('\n多人组合（按人数）:');
const dist = {};
multi.forEach(function (m) { dist[m.artists.length] = (dist[m.artists.length] || 0) + 1; });
console.log('  ', JSON.stringify(dist));

console.log('\n多人组合明细:');
multi.forEach(function (m) {
  console.log('  [' + m.artists.length + '人]', m.artists.join('&'), '-', m.name);
});

fs.writeFileSync(path.join(ROOT, 'tools', '_naying_parsed.json'), JSON.stringify({ solo: solo, multi: multi }, null, 1), 'utf8');
