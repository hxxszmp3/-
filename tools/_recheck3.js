// 复查：毕夏 / Ella陈嘉桦 / 柒玥 —— 列出 NE 搜索候选 + img，供人工挑
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const NEH = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' };
const QQH = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/m/index.html' };
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
const TARGETS = ['毕夏', 'Ella陈嘉桦', '柒玥', 'Ella', '陈嘉桦'];
(async function () {
  const out = {};
  for (const q of TARGETS) {
    const d = await getJson('https://music.163.com/api/search/get/?type=100&limit=6&s=' + encodeURIComponent(q), NEH);
    const arts = (d && d.result && d.result.artists) || [];
    const list = [];
    for (const a of arts) {
      const det = await getJson('https://music.163.com/api/artist/' + a.id, NEH);
      const ar = (det && det.artist) || {};
      list.push({ name: a.name, id: a.id, img: (ar.img1v1Url || '').split('?')[0] });
      await sleep(300);
    }
    out[q] = list;
    console.log('NE[' + q + ']', list.map(function (x) { return x.name + '(' + x.id + ')'; }).join(', '));
    await sleep(400);
  }
  // QQ 候选
  for (const q of ['毕夏', 'Ella', '陈嘉桦', '柒玥']) {
    const d = await getJson('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=8&p=1&w=' + encodeURIComponent(q), QQH);
    const songs = (d && d.data && d.data.song && d.data.song.list) || [];
    const seen = {};
    const sg = [];
    songs.forEach(function (s) { (s.singer || []).forEach(function (a) {
      if (!seen[a.mid]) { seen[a.mid] = 1; sg.push({ name: a.name, url: 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + a.mid + '.jpg' }); }
    }); });
    out['QQ:' + q] = sg.slice(0, 5);
    console.log('QQ[' + q + ']', sg.slice(0, 5).map(function (x) { return x.name; }).join(', '));
    await sleep(400);
  }
  fs.writeFileSync(path.join(ROOT, 'tools', '_recheck3.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log('已存 tools/_recheck3.json');
})();
