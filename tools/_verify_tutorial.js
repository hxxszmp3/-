/**
 * 验证本次改动：
 *   1. 批量下载教程 = 3 张新图，顺序正确
 *   2. 各板块无结果时显示「没有想要的歌曲？点此反馈」，链接指向 QQ 群
 * 用法：node tools/_verify_tutorial.js
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:/Users/dellsq/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const SITE = 'file:///C:/Users/dellsq/Desktop/123/music-site/index.html';
const OUT = 'C:/Users/dellsq/Desktop/123/_shot';
const PORT = 9341;

const get = u => new Promise((res, rej) => {
  http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--window-size=1000,900',
    '--user-data-dir=' + path.join(OUT, '_pt'), 'about:blank'], { stdio: 'ignore' });

  let t = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json'));
      if (list && list.length) { t = list; break; }
    } catch (e) { /* 还没起来 */ }
    await sleep(500);
  }
  if (!t) { console.error('✗ 无法连接 Chrome'); chrome.kill(); process.exit(1); }

  const page = t.find(x => x.type === 'page') || t[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
  const send = (me, pa) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: me, params: pa || {} })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result && r.result.value; };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: SITE });
  await sleep(2500);

  let fails = 0;
  const check = (label, cond, extra) => {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + label + (extra ? '  ' + extra : ''));
    if (!cond) fails++;
  };

  console.log('=== 1. 批量下载教程 ===');
  const tut = await ev("(()=>{const o=document.getElementById('tutOverlay');const img=document.getElementById('tutImg');const dots=document.getElementById('tutDots');return{imgs:tutImgs.slice(),dots:dots.children.length,step:document.getElementById('tutStep').textContent};})()");
  check('教程图片共 3 张', tut.imgs.length === 3, tut.imgs.join(' , '));
  check('顺序为 1/2/3.png', JSON.stringify(tut.imgs) === JSON.stringify(['tutorial/1.png', 'tutorial/2.png', 'tutorial/3.png']));

  // 打开教程，遍历 3 张
  await ev("switchTab('batch')");
  await sleep(400);
  await ev("tutOpen()");
  await sleep(700);
  const shots = [];
  for (let i = 0; i < 3; i++) {
    await ev('tutGo(' + i + ')');
    await sleep(600);
    const info = await ev("(()=>{const img=document.getElementById('tutImg');return{src:img.getAttribute('src'),w:img.naturalWidth,h:img.naturalHeight,step:document.getElementById('tutStep').textContent};})()");
    shots.push(info);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, 'tut-' + (i + 1) + '.png'), Buffer.from(shot.data, 'base64'));
  }
  shots.forEach((s, i) => check('第' + (i + 1) + '张加载正常', s.w > 0, s.src + ' ' + s.w + '×' + s.h + ' | ' + s.step));
  const dotCount = await ev("document.getElementById('tutDots').children.length");
  check('圆点数量 = 3', dotCount === 3, '实际 ' + dotCount);
  await ev("tutClose()");
  await sleep(300);

  console.log('\n=== 2. 各板块无结果的反馈提示 ===');
  const QQ = await ev("QQ_GROUP_URL");
  console.log('    群链接: ' + QQ.slice(0, 45) + '...');

  // A) 单曲搜索
  await ev("switchTab('single')");
  await sleep(500);
  await ev("document.getElementById('searchInput').value='zzz不存在的歌zzz';doSearch();");
  await sleep(1200);
  let r = await ev("(()=>{const c=document.getElementById('resultsContainer');const h=c.querySelector('.no-result-hint');const a=h?h.querySelector('a.feedback-link'):null;return{has:!!h,text:h?h.innerText.replace(/\\s+/g,' ').trim():'',href:a?a.getAttribute('href'):'',linkText:a?a.innerText:''};})()");
  check('单曲搜索：无结果时显示提示', r.has, r.text);
  check('  「点此反馈」是链接', r.linkText === '点此反馈', '文字: ' + r.linkText);
  check('  链接指向 QQ 群', r.href && r.href.startsWith('https://qun.qq.com/'), r.href ? r.href.slice(0, 40) : '无');

  // B) 批量下载（全部未找到）
  await ev("switchTab('batch')");
  await sleep(500);
  await ev("document.getElementById('batchInput').value='zzz不存在的歌aaa\\nzzz不存在的歌bbb';batchSearch();");
  await sleep(1200);
  r = await ev("(()=>{const c=document.getElementById('batchResults');const h=c.querySelector('.no-result-hint');const a=h?h.querySelector('a.feedback-link'):null;return{has:!!h,text:h?h.innerText.replace(/\\s+/g,' ').trim():'',href:a?a.getAttribute('href'):''};})()");
  check('批量下载：无结果时显示提示', r.has, r.text);
  check('  链接指向 QQ 群', r.href && r.href.startsWith('https://qun.qq.com/'));

  // C) 批量下载（部分未找到）
  await ev("document.getElementById('batchInput').value='晴天 周杰伦\\nzzz不存在的歌ccc';batchSearch();");
  await sleep(1200);
  r = await ev("(()=>{const c=document.getElementById('batchResults');const h=c.querySelector('.no-result-hint');return{has:!!h,text:h?h.innerText.replace(/\\s+/g,' ').trim():''};})()");
  check('批量下载：部分未收录时也提示', r.has, r.text);

  // D) 歌单大厅
  await ev("switchTab('playlist')");
  await sleep(600);
  await ev("document.getElementById('plSearch').value='zzz不存在zzz';filterPlaylists();");
  await sleep(700);
  r = await ev("(()=>{const c=document.getElementById('playlistContainer');const h=c.querySelector('.no-result-hint');const a=h?h.querySelector('a.feedback-link'):null;return{has:!!h,text:h?h.innerText.replace(/\\s+/g,' ').trim():'',href:a?a.getAttribute('href'):''};})()");
  check('歌单大厅：无匹配时显示提示', r.has, r.text);
  check('  链接指向 QQ 群', r.href && r.href.startsWith('https://qun.qq.com/'));

  // E) 歌手合集
  await ev("switchTab('singer')");
  await sleep(600);
  await ev("document.getElementById('singerSearchIn').value='zzz不存在歌手zzz';searchSinger();");
  await sleep(700);
  r = await ev("(()=>{const m=document.getElementById('singerSearchMsg');const h=m.querySelector('.no-result-hint');const a=h?h.querySelector('a.feedback-link'):null;return{has:!!h,text:m.innerText.replace(/\\s+/g,' ').trim(),href:a?a.getAttribute('href'):''};})()");
  check('歌手合集：未找到歌手时显示提示', r.has, r.text);
  check('  链接指向 QQ 群', r.href && r.href.startsWith('https://qun.qq.com/'));

  // 截图：单曲搜索无结果
  await ev("switchTab('single')");
  await sleep(400);
  await ev("document.getElementById('searchInput').value='zzz不存在的歌zzz';doSearch();");
  await sleep(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'no-result-single.png'), Buffer.from(shot.data, 'base64'));

  ws.close(); chrome.kill(); await sleep(300);
  console.log('\n' + (fails ? '✗ ' + fails + ' 项失败' : '✓ 全部通过'));
  console.log('截图目录: ' + OUT);
  process.exit(fails ? 1 : 0);
})();
