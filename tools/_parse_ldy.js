// 解析分享 txt，生成 songDB 条目 + 统计
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const raw = fs.readFileSync('C:/Users/dellsq/Desktop/分享结果导出-1792073457336.txt', 'utf8');
const lines = raw.split(/\r?\n/);

const entries = [];
let cur = null;
lines.forEach(function (ln) {
  const t = ln.trim();
  if (!t) return;
  const m = t.match(/^\d+\.\s*(.+?)\.mp3$/i);
  if (m) { cur = { file: m[1].trim(), url: '' }; entries.push(cur); return; }
  if (/^https:\/\/pan\.quark\.cn\//.test(t) && cur && !cur.url) { cur.url = t; }
});

console.log('解析条目:', entries.length);
const noUrl = entries.filter(function (e) { return !e.url; });
console.log('缺链接:', noUrl.length ? noUrl.map(function (e) { return e.file; }).join(', ') : '无');

// 拆 歌手 - 歌名
const solo = [], duo = {};
entries.forEach(function (e) {
  const mm = e.file.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) { console.log('!! 无法解析:', e.file); return; }
  const artistPart = mm[1].trim(), songName = mm[2].trim();
  const artists = artistPart.split('&').map(function (s) { return s.trim(); }).filter(Boolean);
  if (artists.length === 1) {
    solo.push({ singer: artists[0], name: songName, quark: e.url });
  } else {
    const key = artists.join('&');
    if (!duo[key]) duo[key] = [];
    duo[key].push({ singer: key, name: songName, quark: e.url });
  }
});

console.log('\n=== 单人曲 (' + solo.length + ') ===');
const bySinger = {};
solo.forEach(function (s) { (bySinger[s.singer] = bySinger[s.singer] || []).push(s); });
Object.keys(bySinger).forEach(function (k) { console.log(' ', k, ':', bySinger[k].length, '首'); });

console.log('\n=== 合唱曲 ===');
Object.keys(duo).forEach(function (k) { console.log(' ', k, ':', duo[k].length, '首 →', duo[k].map(function (x) { return x.name; }).join(' / ')); });

// 保存中间结果
fs.writeFileSync(path.join(ROOT, 'tools', '_ldy_parsed.json'), JSON.stringify({ solo: solo, duo: duo }, null, 1), 'utf8');
console.log('\n已存 tools/_ldy_parsed.json');
