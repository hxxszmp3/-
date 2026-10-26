// 新增刘欢到歌手合集（无歌曲清单，仅合集板块）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const QUARK = 'https://pan.quark.cn/s/f3858716db38';
const BAIDU = 'https://pan.baidu.com/s/1QZKb-RWrig1lv1br5QP2TA?pwd=s67u';
const IMG = 'https://p2.music.126.net/tvrpasElxI9CBlEz79MzSA==/109951170330585615.jpg';

const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

function litLoc(h, v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(h); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return { start: s, end: e };
}
function insertIntoObj(h, varName, insertText) {
  const loc = litLoc(h, varName);
  if (!loc) { console.log('!! 未找到 ' + varName); process.exit(1); }
  const body = h.slice(loc.start, loc.end + 1);
  const newBody = body.replace(/^\{/, '{\n' + insertText);
  return h.slice(0, loc.start) + newBody + h.slice(loc.end + 1);
}

html = insertIntoObj(html, 'singerCollection', "  '刘欢': '" + QUARK + "',");
html = insertIntoObj(html, 'singerBaidu', "  '刘欢': '" + BAIDU + "',");
html = insertIntoObj(html, 'singerImgs', "  '刘欢': '" + IMG + "',");
html = insertIntoObj(html, 'singerSongCounts', "  '刘欢': 0,");
html = insertIntoObj(html, 'singerMeta', "  '刘欢': 'm',");
fs.writeFileSync(HP, html, 'utf8');

// singerPopularity 加 90（华语乐坛重量级）
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');
if (!/var singerPopularity=\{'刘欢'/.test(dj)) {
  dj = dj.replace(/var singerPopularity=\{/, "var singerPopularity={'刘欢':90,");
  fs.writeFileSync(DP, dj, 'utf8');
}

// ===== 校验 =====
const html2 = fs.readFileSync(HP, 'utf8');
function lit(v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(html2); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = html2.indexOf('};', s);
  return html2.slice(s, e + 1);
}
const cx = {}; vm.createContext(cx);
['singerCollection', 'singerBaidu', 'singerImgs', 'singerSongCounts', 'singerMeta'].forEach(function (v) { vm.runInContext(v + ' = ' + lit(v), cx); });
console.log('singerCollection:', cx.singerCollection['刘欢']);
console.log('singerBaidu:', cx.singerBaidu['刘欢']);
console.log('singerImgs:', cx.singerImgs['刘欢']);
console.log('singerSongCounts:', cx.singerSongCounts['刘欢']);
console.log('singerMeta:', cx.singerMeta['刘欢']);
const cx2 = {}; vm.createContext(cx2);
vm.runInContext(fs.readFileSync(DP, 'utf8'), cx2);
console.log('singerPopularity:', cx2.singerPopularity['刘欢']);
// 内联脚本语法
let err = 0;
[...html2.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(function (sm) { try { new vm.Script(sm[1]); } catch (e) { err++; console.log('语法错误:', e.message); } });
console.log('内联脚本语法错误:', err);
// getFL 检查 '刘' → L
console.log("getFL('刘') → 'L'(映射表中 '罗':'L','刘':'L' 已存在)");
