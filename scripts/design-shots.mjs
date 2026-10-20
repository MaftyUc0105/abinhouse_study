// 生成交给 GPT 的现状截图，输出到 docs/design/
// 用法：先 npm run dev，再 node scripts/design-shots.mjs
// 会清空测试用浏览器配置里的数据，不影响你手机或正式环境。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'docs', 'design');
fs.mkdirSync(OUT, { recursive: true });
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name), fullPage: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 400, height: 880 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

await p.goto('http://localhost:5173/#/');
await p.waitForSelector('text=今日复习');
await p.evaluate(async () => {
  for (const t of window.__db.tables) await t.clear();
});
await p.reload();
await p.waitForSelector('.goal-card');
await shot(p, 'goal-none.png');

// 两条笔记 + 考试日期
for (const [title, subject, body] of [
  ['剩余价值理论', '政治', '## 剩余价值\n\n- 绝对剩余价值：延长工作日\n- 相对剩余价值：缩短必要劳动时间'],
  ['abandon 的用法', '英语', 'abandon oneself to 沉湎于'],
]) {
  await p.click('a[href="#/add"]');
  await p.fill('input[placeholder*="马克思"]', title);
  await p.fill('input[list="subject-list"]', subject);
  await p.fill('textarea', body);
  await p.click('text=保存笔记');
  await p.click('button:has-text("暂不")');
}
await p.evaluate(async (t) => {
  await window.__db.notes.toCollection().modify({ dueDate: t });
  const s = await window.__db.settings.get('default');
  const ex = new Date(Date.now() + 60 * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  await window.__db.settings.put({
    ...s,
    examDate: `${ex.getFullYear()}-${pad(ex.getMonth() + 1)}-${pad(ex.getDate())}`,
    updatedAt: Date.now(),
  });
}, todayStr());

// 定目标 → 进行中
await p.click('a[href="#/"]');
await p.click('button:has-text("定今天的目标")');
await p.waitForSelector('.goal-editor');
await p.fill('.goal-editor input.input', '6');
await p.fill('.goal-editor textarea', '政治第三章看完\n英语真题一套\n数学背 20 个公式');
await shot(p, 'goal-editor.png');
await p.click('button:has-text("定下来")');
await p.waitForSelector('.goal-card[data-state="active"]');
await p.locator('.goal-task input').nth(0).click();
await p.waitForTimeout(400);
await shot(p, 'goal-active.png');

// 复习页
await p.click('text=开始复习');
await p.waitForSelector('text=显示内容');
await shot(p, 'review-hidden.png');
await p.click('button:has-text("显示内容")');
await p.waitForSelector('.rating-bar');
await shot(p, 'review.png');
await p.click('.rating-2');
await p.waitForTimeout(300);
await p.click('button:has-text("显示内容")');
await p.click('.rating-3');
await p.waitForSelector('text=本次复习完成');
await p.click('text=返回今日');

// 达成态
await p.evaluate(async (t) => {
  const g = await window.__db.dailyGoals.get(t);
  await window.__db.dailyGoals.put({ ...g, reviewTarget: 2, tasks: g.tasks.map((x) => ({ ...x, done: true })), updatedAt: Date.now() });
}, todayStr());
await p.waitForSelector('.goal-card[data-state="achieved"]');
await shot(p, 'goal-achieved.png');

// 打卡图
await p.click('button:has-text("生成今日打卡图")');
await p.waitForSelector('.share-card-preview img', { timeout: 20000 });
await shot(p, 'share-dialog.png');
// 原图 1080×1440 约 500KB，缩到 720 宽再存，够看清排版又不撑大仓库
const dataUrl = await p.evaluate(async () => {
  const src = document.querySelector('.share-card-dialog canvas');
  const w = 720;
  const h = Math.round((src.height / src.width) * w);
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  small.getContext('2d').drawImage(src, 0, 0, w, h);
  return small.toDataURL('image/png');
});
fs.writeFileSync(path.join(OUT, 'card-current.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
await p.keyboard.press('Escape');

// 其余页面
for (const [href, name, wait] of [
  ['#/library', 'library.png', 'text=2 条笔记'],
  ['#/stats', 'stats.png', 'text=今日已复习'],
  ['#/settings', 'settings.png', '.section-title:has-text("复习参数")'],
]) {
  await p.click(`a[href="${href}"]`);
  await p.waitForSelector(wait);
  await shot(p, name);
}

// 深色模式下的首页与复习页
await ctx.close();
const dark = await browser.newContext({ viewport: { width: 400, height: 880 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const p2 = await dark.newPage();
await p2.goto('http://localhost:5173/#/');
await p2.waitForSelector('.goal-card');
await shot(p2, 'dark-today.png');
await p2.click('a[href="#/settings"]');
await p2.waitForSelector('.section-title:has-text("复习参数")');
await shot(p2, 'dark-settings.png');

await browser.close();
console.log('截图输出到 docs/design/：', fs.readdirSync(OUT).join(' '));
console.log('页面错误：', errors.length ? errors : '无');
