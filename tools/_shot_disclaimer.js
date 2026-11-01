/**
 * 用 Chrome DevTools Protocol 截取免责声明区域，验证渲染效果。
 * 用法：node tools/_shot_disclaimer.js
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:/Users/dellsq/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const SITE = 'file:///C:/Users/dellsq/Desktop/123/music-site/index.html';
const SINGER = 'file:///C:/Users/dellsq/Desktop/123/music-site/singer/' +
  encodeURIComponent('李克勤') + '.html';
const OUT = 'C:/Users/dellsq/Desktop/123/_shot';
const PORT = 9334;

const THEMES = [
  { id: '', label: '浅色' },
  { id: 'dark', label: '暗夜' },
  { id: 'violet', label: '极光紫' },
  { id: 'paper', label: '奶油纸' },
];

const get = (url) => new Promise((res, rej) => {
  http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--window-size=1000,900',
    '--user-data-dir=' + path.join(OUT, '_profile'), 'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 30; i++) {
    try { targets = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json')); break; }
    catch (e) { await sleep(500); }
  }
  if (!targets) { console.error('✗ 无法连接 Chrome'); chrome.kill(); process.exit(1); }

  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise(res => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  for (const theme of THEMES) {
    for (const [site, tag] of [[SITE, 'main'], [SINGER, 'singer']]) {
      await send('Page.navigate', { url: site });
      await sleep(1500);
      await send('Runtime.evaluate', {
        expression: "localStorage.setItem('siteTheme','" + theme.id + "');location.reload();",
      });
      await sleep(1800);

      const box = await send('Runtime.evaluate', {
        expression: "(() => { const el=document.getElementById('disclaimer');" +
          " if(!el) return null; const r=el.getBoundingClientRect();" +
          " const items=[...el.querySelectorAll('.disclaimer-item')];" +
          " const it=items[0]; const ir=it?it.getBoundingClientRect():null;" +
          " return {x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height," +
          "  bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color," +
          "  itemH: ir?Math.round(ir.height):0, itemW: ir?Math.round(ir.width):0," +
          "  count:items.length}; })()",
        returnByValue: true,
      });
      const v = box.result && box.result.value;
      if (!v) { console.log('  ✗ ' + theme.label + '/' + tag + ': 未找到'); continue; }

      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: v.x, y: v.y, width: v.w, height: Math.min(v.h, 900), scale: 1 },
        captureBeyondViewport: true,
      });
      const file = path.join(OUT, theme.id || 'light', tag + '.png');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log('  ✓ ' + theme.label.padEnd(6) + '/' + tag.padEnd(6) +
        ' ' + String(Math.round(v.w)).padStart(4) + '×' + String(Math.round(v.h)).padStart(4) +
        ' | 条目 ' + v.count + ' 行高 ' + v.itemH + 'px | 背景 ' + v.bg);
    }
  }

  ws.close();
  chrome.kill();
  await sleep(300);
  console.log('\n截图目录: ' + OUT);
})();
