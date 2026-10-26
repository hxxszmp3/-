// 为毕夏多源抓取候选头像
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', '_bixia_cands.json');

const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
const NEH = Object.assign({ 'Referer': 'https://music.163.com/' }, H);
const QQH = Object.assign({ 'Referer': 'https://y.qq.com/m/index.html' }, H);

function get(url, headers, asJson) {
  return new Promise(function (resolve) {
    const req = https.get(url, { headers: headers, timeout: 15000 }, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        if (asJson === false) return resolve(d);
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
  });
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  const out = { candidates: [] };

  // ---- 1. QQ 歌曲搜索：收集所有名为毕夏的歌手 mid ----
  const qq = await get('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&t=0&n=30&p=1&w=' + encodeURIComponent('毕夏'), QQH);
  const songs = (qq && qq.data && qq.data.song && qq.data.song.list) || [];
  const mids = {};
  songs.forEach(function (s) {
    (s.singer || []).forEach(function (a) {
      if (a.name && a.name.indexOf('毕夏') !== -1 && !mids[a.mid]) {
        mids[a.mid] = a.name;
        out.candidates.push({ src: 'QQ-search', name: a.name, mid: a.mid, url: 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + a.mid + '.jpg' });
      }
    });
  });
  console.log('QQ 搜索命中 mid:', Object.keys(mids).length, JSON.stringify(mids));

  // ---- 2. QQ 歌手详情 API（取 SingerPmid / 头像）----
  for (const mid of Object.keys(mids)) {
    const body = JSON.stringify({
      comm: { ct: 24, cv: 0 },
      req: { module: 'music.web_singer_info_svr', method: 'get_singer_info', param: { singermid: mid } }
    });
    const d = await new Promise(function (resolve) {
      const req = https.request('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, QQH)
      }, function (res) {
        let t = ''; res.on('data', function (c) { t += c; }); res.on('end', function () { try { resolve(JSON.parse(t)); } catch (e) { resolve(null); } });
      });
      req.on('error', function () { resolve(null); });
      req.write(body); req.end();
    });
    const info = d && d.req && d.req.data;
    if (info) {
      const pm = info.singer_pmid || info.pmid || '';
      if (pm) out.candidates.push({ src: 'QQ-pmid', name: info.singer_name || '', mid: pm, url: 'https://y.gtimg.cn/music/photo_new/T001R300x300M000' + pm + '.jpg' });
      if (info.singer_pic) out.candidates.push({ src: 'QQ-pic', name: info.singer_name || '', url: info.singer_pic.replace('/800x800', '/300x300') });
      console.log('QQ detail', mid, '→ name:', info.singer_name, 'pmid:', pm, 'pic:', (info.singer_pic || '').slice(0, 60));
    } else {
      console.log('QQ detail 无返回:', mid);
    }
    await sleep(400);
  }

  // ---- 3. 网易云：其他同名 artist 候选 + 886208 的专辑封面 ----
  const ne = await get('https://music.163.com/api/search/get/?type=100&limit=8&s=' + encodeURIComponent('毕夏'), NEH);
  const arts = (ne && ne.result && ne.result.artists) || [];
  for (const a of arts) {
    if (a.name.indexOf('毕夏') === -1) continue;
    const det = await get('https://music.163.com/api/artist/' + a.id, NEH);
    const ar = (det && det.artist) || {};
    const img = (ar.img1v1Url || ar.picUrl || '').split('?')[0];
    if (img) out.candidates.push({ src: 'NE-artist', name: ar.name, id: a.id, url: img });
    console.log('NE', a.id, ar.name, '→', img.slice(-40), 'albums:', (ar.albumSize || '?'));
    await sleep(350);
  }

  // 886208 的专辑列表 → 封面图（常含本人写真）
  const alb = await get('https://music.163.com/api/artist/albums/886208?limit=30&offset=0', NEH);
  const albums = (alb && alb.hotAlbums) || (alb && alb.albums) || [];
  albums.slice(0, 12).forEach(function (x) {
    if (x.picUrl || x.blurPicUrl) out.candidates.push({ src: 'NE-album', name: x.name, url: ((x.picUrl || x.blurPicUrl) + '').split('?')[0] });
  });
  console.log('NE 专辑数:', albums.length);

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
  console.log('候选总数:', out.candidates.length, '已存', OUT);
})();
