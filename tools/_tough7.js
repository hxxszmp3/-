// 定制搜索词攻坚剩余 7 位
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');

const TARGETS = {
  '邓紫棋': ['G.E.M.', '邓紫棋', 'GEM'],
  '飞儿乐团': ['F.I.R', '飞儿乐团', 'FIR'],
  '周兴哲': ['Eric Chou', '周兴哲'],
  '叶倩文': ['叶倩文', '葉蒨文', 'Sally Yeh'],
  '리쌍（leessang）': ['Leessang', '리쌍'],
  '(G)I-DLE': ['(G)I-DLE', '(여자)아이들', 'GIDLE'],
  'IN-K-sadden': ['IN-K', 'sadden', 'IN-K sadden']
};

const NEH = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Referer': 'https://music.163.com/' };
const QQH = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Referer': 'https://y.qq.com/m/index.html' };

function getJson(url, headers) {
  return new Promise(function (resolve) {
    const req = https.get(url, { headers: headers, timeout: 15000 }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
  });
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function neteaseSearch(q) {
  const u = 'https://music.163.com/api/search/get/?type=100&limit=10&s=' + encodeURIComponent(q);
  const d = await getJson(u, NEH);
  return (d && d.result && d.result.artists) || [];
}
async function neteaseImg(id) {
  const d = await getJson('https://music.163.com/api/artist/' + id, NEH);
  const a = (d && d.artist) || {};
  return (a.img1v1Url || a.picUrl || '').split('?')[0];
}
async function qqSearch(q) {
  const u = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=10&p=1&w=' + encodeURIComponent(q);
  const d = await getJson(u, QQH);
  const list = (d && d.data && d.data.song && d.data.song.list) || [];
  const singers = [];
  list.forEach(function (s) { (s.singer || []).forEach(function (a) {
    if (!singers.some(function (x) { return x.mid === a.mid; })) singers.push({ name: a.name, mid: a.mid });
  }); });
  return singers;
}

(async function () {
  const out = {};
  for (const key of Object.keys(TARGETS)) {
    const rec = { queries: TARGETS[key], ne: null, qq: null };
    for (const q of TARGETS[key]) {
      const arts = await neteaseSearch(q);
      if (arts.length) {
        // 打印前几个供核对
        console.log('[' + key + '] NE "' + q + '" →', arts.slice(0, 3).map(function (a) { return a.name + '(' + a.id + ')'; }).join(', '));
        rec.ne = rec.ne || arts.slice(0, 3).map(function (a) { return { name: a.name, id: a.id }; });
      }
      await sleep(500);
    }
    for (const q of TARGETS[key]) {
      const sg = await qqSearch(q);
      if (sg.length) {
        console.log('[' + key + '] QQ "' + q + '" →', sg.slice(0, 3).map(function (a) { return a.name; }).join(', '));
        rec.qq = rec.qq || sg.slice(0, 3);
        break;
      }
      await sleep(500);
    }
    // 取 NE 第一个候选的 img
    if (rec.ne && rec.ne[0]) rec.neImg = await neteaseImg(rec.ne[0].id);
    if (rec.qq && rec.qq[0]) rec.qqImg = 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + rec.qq[0].mid + '.jpg';
    out[key] = rec;
    await sleep(500);
  }
  fs.writeFileSync(path.join(ROOT, 'tools', '_tough7.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log('已存 tools/_tough7.json');
})();
