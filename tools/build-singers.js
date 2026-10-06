#!/usr/bin/env node
/**
 * MusicFind 构建脚本
 *
 * 从 data.js (songDB + singerPopularity) 与 index.html (内嵌歌手映射表) 出发，
 * 生成全部歌手静态 SEO 页 (singer/*.html) 与 sitemap.xml。
 *
 * 用法:
 *   node tools/build-singers.js            # 生成静态页 + sitemap
 *   node tools/build-singers.js --check    # 只校验，不写文件（不一致时退出码 1）
 *   node tools/build-singers.js --verbose  # 打印每个歌手的变化明细
 *
 * 什么时候需要跑:
 *   任何一次修改 data.js 的 songDB，或修改 index.html 中的
 *   singerImgs / singerMeta / singerBaidu / singerSongCounts 之后。
 *   否则 singer/*.html 会与数据源脱节（历史上曾出现 243/345 页计数错误）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- 配置 ----------
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.hxxsz666.vip/';
const LIST_LIMIT = 200;          // 每页最多列出的歌曲数
const TODAY = new Date().toISOString().slice(0, 10);
const SPECIAL_KEYS = ['歌单'];  // 非歌手条目：不出静态页（歌单是「歌单大厅」的数据源）
// 仅用于单曲搜索、不进入歌手合集体系的条目（合唱组合、单曲收录歌手等）
// 合唱组合（含 &）会自动排除，无需在此重复列出
const SINGLE_ONLY_KEYS = ['于春洋', 'Tank'];

/** 是否应为该条目生成静态页 */
function isPageable(name) {
  if (SPECIAL_KEYS.includes(name)) return false;
  if (SINGLE_ONLY_KEYS.includes(name)) return false;
  if (name.indexOf('&') !== -1) return false;  // 合唱组合：走单曲搜索，不建合集页
  return true;
}

// 性别/组合标记 -> 页面标签文案
const GENDER_LABEL = { m: '男歌手', f: '女歌手', g: '组合/乐队' };
const GENDER_FALLBACK = '歌手';

const ARGS = new Set(process.argv.slice(2));
const CHECK_ONLY = ARGS.has('--check');
const VERBOSE = ARGS.has('--verbose');

// ---------- 工具函数 ----------

/**
 * 从源码文本中提取 `var <name> = {...}` 的对象字面量。
 * 采用字符串感知的花括号配对，能正确处理对象内部含 { } 与引号的情况。
 */
function extractObjectLiteral(src, varName) {
  const re = new RegExp('var\\s+' + varName + '\\s*=');
  const m = re.exec(src);
  if (!m) throw new Error('未找到变量: ' + varName);

  let i = src.indexOf('{', m.index);
  if (i < 0) throw new Error('变量 ' + varName + ' 后未找到对象起始 {');

  let depth = 0;
  let inStr = false;
  let quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === "'" || c === '"') { inStr = true; quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  throw new Error('变量 ' + varName + ' 的对象未闭合');
}

/** 在 vm 沙箱中执行一段 `var x = {...}` 并返回其值 */
function evalDeclared(src, varName) {
  const seg = extractObjectLiteral(src, varName);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(seg + ';', sandbox);
  return sandbox[varName];
}

/** HTML / 属性转义 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 歌手名 -> URL 编码后的文件名 */
function pageUrl(name) {
  return SITE + 'singer/' + encodeURIComponent(name) + '.html';
}

// ---------- 载入数据 ----------

function loadData() {
  const dataSrc = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const dataSandbox = {};
  vm.createContext(dataSandbox);
  vm.runInContext(dataSrc, dataSandbox);

  const DB = dataSandbox.songDB;
  if (!DB || typeof DB !== 'object') throw new Error('data.js 中未解析出 songDB');

  return {
    DB,
    POP: dataSandbox.singerPopularity,
    IMGS: evalDeclared(indexSrc, 'singerImgs'),
    META: evalDeclared(indexSrc, 'singerMeta'),
    BAIDU: evalDeclared(indexSrc, 'singerBaidu'),
    indexSrc,
  };
}

/** 从现有页面中提取公共 CSS 与统计代码，保证新页与旧页外观一致 */
function loadSharedAssets() {
  const dir = path.join(ROOT, 'singer');
  const candidates = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  for (const f of candidates) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const css = /<style>([\s\S]*?)<\/style>/.exec(t);
    const hmt = /<script>var _hmt[\s\S]*?<\/script>/.exec(t);
    if (css && hmt) return { css: css[1], hmt: hmt[0], from: f };
  }
  throw new Error('无法从 singer/ 中提取公共样式与统计代码（目录为空或格式不符？）');
}

// ---------- 页面渲染 ----------

function renderSingerPage(name, songs, ctx = {}) {
  const {
    img, meta, baidu,
  } = ctx;
  const total = songs.length;
  const shown = songs.slice(0, LIST_LIMIT);

  const gender = GENDER_LABEL[meta] || GENDER_FALLBACK;
  const tags = ['<span class="tag">' + gender + '</span>'];
  if (baidu) tags.push('<span class="tag">含百度网盘备用</span>');

  const items = shown.map((s) => {
    const dl = s.quark
      ? '<a class="dl" href="' + esc(s.quark) + '" target="_blank" rel="nofollow noopener">夸克下载</a>'
      : '';
    return '<li><span class="sn">' + esc(s.name) + '</span>' + dl + '</li>';
  }).join('\n');

  const more = total > LIST_LIMIT
    ? '<p class="more">还有 ' + (total - LIST_LIMIT) + ' 首，请前往 <a href="' + SITE +
      '">MusicFind 主站</a> 搜索「' + esc(name) + '」查看全部</p>'
    : '';

  return '<!DOCTYPE html>\n' +
    '<html lang="zh-CN">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(name) + '的歌曲下载 - MusicFind 音乐搜索</title>\n' +
    '<meta name="description" content="' + esc(name) + '（' + gender + '）共 ' + total +
      ' 首歌曲资源，在 MusicFind 查找并下载 ' + esc(name) + ' 的歌曲。">\n' +
    '<link rel="canonical" href="' + pageUrl(name) + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<style>' + ctx.css + '</style>\n' +
    ctx.hmt + '\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="crumb"><a href="' + SITE + '">MusicFind 音乐搜索</a> › 歌手目录 › ' + esc(name) + '</div>\n' +
    '<div class="head"><img class="ava" src="' + esc(img || '') + '" alt="' + esc(name) +
      '" loading="lazy"><h1>' + esc(name) + ' 歌曲资源</h1></div>\n' +
    '<div>' + tags.join('') + '</div>\n' +
    '<p class="cnt">共收录 ' + total + ' 首歌曲</p>\n' +
    '<ul>\n' + items + '\n</ul>\n' +
    more + '<div class="bk">← 返回 <a href="' + SITE +
      '">MusicFind 音乐搜索主站</a>，支持歌名 / 歌手搜索与 A-Z 歌手目录</div>\n' +
    '</body>\n</html>\n';
}

function renderSitemap(names) {
  const urls = [SITE, ...names.map((n) => pageUrl(n))];
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of urls) {
    out += '<url><loc>' + u + '</loc><lastmod>' + TODAY + '</lastmod></url>\n';
  }
  out += '</urlset>\n';
  return out;
}

// ---------- 校验 ----------

function check(names, DB, shared) {
  const dir = path.join(ROOT, 'singer');
  const problems = [];
  const existing = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.html')));

  for (const name of names) {
    const file = name + '.html';
    if (!existing.has(file)) { problems.push('缺少静态页: ' + file); continue; }
    const t = fs.readFileSync(path.join(dir, file), 'utf8');
    const dec = /共收录 (\d+) 首歌曲/.exec(t);
    if (!dec) { problems.push('缺少计数文案: ' + file); continue; }
    if (+dec[1] !== DB[name].length) {
      problems.push('计数不一致: ' + name + ' 声明 ' + dec[1] + ' 实际 ' + DB[name].length);
    }
    const liCount = (t.match(/class="sn"/g) || []).length;
    const dlCount = (t.match(/class="dl"/g) || []).length;
    if (liCount !== dlCount) problems.push('歌名/下载链接数量不匹配: ' + file);

    const expected = renderSingerPage(name, DB[name], {
      img: shared.IMGS[name],
      meta: shared.META[name],
      baidu: shared.BAIDU[name],
      css: shared.css,
      hmt: shared.hmt,
    });
    if (expected !== t) problems.push('页面内容已过期: ' + file);
  }

  const extra = [...existing].filter((f) => !names.includes(f.replace(/\.html$/, '')));
  for (const f of extra) problems.push('多余的静态页（数据源已无此歌手）: ' + f);

  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  // 只比较 URL 集合：lastmod 会随构建日期变化，不应导致 --check 失败
  const smLocs = (sm.match(/<loc>[^<]*<\/loc>/g) || []).join('\n');
  const expectLocs = (renderSitemap(names).match(/<loc>[^<]*<\/loc>/g) || []).join('\n');
  if (smLocs !== expectLocs) problems.push('sitemap.xml 的 URL 列表已过期');

  return problems;
}

// ---------- 主流程 ----------

function main() {
  const { DB, IMGS, META, BAIDU } = loadData();
  const shared = loadSharedAssets();

  const names = Object.keys(DB)
    .filter(isPageable)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));  // 按歌手名排序，保证输出稳定可复现

  const ctx = { IMGS, META, BAIDU, css: shared.css, hmt: shared.hmt };

  const stats = { written: 0, unchanged: 0, created: 0 };
  const dir = path.join(ROOT, 'singer');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (CHECK_ONLY) {
    const problems = check(names, DB, ctx);
    if (problems.length === 0) {
      console.log('[build-singers] 校验通过：' + names.length + ' 个歌手页与 sitemap.xml 均与数据源一致');
      process.exit(0);
    }
    console.error('[build-singers] 校验失败，共 ' + problems.length + ' 项：');
    for (const p of problems.slice(0, 40)) console.error('  - ' + p);
    if (problems.length > 40) console.error('  ... 另有 ' + (problems.length - 40) + ' 项');
    process.exit(1);
  }

  for (const name of names) {
    const file = path.join(dir, name + '.html');
    const out = renderSingerPage(name, DB[name], {
      img: IMGS[name],
      meta: META[name],
      baidu: BAIDU[name],
      css: shared.css,
      hmt: shared.hmt,
    });
    const exists = fs.existsSync(file);
    const old = exists ? fs.readFileSync(file, 'utf8') : null;
    if (old === out) {
      stats.unchanged++;
      continue;
    }
    if (VERBOSE) console.log('  ' + (exists ? '更新' : '新建') + ' ' + name + '.html');
    fs.writeFileSync(file, out);
    if (exists) stats.written++; else stats.created++;
  }

  // 清理数据源中已不存在的歌手页
  const valid = new Set(names.map((n) => n + '.html'));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    if (!valid.has(f)) {
      fs.unlinkSync(path.join(dir, f));
      console.log('  删除失效页 ' + f);
    }
  }

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(names));

  console.log('[build-singers] 完成');
  console.log('  歌手页: 新建 ' + stats.created + ' / 更新 ' + stats.written +
    ' / 未变 ' + stats.unchanged + '（共 ' + names.length + '）');
  console.log('  sitemap.xml: ' + (names.length + 1) + ' 条 URL，lastmod ' + TODAY);
  console.log('  样式来源: singer/' + shared.from);
}

try {
  main();
} catch (err) {
  console.error('[build-singers] 错误: ' + err.message);
  process.exit(1);
}
