/**
 * 主站功能自检：在 Node 里模拟浏览器环境，跑通核心搜索/匹配逻辑。
 * 用法：node tools/_smoke.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 抽出主脚本（第二个 <script> 块，即业务逻辑）
const scripts = [...idx.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appJs = scripts.find(s => s.includes('_matchQuery'));
if (!appJs) { console.error('✗ 未找到主脚本'); process.exit(1); }

// 造一个最小 DOM 环境
const noop = () => {};
const fakeEl = () => new Proxy({
  style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  value: '', innerHTML: '', textContent: '', children: [], dataset: {},
  addEventListener: noop, appendChild: noop, removeChild: noop,
  querySelector: () => null, querySelectorAll: () => [],
  getAttribute: () => null, setAttribute: noop, focus: noop, remove: noop,
}, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });

const doc = {
  getElementById: fakeEl,
  querySelector: fakeEl,
  querySelectorAll: () => [],
  createElement: fakeEl,
  body: { classList: { add: noop, remove: noop, toggle: noop } },
  addEventListener: noop,
};

const ctx = {
  document: doc,
  window: {},
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  location: { href: 'https://www.hxxsz666.vip/' },
  navigator: { userAgent: 'node' },
  fetch: () => Promise.reject(new Error('offline')),
  addEventListener: noop,
  removeEventListener: noop,
  alert: noop,
  confirm: () => false,
  prompt: () => null,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
  history: { pushState: noop, replaceState: noop },
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

// 先注入数据源
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
// 再注入业务脚本
try {
  vm.runInContext(appJs, ctx);
} catch (e) {
  console.error('✗ 主脚本执行出错: ' + e.message);
  process.exit(1);
}

const { _matchQuery, cleanStr, songDB, singerPopularity } = ctx;
if (typeof _matchQuery !== 'function') { console.error('✗ _matchQuery 未导出'); process.exit(1); }

console.log('数据加载: ' + Object.keys(songDB).length + ' 个键, ' +
  Object.keys(songDB).reduce((s, k) => s + songDB[k].length, 0) + ' 首歌曲');

const cases = [
  ['晴天 周杰伦',            '歌手+歌名'],
  ['周杰伦',                '纯歌手'],
  ['青花瓷',                '纯歌名'],
  ['青花瓷 周杰伦',          '歌名+歌手'],
  ['画心 张信哲',            '合唱回退'],
  ['邓紫棋',                '别名歌手'],
  ['A-LIN',                 '英文名歌手'],
  ['不存在的歌名xyz123',      '无结果'],
  ['   ',                   '空输入'],
];

let pass = 0, fail = 0;
for (const [q, label] of cases) {
  try {
    const r = _matchQuery(q);
    const top = r[0] ? (r[0].singer + ' - ' + r[0].name) : '(无结果)';
    console.log('  ✓ [' + label + '] "' + q + '" → ' + r.length + ' 条, 首位: ' + top);
    pass++;
  } catch (e) {
    console.log('  ✗ [' + label + '] "' + q + '" 抛错: ' + e.message);
    fail++;
  }
}

// 校验排序稳定性：同分应按热度降序
const r = _matchQuery('周杰伦');
let sorted = true;
for (let i = 1; i < r.length; i++) {
  if (r[i].score === r[i-1].score &&
      (singerPopularity[r[i].singer] || 0) > (singerPopularity[r[i-1].singer] || 0)) { sorted = false; break; }
}
console.log('  ' + (sorted ? '✓' : '✗') + ' 同分排序按歌手热度降序');
if (!sorted) fail++; else pass++;

// 校验 cleanStr 对中英文/符号的处理
const cs = cleanStr('A-LIN  陈奕迅!');
const csOk = cs === 'alin陈奕迅';
console.log('  ' + (csOk ? '✓' : '✗') + ' cleanStr 归一化: "' + 'A-LIN  陈奕迅!' + '" → "' + cs + '"');
if (!csOk) fail++; else pass++;

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
