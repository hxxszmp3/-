// 打印可疑索引对应的歌手名与 URL
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const changed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_changed.json'), 'utf8'));
const susp = [1, 5, 10, 17, 29, 44, 49, 53, 60, 82, 91, 101, 107, 122, 130, 131, 132, 134, 136, 139, 140, 142, 163, 187, 195, 209, 211, 226, 249, 269, 275, 279];
susp.forEach(function (i) {
  const c = changed[i];
  if (!c) { console.log(i, '越界'); return; }
  console.log(i, '|', c.key, '|', c.action, '|', c.url);
});
console.log('--- 总变更数:', changed.length);
