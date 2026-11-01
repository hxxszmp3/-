/**
 * 从 _add_disclaimer.js 导出最新的 DISCLAIMER_HTML / CSS，
 * 写入 build-singers.js 的常量（歌手页用）。
 * 用法：node tools/_sync_disclaimer.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 读取生成脚本，截取到「主站」段之前（只含常量定义）
const src = fs.readFileSync(path.join(ROOT, 'tools', '_add_disclaimer.js'), 'utf8');
const head = src.slice(0, src.indexOf('// ================= 主站'));

// 沙箱里求值（const 声明不会挂到 context，需显式导出）
const vm = require('vm');
const ctx = { module: { exports: {} }, require, console, __dirname: path.join(ROOT, 'tools'), __filename: path.join(ROOT, 'tools', '_add_disclaimer.js') };
vm.createContext(ctx);
vm.runInContext(head + '\n;globalThis.__OUT = { HTML: DISCLAIMER_HTML, CSS: CSS };', ctx);
const HTML = ctx.__OUT.HTML;
const CSS = ctx.__OUT.CSS;

if (!HTML || !CSS) { console.error('✗ 未能取到常量'); process.exit(1); }

// 歌手页：主站 CSS 基础上补 .site-footer / .footer-row 结构样式
const SINGER_CSS = CSS;

const BP = path.join(ROOT, 'tools', 'build-singers.js');
let bs = fs.readFileSync(BP, 'utf8');

function setConst(src, name, value) {
  const re = new RegExp('const ' + name + ' = "(?:[^"\\\\]|\\\\.)*";');
  if (re.test(src)) {
    return src.replace(re, 'const ' + name + ' = ' + JSON.stringify(value) + ';');
  }
  return src.replace('const DISCLAIMER_HTML =',
    'const ' + name + ' = ' + JSON.stringify(value) + ';\nconst DISCLAIMER_HTML =');
}

bs = setConst(bs, 'DISCLAIMER_HTML', HTML);
bs = setConst(bs, 'DISCLAIMER_CSS', SINGER_CSS);
fs.writeFileSync(BP, bs, 'utf8');

console.log('  ✓ build-singers.js 常量已同步');
console.log('    HTML 含 site-footer: ' + /site-footer/.test(HTML));
console.log('    CSS 含 footer-row  : ' + /footer-row/.test(SINGER_CSS));
console.log('    HTML 长度: ' + HTML.length + ' | CSS 长度: ' + SINGER_CSS.length);
