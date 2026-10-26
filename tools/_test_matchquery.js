// 提取 index.html 中的搜索相关函数，在沙箱验证合唱曲是否随歌手搜出
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dj = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');

function cut(startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  if (s === -1) throw new Error('未找到: ' + startMarker);
  const e = html.indexOf(endMarker, s);
  if (e === -1) throw new Error('未找到结束: ' + endMarker);
  return html.slice(s, e + endMarker.length);
}

const codeParts = [
  'var _songFlat = []; var _singerCleanCache = {};',
  "var singerAlias={'黄丽玲':'A-LIN','G.E.M.':'邓紫棋','G.E.M':'邓紫棋'};",
  dj, // songDB + singerPopularity
  cut('function cleanStr', '}'),
  cut('(function buildSongIndex()', '})();'),
  cut('var _collabKeysBySinger', '})();'),
  cut('function _lev(', '\n}'),
  cut('function _scoreSong(it, keywords)', '\n}')
];

// _matchQuery 提取到函数结束（用大括号配对）
(function () {
  const s = html.indexOf('function _matchQuery(query)');
  let depth = 0, e = -1;
  for (let i = html.indexOf('{', s); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { e = i; break; } }
  }
  codeParts.push(html.slice(s, e + 1));
})();

const cx = { console: console };
vm.createContext(cx);
vm.runInContext(codeParts.join('\n'), cx);

function search(q) {
  return vm.runInContext('_matchQuery(' + JSON.stringify(q) + ')', cx).map(function (r) { return r.singer + ' - ' + r.name; });
}

console.log('=== 搜「林子祥」===');
const lz = search('林子祥');
console.log('总数:', lz.length, '（期望 86 独唱 + 14 合唱 = 100）');
const byKey = {};
lz.forEach(function (s) { byKey[s.split(' - ')[0]] = (byKey[s.split(' - ')[0]] || 0) + 1; });
console.log('分布:', JSON.stringify(byKey, null, 1));
console.log('前5:', lz.slice(0, 5).join(' | '));

console.log('\n=== 搜「那英」===');
const ny = search('那英');
const byKey2 = {};
ny.forEach(function (s) { byKey2[s.split(' - ')[0]] = (byKey2[s.split(' - ')[0]] || 0) + 1; });
console.log('总数:', ny.length, '（期望 76 + 16 = 92）');
console.log('分布:', JSON.stringify(byKey2, null, 1));

console.log('\n=== 搜「罗大佑」===');
const ldy = search('罗大佑');
console.log('总数:', ldy.length, '（期望 51 + 4 = 55）');

console.log('\n=== 搜「刘欢」===');
const lh = search('刘欢');
const byKey3 = {};
lh.forEach(function (s) { byKey3[s.split(' - ')[0]] = (byKey3[s.split(' - ')[0]] || 0) + 1; });
console.log('总数:', lh.length, '（期望 85 独唱 + 合唱: 刘欢&那英2 + 林子祥&刘…无 + 黄霑组无 = 87）');
console.log('分布:', JSON.stringify(byKey3, null, 1));

console.log('\n=== 搜「叶倩文」（合唱键里的另一人）===');
const yqw = search('叶倩文');
const byKey4 = {};
yqw.forEach(function (s) { byKey4[s.split(' - ')[0]] = (byKey4[s.split(' - ')[0]] || 0) + 1; });
console.log('总数:', yqw.length);
console.log('分布:', JSON.stringify(byKey4, null, 1));

console.log('\n=== 回归：搜「好汉歌」（歌名）===');
console.log(search('好汉歌').join(' | '));
console.log('\n=== 回归：搜「晴天 周杰伦」===');
console.log(search('晴天 周杰伦').slice(0, 3).join(' | '));
console.log('\n=== 回归：搜「画心 张信哲」（原回退场景）===');
console.log(search('画心 张信哲').slice(0, 5).join(' | '));
