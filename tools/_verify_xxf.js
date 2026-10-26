// 线上核验：徐小凤
const fs = require('fs');
const vm = require('vm');
const dj = fs.readFileSync('C:/Users/dellsq/Desktop/123/lcd.js', 'utf8');
const html = fs.readFileSync('C:/Users/dellsq/Desktop/123/lc.html', 'utf8');
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('线上 songDB 键数:', Object.keys(cx.songDB).length);
console.log('线上徐小凤曲数:', (cx.songDB['徐小凤'] || []).length);
console.log('热门曲:', ['顺流逆流', '风的季节', '每一步', '明月千里寄相思', '南屏晚钟', '婚纱背后', '天涯歌女'].map(function (n) {
  return n + ':' + ((cx.songDB['徐小凤'] || []).some(function (s) { return s.name === n; }) ? '✓' : '✗');
}).join(' '));
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html.indexOf('};', s);
  return html.slice(s, e + 1);
}
const cx2 = {}; vm.createContext(cx2);
['singerCollection', 'singerBaidu', 'singerImgs'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx2); });
console.log('合集-夸克:', cx2.singerCollection['徐小凤']);
console.log('合集-百度:', cx2.singerBaidu['徐小凤']);
console.log('头像:', (cx2.singerImgs['徐小凤'] || '').slice(0, 60));
