// 探测刘欢现有数据 + build-singers 对无歌曲歌手的处理
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
['singerCollection', 'singerBaidu', 'singerImgs', 'singerMeta', 'singerSongCounts'].forEach(function (v) {
  vm.runInContext(v + ' = ' + lit(v), cx);
});
['singerCollection', 'singerBaidu', 'singerImgs', 'singerMeta', 'singerSongCounts'].forEach(function (v) {
  console.log(v, '含刘欢:', cx[v]['刘欢'] !== undefined, '| 键数:', Object.keys(cx[v]).length);
});

const dj = fs.readFileSync('data.js', 'utf8');
const cx2 = {}; vm.createContext(cx2); vm.runInContext(dj, cx2);
console.log('songDB 含刘欢:', !!cx2.songDB['刘欢'], '| 含刘欢键:', Object.keys(cx2.songDB).filter(function (k) { return k.indexOf('刘欢') !== -1; }));
console.log('popularity 刘欢:', cx2.singerPopularity['刘欢']);

// 检查合集里是否存在于 songDB 但不在 songDB 的歌手（现状一致性）
const collKeys = Object.keys(cx.singerCollection);
const noSongs = collKeys.filter(function (k) { return !cx2.songDB[k]; });
console.log('\n合集里但 songDB 无歌曲的歌手:', noSongs.length, noSongs.join(', '));
