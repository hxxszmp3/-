// 填充+清理后整站验证
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));
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
let pass = 0, fail = 0;
const T = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

eval(script);
T('主脚本执行', true);

// 1. 数据一致性
let t = 0, q = 0, c = 0, plQ = 0;
for (const k of Object.keys(songDB)) for (const s of songDB[k]) { if (k === '歌单') { if (s.quark) plQ++; continue; } t++; if (s.quark) q++; if (s.cover) c++; }
T('单曲总数 25135 (实际' + t + ')', t === 25135);
T('quark 21898 (实际' + q + ')', q === 21898);
T('封面 15967 (实际' + c + ')', c === 15967);
T('歌单链接 69/69', plQ === 69);
let cntOk = true;
for (const k of Object.keys(songDB)) if (singerSongCounts[k] !== songDB[k].length) cntOk = false;
T('singerSongCounts 全键一致', cntOk);
T('邓紫棋唯一键', JSON.stringify(Object.keys(songDB).filter(k => k.indexOf('邓紫棋') > -1)) === '["邓紫棋"]');
T('丁当10首独立', (songDB['丁当'] || []).length === 10);
T('(G)I-DLE标题干净', (songDB['(G)I-DLE'] || []).every(s => s.name.indexOf('DLE ((') === -1));
T('海鸣威6/6已填', (songDB['海鸣威'] || []).filter(s => s.quark).length === 6);

// 2. 猜你想搜
T('黄丽玲→A-LIN', suggestSinger('黄丽玲') === 'A-LIN');
T('G.E.M.→邓紫棋', suggestSinger('G.E.M.') === '邓紫棋');
T('邓紫琪→邓紫棋', suggestSinger('邓紫琪') === '邓紫棋');
T('周结伦→周杰伦', suggestSinger('周结伦') === '周杰伦');

// 3. 条件渲染
const mk = (k, s) => Object.assign({}, s, { singer: k });
const withQ = mk('邓紫棋', songDB['邓紫棋'].find(s => s.quark));
let withoutQ = null, withoutQKey = '';
for (const k of Object.keys(songDB)) { if (k === '歌单') continue; const f = songDB[k].find(s => !s.quark); if (f) { withoutQ = mk(k, f); withoutQKey = k; break; } }
let noCover = null;
for (const k of Object.keys(songDB)) { if (k === '歌单') continue; const f = songDB[k].find(s => s.quark && !s.cover); if (f) { noCover = mk(k, f); break; } }
try {
  const h1 = songCardHTML(withQ, 0, '');
  T('有链接→有下载按钮', h1.indexOf('download-btn') > -1);
} catch (e) { T('songCardHTML(有链接) 执行: ' + e.message, false); }
if (withoutQ) try {
  const h2 = songCardHTML(withoutQ, 0, '');
  T('无链接→无下载按钮(' + withoutQKey + ')', h2.indexOf('download-btn') === -1);
} catch (e) { T('songCardHTML(无链接) 执行: ' + e.message, false); }
if (noCover) try {
  const h3 = songCardHTML(noCover, 0, '');
  T('无封面→音符符号', h3.indexOf('<svg') > -1);
} catch (e) { T('songCardHTML(无封面) 执行: ' + e.message, false); }
try { renderSingerCollection('邓紫棋'); T('renderSingerCollection(邓紫棋)', true); } catch (e) { T('renderSingerCollection: ' + e.message, false); }
console.log('\n结果:', pass, '通过 /', fail, '失败');
