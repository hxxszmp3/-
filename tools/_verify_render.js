/**
 * 首页歌手合集板块渲染验证：真实调用页面的 singerRowHTML / 排序逻辑，
 * 检查 11 位新歌手在 A-Z 目录中的实际输出（链接、头像、按钮）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...idx.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appJs = scripts.find(s => s.includes('_matchQuery'));
if (!appJs) { console.error('✗ 未找到主脚本'); process.exit(1); }

const noop = () => {};
const captured = {};
/** escHtml 依赖真实 DOM 的 textContent → innerHTML 转义，这里等价实现 */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const fakeEl = (id) => new Proxy({
  id, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  value: '', innerHTML: '', textContent: '', children: [], dataset: {},
  addEventListener: noop, appendChild: noop, removeChild: noop,
  querySelector: () => null, querySelectorAll: () => [],
  getAttribute: () => null, setAttribute: noop, focus: noop, remove: noop,
  scrollTo: noop,
}, {
  get: (t, k) => {
    // textContent 写入 → innerHTML 读出，模拟浏览器的 HTML 转义
    if (k === 'innerHTML' && typeof t.__text === 'string') return escapeHtml(t.__text);
    return k in t ? t[k] : undefined;
  },
  set: (t, k, v) => {
    if (k === 'textContent') t.__text = v;
    t[k] = v; return true;
  },
});

const doc = {
  getElementById: (id) => { if (!captured[id]) captured[id] = fakeEl(id); return captured[id]; },
  querySelector: () => fakeEl(''),
  querySelectorAll: () => [],
  createElement: () => fakeEl(''),
  body: { classList: { add: noop, remove: noop, toggle: noop } },
  addEventListener: noop,
};

const ctx = {
  document: doc, window: {}, console,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  setTimeout, clearTimeout, setInterval, clearInterval,
  location: { href: 'https://www.hxxsz666.vip/' },
  navigator: { userAgent: 'node' },
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

// 触发歌手合集渲染
ctx.renderSingerCollection();

// 首页 A-Z 目录是分页的（每页 10 位），需要遍历全部页才能覆盖所有歌手
let allHtml = '';
const totalPages = ctx._singerPages ? ctx._singerPages.length : 1;
for (let p = 0; p < totalPages; p++) {
  ctx.gotoSingerPage(p);
  const g = captured['singerGrid'];
  if (g) allHtml += g.innerHTML;
}
const grid = captured['singerGrid'];
const html = allHtml;

const NEW = ['孙楠', '杨坤', '汪峰', '肖战', '田震', '韩磊', '腾格尔', '刘宇宁', '邓丽欣', '杨千嬅', '李克勤'];

console.log('=== 歌手合集板块渲染验证 ===');
console.log('渲染出的 HTML 长度: ' + html.length + ' 字节');
console.log('渲染出的歌手行数: ' + (html.match(/class="singer-row"/g) || []).length);

let bad = 0;
for (const name of NEW) {
  const rowRe = new RegExp('<div class="singer-row" id="singer-row-' +
    encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '">([\\s\\S]*?)</div></div>');
  const m = rowRe.exec(html);
  if (!m) { console.log('  ✗ ' + name + ' 未出现在渲染结果中'); bad++; continue; }
  const row = m[1];
  const hasImg = /background-image:url\([^)]*music\.126\.net/.test(row);
  const quark = /class="singer-row-btn" href="([^"]+)"/.exec(row);
  const baidu = /class="singer-row-btn baidu" href="([^"]+)"/.exec(row);
  const hasName = row.indexOf('>' + name + '<') !== -1;
  const ok = hasImg && quark && baidu && hasName;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name.padEnd(4) +
    ' | 名字' + (hasName ? '✓' : '✗') +
    ' | 头像' + (hasImg ? '✓' : '✗') +
    ' | 夸克' + (quark ? quark[1].slice(0, 34) : '✗') +
    ' | 百度' + (baidu ? '✓' : '✗'));
}

// 校验排序：11 位应按热度插在正确位置
const order = [...html.matchAll(/id="singer-row-([^"]+)"/g)].map(m => decodeURIComponent(m[1]));
const idxOf = n => order.indexOf(n);
console.log('\n=== A-Z 目录位置（按首字母+热度排序）===');
for (const n of NEW) {
  const i = idxOf(n);
  const near = order.slice(Math.max(0, i - 1), i + 2).join(' | ');
  console.log('  ' + (i >= 0 ? '✓' : '✗') + ' ' + n.padEnd(4) + ' 第' + (i + 1) + '位  ' + near);
}

// 校验口径：这 11 位歌手已从「纯合集」升级为「合集+单曲」，
// 因此应当有 songDB 条目、有静态页、进 sitemap。
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), cx);
console.log('\n=== 合集+单曲口径校验 ===');
for (const n of NEW) {
  const hasSongs = cx.songDB[n] && cx.songDB[n].length > 0;
  const inSm = sm.indexOf(encodeURIComponent(n)) !== -1;
  const hasPage = fs.existsSync(path.join(ROOT, 'singer', n + '.html'));
  const ok = hasSongs && inSm && hasPage;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + n.padEnd(4) +
    ' | 单曲 ' + (cx.songDB[n] ? cx.songDB[n].length + ' 首' : '无') +
    ' | sitemap ' + (inSm ? '有' : '缺') +
    ' | 静态页 ' + (hasPage ? '有' : '缺'));
}

console.log('\n结果: ' + (bad ? bad + ' 项异常' : '全部通过 ✓'));
process.exit(bad ? 1 : 0);
