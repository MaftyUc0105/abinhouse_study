// 端到端冒烟测试（需先 npm run dev；用法：node scripts/smoke.mjs）：录入(文字+图片) → 拆卡 → 把到期日改为今天 → 复习评分 → 详情校验 → 导出 → 清空 → 导入
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:5173/';
const ICON = 'D:/0 AI-code/abinhouse_study/public/icons/icon-512.png';
const OUT = process.env.SMOKE_OUT || process.cwd();
const errors = [];
const checks = [];
function check(name, ok, extra = '') {
  checks.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, acceptDownloads: true, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE + '#/');
await page.waitForSelector('text=今日复习');
await page.evaluate(async () => { const t = window.__db.tables; for (const tb of t) await tb.clear(); });
await page.reload();
await page.waitForSelector('text=今天没有待复习的内容');
check('今日页空状态', true);

// ---- 录入笔记（文字 + 图片）----
await page.click('a[href="#/add"]');
await page.fill('input[placeholder*="马克思"]', '剩余价值理论');
await page.fill('input[list="subject-list"]', '政治');
await page.fill('input[placeholder*="第三章"]', '第三章, 重点');
await page.fill('textarea', '## 剩余价值\n\n- 绝对剩余价值\n- 相对剩余价值\n\nQ: 什么是剩余价值？\nA: 工人创造的超过劳动力价值的部分\n---\nQ: 绝对剩余价值靠什么？\nA: 延长工作日');
const gallery = page.locator('input[type=file][multiple]');
await gallery.setInputFiles([ICON, ICON]);
await page.waitForSelector('.thumb img', { timeout: 15000 });
await page.waitForFunction(() => document.querySelectorAll('.thumb img').length === 2);
check('图片压缩后显示 2 张缩略图', (await page.locator('.thumb').count()) === 2);
const sizeText = await page.locator('.field label .tiny').first().textContent();
check('图片大小提示', /2 张/.test(sizeText ?? ''), sizeText ?? '');
// 删除第二张再拍照加一张
await page.locator('.thumb-actions .del').nth(1).click();
await page.locator('input[type=file][capture]').setInputFiles(ICON);
await page.waitForFunction(() => document.querySelectorAll('.thumb img').length === 2);
await page.click('text=保存笔记');
await page.waitForSelector('text=拆分卡片');
check('保存后弹出拆分提示', true);
await page.click('button:has-text("拆分卡片")');
await page.waitForSelector('text=预览：将创建');
const previewTitle = await page.locator('.section-title').filter({ hasText: '预览' }).textContent();
check('批量拆卡解析出 2 张', /2 张/.test(previewTitle ?? ''), previewTitle ?? '');
await page.click('button:has-text("创建 2 张卡片")');
await page.waitForSelector('text=问答卡片（2）');
check('详情页显示 2 张卡片', true);
const noteImgs = await page.locator('.photo-list img').count();
check('详情页显示 2 张照片', noteImgs === 2, String(noteImgs));

// 第二条：纯文字笔记
await page.click('a[href="#/add"]');
await page.fill('input[placeholder*="马克思"]', '唯物辩证法总特征');
await page.fill('textarea', '联系与发展');
await page.click('text=保存笔记');
await page.waitForSelector('button:has-text("暂不")');
await page.click('button:has-text("暂不")');
await page.waitForSelector('text=已保存，明天开始复习');
check('科目自动沿用上次', (await page.inputValue('input[list="subject-list"]')) === '政治');

// ---- 知识库 ----
await page.click('a[href="#/library"]');
await page.waitForSelector('text=2 条笔记');
await page.fill('input[placeholder*="搜索"]', '辩证');
await page.waitForTimeout(200);
check('知识库搜索过滤', (await page.locator('.list .card').count()) === 1);

// ---- 把全部到期日改到今天，进入复习 ----
const counts = await page.evaluate(async () => {
  const db = window.__db;
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await db.notes.toCollection().modify({ dueDate: t });
  await db.cards.toCollection().modify({ dueDate: t });
  return { notes: await db.notes.count(), cards: await db.cards.count(), images: await db.images.count() };
});
check('数据库计数', counts.notes === 2 && counts.cards === 2 && counts.images === 2, JSON.stringify(counts));
await page.click('a[href="#/"]');
await page.waitForSelector('text=开始复习');
check('今日显示 4 条', await page.locator('.banner-num', { hasText: '4' }).isVisible());
check('Tab 角标显示 4', (await page.locator('.tab-count').textContent()) === '4');
await page.screenshot({ path: path.join(OUT, 'today.png'), fullPage: true });
await page.click('text=开始复习');
await page.waitForSelector('text=显示内容');

// 第一条：稍后 → 跳过 → 显示 → 忘了（触发当次重现）
await page.click('button:has-text("稍后")');
await page.click('button:has-text("显示内容")');
await page.waitForSelector('.rating-bar');
await page.screenshot({ path: path.join(OUT, 'review.png'), fullPage: true });
const previews = await page.locator('.rating-btn small').allTextContents();
check('评分按钮显示间隔预览', previews.join(',').includes('天后'), previews.join(','));
await page.click('.rating-0');
await page.waitForSelector('text=显示内容');
await page.click('button:has-text("显示内容")');
await page.click('.rating-2');
await page.waitForSelector('text=显示内容');
await page.click('button:has-text("显示内容")');
await page.click('.rating-3');
await page.waitForSelector('text=显示内容');
await page.click('button:has-text("显示内容")');
await page.click('.rating-1');
// 重现项
await page.waitForSelector('text=再看一遍，知道了');
check('忘了的条目当次重现', true);
await page.click('text=再看一遍，知道了');
await page.waitForSelector('text=本次复习完成');
const doneText = await page.locator('.empty').textContent();
check('完成页统计 4 条', /共评分 4 条/.test(doneText ?? ''), doneText ?? '');

// ---- 验证数据库状态 ----
const after = await page.evaluate(async () => {
  const db = window.__db;
  const notes = await db.notes.toArray();
  const cards = await db.cards.toArray();
  const logs = await db.reviewLogs.toArray();
  return {
    stages: [...notes, ...cards].map((x) => x.stage).sort(),
    logs: logs.length,
    ratings: logs.map((l) => l.rating).sort(),
    reviewCounts: [...notes, ...cards].map((x) => x.reviewCount),
  };
});
check('评分后 stage 分布 [0,0,1,2]', JSON.stringify(after.stages) === '[0,0,1,2]', JSON.stringify(after));
check('写入 4 条日志', after.logs === 4);
check('重现不重复计数', after.reviewCounts.every((c) => c === 1));

await page.click('text=返回今日');
await page.waitForSelector('text=今天没有待复习的内容');
check('复习后今日清空', true);

// ---- 统计页 ----
await page.click('a[href="#/stats"]');
await page.waitForSelector('text=今日已复习');
const statsText = await page.locator('.stat-grid').textContent();
check('统计今日已复习 4', /4今日已复习/.test(statsText ?? ''), statsText ?? '');

// ---- 详情：历史记录 ----
await page.click('a[href="#/library"]');
await page.click('text=剩余价值理论');
await page.waitForSelector('text=复习记录（3）');
await page.click('text=展开');
check('时间线显示', (await page.locator('.timeline-item').count()) === 3);

// ---- 导出 → 清空 → 导入 ----
await page.click('a[href="#/settings"]');
await page.waitForSelector('text=导出备份');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=导出备份')]);
const zipPath = path.join(OUT, download.suggestedFilename());
await download.saveAs(zipPath);
check('导出 ZIP', fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1000, `${download.suggestedFilename()} ${fs.statSync(zipPath).size}B`);

await page.click('text=清空全部数据');
await page.click('.dialog button:has-text("清空")');
await page.waitForSelector('text=已清空全部数据');
const empty = await page.evaluate(async () => (await window.__db.notes.count()) + (await window.__db.images.count()));
check('清空后为 0', empty === 0);

await page.click('label:has-text("覆盖本机")');
await page.locator('input[type=file][accept*="zip"]').setInputFiles(zipPath);
await page.click('.dialog button:has-text("导入")');
await page.waitForSelector('text=导入完成');
const importText = await page.locator('text=导入：笔记').textContent();
check('导入结果', /笔记 2 · 卡片 2 · 照片 2 · 记录 4/.test(importText ?? ''), importText ?? '');
const restored = await page.evaluate(async () => {
  const imgs = await window.__db.images.toArray();
  return { n: imgs.length, sizesOk: imgs.every((i) => i.blob instanceof Blob && i.blob.size === i.size && i.size > 1000) };
});
check('导入后图片 blob 完整', restored.n === 2 && restored.sizesOk, JSON.stringify(restored));

// 复习参数校验
await page.fill('input[value="1, 2, 4, 7, 15, 30, 60"]', '1, 1');
await page.click('text=保存参数');
await page.waitForSelector('text=阶梯必须严格递增');
check('阶梯校验', true);

await page.screenshot({ path: path.join(OUT, 'settings.png'), fullPage: true });
await page.click('a[href="#/library"]');
await page.waitForSelector('text=2 条笔记');
await page.screenshot({ path: path.join(OUT, 'library.png'), fullPage: true });

await browser.close();
console.log('\nERRORS:', errors.length ? errors : 'none');
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length || errors.length ? 1 : 0);
