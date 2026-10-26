// 清除指定歌手的解析进度，便于重试
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const RETRY = ['刺猬乐队','张含韵','段千寻','许嵩','费玉清','赵传','赵雷','迟志强','迪克牛仔','邓丽君','邓紫棋','郑中基','郭峰','郭静','金海心','钟镇涛','飞儿乐团','TFBOYS','邝美云','郑润泽','周兴哲','리쌍（leessang）','(G)I-DLE','aespa','回春丹乐队','IN-K-sadden','科尔沁夫','LE SSERAFIM','棱镜乐队','NCT DREAM','NewJeans','叶倩文'];

const pp = path.join(ROOT, 'tools', '_avatar_progress.json');
const rp = path.join(ROOT, 'tools', '_avatar_result.json');
const progress = JSON.parse(fs.readFileSync(pp, 'utf8'));
const result = JSON.parse(fs.readFileSync(rp, 'utf8'));

let n = 0;
RETRY.forEach(function (k) {
  if (progress[k] !== undefined) { delete progress[k]; n++; }
  if (result.failed && result.failed[k]) delete result.failed[k];
});
fs.writeFileSync(pp, JSON.stringify(progress));
fs.writeFileSync(rp, JSON.stringify(result, null, 1));
console.log('已清除进度:', n, '/', RETRY.length);
// 确认这些名字都在 singerCollection 中（否则 --only 过滤后为空）
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /var\s+singerCollection\s*=\s*\{/.exec(html);
const s = m.index + m[0].length - 1;
const e = html.indexOf('};', s);
const cx = {}; require('vm').createContext(cx);
require('vm').runInContext('coll = ' + html.slice(s, e + 1), cx);
const missing = RETRY.filter(function (k) { return !cx.coll[k]; });
console.log('不在合集里的:', missing.length ? missing.join(', ') : '无');
