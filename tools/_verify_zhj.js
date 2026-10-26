// 线上核验：周华健
const fs = require('fs');
const vm = require('vm');
const dj = fs.readFileSync('C:/Users/dellsq/Desktop/123/lcd.js', 'utf8');
const html = fs.readFileSync('C:/Users/dellsq/Desktop/123/lc.html', 'utf8');
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('线上 songDB 键数:', Object.keys(cx.songDB).length);
console.log('线上周华健曲数:', (cx.songDB['周华健'] || []).length);
console.log('合唱键:', Object.keys(cx.songDB).filter(function (k) { return k.indexOf('周华健') !== -1 && k.indexOf('&') !== -1; }).join(', '));
console.log('热门曲:', ['朋友', '花心', '让我欢喜让我忧', '难念的经', '刀剑如梦', '忘忧草', '其实不想走', '有没有那么一首歌会让你想起我'].map(function (n) {
  return n + ':' + ((cx.songDB['周华健'] || []).some(function (s) { return s.name === n; }) ? '✓' : '✗');
}).join(' '));
console.log('残留(1)标记:', (cx.songDB['周华健'] || []).filter(function (s) { return /\(\d+\)/.test(s.name); }).map(function (s) { return s.name; }).join(', ') || '无');
console.log('总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));

function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html); if (!m) return null;
  const s = m.index + m[0].length - 1;
  return html.slice(s, html.indexOf('};', s) + 1);
}
const cx2 = {}; vm.createContext(cx2);
['singerCollection', 'singerBaidu', 'singerImgs'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx2); });
console.log('合集-夸克:', cx2.singerCollection['周华健']);
console.log('合集-百度:', cx2.singerBaidu['周华健']);
console.log('头像:', (cx2.singerImgs['周华健'] || '').slice(0, 60));
