/**
 * 验证新歌手：搜索命中 / 别名 / 目录位置 / 合集链接
 * 用法：node tools/_verify_new3.js
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

let fails = 0;
const check = (label, cond, extra) => {
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + label + (extra ? '  ' + extra : ''));
  if (!cond) fails++;
};

console.log('=== 单曲搜索命中 ===');
const m = ctx._matchQuery;
[['张震岳', '主名'], ['阿岳', '别名'], ['苏芮', '主名'], ['Julie Su', '英文别名'], ['刘文正', '主名'], ['Steven Liu', '英文别名'],
 ['时代少年团', '主名'], ['TNT', '英文别名'], ['Teens in Times', '全称别名'], ['MC Cheung', '英文别名(带空格)'], ['MC 张天赋', '带空格别名'],
 ['跳楼机', '歌名'], ['少年时代', '歌名'], ['登顶', '歌名']].forEach(([q, label]) => {
  const r = m(q);
  const singers = [...new Set(r.map(x => x.singer))].slice(0, 2).join(', ');
  check('「' + q + '」(' + label + ')', r.length > 0, r.length + ' 条 → ' + (singers || '无'));
});

console.log('\n=== 合集板块搜索 ===');
ctx.renderSingerCollection();
['LBI利比', '时柏尘', 'LBI', '时代少年团', 'TNT', 'Teens in Times'].forEach(q => {
  cap['singerSearchIn'] = fakeEl('singerSearchIn'); cap['singerSearchIn'].value = q;
  cap['singerSearchMsg'] = fakeEl('singerSearchMsg');
  try {
    ctx.searchSinger();
    const msg = cap['singerSearchMsg'].textContent || '';
    check('「' + q + '」定位', !msg, msg);
  } catch (e) { check('「' + q + '」定位', false, e.message); }
});

console.log('\n=== 目录位置与分组 ===');
const all = ctx._allSingers.map(x => x.singer);
[['罗志祥', 'L'], ['TOP登陆少年', 'T']].forEach(([n, g]) => {
  const i = all.indexOf(n);
  const got = i >= 0 ? ctx.getFL(n) : '?';
  check(n + ' 在目录中（第 ' + (i + 1) + ' 位，分组 ' + got + '）', i >= 0 && got === g,
    all.slice(Math.max(0, i - 1), i + 2).join(' | '));
});

console.log('\n=== 静态页与链接 ===');
['罗志祥', 'TOP登陆少年'].forEach(n => {
  const f = path.join(ROOT, 'singer', n + '.html');
  const ok = fs.existsSync(f);
  let cnt = 0, hasQuark = false;
  if (ok) {
    const h = fs.readFileSync(f, 'utf8');
    cnt = (h.match(/class="sn"/g) || []).length;
    hasQuark = h.includes('pan.quark.cn');
  }
  const songs = (ctx.songDB[n] || []).length;
  check(n + ' 静态页', ok && cnt === songs, cnt + '/' + songs + ' 首' + (hasQuark ? ' | 含夸克链接' : ''));
});

console.log('\n' + (fails ? '✗ ' + fails + ' 项失败' : '✓ 全部通过'));
process.exit(fails ? 1 : 0);
