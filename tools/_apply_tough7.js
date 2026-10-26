// 补取正确 ID 的头像并应用 7 位
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');

const NEH = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' };
function getJson(url) {
  return new Promise(function (resolve) {
    const req = https.get(url, { headers: NEH, timeout: 15000 }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
  });
}

const FINAL = [
  { key: '邓紫棋', id: '7763', name: 'G.E.M.邓紫棋' },
  { key: '飞儿乐团', id: '11562', name: 'F.I.R.' },
  { key: '周兴哲', id: '980025', name: '周兴哲' },
  { key: '叶倩文', id: '10209', name: '叶蒨文' },
  { key: '리쌍（leessang）', id: '127089', name: 'Leessang' },
  { key: '(G)I-DLE', id: '14055085', name: 'i-dle' },
  { key: 'IN-K-sadden', id: '37584083', name: 'IN-K' }
];

(async function () {
  const P = path.join(ROOT, 'index.html');
  let src = fs.readFileSync(P, 'utf8');
  const decl = src.match(/var\s+singerImgs\s*=\s*\{/);
  const start = decl.index + decl[0].length - 1;
  const end = src.indexOf('};', start);
  let block = src.slice(start, end + 1);

  const changed = [];
  for (const t of FINAL) {
    const d = await getJson('https://music.163.com/api/artist/' + t.id);
    const a = (d && d.artist) || {};
    const url = (a.img1v1Url || a.picUrl || '').split('?')[0];
    if (!url) { console.log('  ✗ 无图:', t.key, '(网易云返回:', (a.name || '?') + ')'); continue; }
    const re = new RegExp("('" + t.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*')([^']*)(')");
    if (!re.test(block)) { console.log('  ✗ 块内无键:', t.key); continue; }
    block = block.replace(re, '$1' + url + '$3');
    changed.push({ key: t.key, url: url, action: 'tough-ne', source: a.name + ' (id=' + t.id + ')' });
    console.log('  ✓', t.key, '←', a.name, '|', url);
    await new Promise(function (r) { setTimeout(r, 600); });
  }

  src = src.slice(0, start) + block + src.slice(end + 1);
  fs.writeFileSync(P, src, 'utf8');
  console.log('应用:', changed.length, '/', FINAL.length);

  // 校验
  const html = fs.readFileSync(P, 'utf8');
  const d2 = html.match(/var\s+singerImgs\s*=\s*\{/);
  const s2 = d2.index + d2[0].length - 1;
  const e2 = html.indexOf('};', s2);
  const cx = {}; vm.createContext(cx);
  vm.runInContext('imgs = ' + html.slice(s2, e2 + 1), cx);
  let bad = 0;
  changed.forEach(function (c) { if (cx.imgs[c.key] !== c.url) { console.log('  ✗ 未生效:', c.key); bad++; } });
  console.log('未生效:', bad);
  fs.appendFileSync(path.join(ROOT, 'tools', '_changed.json'), '\n/* tough7 */\n' + JSON.stringify(changed, null, 1), 'utf8');
})();
