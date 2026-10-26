// 为问题歌手抓取 网易云 img1v1 与 QQ 头像 两个候选
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', '_fix_candidates.json');

const NAMES = [
  // 明确错误
  '丢火车乐队', 'A-LIN', '付豪', '布衣乐队', '柯柯柯啊', '河图', '王嘉尔', '窦靖童',
  '艾辰', '苏晗', '蔡依林', '高胜美', 'Avril Lavigne', '柒玥', '鞠婧祎',
  // 边界可疑
  'Ella陈嘉桦', '半吨兄弟', '周笔畅', '孙子涵', '艾热', '艾福杰尼', '蒋雪儿',
  '蔡国庆', '马旭东', '希林娜依高', '云朵', '邓寓君(等什么君)',
  // 404
  '毕夏', 'EXO&유재석'
];

const NEH = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': 'https://music.163.com/'
};
const QQH = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer': 'https://y.qq.com/m/index.html'
};

function getJson(url, headers) {
  return new Promise(function (resolve) {
    const req = https.get(url, { headers: headers, timeout: 15000 }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
  });
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function normName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '').replace(/\(.*?\)|（.*?）/g, '');
}
function latinPart(s) {
  const m = (s || '').match(/[A-Za-z][A-Za-z0-9 .\-&!]*/);
  return m ? m[0].trim() : '';
}

async function neteaseSearch(name) {
  const cands = [name];
  const lp = latinPart(name);
  if (lp && lp !== name) cands.push(lp);
  const inParen = (name.match(/[（(]([^）)]*)[）)]/) || [])[1];
  if (inParen) cands.push(inParen);
  const noParen = name.replace(/[（(].*?[）)]/g, '').trim();
  if (noParen && noParen !== name) cands.push(noParen);
  for (const c of cands) {
    const u = 'https://music.163.com/api/search/get/?type=100&limit=8&s=' + encodeURIComponent(c);
    const d = await getJson(u, NEH);
    const arts = (d && d.result && d.result.artists) || [];
    const target = normName(name);
    let hit = arts.find(function (a) { return normName(a.name) === target; });
    if (!hit) hit = arts.find(function (a) { return normName(a.name).indexOf(target) === 0 || target.indexOf(normName(a.name)) === 0; });
    if (hit) return hit;
    await sleep(600);
  }
  return null;
}

async function neteaseImg(id) {
  const d = await getJson('https://music.163.com/api/artist/' + id, NEH);
  if (d && d.artist) return d.artist.img1v1Url || '';
  return '';
}

async function qqAvatar(name) {
  const u = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=10&p=1&w=' + encodeURIComponent(name);
  const d = await getJson(u, QQH);
  const list = (d && d.data && d.data.song && d.data.song.list) || [];
  const target = normName(name);
  for (const s of list) {
    for (const ar of (s.singer || [])) {
      if (normName(ar.name) === target) {
        return 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + ar.mid + '.jpg';
      }
    }
  }
  for (const s of list) {
    for (const ar of (s.singer || [])) {
      const n = normName(ar.name);
      if (n && (n.indexOf(target) === 0 || target.indexOf(n) === 0)) {
        return 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + ar.mid + '.jpg';
      }
    }
  }
  return '';
}

(async function () {
  const out = {};
  for (const name of NAMES) {
    const rec = { name: name };
    const na = await neteaseSearch(name);
    if (na) {
      rec.neteaseId = na.id;
      rec.neteaseName = na.name;
      rec.neteaseImg = await neteaseImg(na.id);
    }
    await sleep(500);
    rec.qqImg = await qqAvatar(name);
    out[name] = rec;
    console.log(name, '| ne:', rec.neteaseImg ? 'OK' : '--', '| qq:', rec.qqImg ? 'OK' : '--',
      rec.neteaseName && rec.neteaseName !== name ? '(网易云命中: ' + rec.neteaseName + ')' : '');
    await sleep(700);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
  console.log('已存', OUT);
})();
