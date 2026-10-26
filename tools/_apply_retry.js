// 只应用重试名单中新解析出的头像（不动其他已修正项）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const RETRY = ['刺猬乐队','张含韵','段千寻','许嵩','费玉清','赵传','赵雷','迟志强','迪克牛仔','邓丽君','邓紫棋','郑中基','郭峰','郭静','金海心','钟镇涛','飞儿乐团','TFBOYS','邝美云','郑润泽','周兴哲','리쌍（leessang）','(G)I-DLE','aespa','回春丹乐队','IN-K-sadden','科尔沁夫','LE SSERAFIM','棱镜乐队','NCT DREAM','NewJeans','叶倩文'];

const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', '_avatar_result.json'), 'utf8'));
const resolved = result.resolved || {};

const P = path.join(ROOT, 'index.html');
let src = fs.readFileSync(P, 'utf8');
const decl = src.match(/var\s+singerImgs\s*=\s*\{/);
const start = decl.index + decl[0].length - 1;
const end = src.indexOf('};', start);
let block = src.slice(start, end + 1);

const changed = [], errors = [];
RETRY.forEach(function (k) {
  const rec = resolved[k];
  if (!rec || !rec.url) { errors.push(k + '(未解析)'); return; }
  const re = new RegExp("('" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*')([^']*)(')");
  if (!re.test(block)) { errors.push(k + '(块内无此键)'); return; }
  block = block.replace(re, '$1' + rec.url + '$3');
  changed.push({ key: k, url: rec.url, action: rec.action, source: rec.source });
});

src = src.slice(0, start) + block + src.slice(end + 1);
fs.writeFileSync(P, src, 'utf8');
console.log('重试批次已应用:', changed.length);
changed.forEach(function (c) { console.log('  ✓', c.key, '←', c.action, '|', c.source); });
console.log('未解析/跳过:', errors.length, errors.join(', '));

// 校验
const html = fs.readFileSync(P, 'utf8');
const d2 = html.match(/var\s+singerImgs\s*=\s*\{/);
const s2 = d2.index + d2[0].length - 1;
const e2 = html.indexOf('};', s2);
const cx = {}; vm.createContext(cx);
vm.runInContext('imgs = ' + html.slice(s2, e2 + 1), cx);
let bad = 0;
changed.forEach(function (c) { if (cx.imgs[c.key] !== c.url) { console.log('  ✗ 未生效:', c.key); bad++; } });
console.log('未生效:', bad);

fs.appendFileSync(path.join(ROOT, 'tools', '_changed.json'), '\n/* retry */\n' + JSON.stringify(changed, null, 1), 'utf8');
