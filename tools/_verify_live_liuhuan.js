// 线上核验：刘欢
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/dellsq/Desktop/123/lc.html', 'utf8');
function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html.indexOf('};', s);
  return html.slice(s, e + 1);
}
const cx = {}; vm.createContext(cx);
['singerCollection', 'singerBaidu', 'singerImgs'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx); });
console.log('线上合集键数:', Object.keys(cx.singerCollection).length);
console.log('线上刘欢-夸克:', cx.singerCollection['刘欢']);
console.log('线上刘欢-百度:', cx.singerBaidu['刘欢']);
console.log('线上刘欢-头像:', (cx.singerImgs['刘欢'] || '').slice(0, 70));
