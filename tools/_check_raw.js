/**
 * 校验 tools/_raw_*.txt 原始分享数据：条数、链接格式、重名、歌手归属。
 * 用法：node tools/_check_raw.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const FILES = [
  ['_raw_lkq.txt', '李克勤'],
  ['_raw_yqh.txt', '杨千嬅'],
  ['_raw_dlx.txt', '邓丽欣'],
  ['_raw_lyn.txt', '刘宇宁'],
  ['_raw_tge.txt', '腾格尔'],
  ['_raw_hl.txt',  '韩磊'],
  ['_raw_tz.txt',  '田震'],
  ['_raw_xz.txt',  '肖战'],
  ['_raw_wf.txt',  '汪峰'],
  ['_raw_yk.txt',  '杨坤'],
  ['_raw_sn.txt',  '孙楠'],
];

let grand = 0, problems = 0;
const allLinks = new Map();
const globalNames = new Map();

for (const [file, expectSinger] of FILES) {
  const p = path.join(ROOT, 'tools', file);
  if (!fs.existsSync(p)) { console.log('✗ 缺文件 ' + file); problems++; continue; }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim());
  if (lines.length % 2 !== 0) {
    console.log('✗ ' + file + ' 行数为奇数(' + lines.length + ')，歌名/链接未成对');
    problems++;
  }
  const n = lines.length / 2;
  let badLink = 0, wrongSinger = 0, noSep = 0;
  const seen = new Map();

  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = lines[i + 1].trim();
    if (!/^https:\/\/pan\.quark\.cn\/s\/[a-z0-9]+$/.test(url)) {
      badLink++;
      if (badLink <= 3) console.log('   链接异常: ' + title + ' → ' + url);
    }
    if (allLinks.has(url)) {
      console.log('   重复链接: ' + title + ' 与 ' + allLinks.get(url));
      problems++;
    }
    allLinks.set(url, title);

    // 文件名格式应为「歌手 - 歌名.mp3」；歌名本身也可能含 ' - '
    if (!title.startsWith(expectSinger + ' - ') && title !== expectSinger + '.mp3') {
      wrongSinger++;
      if (wrongSinger <= 3) console.log('   歌手不符: ' + title);
    }
    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(expectSinger + ' - ')) name = name.slice(expectSinger.length + 3);
    else if (name === expectSinger) { name = expectSinger; noSep++; }
    else name = name.replace(expectSinger + ' - ', '');

    if (seen.has(name)) {
      console.log('   组内重名: ' + name + ' (第' + seen.get(name) + '条与第' + (i / 2 + 1) + '条)');
      problems++;
    }
    seen.set(name, i / 2 + 1);

    const key = expectSinger + '||' + name;
    if (globalNames.has(key)) {
      console.log('   跨组重名: ' + key);
      problems++;
    }
    globalNames.set(key, true);
  }
  if (badLink) problems++;
  if (wrongSinger) problems++;
  grand += n;
  console.log((badLink || wrongSinger ? '✗ ' : '✓ ') + expectSinger.padEnd(4) +
    ' 共 ' + String(n).padStart(3) + ' 首' +
    (badLink ? '  链接异常 ' + badLink : '') +
    (wrongSinger ? '  歌手不符 ' + wrongSinger : ''));
}

console.log('\n合计 ' + grand + ' 首，唯一链接 ' + allLinks.size + ' 个');
console.log(problems ? '发现 ' + problems + ' 项问题' : '全部通过 ✓');
process.exit(problems ? 1 : 0);
