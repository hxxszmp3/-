// 审计: 填充后仍含" - "的标题, 分类统计
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));
const nk = s => (s || '').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
let total = 0, stripMatch = 0, stripNovel = 0, keep = 0;
const samples = { match: [], novel: [], keep: [] };
for (const k of Object.keys(songDB)) {
  if (k === '歌单') continue;
  const arr = songDB[k];
  const byNk = new Map();
  arr.forEach((s, i) => { const n = nk(s.name); if (!byNk.has(n)) byNk.set(n, i); });
  const kn = nk(k);
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (s.name.indexOf(' - ') === -1) continue;
    total++;
    const m = s.name.match(/^(.{1,40}?)\s+-\s+(.+)$/);
    if (m && kn.length >= 2 && nk(m[1]).indexOf(kn) > -1) {
      const rest = m[2], rn = nk(rest);
      if (byNk.has(rn) && byNk.get(rn) !== i) { stripMatch++; if (samples.match.length < 12) samples.match.push(k + '《' + s.name + '》→《' + rest + '》(已有)'); }
      else { stripNovel++; if (samples.novel.length < 12) samples.novel.push(k + '《' + s.name + '》→《' + rest + '》(新歌)'); }
    } else { keep++; if (samples.keep.length < 12) samples.keep.push(k + '《' + s.name + '》'); }
  }
}
console.log('含" - "标题总数:', total, '| 前缀含歌手名且剥后撞已有:', stripMatch, '| 前缀含歌手名剥后为新歌:', stripNovel, '| 保留:', keep);
console.log('\n-- 撞已有(应合并) --'); samples.match.forEach(x => console.log(' ', x));
console.log('\n-- 剥后为新歌(应改名) --'); samples.novel.forEach(x => console.log(' ', x));
console.log('\n-- 保留 --'); samples.keep.forEach(x => console.log(' ', x));
