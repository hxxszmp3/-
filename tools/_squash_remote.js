/**
 * 清理远端历史里的中间 commit（API 推送产生）。
 * 用法：node tools/_squash_remote.js
 *
 * 场景：git push 因 TLS/代理问题失败，改用 GitHub API 推送时
 *       可能产生多个内容等价的 commit。API 无法 force-push，
 *       改用「重建 commit + 更新 ref」的方式压平历史。
 */
'use strict';
const fs = require('fs');
const path = require('path');
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

function api(method, endpoint, body) {
  const args = ['-s', '--noproxy', '*', '-X', method,
    '-H', 'Authorization: token ' + TOKEN,
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'User-Agent: workbuddy'];
  if (body) {
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

// 1) 当前分支状态
const ref = api('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH);
const headSha = ref.object.sha;
const headCommit = api('GET', '/repos/' + REPO + '/git/commits/' + headSha);
console.log('  远端 HEAD: ' + headSha.slice(0, 7) + '  ' + headCommit.message.split('\n')[0].slice(0, 50));

const parents = headCommit.parents || [];
if (parents.length !== 1) { console.log('  · 父提交数不为 1，无需处理'); process.exit(0); }

const parent = parents[0].sha;
const parentCommit = api('GET', '/repos/' + REPO + '/git/commits/' + parent);
console.log('  父提交: ' + parent.slice(0, 7) + '  ' + parentCommit.message.split('\n')[0].slice(0, 50));

// 2) 父提交的父提交（要压平成的那一层）
if (parentCommit.parents.length !== 1) { console.log('  · 祖父不存在，结束'); process.exit(0); }
const grandParent = parentCommit.parents[0].sha;
const grandParentCommit = api('GET', '/repos/' + REPO + '/git/commits/' + grandParent);
console.log('  祖父提交: ' + grandParent.slice(0, 7) + '  ' + grandParentCommit.message.split('\n')[0].slice(0, 50));

// 3) 检查：父提交的 tree 是否等于祖父的 tree（若相等说明父提交是空提交，可直接跳过）
if (parentCommit.tree.sha === grandParentCommit.tree.sha) {
  console.log('  · 父提交是空提交（tree 相同），直接把它从历史里去掉');
  // 用 force 更新 ref 指向祖父
  api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + BRANCH, { sha: grandParent, force: true });
  console.log('  ✓ 已压平 → ' + grandParent.slice(0, 7));
  process.exit(0);
}

// 4) 父提交有实际内容 → 重建一个 commit：
//    tree = HEAD 的完整 tree（保留所有文件内容，不丢任何改动）
//    parent = 祖父（跳过中间的 API 推送产物）
console.log('  · 重建 commit（tree 用 HEAD 的完整 tree，内容零丢失）');
const newCommit = api('POST', '/repos/' + REPO + '/git/commits', {
  message: headCommit.message,
  tree: headCommit.tree.sha,     // ← HEAD 的完整 tree，中间 commit 的内容都在里面
  parents: [grandParent],        // ← 跳过中间产物
  author: { name: headCommit.author.name, email: headCommit.author.email, date: headCommit.author.date },
  committer: { name: headCommit.committer.name, email: headCommit.committer.email, date: headCommit.committer.date },
});
api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + BRANCH, { sha: newCommit.sha, force: true });
console.log('  ✓ 已压平 → ' + newCommit.sha.slice(0, 7));

// 5) 再检查一次（可能需要多轮压平）
const newRef = api('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH);
const nc = api('GET', '/repos/' + REPO + '/git/commits/' + newRef.object.sha);
console.log('  现在 HEAD 的父提交: ' + nc.parents[0].sha.slice(0, 7));
if (nc.parents[0].sha !== grandParent) console.log('  ! 仍需再压一轮');
else console.log('  ✓ 历史已干净（HEAD 的父提交就是祖父）');
