// 查看解析结果概况
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_avatar_result.json'), 'utf8'));
const resolved = r.resolved || {};

const byAction = {};
const bySource = {};
const noUrl = [];
Object.keys(resolved).forEach(function (k) {
  const rec = resolved[k];
  byAction[rec.action] = (byAction[rec.action] || 0) + 1;
  if (rec.source) bySource[rec.source] = (bySource[rec.source] || 0) + 1;
  if (!rec.url) noUrl.push(k);
});
console.log('总数:', Object.keys(resolved).length);
console.log('按 action:', JSON.stringify(byAction));
console.log('按 source:', JSON.stringify(bySource));
console.log('无 url 的:', noUrl.length, noUrl.slice(0, 50).join(', '));

// 主机分布
const host = {};
Object.keys(resolved).forEach(function (k) {
  const u = resolved[k].url || '';
  let h = '(空)';
  try { h = new URL(u).host; } catch (e) { }
  host[h] = (host[h] || 0) + 1;
});
console.log('按 host:', JSON.stringify(host, null, 1));

// 抽样打印
const keys = Object.keys(resolved);
console.log('\n--- 抽样 25 条 ---');
for (let i = 0; i < Math.min(25, keys.length); i++) {
  const k = keys[i];
  console.log(k, '|', resolved[k].action, '|', resolved[k].url);
}
if (r.unresolved) {
  console.log('\nunresolved 字段:', Array.isArray(r.unresolved) ? r.unresolved.length : typeof r.unresolved);
}
