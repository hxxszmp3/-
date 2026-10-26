// 线上核验：林子祥
const fs = require('fs');
const vm = require('vm');
const dj = fs.readFileSync('C:/Users/dellsq/Desktop/123/lcd.js', 'utf8');
const html = fs.readFileSync('C:/Users/dellsq/Desktop/123/lc.html', 'utf8');
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('线上 songDB 键数:', Object.keys(cx.songDB).length);
console.log('线上林子祥曲数:', (cx.songDB['林子祥'] || []).length);
const collab = Object.keys(cx.songDB).filter(function (k) { return k.indexOf('林子祥') !== -1 && k.indexOf('&') !== -1; });
console.log('线上合唱键:', collab.length, '个 →', collab.reduce(function (n, k) { return n + cx.songDB[k].length; }, 0), '首');
console.log('合唱键列表:', collab.join(' | '));
console.log('热门曲:', ['男儿当自强', '真的汉子', '选择', '分分钟需要你', '数字人生', '凭着爱', '在水中央'].map(function (n) {
  return n + ':' + ((cx.songDB['林子祥'] || []).some(function (s) { return s.name === n; }) ? '✓' : '✗');
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
console.log('合集-夸克:', cx2.singerCollection['林子祥']);
console.log('合集-百度:', cx2.singerBaidu['林子祥']);
console.log('头像:', (cx2.singerImgs['林子祥'] || '').slice(0, 60));
