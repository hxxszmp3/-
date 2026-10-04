// 生成歌手静态落地页 singer/*.html + sitemap.xml + robots.txt
const fs = require('fs');
eval(fs.readFileSync('data.js', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// 只取数据,不执行 app 代码:手动提取 singerCollection / singerImgs / singerBaidu / singerMeta
function grab(name){
  const re = new RegExp('var ' + name + '\\s*=\\s*\\{');
  const m = html.match(re); if(!m) return null;
  const s = html.indexOf(m[0]);
  const e = html.indexOf('};', s);
  if(e < 0) return null;
  return new Function(m[0].slice(4) + html.slice(s + m[0].length, e + 2) + '; return ' + name + ';')();
}
const singerCollection = grab('singerCollection');
const singerImgs = grab('singerImgs');
const singerBaidu = grab('singerBaidu');
const singerMeta = grab('singerMeta');
if(!singerCollection){ console.log('数据提取失败'); process.exit(1); }

const BASE = 'https://www.hxxsz666.vip';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const SUB_NAME = { m:'男歌手', f:'女歌手', g:'组合 / 乐队', u:'歌手' };
fs.mkdirSync('singer', { recursive: true });

const urls = [BASE + '/'];
let made = 0;
for (const name of Object.keys(singerCollection)) {
  const songs = songDB[name] || [];
  const img = singerImgs[name] || '';
  const baidu = singerBaidu[name] || '';
  const sub = SUB_NAME[singerMeta[name]] || '歌手';
  const fname = name.replace(/[\\/:*?"<>|]/g, '-');
  const shown = songs.slice(0, 200);
  const songLis = shown.map(s => {
    const dl = s.quark
      ? '<a class="dl" href="' + esc(s.quark) + '" target="_blank" rel="nofollow">夸克下载</a>'
      : (s.baidu ? '<a class="dl" href="' + esc(s.baidu) + '" target="_blank" rel="nofollow">百度网盘</a>' : '');
    return '<li><span class="sn">' + esc(s.name) + '</span>' + dl + '</li>';
  }).join('\n');
  const more = songs.length > shown.length ? '<p class="more">还有 ' + (songs.length - shown.length) + ' 首，请前往 <a href="' + BASE + '/">MusicFind 主站</a> 搜索「' + esc(name) + '」查看全部</p>' : '';
  const noSong = songs.length ? '' : '<p class="more">该歌手的歌曲请在 <a href="' + BASE + '/">MusicFind 主站</a> 中搜索。</p>';
  const page = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>' + esc(name) + '的歌曲下载 - MusicFind 音乐搜索</title>\n'
    + '<meta name="description" content="' + esc(name) + '（' + sub + '）共 ' + songs.length + ' 首歌曲资源，在 MusicFind 查找并下载 ' + esc(name) + ' 的歌曲。">\n'
    + '<link rel="canonical" href="' + BASE + '/singer/' + encodeURIComponent(fname) + '.html">\n'
    + '<meta name="robots" content="index,follow">\n'
    + '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#2d3748;line-height:1.6}a{color:#4a7f96;text-decoration:none}a:hover{text-decoration:underline}.crumb{font-size:13px;color:#8898a4;margin-bottom:16px}.head{display:flex;align-items:center;gap:16px;margin-bottom:8px}.ava{width:72px;height:72px;border-radius:50%;object-fit:cover;background:#e4ecf0}h1{font-size:22px;margin:0}.tag{display:inline-block;font-size:12px;color:#6b9aae;border:1px solid #b8d4e0;border-radius:99px;padding:1px 10px;margin:4px 6px 12px 0}.cnt{color:#8898a4;font-size:14px;margin-bottom:14px}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #eef2f5}.sn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dl{flex-shrink:0;font-size:13px;background:#eaf3f7;padding:3px 12px;border-radius:6px}.more{color:#8898a4;font-size:14px;margin-top:14px}.bk{margin-top:22px;font-size:14px}</style>\n'
    + '<script>var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?fdbc24a7c27265ea9fc1518954eeec98";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();</script>\n</head>\n<body>\n'
    + '<div class="crumb"><a href="' + BASE + '/">MusicFind 音乐搜索</a> › 歌手目录 › ' + esc(name) + '</div>\n'
    + '<div class="head">' + (img ? '<img class="ava" src="' + esc(img) + '" alt="' + esc(name) + '" loading="lazy">' : '') + '<h1>' + esc(name) + ' 歌曲资源</h1></div>\n'
    + '<div><span class="tag">' + sub + '</span>' + (baidu ? '<span class="tag">含百度网盘备用</span>' : '') + '</div>\n'
    + '<p class="cnt">共收录 ' + songs.length + ' 首歌曲</p>\n'
    + (songs.length ? '<ul>\n' + songLis + '\n</ul>\n' : '')
    + more + noSong
    + '<div class="bk">← 返回 <a href="' + BASE + '/">MusicFind 音乐搜索主站</a>，支持歌名 / 歌手搜索与 A-Z 歌手目录</div>\n'
    + '</body>\n</html>\n';
  fs.writeFileSync('singer/' + fname + '.html', page);
  urls.push(BASE + '/singer/' + encodeURIComponent(fname) + '.html');
  made++;
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(u => '<url><loc>' + u + '</loc><lastmod>' + today + '</lastmod></url>').join('\n')
  + '\n</urlset>\n';
fs.writeFileSync('sitemap.xml', sitemap);
fs.writeFileSync('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + BASE + '/sitemap.xml\n');
console.log('生成落地页:', made, '| sitemap URL:', urls.length);
