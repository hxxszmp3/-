// 线上核验：刘欢 85 首
const fs = require('fs');
const vm = require('vm');
const dj = fs.readFileSync('C:/Users/dellsq/Desktop/123/lcd.js', 'utf8');
const cx = {}; vm.createContext(cx);
vm.runInContext(dj, cx);
console.log('线上 songDB 键数:', Object.keys(cx.songDB).length);
console.log('线上刘欢曲数:', (cx.songDB['刘欢'] || []).length);
console.log('抽样首/末:', JSON.stringify(cx.songDB['刘欢'][0]), '/', JSON.stringify(cx.songDB['刘欢'][84]));
console.log('热门曲在库:', ['好汉歌', '弯弯的月亮', '少年壮志不言愁', '亚洲雄风', '从头再来', '凤凰于飞', '千万次地问'].map(function (n) {
  return n + ':' + ((cx.songDB['刘欢'] || []).some(function (s) { return s.name === n; }) ? '✓' : '✗');
}).join(' '));
console.log('线上总曲数:', Object.values(cx.songDB).reduce(function (n, a) { return n + a.length; }, 0));
