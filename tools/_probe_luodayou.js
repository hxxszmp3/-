// 探测现有数据结构：罗大佑是否已存在、各表键情况
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html.indexOf('};', s);
  return html.slice(s, e + 1);
}
const cx = {}; vm.createContext(cx);
['singerAlias', 'singerImgs', 'singerCollection', 'singerBaidu', 'singerSongCounts', 'singerMeta'].forEach(function (v) {
  try { vm.runInContext(v + ' = ' + lit(v), cx); } catch (e) { console.log('!! ' + v + ' 求值失败:', e.message); }
});

['singerAlias', 'singerImgs', 'singerCollection', 'singerBaidu', 'singerSongCounts', 'singerMeta'].forEach(function (v) {
  const o = cx[v] || {};
  console.log('=== ' + v + ' === 键数:' + Object.keys(o).length + ' | 含罗大佑:' + (o['罗大佑'] !== undefined));
  if (o['罗大佑'] !== undefined) console.log('    值:', JSON.stringify(o['罗大佑']));
});

// data.js 里 songDB 是否已有罗大佑
const dj = fs.readFileSync('data.js', 'utf8');
console.log('\n=== data.js ===');
console.log('含 "罗大佑":', dj.indexOf("'罗大佑'") !== -1 || dj.indexOf('"罗大佑"') !== -1);

// 抽样看 singerCollection 的结构
const collKeys = Object.keys(cx.singerCollection || {});
console.log('\n=== singerCollection 抽样 ===');
collKeys.slice(0, 3).forEach(function (k) { console.log(k, '→', JSON.stringify(cx.singerCollection[k]).slice(0, 200)); });
console.log('是否含 "歌单":', collKeys.indexOf('歌单') !== -1);

// singerMeta 抽样
const mk = Object.keys(cx.singerMeta || {});
console.log('\n=== singerMeta 抽样 ===');
mk.slice(0, 3).forEach(function (k) { console.log(k, '→', JSON.stringify(cx.singerMeta[k]).slice(0, 200)); });

// singerSongCounts 抽样
console.log('\n=== singerSongCounts 抽样 ===');
console.log(JSON.stringify(cx.singerSongCounts).slice(0, 300));
