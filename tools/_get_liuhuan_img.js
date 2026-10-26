const https = require('https');
const H = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' };
const QQH = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/m/index.html' };
function g(url, headers) {
  return new Promise(function (r) {
    const q = https.get(url, { headers: headers, timeout: 15000 }, function (res) {
      let d = ''; res.on('data', function (c) { d += c; });
      res.on('end', function () { try { r(JSON.parse(d)); } catch (e) { r(null); } });
    });
    q.on('error', function () { r(null); });
    q.on('timeout', function () { q.destroy(); r(null); });
  });
}
(async function () {
  const ne = await g('https://music.163.com/api/search/get/?type=100&limit=5&s=' + encodeURIComponent('刘欢'), H);
  const arts = (ne && ne.result && ne.result.artists) || [];
  console.log('NE 候选:', arts.map(function (a) { return a.name + '(' + a.id + ')'; }).join(', '));
  for (const a of arts.slice(0, 3)) {
    const d = await g('https://music.163.com/api/artist/' + a.id, H);
    const ar = (d && d.artist) || {};
    console.log('  ', ar.name, '→', (ar.img1v1Url || '').split('?')[0], '| 专辑数:', ar.albumSize);
    await new Promise(function (r) { setTimeout(r, 500); });
  }
  const qq = await g('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=10&p=1&w=' + encodeURIComponent('刘欢'), QQH);
  const list = (qq && qq.data && qq.data.song && qq.data.song.list) || [];
  const seen = {};
  list.forEach(function (s) {
    (s.singer || []).forEach(function (a) {
      if (a.name.indexOf('刘欢') !== -1 && !seen[a.mid]) {
        seen[a.mid] = 1;
        console.log('QQ:', a.name, '→ https://y.gtimg.cn/music/photo_new/T001R300x300M000' + a.mid + '.jpg');
      }
    });
  });
})();
