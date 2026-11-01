/**
 * 校验歌手 A-Z 目录的字母分组是否正确。
 * 用法：node tools/_check_groups.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = [...idx.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
  .find(s => s.includes('_matchQuery'));

const noop = () => {};
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const cap = {};
const fakeEl = (id) => new Proxy({
  id, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  value: '', innerHTML: '', textContent: '', children: [], dataset: {},
  addEventListener: noop, appendChild: noop, removeChild: noop,
  querySelector: () => null, querySelectorAll: () => [],
  getAttribute: () => null, setAttribute: noop, focus: noop, remove: noop,
  scrollTo: noop, scrollIntoView: noop,
}, {
  get: (t, k) => (k === 'innerHTML' && typeof t.__text === 'string') ? escHtml(t.__text) : (k in t ? t[k] : undefined),
  set: (t, k, v) => { if (k === 'textContent') t.__text = v; t[k] = v; return true; },
});
const doc = {
  getElementById: (id) => { if (!cap[id]) cap[id] = fakeEl(id); return cap[id]; },
  querySelector: () => fakeEl(''), querySelectorAll: () => [],
  createElement: () => fakeEl(''),
  body: { classList: { add: noop, remove: noop, toggle: noop } },
  addEventListener: noop,
};
const ctx = {
  document: doc, window: {}, console,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  setTimeout, clearTimeout, setInterval, clearInterval,
  location: { href: 'x' }, navigator: { userAgent: 'node' },
  fetch: () => Promise.reject(new Error('offline')),
  addEventListener: noop, removeEventListener: noop,
  alert: noop, confirm: () => false, prompt: () => null,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  scrollTo: noop,
  matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
  history: { pushState: noop, replaceState: noop },
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
vm.runInContext(appJs, ctx);
ctx.renderSingerCollection();

// 按拼音归类的期望分组（「肖」作姓氏读 xiāo → X）
const EXPECT = [
  ['肖战', 'X'], ['腾格尔', 'T'], ['張天賦', 'Z'],
  ['李幸倪', 'L'], ['Tank', 'T'],
];

console.log('=== 指定歌手的分组 ===');
let bad = 0;
for (const [name, exp] of EXPECT) {
  const got = ctx.getFL(name);
  const ok = got === exp;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name.padEnd(8) + '当前 ' + got + '  期望 ' + exp);
}

// 分组分布
const groups = {};
for (const s of ctx._allSingers) {
  const g = ctx.getFL(s.singer);
  (groups[g] = groups[g] || []).push(s.singer);
}
console.log();
console.log('=== 各字母分组人数 ===');
for (const g of Object.keys(groups).sort()) {
  console.log('  ' + g.padEnd(2) + String(groups[g].length).padStart(4) + ' 位');
}

// # 组内容
console.log();
console.log('=== # 号组（未识别首字）===');
if (groups['#'] && groups['#'].length) {
  console.log('  ' + groups['#'].join(' | '));
} else {
  console.log('  空 ✓');
}

// Z 组与 T 组的中文歌手抽样
for (const g of ['Z', 'T']) {
  const cn = (groups[g] || []).filter(n => /[一-鿿]/.test(n[0]));
  console.log();
  console.log('=== ' + g + ' 组中文歌手（' + cn.length + ' 位）===');
  console.log('  ' + cn.join(' | '));
}

process.exit(bad ? 1 : 0);
