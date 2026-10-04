// 全量检测 songDB + 歌单 中的夸克网盘分享链接有效性
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8')); // songDB 已拆分到 data.js
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = blocks.find(b => b.indexOf('renderSingerCollection') > -1) || blocks[0];
function fakeEl(){const t={_style:{}};return new Proxy(t,{get(tt,p){if(p==='style')return tt._style;if(p==='classList')return{add(){},remove(){},toggle(){},contains(){return false}};if(['addEventListener','removeEventListener','appendChild','removeChild','setAttribute','removeAttribute','scrollIntoView','focus','click','select','setSelectionRange','insertBefore'].includes(p))return function(){};if(['querySelectorAll','querySelector','getElementsByTagName'].includes(p))return function(){return [fakeEl()]};if(p==='children')return[];if(p==='parentNode'){tt._pn=tt._pn||fakeEl();return tt._pn;}return tt[p];},set(tt,p,v){tt[p]=v;return true;}});}
const docEls={};
global.document={getElementById(id){return docEls[id]||(docEls[id]=fakeEl());},querySelectorAll(){return[]},querySelector(){return fakeEl()},createElement(){return fakeEl()},addEventListener(){},removeEventListener(){},execCommand(){},getElementsByTagName(){return[fakeEl()]},body:fakeEl(),documentElement:fakeEl()};
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
global.window=global;global.addEventListener=function(){};global.removeEventListener=function(){};
global.matchMedia=function(){return {matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}};
global.scrollTo=function(){};global.scrollY=0;global.innerWidth=1280;global.innerHeight=800;global.location={href:'x'};global.open=function(){};global.navigator={userAgent:'node'};
eval(script);

// 收集所有 quark 链接及归属
const linkMap = new Map(); // link -> [{singer, name}]
for (const k of Object.keys(songDB)) {
  for (const sg of songDB[k]) {
    if (sg.quark && sg.quark.indexOf('pan.quark.cn/s/') !== -1) {
      const link = sg.quark.split('?')[0];
      if (!linkMap.has(link)) linkMap.set(link, []);
      linkMap.get(link).push({ singer: k, name: sg.name });
    }
  }
}
const links = [...linkMap.keys()];
console.log('歌曲 quark 链接(去重):', links.length);

// 歌手合集链接(index.html 内 singerCollection): type=collection
const colMap = new Map(); // link -> singer
{
  const cs2 = html.indexOf('var singerCollection = {');
  const ce2 = html.indexOf('};', cs2);
  let sc;
  eval('sc=' + html.slice(cs2, ce2 + 2).replace('var singerCollection = ', '').replace(/;$/, ''));
  for (const k of Object.keys(sc)) {
    const v = String(sc[k] || '');
    if (v.indexOf('pan.quark.cn/s/') !== -1) {
      const link = v.split('?')[0];
      colMap.set(link, k);
      if (!linkMap.has(link)) linkMap.set(link, []);
      linkMap.get(link).push({ singer: k, name: '(歌手合集入口)', coll: true });
    }
  }
  console.log('歌手合集 quark 链接:', colMap.size);
}
const collLinks = new Set(colMap.keys());

async function chk(id, tries) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch('https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://pan.quark.cn/' },
        body: JSON.stringify({ pwd_id: id, passcode: '' })
      });
      const j = await r.json().catch(() => null);
      if (!j) return { st: 'unknown', code: 'http' + r.status };
      if (j.code === 0) return { st: 'alive' };
      if (j.code === 41006 || j.code === 41008) return { st: 'dead', code: j.code, msg: j.message };
      if (j.code === 41009) return { st: 'locked', code: j.code, msg: j.message }; // 需要提取码=存在
      // 其他错误码: 限流等,重试
      if (j.code === 429 || r.status === 429 || (j.status && j.status >= 500)) { await new Promise(r => setTimeout(r, 1500 * (t + 1))); continue; }
      return { st: 'unknown', code: j.code, msg: j.message };
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000 * (t + 1)));
    }
  }
  return { st: 'unknown', code: 'retry_exhausted' };
}

(async function(){
  const CONC = 12;
  let idx = 0, alive = 0, dead = 0, locked = 0, unknown = 0;
  const deadList = [], unknownList = [];
  const started = Date.now();
  async function worker() {
    while (idx < links.length) {
      const link = links[idx++];
      const id = link.split('/s/')[1];
      const res = await chk(id, 3);
      if (res.st === 'alive') alive++;
      else if (res.st === 'locked') locked++;
      else if (res.st === 'dead') { dead++; deadList.push({ link, songs: linkMap.get(link) }); }
      else { unknown++; unknownList.push({ link, code: res.code, msg: res.msg, songs: linkMap.get(link) }); }
      if ((alive + dead + locked + unknown) % 500 === 0) {
        console.log(`进度 ${alive+dead+locked+unknown}/${links.length} | 有效 ${alive} | 失效 ${dead} | 需提取码 ${locked} | 未知 ${unknown} | ${Math.round((Date.now()-started)/1000)}s`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  fs.writeFileSync('dead-links.json', JSON.stringify({ checkedAt: new Date().toISOString(), total: links.length, alive, locked, dead, unknown, deadList, unknownList }, null, 1));
  // 生成易读 txt（歌曲死链与合集死链分开列出）
  const deadColl = deadList.filter(d => collLinks.has(d.link));
  const deadSongs = deadList.filter(d => !collLinks.has(d.link));
  const lines = [`夸克链接检测报告  ${new Date().toLocaleString('zh-CN')}`, `检测总数: ${links.length} (去重, 含${collLinks.size}个歌手合集入口)`, `有效: ${alive} | 需提取码: ${locked} | 失效: ${dead} (歌曲${deadSongs.length} 合集入口${deadColl.length}) | 未知: ${unknown}`, '', '=== 失效·歌曲链接 ==='];
  for (const d of deadSongs) {
    lines.push(d.link + '  <- ' + d.songs.map(s => s.singer + '《' + s.name + '》').join('; ').slice(0, 200));
  }
  lines.push('', '=== 失效·歌手合集入口 ===');
  for (const d of deadColl) lines.push(d.link + '  <- ' + d.songs.map(s => s.singer).join('; '));
  if (unknownList.length) {
    lines.push('', '=== 未知(网络/限流,建议复测) ===');
    for (const u of unknownList) lines.push(u.link + '  [' + u.code + ']  <- ' + u.songs.map(s => s.singer + '《' + s.name + '》').join('; ').slice(0, 200));
  }
  fs.writeFileSync('dead-links.txt', lines.join('\r\n'));
  console.log(`完成: 有效 ${alive} | 需提取码 ${locked} | 失效 ${dead} | 未知 ${unknown} | 耗时 ${Math.round((Date.now()-started)/1000)}s`);
  process.exit(0);
})();
