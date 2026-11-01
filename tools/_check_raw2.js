#!/usr/bin/env node
/**
 * 校验本批三份原始数据的完整性：
 *   - 条数配对、链接格式
 *   - 重复链接、组内重名
 *   - 与现有 songDB 的重名/重复链接冲突
 *   - 合唱条目识别（文件名含其他歌手）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 文件 → { 歌手键, 前缀(剥离用), 合唱检测 }
const FILES = [
  ['_raw_tank2.txt', 'Tank', 'Tank'],
  ['_raw_mctt.txt', 'MC張天賦', 'MC張天賦'],
  ['_raw_ginlee.txt', '李幸倪', 'Gin Lee 李幸倪'],
];

// 已存在的 songDB
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), cx);
const DB = cx.songDB;

const existingLinks = new Map();
for (const k of Object.keys(DB)) {
  for (const s of DB[k]) {
    if (s.quark) existingLinks.set(s.quark, k + ' - ' + s.name);
  }
}

let problems = 0;
const allLinks = new Map();

for (const [file, singerKey, prefix] of FILES) {
  const p = path.join(ROOT, 'tools', file);
  if (!fs.existsSync(p)) { console.log('✗ 缺文件 ' + file); problems++; continue; }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim());
  if (lines.length % 2 !== 0) { console.log('✗ ' + file + ' 行数非偶数'); problems++; }

  const n = lines.length / 2;
  let badLink = 0, wrongSinger = 0;
  const seen = new Map();
  const collabs = [];
  const dups = [];

  for (let i = 0; i < lines.length; i += 2) {
    const title = lines[i].trim();
    const url = (lines[i + 1] || '').trim();

    if (!/^https:\/\/pan\.quark\.cn\/s\/[a-z0-9]+$/.test(url)) {
      badLink++;
      console.log('   链接异常: ' + title + ' → ' + url);
    }
    if (allLinks.has(url)) { console.log('   本批内重复链接: ' + title); problems++; }
    allLinks.set(url, title);

    if (existingLinks.has(url)) {
      console.log('   ⚠ 与现有库重复: ' + title + '  ←→  ' + existingLinks.get(url));
      dups.push(title);
    }

    if (!title.startsWith(prefix + ' - ') && title !== prefix + '.mp3') {
      wrongSinger++;
      console.log('   前缀不符: ' + title);
    }

    let name = title.replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);

    // 合唱检测：歌名里含「其他歌手 - 」或「, 歌手」
    const m = name.match(/^(.+?)\s*[-–]\s*([^、,，]+[、,，][^、,，]+)$/);
    if (m) collabs.push({ title, name, detail: m[2] });

    if (seen.has(name)) {
      console.log('   组内重名: ' + name);
      problems++;
    }
    seen.set(name, i / 2 + 1);
  }

  if (badLink) problems++;
  if (wrongSinger) problems++;
  console.log((badLink || wrongSinger ? '✗ ' : '✓ ') + file.padEnd(20) +
    ' 歌手键=' + singerKey.padEnd(8) + ' 共 ' + String(n).padStart(3) + ' 首' +
    (dups.length ? '  ⚠ 与库重复 ' + dups.length : ''));

  if (collabs.length) {
    console.log('   合唱条目 ' + collabs.length + ' 首:');
    collabs.forEach(c => console.log('     · ' + c.name + '   [' + c.detail + ']'));
  }
}

console.log();
console.log('本批合计 ' + allLinks.size + ' 首，唯一链接 ' + allLinks.size + ' 个');

// 与现有库的冲突检查
console.log();
console.log('=== 与现有 songDB 的歌名冲突 ===');
for (const [file, singerKey, prefix] of FILES) {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8').split(/\r?\n/).filter(l => l.trim());
  const names = [];
  for (let i = 0; i < lines.length; i += 2) {
    let name = lines[i].trim().replace(/\.mp3$/i, '');
    if (name.startsWith(prefix + ' - ')) name = name.slice(prefix.length + 3);
    names.push(name);
  }
  if (DB[singerKey]) {
    const exist = new Set(DB[singerKey].map(s => s.name));
    const dup = names.filter(n => exist.has(n));
    console.log('  ' + singerKey + ' 现有 ' + DB[singerKey].length + ' 首，' +
      (dup.length ? '歌名重复: ' + dup.join(', ') : '无歌名重复 ✓'));
    if (dup.length) console.log('     现有条目: ' + DB[singerKey].map(s => s.name).join(' | '));
  } else {
    console.log('  ' + singerKey + ' 新歌手，无冲突');
  }
}

process.exit(problems ? 1 : 0);
