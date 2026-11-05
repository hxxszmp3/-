/**
 * 通过 GitHub API 追加一条说明 commit（不改变 tree，只补充提交信息）。
 * 用法：GH_TOKEN=xxx node tools/_api_note.js <message-file>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'hxxszmp3/-';
const BRANCH = 'main';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';

if (!TOKEN) { console.error('✗ 未设置 GH_TOKEN'); process.exit(1); }

const msgFile = process.argv[2];
if (!msgFile) { console.error('用法: node tools/_api_note.js <message-file>'); process.exit(1); }
const message = fs.readFileSync(msgFile, 'utf8').trim();

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

const ref = api('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH);
const head = api('GET', '/repos/' + REPO + '/git/commits/' + ref.object.sha);
const commit = api('POST', '/repos/' + REPO + '/git/commits', {
  message: message,
  tree: head.tree.sha,          // tree 不变
  parents: [ref.object.sha],
  author: { name: 'dellsq', email: 'dellsq@users.noreply.github.com' },
  committer: { name: 'dellsq', email: 'dellsq@users.noreply.github.com' },
});
api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + BRANCH, { sha: commit.sha, force: false });
console.log('  ✓ 说明 commit: ' + commit.sha.slice(0, 7));
console.log('  ' + message.split('\n')[0]);
