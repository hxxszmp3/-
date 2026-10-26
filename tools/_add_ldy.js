// 新增罗大佑：写入 data.js(songDB) 与 index.html 各表
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_ldy_parsed.json'), 'utf8'));
const QUARK = 'https://pan.quark.cn/s/1bdd71d3182e';
const BAIDU = 'https://pan.baidu.com/s/1bYT0Y4tav6KmfETkgtPaWQ?pwd=9k6f';

// ========== 1. data.js: songDB 新增罗大佑 + 合唱键 ==========
const DP = path.join(ROOT, 'data.js');
let dj = fs.readFileSync(DP, 'utf8');

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function entry(o) {
  return "{ name: '" + esc(o.name) + "', cover: '', quark: '" + o.quark + "' }";
}

// 罗大佑独唱块
const soloBlock = "  '罗大佑': [" + parsed.solo.map(entry).join(', ') + "],\n";
// 合唱块
const duoKeys = Object.keys(parsed.duo);
const duoBlock = duoKeys.map(function (k) {
  return "  '" + esc(k) + "': [" + parsed.duo[k].map(entry).join(', ') + "],\n";
}).join('');

// 插入到 songDB 开头（var songDB = {\n 之后）
const dbRe = /var\s+songDB\s*=\s*\{\n/;
if (!dbRe.test(dj)) { console.log('!! data.js 未找到 songDB 开头'); process.exit(1); }
dj = dj.replace(dbRe, function (m) { return m + duoBlock + soloBlock; });

// singerPopularity 加罗大佑（华语乐坛教父级，给 95）
const popRe = /var singerPopularity=\{/;
dj = dj.replace(popRe, "var singerPopularity={'罗大佑':95,");
fs.writeFileSync(DP, dj, 'utf8');
console.log('✓ data.js: songDB 新增 1 位独唱 + ' + duoKeys.length + ' 个合唱键；singerPopularity 加罗大佑');

// 校验 data.js 可正常求值
const cx1 = {}; vm.createContext(cx1);
try {
  vm.runInContext(dj, cx1);
  console.log('  校验: songDB 键数', Object.keys(cx1.songDB).length, '| 罗大佑曲数', cx1.songDB['罗大佑'].length);
  duoKeys.forEach(function (k) { console.log('  合唱', k, '→', cx1.songDB[k].length, '首'); });
} catch (e) { console.log('!! data.js 求值失败:', e.message); process.exit(1); }

// ========== 2. index.html 各表 ==========
const HP = path.join(ROOT, 'index.html');
let html = fs.readFileSync(HP, 'utf8');

function litSource(h, v) {
  const re = new RegExp('var\\s+' + v + '\\s*=\\s*(\\{|\\[)');
  const m = re.exec(h); if (!m) return null;
  const s = m.index + m[0].length - 1;
  const e = h.indexOf('};', s);
  return { start: s, end: e, text: h.slice(s, e + 1) };
}

// 2.1 singerCollection: 加了回车排版，需要定位 '罗大佑' 插入
function insertIntoObj(h, varName, insertText) {
  const loc = litSource(h, varName);
  if (!loc) { console.log('!! 未找到 ' + varName); return h; }
  const body = loc.text;
  // 插到 { 之后
  const newBody = body.replace(/^\{/, '{\n' + insertText);
  return h.slice(0, loc.start) + newBody + h.slice(loc.end + 1);
}

html = insertIntoObj(html, 'singerCollection', "  '罗大佑': '" + QUARK + "',");
html = insertIntoObj(html, 'singerBaidu', "  '罗大佑': '" + BAIDU + "',");
html = insertIntoObj(html, 'singerSongCounts', "  '罗大佑': " + parsed.solo.length + ",");
html = insertIntoObj(html, 'singerMeta', "  '罗大佑': 'm',");

// 2.2 singerImgs: 需先抓头像
fs.writeFileSync(HP, html, 'utf8');
console.log('✓ index.html: singerCollection / singerBaidu / singerSongCounts / singerMeta 已加罗大佑');
console.log('  剩余待办: singerImgs（需抓头像）');
fs.writeFileSync(path.join(ROOT, 'tools', '_ldy_state.json'), JSON.stringify({ quark: QUARK, baidu: BAIDU, soloCount: parsed.solo.length }, null, 1));
