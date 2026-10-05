# MusicFind 构建工具

## `build-singers.js`

从数据源生成歌手静态 SEO 页与 sitemap。

```bash
node tools/build-singers.js            # 生成 singer/*.html 与 sitemap.xml
node tools/build-singers.js --check    # 只校验，不写文件（不一致时退出码 1）
node tools/build-singers.js --verbose  # 打印每个歌手页的变化明细
```

### 数据来源

| 输入 | 位置 | 用途 |
|---|---|---|
| `songDB` | `data.js` | 每个歌手的歌曲列表（`name` / `quark`） |
| `singerPopularity` | `data.js` | 歌手热度，主站排序用（本脚本不消费） |
| `singerImgs` | `index.html` | 歌手头像 URL |
| `singerMeta` | `index.html` | 性别/组合标记：`m` 男歌手、`f` 女歌手、`g` 组合·乐队 |
| `singerBaidu` | `index.html` | 百度网盘备用链接（有值则页面加「含百度网盘备用」标签） |

### 输出

- `singer/<歌手名>.html`：每个歌手一个静态页，最多列出 200 首，超出显示「还有 N 首」
- `sitemap.xml`：首页 + 全部歌手页，`lastmod` 为构建当日

### ⚠️ 什么时候必须跑

**任何一次修改 `data.js` 的 `songDB`，或修改 `index.html` 里的 `singerImgs` / `singerMeta` / `singerBaidu` 之后，都必须重跑本脚本。**

否则 `singer/*.html` 会与数据源脱节。历史上曾因此出现 **243 / 345 个页面计数错误**（静态页停留在旧版 `songDB`，而 `songDB` 已被更新）。

### 建议流程

```bash
# 1. 改数据
# 2. 重新生成
node tools/build-singers.js
# 3. 校验
node tools/build-singers.js --check
# 4. 提交
git add -A && git commit -m "更新歌曲数据"
```

### 设计说明

- **不引入构建依赖**：纯 Node 内置模块（`fs` / `path` / `vm`），无需 `npm install`。
- **样式复用**：新页的 CSS 与统计代码直接从 `singer/` 中已有的页面提取，保证新旧页外观一致。因此 `singer/` 不能为空。
- **解析方式**：`data.js` 用 `vm.runInContext` 直接求值（JS 对象是单引号 + 尾逗号，非标准 JSON）；`index.html` 的内嵌数据用「正则定位 + 字符串感知花括号配对」提取，可正确处理对象内的 `{` `}` 与引号。
- **特殊条目**：`歌单`（歌单大厅数据源）与 `EXO&유재석`（合唱分组）不是普通歌手，不生成静态页。该列表见脚本顶部 `SPECIAL_KEYS`。
- **`--check` 的 sitemap 比对忽略 `lastmod`**：只比 URL 集合，否则每天都会因日期变化而误报过期。
- **自动清理**：数据源中已不存在的歌手，其静态页会被删除。
