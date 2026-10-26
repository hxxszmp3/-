// 头像结构化审计：查重(按路径归一化)、占位图识别、来源统计
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function litSource(h, v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(h); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return h.slice(s, e + 1);
}
const sb = {}; vm.createContext(sb);
vm.runInContext('imgs = ' + litSource(html, 'singerImgs'), sb);
vm.runInContext('coll = ' + litSource(html, 'singerCollection'), sb);
const imgs = sb.imgs, coll = sb.coll;

// 归一化：去掉协议+主机与 query，只留路径（这样 p1/p2 的同一张图会归到一起）
function normUrl(u) {
  if (!u) return '';
  return u.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
}
function host(u) {
  const m = /^https?:\/\/([^/]+)/.exec(u || '');
  return m ? m[1] : '(none)';
}

const keys = Object.keys(imgs);
console.log('singerImgs 键数:', keys.length);
console.log('singerCollection 键数:', Object.keys(coll).length);
console.log('');

// 1) 缺头像
const noImg = Object.keys(coll).filter(function (k) { return !imgs[k]; });
console.log('=== 1. 合集里没有头像的歌手 (' + noImg.length + ') ===');
console.log(noImg.length ? '  ' + noImg.join('、') : '  无');
console.log('');

// 2) 按归一化路径查重
const byPath = {};
keys.forEach(function (k) {
  const p = normUrl(imgs[k]);
  if (!p) return;
  (byPath[p] = byPath[p] || []).push(k);
});
const dups = Object.keys(byPath).filter(function (p) { return byPath[p].length > 1; });
console.log('=== 2. 多位歌手共用同一张图 (' + dups.length + ' 组) ===');
dups.forEach(function (p) {
  console.log('  ' + byPath[p].join('、'));
  console.log('      ' + p);
});
if (!dups.length) console.log('  无');
console.log('');

// 3) 已知占位图
const PLACEHOLDER_HINTS = [
  { name: '男歌手剪影占位图', re: /6y-UleORITEDbvrOLV0Q8A/ },
  { name: '灰色默认头像', re: /VnZiScyynLG7atLIZ2YPkw==\/18686200114669622/ }
];
console.log('=== 3. 已知占位图 ===');
let phCount = 0;
PLACEHOLDER_HINTS.forEach(function (h) {
  const hit = keys.filter(function (k) { return h.re.test(imgs[k] || ''); });
  if (hit.length) { phCount += hit.length; console.log('  [' + h.name + '] ' + hit.join('、')); }
});
if (!phCount) console.log('  无');
console.log('');

// 4) 来源统计
const byHost = {};
keys.forEach(function (k) {
  const h = host(imgs[k]);
  byHost[h] = (byHost[h] || 0) + 1;
});
console.log('=== 4. 图片来源分布 ===');
Object.keys(byHost).sort(function (a, b) { return byHost[b] - byHost[a]; }).forEach(function (h) {
  console.log('  ' + String(byHost[h]).padStart(4, ' ') + '  ' + h);
});
console.log('');

// 5) qqmp3.vip 来源的（第三方，易是专辑封面）
const qqmp3 = keys.filter(function (k) { return /qqmp3\.vip/.test(imgs[k] || ''); });
console.log('=== 5. 第三方源 img.qqmp3.vip (' + qqmp3.length + ') ===');
console.log(qqmp3.length ? '  ' + qqmp3.join('、') : '  无');

fs.writeFileSync(path.join(ROOT, 'tools', '_audit_imgs.json'), JSON.stringify(imgs, null, 2));
console.log('');
console.log('（singerImgs 已导出到 tools/_audit_imgs.json 供下一步使用）');
