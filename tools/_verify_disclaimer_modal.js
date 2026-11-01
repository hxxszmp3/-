/**
 * 验证免责声明弹层：
 *   1. 默认不显示（单曲搜索界面也不出现）
 *   2. 点击底部「免责声明」链接后弹出
 *   3. 点击关闭按钮 / 遮罩后关闭
 * 用法：node tools/_verify_disclaimer_modal.js
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:/Users/dellsq/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const SITE = 'file:///C:/Users/dellsq/Desktop/123/music-site/index.html';
const SINGER = 'file:///C:/Users/dellsq/Desktop/123/music-site/singer/' + encodeURIComponent('李克勤') + '.html';
const OUT = 'C:/Users/dellsq/Desktop/123/_shot';
const PORT = 9338;

const get = u => new Promise((res, rej) => {
  http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--window-size=1000,900',
    '--user-data-dir=' + path.join(OUT, '_pv'), 'about:blank',
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

  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  let fails = 0;
  const check = (label, cond) => {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + label);
    if (!cond) fails++;
  };

  for (const [site, tag] of [[SITE, '主站'], [SINGER, '歌手页']]) {
    console.log('\n=== ' + tag + ' ===');
    await send('Page.navigate', { url: site });
    await sleep(2200);

    // 1) 默认隐藏
    let v = await evalJs("(()=>{const o=document.getElementById('disclaimerOverlay');" +
      "if(!o)return null;const s=getComputedStyle(o);" +
      "return{display:s.display,hasModal:!!o.querySelector('.disclaimer-modal')," +
      "inMain:!!document.querySelector('main #disclaimerOverlay')};})()");
    check('弹层元素存在', !!v);
    check('默认 display:none（不占页面空间）', v && v.display === 'none');
    check('不在 <main> 内（不随 tab 切换显隐）', v && v.inMain === false);
    check('含 .disclaimer-modal 内容', v && v.hasModal === true);

    // 2) 单曲搜索 tab 下也不出现
    await evalJs("switchTab('single')");
    await sleep(600);
    v = await evalJs("(()=>{const o=document.getElementById('disclaimerOverlay');" +
      "return{display:getComputedStyle(o).display," +
      "visible:o.getBoundingClientRect().height>0};})()");
    check('单曲搜索 tab 下仍隐藏', v && v.display === 'none' && !v.visible);

    // 3) 点击「免责声明」链接 → 弹出
    await evalJs("switchTab('singer')");   // 切回歌手合集 tab，避免搜索区重建干扰
    await sleep(400);
    await evalJs("document.querySelector('[data-open-disclaimer]').click()");
    await sleep(500);
    v = await evalJs("(()=>{const o=document.getElementById('disclaimerOverlay');" +
      "const m=o.querySelector('.disclaimer-modal');const r=m.getBoundingClientRect();" +
      "return{display:getComputedStyle(o).display,modalH:Math.round(r.height)," +
      "modalW:Math.round(r.width),items:m.querySelectorAll('.disclaimer-item').length};})()");
    check('点击后弹出', v && v.display === 'flex');
    check('弹窗内容完整（7 条 + 邮箱）', v && v.items === 7);
    console.log('    弹窗尺寸: ' + (v ? v.modalW + '×' + v.modalH : '-'));

    // 4) 截图
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, tag + '-modal.png'), Buffer.from(shot.data, 'base64'));

    // 5) 点击关闭按钮 → 关闭
    await evalJs("document.querySelector('.disclaimer-close').click()");
    await sleep(400);
    v = await evalJs("getComputedStyle(document.getElementById('disclaimerOverlay')).display");
    check('点关闭按钮后关闭', v === 'none');

    // 6) 点遮罩关闭
    await evalJs("document.querySelector('[data-open-disclaimer]').click()");
    await sleep(400);
    await evalJs("(()=>{const o=document.getElementById('disclaimerOverlay');" +
      "o.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()");
    await sleep(400);
    v = await evalJs("getComputedStyle(document.getElementById('disclaimerOverlay')).display");
    check('点遮罩后关闭', v === 'none');
  }

  ws.close();
  chrome.kill();
  await sleep(300);
  console.log('\n' + (fails ? '✗ ' + fails + ' 项失败' : '✓ 全部通过'));
  console.log('截图目录: ' + OUT);
  process.exit(fails ? 1 : 0);
})();
