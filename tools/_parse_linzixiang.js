// 林子祥清单解析（歌手用 、 分隔；叶蒨文→叶倩文 与站内规范名统一）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const raw = fs.readFileSync(path.join(ROOT, 'tools', '_linzixiang_raw.txt'), 'utf8');
const lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });

const entries = [];
for (let i = 0; i < lines.length; i += 2) {
  const f = lines[i].trim().replace(/\.mp3$/i, '');
  const u = (lines[i + 1] || '').trim();
  if (!/^https:\/\/pan\.quark\.cn\//.test(u)) { console.log('!! 链接异常:', f, '→', u); continue; }
  entries.push({ file: f, url: u });
}
console.log('条目:', entries.length);

function normArtist(s) {
  s = s.trim();
  if (s === '叶蒨文') return '叶倩文'; // 与站内规范名统一
  return s;
}

const solo = [], multi = [];
entries.forEach(function (e) {
  const mm = e.file.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) { console.log('!! 无法解析:', e.file); return; }
  const artists = mm[1].split(/\s*、\s*|\s*_\s*|\s*&\s*/).map(normArtist).filter(Boolean);
  const rec = { artists: artists, name: mm[2].trim(), quark: e.url };
  if (artists.length === 1) solo.push(rec); else multi.push(rec);
});

console.log('独唱:', solo.length, '| 合唱:', multi.length);
const dist = {};
multi.forEach(function (m) { dist[m.artists.length] = (dist[m.artists.length] || 0) + 1; });
console.log('合唱人数分布:', JSON.stringify(dist));
multi.forEach(function (m) { console.log('  ', m.artists.join('&'), '-', m.name); });

// 清单内重名（同歌手同名不同链接）
const seen = {};
entries.forEach(function (e) {
  const mm = e.file.match(/^(.+?)\s*-\s*(.+)$/);
  if (!mm) return;
  const k = mm[1].split(/\s*、\s*/).map(normArtist).join('&') + '||' + mm[2].trim();
  if (seen[k]) console.log('清单内重复(保留两条):', k);
  seen[k] = 1;
});

fs.writeFileSync(path.join(ROOT, 'tools', '_linzixiang_parsed.json'), JSON.stringify({ solo: solo, multi: multi }, null, 1), 'utf8');
console.log('已存 tools/_linzixiang_parsed.json');
