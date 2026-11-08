/**
 * 校验本批原始数据：链接格式 / 批内重复 / 与现有库冲突 / 组内重名
 * 用法：node tools/_check_raw3.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const FILES = [['_raw_lzx2.txt', '罗志祥'], ['_raw_top.txt', 'TOP登陆少年组合']];

// 现有库的全部 quark 链接
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), cx);
const existing = new Set();
for (const k of Object.keys(cx.songDB)) {
  for (const s of cx.songDB[k]) if (s.quark) existing.add(s.quark);
}

const URL_RE = /^https:\/\/pan\.quark\.cn\/s\/[a-z0-9]+$/;

console.log('=== 原始数据校验 ===');
let total = 0;
let problems = 0;

for (const [f, prefix] of FILES) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8')
    .split(/\r?\n/).filter(l => l.trim());
  let bad = 0, dup = 0;
  const seen = new Set(), names = new Set();

  for (let i = 0; i < lines.length; i += 2) {
    const t = lines[i].trim(), u = (lines[i + 1] || '').trim();
    if (!URL_RE.test(u)) { bad++; console.log('   链接异常: ' + t + ' → ' + u); }
    if (seen.has(u)) { dup++; console.log('   批内重复: ' + t); }
    seen.add(u);
    if (existing.has(u)) { console.log('   ⚠ 与现有库重复: ' + t); problems++; }

    let n = t.replace(/\.mp3$/i, '');
    if (n.startsWith(prefix + ' - ')) n = n.slice(prefix.length + 3);
    if (names.has(n)) { console.log('   组内重名: ' + n); problems++; }
    names.add(n);
  }

  const n = lines.length / 2;
  total += n;
  if (bad || dup) problems++;
  console.log('  ' + (bad || dup ? '✗' : '✓') + ' ' + f.padEnd(16) +
    ' 共 ' + String(n).padStart(3) + ' 首 | 链接异常 ' + bad + ' | 批内重复 ' + dup +
    ' | 唯一链接 ' + seen.size);
}

console.log('\n本批合计 ' + total + ' 首');
process.exit(problems ? 1 : 0);
