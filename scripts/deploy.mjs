// 构建并发布到 GitHub Pages 的 gh-pages 分支。用法：npm run deploy
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const remote = out('git remote get-url origin');
const repo = remote.replace(/\.git$/, '').split('/').pop();
const base = `/${repo}/`;
const sha = out('git rev-parse --short HEAD');

console.log(`\n> 测试`);
run('npx vitest run');

console.log(`\n> 构建（base = ${base}）`);
run('npm run build', { env: { ...process.env, VITE_BASE: base } });

// GitHub Pages 默认会用 Jekyll 处理，跳过它；404 回退到首页
fs.writeFileSync('dist/.nojekyll', '');
fs.copyFileSync('dist/index.html', 'dist/404.html');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ghpages-'));
fs.cpSync('dist', tmp, { recursive: true });

console.log(`\n> 推送到 gh-pages`);
const git = (args) => run(`git ${args}`, { cwd: tmp });
git('init -q -b gh-pages');
git('add -A');
git(`-c user.name="${out('git config user.name')}" -c user.email="${out('git config user.email')}" commit -q -m "deploy ${sha}"`);
git(`push -f "${remote}" gh-pages`);
fs.rmSync(tmp, { recursive: true, force: true });

const owner = remote.replace(/\.git$/, '').split('/').slice(-2)[0];
console.log(`\n完成：https://${owner.toLowerCase()}.github.io/${repo}/`);
