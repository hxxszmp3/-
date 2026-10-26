// 解析每位歌手的官方人像（网易云 img1v1 优先，QQ 兜底）
// 用法: node _resolve_avatars.js [--sample N] [--only "名1,名2"] [--resume]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROGRESS = path.join(ROOT, 'tools', '_avatar_progress.json');
const RESULT = path.join(ROOT, 'tools', '_avatar_result.json');

const args = process.argv.slice(2);
function argVal(flag, dft) {
  const i = args.indexOf(flag);
  return (i !== -1 && args[i + 1] !== undefined) ? args[i + 1] : dft;
}
const SAMPLE = parseInt(argVal('--sample', '0'), 10) || 0;
const ONLY = argVal('--only', '');
const RESUME = args.indexOf('--resume') !== -1;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const QQH = ['Referer: https://y.qq.com/m/index.html', 'User-Agent: ' + UA];
const NEH = ['Referer: https://music.163.com', 'User-Agent: ' + UA];

function curl(url, headers) {
  try {
    return execFileSync('curl', ['-s', '--max-time', '25', '-H', headers[0], '-H', headers[1], url],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 });
  } catch (e) { return ''; }
}
function getJson(url, headers) {
  const raw = curl(url, headers).trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function norm(s) {
  return String(s).replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/gi, '').toLowerCase();
}
function pathOf(u) {
  return String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
}
const sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

// ---- 读取现有头像与合集 ----
function litSource(h, v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(h); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return h.slice(s, e + 1);
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cx = {}; require('vm').createContext(cx);
require('vm').runInContext('imgs = ' + litSource(html, 'singerImgs'), cx);
require('vm').runInContext('coll = ' + litSource(html, 'singerCollection'), cx);
require('vm').runInContext('meta = ' + litSource(html, 'singerMeta'), cx);
const imgs = cx.imgs, coll = cx.coll, meta = cx.meta;

const SKIP = ['歌单'];
let names = Object.keys(coll).filter(function (k) { return SKIP.indexOf(k) === -1; });
if (ONLY) {
  const set = {};
  ONLY.split(',').forEach(function (n) { set[n.trim()] = 1; });
  names = names.filter(function (n) { return set[n]; });
} else if (SAMPLE > 0) {
  names = names.slice(0, SAMPLE);
}

// ---- 网易云搜索：名字 → artist id ----
function neteaseSearch(name) {
  const tries = [name];
  const latin = (name.match(/[A-Za-z0-9]+/g) || []).join(' ').trim();
  if (latin && latin !== name) tries.push(latin);
  const parens = (name.match(/[（(]([^）)]*)[）)]/) || [])[1];
  if (parens) tries.push(parens.trim());
  const base = name.replace(/[（(].*$/, '').trim();
  if (base && base !== name) tries.push(base);

  for (let t = 0; t < tries.length; t++) {
    const q = encodeURIComponent(tries[t]);
    const d = getJson('https://music.163.com/api/search/get/web?s=' + q + '&type=100&limit=8&offset=0', NEH);
    if (!d || !d.result || !d.result.artists) continue;
    const arts = d.result.artists;
    const n = norm(name);
    const pick = arts.find(function (a) { return norm(a.name) === n; })
      || arts.find(function (a) { const an = norm(a.name); return an && n && (an === n || (an.length > 1 && n.indexOf(an) === 0)); })
      || null;
    if (pick) return pick;
    sleep(120);
  }
  return null;
}

function neteaseImg1v1(id) {
  const d = getJson('https://music.163.com/api/artist/' + id, NEH);
  const a = (d && d.artist) || {};
  return (a.img1v1Url || a.picUrl || '').split('?')[0];
}
function neteaseName(id) {
  const d = getJson('https://music.163.com/api/artist/' + id, NEH);
  return ((d && d.artist) || {}).name || '';
}

// ---- QQ：歌名搜索取歌手 mid → 官方头像 ----
function qqAvatar(name) {
  const d = getJson('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=10&p=1&w=' + encodeURIComponent(name), QQH);
  const songs = (d && d.data && d.data.song && d.data.song.list) || [];
  const n = norm(name);
  for (let i = 0; i < songs.length; i++) {
    const sg = songs[i].singer || [];
    for (let j = 0; j < sg.length; j++) {
      if (norm(sg[j].name) === n || norm(sg[j].name).indexOf(n) === 0) {
        return { name: sg[j].name, url: 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + sg[j].mid + '.jpg' };
      }
    }
  }
  return null;
}

const PLACEHOLDER_RE = [
  /6y-UleORITEDbvrOLV0Q8A/,
  /VnZiScyynLG7atLIZ2YPkw==\/18686200114669622/
];
function isPlaceholder(u) { return PLACEHOLDER_RE.some(function (r) { return r.test(u || ''); }); }

// ---- 主流程 ----
const progress = (RESUME && fs.existsSync(PROGRESS)) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
const result = (RESUME && fs.existsSync(RESULT)) ? JSON.parse(fs.readFileSync(RESULT, 'utf8')) : { resolved: {}, unchanged: {}, failed: {} };

let done = 0;
(async function () {
for (let i = 0; i < names.length; i++) {
  const key = names[i];
  done++;
  if (progress[key]) { process.stdout.write('  [' + done + '/' + names.length + '] ' + key + ' (缓存)\n'); continue; }

  const cur = imgs[key] || '';
  const curPath = pathOf(cur);
  let rec = { current: cur };

  // 已是 QQ 官方头像（T001）则保留
  if (/y\.gtimg\.cn\/music\/photo_new\/T001R/.test(cur)) {
    rec.action = 'keep-qq-official';
    result.unchanged[key] = rec;
    progress[key] = 1;
    process.stdout.write('  [' + done + '/' + names.length + '] ' + key + ' → 保留(QQ官方)\n');
    continue;
  }

  const art = neteaseSearch(key);
  if (!art) {
    const qq = qqAvatar(key);
    if (qq) { rec.action = 'qq'; rec.url = qq.url; rec.source = qq.name; result.resolved[key] = rec; }
    else { rec.action = 'unresolved'; result.failed[key] = rec; }
    progress[key] = 1;
    process.stdout.write('  [' + done + '/' + names.length + '] ' + key + ' → ' + (qq ? 'QQ' : '未解析') + '\n');
    continue;
  }

  const img = neteaseImg1v1(art.id);
  const netName = neteaseName(art.id);

  if (!img || isPlaceholder(img)) {
    const qq = qqAvatar(key);
    if (qq) { rec.action = 'qq'; rec.url = qq.url; rec.source = qq.name + '(网易云无图)'; result.resolved[key] = rec; }
    else { rec.action = 'unresolved'; rec.why = '网易云无有效图'; result.failed[key] = rec; }
  } else if (pathOf(img) === curPath) {
    rec.action = 'same'; rec.url = img + '?param=300y300'; rec.source = netName;
    result.unchanged[key] = rec;
  } else {
    rec.action = 'replace'; rec.url = img + '?param=300y300';
    rec.source = netName + ' (id=' + art.id + ')';
    rec.old = cur;
    result.resolved[key] = rec;
  }
  progress[key] = 1;
  process.stdout.write('  [' + done + '/' + names.length + '] ' + key + ' → ' + (rec.action || '?') + ' (' + (rec.source || '') + ')\n');

  fs.writeFileSync(PROGRESS, JSON.stringify(progress));
  fs.writeFileSync(RESULT, JSON.stringify(result, null, 1));
  await sleep(120);
}

fs.writeFileSync(PROGRESS, JSON.stringify(progress));
fs.writeFileSync(RESULT, JSON.stringify(result, null, 1));

console.log('');
console.log('=== 汇总 ===');
console.log('需替换:', Object.keys(result.resolved).length, '| 无变化:', Object.keys(result.unchanged).length, '| 未解析:', Object.keys(result.failed).length);
console.log('结果已存 _avatar_result.json');
})();
