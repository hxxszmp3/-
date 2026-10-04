const fs = require('fs');
const SITE = 'C:/Users/dellsq/Desktop/123/music-site';

// ---------- HSL 工具 ----------
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hslToHex(h, s, l) { h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0'); return '#' + to(r) + to(g) + to(b); }

// 暖色系（红橙）保留色相，避免错误色变
function isWarm(h) { return h < 70 || h > 330; }
function tfViolet(hex) {
  const [r, g, b] = hexToRgb(hex); const [h, s, l] = rgbToHsl(r, g, b);
  if (isWarm(h)) return hex; // 红/橙警示色保留
  const s2 = s < 0.05 ? 0.10 : Math.min(0.82, s * 2.1 + 0.06);
  const l2 = l > 0.92 ? l : (l < 0.14 ? l : Math.min(0.93, l * 1.06));
  return hslToHex(258, s2, l2);
}
function tfPaper(hex) {
  const [r, g, b] = hexToRgb(hex); const [h, s, l] = rgbToHsl(r, g, b);
  if (isWarm(h)) return hex;
  if (l < 0.45) return hslToHex(42, 0.08, l); // 深色文字 → 暖炭色（Notion 风），不变青绿
  if (l > 0.93 && s < 0.25) return hslToHex(42, Math.min(0.12, s + 0.06), l); // 极浅背景 → 暖纸色
  const s2 = s < 0.06 ? Math.min(0.10, s + 0.04) : Math.min(0.55, s * 1.6 + 0.08);
  const l2 = l > 0.5 && s >= 0.06 ? l * 0.94 : l;
  return hslToHex(s < 0.06 ? 42 : 168, s2, l2);
}
function remapColors(decl, tf) {
  return decl
    .replace(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g, m => tf(m))
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g, (m, r, g, b, a) => {
      const hex = hslToHex(...rgbToHsl(+r, +g, +b));
      const nh = hexToRgb(tf(hex));
      return (a !== undefined ? 'rgba(' : 'rgb(') + nh[0] + ',' + nh[1] + ',' + nh[2] + (a !== undefined ? ',' + a + ')' : ')');
    });
}

// ---------- CSS 解析 ----------
function parseBlocks(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    // 跳过注释
    if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i); i = e < 0 ? css.length : e + 2; continue; }
    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const prelude = css.slice(i, brace).trim();
    // 找匹配的 }
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(brace + 1, j - 1);
    out.push({ prelude, body, start: i, end: j });
    i = j;
  }
  return out;
}
function isAt(p) { return p.startsWith('@'); }

function transform(css, tf, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, ''); // 先剥离注释，防止混入选择器
  const blocks = parseBlocks(css);
  const parts = [];
  for (const b of blocks) {
    if (isAt(b.prelude)) {
      if (b.prelude.startsWith('@keyframes') || b.prelude.startsWith('@font-face')) continue;
      if (b.prelude.startsWith('@media')) {
        const inner = transform(b.body, tf, scope);
        if (inner.trim()) parts.push(b.prelude + '{' + inner + '}');
      }
      continue;
    }
    if (/body\.dark/.test(b.prelude) !== scope.onlyDark) continue;
    const sel = b.prelude.split(',').map(s0 => {
      s0 = s0.trim();
      if (scope.onlyDark) return s0.replace(/body\.dark/g, 'body.dark.theme-violet');
      if (/^body\b/.test(s0)) return s0.replace(/^body\b/, 'body.theme-paper');
      if (/^html\b/.test(s0) && !/theme|dark/.test(s0)) return null; // html 规则不入补丁，避免污染其他主题
      if (/^body\b/.test(s0)) return s0.replace(/^body\b/, 'body.theme-paper');
      return 'body.theme-paper ' + s0;
    }).filter(Boolean).join(', ');
    if (!sel) continue;
    parts.push(sel + '{' + remapColors(b.body, tf) + '}');
  }
  return '\n' + parts.join('\n') + '\n';
}

// ---------- 生成 ----------
const html = fs.readFileSync(SITE + '/index.html', 'utf8');
const s = html.indexOf('<style>') + 7, e = html.indexOf('</style>');
let css = html.slice(s, e);
// 移除旧的补丁（幂等）
css = css.replace(/\/\*THEME_PATCH:violet\*\/[\s\S]*?\/\*END_PATCH\*\//g, '').replace(/\/\*THEME_PATCH:paper\*\/[\s\S]*?\/\*END_PATCH\*\//g, '');

const violetCSS = '\n/*THEME_PATCH:violet*/\n/* 极光紫 · 参考 Stripe / Linear 审美 */\n' + transform(css, tfViolet, { onlyDark: true }) + '/*END_PATCH*/\n';
const paperCSS = '\n/*THEME_PATCH:paper*/\n/* 奶油纸 · 参考 Notion / Apple 暖白极简审美 */\n' + transform(css, tfPaper, { onlyDark: false }) + '/*END_PATCH*/\n';

let newCss = css + violetCSS + paperCSS;
let out = html.slice(0, s) + newCss + html.slice(e);

// ---------- 替换主题切换 JS ----------
if (/function toggleDark\(\)/.test(out)) {
  const oldToggle = out.match(/function toggleDark\(\)\{[\s\S]*?\n\}\nfunction initDark\(\)\{[\s\S]*?\n\}/);
  if (!oldToggle) { console.log('FATAL: toggleDark/initDark 未匹配'); process.exit(1); }
  const newToggle = `var THEMES=[
  {id:'',      icon:'🌙', label:'夜'},
  {id:'dark',  icon:'🌗', label:'暗'},
  {id:'violet',icon:'💜', label:'紫'},
  {id:'paper', icon:'📄', label:'纸'}
];
function applyTheme(id){
  document.body.classList.toggle('dark', id==='dark'||id==='violet');
  document.body.classList.toggle('theme-violet', id==='violet');
  document.body.classList.toggle('theme-paper', id==='paper');
  var t=THEMES.find(function(x){return x.id===id;})||THEMES[0];
  var b=document.getElementById('darkToggle');
  if(b)b.innerHTML='<span class="fb-icon">'+t.icon+'</span>'+t.label;
}
function toggleTheme(){
  var cur=localStorage.getItem('siteTheme')||'';
  var idx=THEMES.findIndex(function(x){return x.id===cur;});
  if(idx<0)idx=0;
  var next=THEMES[(idx+1)%THEMES.length];
  localStorage.setItem('siteTheme',next.id);
  applyTheme(next.id);
}
function initDark(){
  var id=localStorage.getItem('siteTheme');
  if(id===null){ id=localStorage.getItem('darkMode')==='1'?'dark':''; }
  applyTheme(id);
}`;
  out = out.replace(oldToggle[0], newToggle);
  out = out.replace('id="darkToggle" onclick="toggleDark()" title="夜间/日间模式"', 'id="darkToggle" onclick="toggleTheme()" title="切换网站风格（循环：浅色/暗夜/极光紫/奶油纸）"');
} else {
  out = out.replace('onclick="toggleDark()"', 'onclick="toggleTheme()"');
}

fs.writeFileSync(SITE + '/index.html', out);
const vs = (violetCSS.length / 1024).toFixed(0), ps = (paperCSS.length / 1024).toFixed(0);
console.log('主题补丁已注入: violet ' + vs + 'KB, paper ' + ps + 'KB | 文件大小: ' + (out.length / 1024).toFixed(0) + 'KB');
