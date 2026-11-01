/**
 * 在页面底部添加免责声明（主站 + 歌手页）。
 *
 * 关键设计（尽量简单，避免踩坑）：
 *   1. 样式**内联在免责声明区块里**（自带 <style>），不改 build-singers.js 的
 *      CSS 提取逻辑 —— 歌手页的公共 CSS 是从 singer/ 目录自提取的，
 *      在模板里额外拼接会每轮重复累积。
 *   2. 用 <div> 而不是 <ol>/<li> —— 歌手页有全局裸标签规则
 *      li{display:flex;...}，会把条款列表挤成竖排。
 *
 * 用法：node tools/_add_disclaimer.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const EMAIL = 'gg318364167@gmail.com';

const ITEMS = [
  ['资源来源', '本站收录的歌曲链接均来自网络公开分享渠道，由网友主动提供并在此集中索引。本站不存储、不转载、不上传任何音频文件本身，仅提供歌曲信息与网盘链接的查询跳转。'],
  ['版权归属', '所有作品的著作权及相关权利均归原作者、版权方及表演者所有，本站不改变、不转移任何权利归属。'],
  ['使用用途', '本站资源仅供个人学习、研究与欣赏等非商业用途使用，请勿用于商业发行、公开售卖、付费下载或其他盈利性用途。'],
  ['用户责任', '使用者应自行判断所获取资源的使用方式并承担相应责任，确保行为符合当地法律法规。'],
  ['侵权处理', '如您是原始权利人并认为站内资源侵犯合法权益，请通过下方邮箱联系我们，提供权利证明、具体资源链接及删除要求，我们将在核实后第一时间移除。'],
  ['免责声明', '本站为个人非商业项目，不对资源的合法性、准确性、完整性及可用性作任何保证，亦不对因使用本站产生的任何损失承担责任。网盘链接可能因分享方取消或服务商策略调整而失效，本站会尽力维护更新。'],
  ['隐私保护', '本站不使用账号体系，不收集您的个人信息，访问数据仅用于站点自身的统计与运行。'],
];

/* ---------- 样式：内联在区块内，跟着主题走 ---------- */
const CSS = [
  // 全局有 *{margin:0;padding:0} 重置（尤其奶油纸主题），关键布局属性用 !important 兜住
  '.disclaimer{margin-top:40px!important;padding:22px 20px!important;background:#f2f6f8;border-top:1px solid #dce8f0;border-radius:10px;color:#6a7a88;font-size:13px;line-height:1.8;box-sizing:border-box}',
  '.disclaimer *{box-sizing:border-box}',
  '.disclaimer-title{font-size:14px;font-weight:700;color:#4a5568;margin-bottom:10px!important}',
  '.disclaimer-lead{margin:0 0 12px!important}',
  '.disclaimer-item{margin:0 0 8px!important}',
  '.disclaimer-key{color:#4a5568;font-weight:600;margin-right:4px!important}',
  '.disclaimer-contact{margin:14px 0 0!important;padding:10px 12px!important;background:#fff;border:1px solid #dce8f0;border-radius:8px}',
  '.disclaimer-contact a{color:#6b9aae;font-weight:600;text-decoration:none}',
  '.disclaimer-contact a:hover{text-decoration:underline}',
  '.disclaimer-note{margin:10px 0 0!important;font-size:12px;color:#9aa8b4}',
  // 四套主题配色
  'body.dark .disclaimer{background:#1b2026;border-top-color:#333a42;color:#8898a4}',
  'body.dark .disclaimer-title,body.dark .disclaimer-key{color:#c8d0d8}',
  'body.dark .disclaimer-contact{background:#232930;border-color:#333a42}',
  'body.dark .disclaimer-contact a{color:#8cb0c0}',
  'body.dark .disclaimer-note{color:#6b7682}',
  'body.dark.theme-violet .disclaimer{background:rgba(30,27,58,.55);border-top-color:rgba(167,139,250,.25);color:#a5a0c8}',
  'body.dark.theme-violet .disclaimer-title,body.dark.theme-violet .disclaimer-key{color:#e4e0f5}',
  'body.dark.theme-violet .disclaimer-contact{background:rgba(45,40,80,.6);border-color:rgba(167,139,250,.25)}',
  'body.dark.theme-violet .disclaimer-contact a{color:#c4b5fd}',
  'body.dark.theme-violet .disclaimer-note{color:#8b85b0}',
  'body.theme-paper .disclaimer{background:#f7f1e6;border-top-color:#e0d5c2;color:#8a7d68}',
  'body.theme-paper .disclaimer-title,body.theme-paper .disclaimer-key{color:#5c5240}',
  'body.theme-paper .disclaimer-contact{background:#fdfaf3;border-color:#e0d5c2}',
  'body.theme-paper .disclaimer-contact a{color:#a88b5c}',
  'body.theme-paper .disclaimer-note{color:#9c9080}',
  // 底部版权行（主站复用已有 .site-footer/.footer-row；歌手页需自带结构样式）
  '.site-footer{margin-top:26px;padding:14px 16px 18px;border-top:1px solid #e3edf2;text-align:center}',
  '.site-footer .footer-row{max-width:none;margin:0;display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap}',
  '.site-footer-copy{color:#9aa8b4;font-size:13px}',
  '.site-footer-link{color:#6b9aae;font-size:13px;text-decoration:underline;text-underline-offset:3px}',
  '.site-footer-link:hover{opacity:.75}',
  'body.dark .site-footer-copy{color:#6b7682}',
  'body.dark .site-footer-link{color:#8cb0c0}',
  'body.dark.theme-violet .site-footer-copy{color:#8b85b0}',
  'body.dark.theme-violet .site-footer-link{color:#c4b5fd}',
  'body.theme-paper .site-footer-copy{color:#9c9080}',
  'body.theme-paper .site-footer-link{color:#a88b5c}',
].join('\n');

/* ---------- 区块（自带 style，主站与歌手页共用同一份） ---------- */
const DISCLAIMER_HTML = [
  '<div class="disclaimer" id="disclaimer">',
  '  <style>' + CSS + '</style>',
  '  <div class="disclaimer-title">📜 免责声明</div>',
  '  <p class="disclaimer-lead">本站是一个非商业性质的音乐资源索引与检索工具，仅提供资源的检索、聚合与跳转服务。访问本页即表示您已阅读并同意以下条款。</p>',
  ...ITEMS.map(([k, v], i) =>
    '  <p class="disclaimer-item"><span class="disclaimer-key">' + (i + 1) + '. ' + k + '</span>' + v + '</p>'),
  '  <p class="disclaimer-contact">侵权投诉 / 联系邮箱：<a href="mailto:' + EMAIL + '">' + EMAIL + '</a></p>',
  '  <p class="disclaimer-note">本声明可能随站点运营情况更新，恕不另行通知。再次访问本站即视为接受更新后的声明。</p>',
  '</div>',
  // 版权行：© 2026 + 免责声明链接 + 联系我们链接
  '<div class="site-footer">',
  '  <div class="footer-row" style="justify-content:center;align-items:center;gap:14px;flex-wrap:wrap">',
  '    <span class="site-footer-copy">&copy; 2026 MusicFind</span>',
  '    <a class="site-footer-link" href="#disclaimer">免责声明</a>',
  '    <a class="site-footer-link" href="mailto:' + EMAIL + '">联系我们</a>',
  '  </div>',
  '</div>',
].join('\n');

// ================= 主站 =================
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

if (html.indexOf('id="disclaimer"') === -1) {
  // 内容插到 </main> 之后（页面最底部）
  const mainEnd = html.indexOf('</main>');
  if (mainEnd === -1) { console.error('✗ 未找到 </main>'); process.exit(1); }
  html = html.slice(0, mainEnd + 7) + '\n' + DISCLAIMER_HTML + '\n' + html.slice(mainEnd + 7);

  // 删除顶部 📜 免责声明按钮（改为底部版权行里的「免责声明」链接）
  const oldBtn = /\s*<button class="icon-btn" onclick="showDisclaimer\(\)" title="免责声明">[^<]*<\/button>/;
  if (oldBtn.test(html)) {
    html = html.replace(oldBtn, '');
    console.log('  ✓ index.html：已删除顶部 📜 免责声明按钮');
  }

  fs.writeFileSync(HP, html, 'utf8');
  console.log('  ✓ index.html：免责声明已插入底部，📜 按钮改为滚动定位');
}

// ================= 歌手页 =================
const BP = path.join(ROOT, 'tools', 'build-singers.js');
let bs = fs.readFileSync(BP, 'utf8');

if (bs.indexOf('DISCLAIMER_HTML') === -1) {
  // 注入常量
  const p = bs.indexOf('\n');
  bs = bs.slice(0, p) + '\n' +
    'const DISCLAIMER_HTML = ' + JSON.stringify(DISCLAIMER_HTML) + ';\n' +
    bs.slice(p);

  // 内容插到 </body> 前（样式已在区块内，无需动 CSS 提取逻辑）
  bs = bs.replace(
    "'</body>\\n</html>\\n';",
    "    DISCLAIMER_HTML + '\\n</body>\\n</html>\\n';"
  );
  fs.writeFileSync(BP, bs, 'utf8');
  console.log('  ✓ build-singers.js：歌手页底部已加免责声明');
}

console.log('\n完成。');
