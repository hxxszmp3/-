/**
 * 通过 GitHub API 推送（绕过 git 的 HTTPS/schannel 连接问题）。
 * 用法：node tools/_push_via_api.js
 *
 * 原理：把本地 commit 的 tree/blob 逐个上传到 GitHub，再创建 commit 并更新分支引用。
 * 适用于 git push 因 TLS/代理问题失败、但 API 可达的场景。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'hxxszmp3/-';
const BRANCH = 'main';
// Token 从环境变量读取，绝不硬编码进仓库
// （GitHub secret scanning 会拦截含 PAT 的文件，且明文入库不安全）
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('✗ 未设置 GH_TOKEN / GITHUB_TOKEN 环境变量');
  process.exit(1);
}
const API = 'https://api.github.com';

// 走 curl（--noproxy '*'），git 自身的 TLS 通道连不上 GitHub
function api(method, endpoint, body) {
  const args = ['-s', '--noproxy', '*', '-X', method,
    '-H', 'Authorization: token ' + TOKEN,
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'User-Agent: workbuddy'];
  if (body) {
    // 请求体可能很大（base64 几 MB），超过 Windows 命令行长度限制 → 走临时文件
    const tmp = path.join(ROOT, '.git', 'api-body.json');
    fs.writeFileSync(tmp, JSON.stringify(body));
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', '@' + tmp.replace(/\\/g, '/'));
  }
  args.push(API + endpoint);
  const out = execFileSync('curl', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message && parsed.documentation_url) {
    throw new Error(method + ' ' + endpoint + ' → ' + parsed.message);
  }
  return parsed;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

console.log('=== 通过 GitHub API 推送 ===');

// 1) 本地待推送的 commit
const localSha = git('rev-parse', 'HEAD');
const remoteSha = api('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH).object.sha;
console.log('  本地 HEAD: ' + localSha.slice(0, 7));
console.log('  远端 HEAD: ' + remoteSha.slice(0, 7));
if (localSha === remoteSha) { console.log('  ✓ 已是最新，无需推送'); process.exit(0); }

// 2) 基线：以远端当前 HEAD 为准
//    （远端可能已有前一次 API 推送的 commit，本地与远端 sha 不同但内容等价）
const remoteRef = api('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH);
const remoteShaNow = remoteRef.object.sha;
const remoteCommit = api('GET', '/repos/' + REPO + '/git/commits/' + remoteShaNow);
const baseTree = remoteCommit.tree.sha;
const baseCommitSha = remoteCommit.sha;
console.log('  远端基线 tree: ' + baseTree.slice(0, 7));

// 3) 对比本地 HEAD 与远端 tree，找出「内容不同」的文件
//    注意：不能只补「远端缺失的文件」——
//    远端已有但内容已被本地修改的文件（data.js/index.html 等）也必须重传，
//    否则远端会停留在旧内容上。
const remoteTree = api('GET', '/repos/' + REPO + '/git/trees/' + baseTree + '?recursive=1');
const remoteMap = new Map((remoteTree.tree || []).filter(t => t.type === 'blob')
  .map(t => [t.path, t.sha]));

// 本地 HEAD 的完整文件清单 + 各文件 blob sha
const lsOut = git('-c', 'core.quotepath=false', 'ls-tree', '-r', localSha).split('\n').filter(Boolean);
const localMap = new Map();
for (const line of lsOut) {
  const m = /\d+\s+blob\s+([0-9a-f]+)\t(.+)$/.exec(line);
  if (m) localMap.set(m[2], m[1]);
}
const changed = [...localMap.keys()].filter(f => remoteMap.get(f) !== localMap.get(f));
console.log('  内容不一致文件: ' + changed.length + ' 个');

// 远端多出来的文件（本地已删除的）→ 记下来，在 tree 里剔除
const localSet = new Set(localMap.keys());
const removed = (remoteTree.tree || []).filter(t => t.type === 'blob' && !localSet.has(t.path)).map(t => t.path);
if (removed.length) console.log('  远端多余文件（本地已删）: ' + removed.length + ' 个 → ' + removed.join(', '));

const changedSet = new Set(changed);

// 4) 构造新 tree：基线 tree + 变更文件（用本地 blob sha）
//    GitHub 不允许直接引用本地 blob sha，必须先上传 blob
const baseTreeResp = api('GET', '/repos/' + REPO + '/git/trees/' + baseTree + '?recursive=1');
const baseEntries = new Map((baseTreeResp.tree || []).map(t => [t.path, t]));

const uploadedBlobs = new Map();
let uploaded = 0, reused = 0;

for (const file of changed) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { console.log('  · 删除: ' + file); continue; }
  const content = fs.readFileSync(abs);
  // 小文件直接走 contents API，大文件走 blobs API
  const res = api('POST', '/repos/' + REPO + '/git/blobs',
    { content: content.toString('base64'), encoding: 'base64' });
  uploadedBlobs.set(file, res.sha);
  uploaded++;
}
console.log('  已上传 blob: ' + uploaded + ' 个');

// 5) 构造 tree entries
const treeEntries = [];
for (const [file, sha] of uploadedBlobs) {
  const old = baseEntries.get(file);
  const mode = old ? old.mode : '100644';
  treeEntries.push({ path: file, mode: mode, type: 'blob', sha: sha });
}
console.log('  tree entries: ' + treeEntries.length);

// 6) 创建新 tree：base_tree = 远端 tree，entries = 变更文件
const newTree = api('POST', '/repos/' + REPO + '/git/trees',
  { base_tree: baseTree, tree: treeEntries });
console.log('  新 tree: ' + newTree.sha.slice(0, 7));

// 7) 创建 commit（父提交 = 远端当前 HEAD）
const msg = git('log', '-1', '--pretty=%B', localSha).trim();
const commit = api('POST', '/repos/' + REPO + '/git/commits', {
  message: msg,
  tree: newTree.sha,
  parents: [baseCommitSha],
  author: { name: git('log', '-1', '--pretty=%an', localSha).trim(),
            email: git('log', '-1', '--pretty=%ae', localSha).trim() },
  committer: { name: git('log', '-1', '--pretty=%cn', localSha).trim(),
               email: git('log', '-1', '--pretty=%ce', localSha).trim() },
});
console.log('  新 commit: ' + commit.sha.slice(0, 7));

// 8) 更新分支引用
api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + BRANCH, {
  sha: commit.sha,
  force: false,
});
console.log('  ✓ 分支已更新: ' + BRANCH);

// 9) 同步本地 remote 引用（远端 commit 对象不在本地，update-ref 会失败，属正常）
//    本地与远端 sha 不同是预期状态 —— git push 走的是 API，绕开了对象传输
try { git('update-ref', 'refs/remotes/origin/main', commit.sha); }
catch (e) { console.log('  · 本地 origin/main 引用未同步（远端对象不在本地，属预期）'); }

console.log('\n完成。远端 ' + BRANCH + ' → ' + commit.sha.slice(0, 7));
