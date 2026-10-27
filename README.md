# MusicFind

> 按歌手、歌名快速查找音乐资源的静态站点。
> 线上地址：https://www.hxxsz666.vip/

## 技术形态

**零构建依赖的纯静态站点**，托管在 GitHub Pages。不需要 `npm install`，没有框架，没有打包器——所有东西都是浏览器直接能跑的 HTML / CSS / JS。

| 文件 | 作用 |
|---|---|
| `index.html` | 主站。单文件内联全部 CSS（约 72KB）与 JS（约 140KB），包含单曲搜索 / 批量下载 / 歌手合集 / 歌单大厅四个面板 |
| `data.js` | 数据源。`songDB`（歌手 → 歌曲列表）+ `singerPopularity`（歌手热度，用于排序）。约 2MB，gzip 后 470KB |
| `singer/*.html` | 354 个歌手静态 SEO 页，由构建脚本生成，勿手改 |
| `sitemap.xml` | 搜索引擎收录入口，由构建脚本生成 |
| `tools/build-singers.js` | 构建脚本：生成歌手页 + sitemap + 同步首页统计数字 |
| `tools/README.md` | 构建脚本的详细说明 |

### 数据规模（2026-10）

- 354 位歌手有静态合集页（另有 2 位仅作单曲收录：`于春洋`、`Tank`）
- 22,820 首歌曲，26 个合唱组合条目，69 个歌单
- 歌曲链接统一指向夸克网盘，部分歌手另有百度网盘备用链接

## 关键约定

### 改完数据必须重跑构建

```bash
node tools/build-singers.js            # 生成 singer/*.html + sitemap.xml
node tools/build-singers.js --check    # 只校验，不写文件（不一致时退出码 1）
node tools/build-singers.js --verbose  # 打印每个歌手的变化明细
```

**任何一次**修改 `data.js` 的 `songDB`，或修改 `index.html` 里的 `singerImgs` / `singerMeta` / `singerBaidu` 之后，都必须重跑。历史上曾因此出现过 **243/345 个页面计数错误**——静态页停留在旧版数据，而数据源已被更新。

构建脚本同时会同步 `index.html` 的 meta description 里的「N 位歌手、N 首歌曲」。这个数字过去是手工维护的，每次加歌手都会漂移（曾长期写着 347，实际已是 354），现在由脚本自动回写，`--check` 会把它当作漂移报错。

### 三套内嵌映射表（都在 index.html 里）

| 变量 | 用途 |
|---|---|
| `singerImgs` | 歌手头像 URL |
| `singerMeta` | 性别 / 组合标记：`m` 男歌手、`f` 女歌手、`g` 组合·乐队 |
| `singerBaidu` | 百度网盘备用链接（有值则页面加「含百度网盘备用」标签） |

### 四套主题

浅色（默认）/ 暗夜 / 极光紫 / 奶油纸，通过 `body` 上的 class 切换，用户选择存在 `localStorage.siteTheme`。

> ⚠️ **当前技术债**：奶油纸主题是基础样式的整段复制粘贴（约 316 条规则），暗夜 / 极光紫走的是覆盖式写法。改一个通用组件需要同步改三处，容易漏。新增主题前请先看 `tools/README.md` 的说明。

## 新增一位歌手的流程

1. 在 `data.js` 的 `songDB` 里加键值对（歌名 + 夸克链接）
2. 在 `index.html` 的 `singerImgs` / `singerMeta` / `singerBaidu` 里补上对应条目
3. 在 `singerCollection` 里加上歌手名与合集网盘链接（这一步决定 A-Z 目录是否显示）
4. 跑 `node tools/build-singers.js`
5. 跑 `node tools/build-singers.js --check` 确认通过
6. 提交

一次性脚本参考 `tools/_add_solo_singer.js`（通用版）与 `tools/_add_ldy.js`（按歌手定制版）。

## 已知事项

- **仓库里有 GitHub PAT**：`origin` 远程地址里内嵌了访问令牌（`https://<user>:<token>@github.com/...`）。令牌未进入任何被追踪的文件，但明文存于 `.git/config`。**建议改用 SSH 或 credential helper，并轮换该令牌。**
- **`tools/` 目录有历史备份文件**：约 19MB 的 `_*backup*` 快照已从版本控制移除（由 `.gitignore` 拦截），但本地文件仍在磁盘上，可随时删除。
- **头像走外链**：来自 `y.gtimg.cn` 等第三方 CDN，站点本身不托管图片资源。外链失效会导致头像挂掉。
- **无 CI**：目前靠人工跑 `--check`。建议加 GitHub Actions 在 PR 时自动校验。
- **无 favicon / og:image**：已补齐（`img/favicon.svg`）。
