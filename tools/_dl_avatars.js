// 下载全部歌手头像到临时目录
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = 'C:/Users/dellsq/Desktop/123/_avaudit';
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const decl = html.match(/var\s+singerImgs\s*=\s*\{/);
const s = decl.index + decl[0].length - 1;
const e = html.indexOf('};', s);
const sb = {}; vm.createContext(sb);
vm.runInContext('imgs = ' + html.slice(s, e + 1), sb);
const imgs = sb.imgs;

const keys = Object.keys(imgs);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function ext(u) {
  const m = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.exec(u || '');
  return m ? '.' + m[1].toLowerCase() : '.jpg';
}

async function one(k, i) {
  const url = imgs[k];
  if (!url) return { k, ok: false, why: 'no-url' };
  const file = path.join(OUT, String(i).padStart(3, '0') + ext(url));
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': new URL(url).origin + '/' } });
    if (!r.ok) return { k, ok: false, why: 'http ' + r.status, file };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 300) return { k, ok: false, why: 'too small ' + buf.length, file };
    fs.writeFileSync(file, buf);
    return { k, ok: true, file, size: buf.length };
  } catch (err) {
    return { k, ok: false, why: err.message, file };
  }
}

(async function () {
  const results = [];
  const BATCH = 10;
  for (let i = 0; i < keys.length; i += BATCH) {
    const chunk = keys.slice(i, i + BATCH).map(function (k, j) { return one(k, i + j); });
    const rs = await Promise.all(chunk);
    rs.forEach(function (r) { results.push(r); });
    process.stdout.write('  已下载 ' + Math.min(i + BATCH, keys.length) + '/' + keys.length + '\r');
  }
  console.log('');
  const okList = results.filter(function (r) { return r.ok; });
  const badList = results.filter(function (r) { return !r.ok; });
  console.log('成功:', okList.length, '| 失败:', badList.length);
  if (badList.length) badList.forEach(function (r) { console.log('  ✗', r.k, '→', r.why); });
  fs.writeFileSync(path.join(OUT, '_map.json'), JSON.stringify(results.map(function (r) {
    return { key: r.k, file: r.ok ? path.basename(r.file) : '', ok: r.ok, why: r.why || '' };
  }), null, 1));
  console.log('映射已存 _map.json');
})();
