/**
 * 把 _avatar_result.json 里解析出的头像 URL 写回 index.html 的 singerImgs。
 * 用法：node tools/_apply_avatars.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_avatar_result.json'), 'utf8'));
const resolved = result.resolved || {};
if (!Object.keys(resolved).length) { console.log('没有待写入的头像'); process.exit(0); }

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

let applied = 0, skipped = 0;
for (const [name, rec] of Object.entries(resolved)) {
  const url = rec.url;
  if (!url) { skipped++; continue; }
  const e = esc(name);
  // 匹配 singerImgs 里该歌手当前条目（可能是我刚写入的空串）
  const re = new RegExp("('" + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*)'[^']*'");
  if (!re.test(html)) { console.log('  !! singerImgs 中未找到 ' + name); skipped++; continue; }
  html = html.replace(re, "$1'" + esc(url) + "'");
  applied++;
}
fs.writeFileSync(HP, html, 'utf8');
console.log('已写入头像: ' + applied + ' | 跳过: ' + skipped);
