// 生成交给 GPT 的现状截图，输出到 docs/design/
// 用法：先 npm run dev，再 node scripts/design-shots.mjs
// 会清空测试用浏览器配置里的数据，不影响你手机或正式环境。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'docs', 'design');
const ICON = path.join(process.cwd(), 'public', 'icons', 'icon-512.png');
fs.mkdirSync(OUT, { recursive: true });

const done = [];
const failed = [];
/** 单张失败不影响后面的，最后统一报告 */
async function shot(page, name, prepare) {
  try {
    if (prepare) await prepare();
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    done.push(name);
  } catch (e) {
    failed.push(`${name}: ${String(e).split('\n')[0].slice(0, 90)}`);
  }
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 400, height: 880 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

await p.goto('http://localhost:5173/#/');
await p.waitForSelector('text=今日复习');
await p.evaluate(async () => {
  for (const t of window.__db.tables) await t.clear();
});
await p.reload();

// ---- 空状态 ----
await p.waitForSelector('.goal-card');
await shot(p, 'empty-today.png');
await shot(p, 'empty-library.png', async () => {
  await p.click('a[href="#/library"]');
  await p.waitForSelector('text=还没有笔记');
});

// ---- 录入页：空表单与填好的表单 ----
await p.click('a[href="#/add"]');
await shot(p, 'add-empty.png', () => p.waitForSelector('text=录入笔记'));
await p.fill('input[placeholder*="马克思"]', '剩余价值理论');
await p.fill('input[list="subject-list"]', '政治');
await p.fill('input[placeholder*="第三章"]', '第三章, 易错');
await p.fill(
  'textarea',
  '## 剩余价值\n\n资本家榨取剩余价值的两种方法：\n\n- **绝对剩余价值**：延长工作日\n- **相对剩余价值**：缩短必要劳动时间\n\n> 剩余价值是雇佣工人创造的、被无偿占有的、超过劳动力价值的那部分价值。\n\nQ: 什么是剩余价值？\nA: 工人创造的超过劳动力价值的部分\n---\nQ: 绝对剩余价值靠什么获得？\nA: 延长工作日',
);
await p.locator('input[type=file][multiple]').setInputFiles([ICON, ICON]);
await p.waitForFunction(() => document.querySelectorAll('.thumb img').length === 2);
await shot(p, 'add-filled.png');

// ---- 拆分卡片 ----
await p.click('text=保存笔记');
await p.waitForSelector('button:has-text("拆分卡片")');
await p.click('button:has-text("拆分卡片")');
await shot(p, 'split-cards.png', () => p.waitForSelector('text=预览：将创建'));
await p.click('button:has-text("创建 2 张卡片")');
await p.waitForSelector('text=问答卡片（2）');

// ---- 遮挡编辑器 ----
await shot(p, 'mask-editor.png', async () => {
  await p.click('a:has-text("编辑")');
  await p.waitForSelector('text=编辑笔记');
  await p.locator('.thumb img').first().click();
  await p.waitForSelector('.mask-editor .mask-canvas img');
  await p.waitForTimeout(300);
  const box = await p.locator('.mask-canvas').boundingBox();
  const drag = async (x1, y1, x2, y2) => {
    await p.mouse.move(box.x + box.width * x1, box.y + box.height * y1);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * x2, box.y + box.height * y2, { steps: 4 });
    await p.mouse.up();
  };
  await drag(0.12, 0.14, 0.45, 0.32);
  await drag(0.5, 0.6, 0.9, 0.78);
});
await p.click('.mask-toolbar button:has-text("完成")');
await p.click('text=保存修改');
await p.waitForSelector('text=遮挡自测');

// ---- 笔记详情与大图 ----
await shot(p, 'note-detail.png', () => p.waitForSelector('text=问答卡片（2）'));
await shot(p, 'lightbox.png', async () => {
  await p.locator('.occluded').first().click();
  await p.waitForSelector('.lightbox img');
  await p.waitForTimeout(300);
});
await p.keyboard.press('Escape');

// ---- 第二条笔记 + 考试日期 ----
await p.click('a[href="#/add"]');
await p.fill('input[placeholder*="马克思"]', 'abandon 的用法');
await p.fill('input[list="subject-list"]', '英语');
await p.fill('textarea', 'abandon oneself to 沉湎于\n\nHe abandoned himself to despair.');
await p.click('text=保存笔记');
await p.click('button:has-text("暂不")');
await p.evaluate(
  async ({ t, ex }) => {
    await window.__db.notes.toCollection().modify({ dueDate: t });
    await window.__db.cards.toCollection().modify({ dueDate: t });
    const s = await window.__db.settings.get('default');
    await window.__db.settings.put({ ...s, examDate: ex, updatedAt: Date.now() });
  },
  { t: ymd(new Date()), ex: ymd(new Date(Date.now() + 424 * 86400000)) },
);

// ---- 定目标 ----
await p.click('a[href="#/"]');
await p.waitForSelector('button:has-text("定今天的目标")');
await shot(p, 'goal-none.png');
await p.click('button:has-text("定今天的目标")');
await p.waitForSelector('.goal-editor');
await p.fill('.goal-editor input.input', '4');
await p.fill('.goal-editor textarea', '政治第三章看完\n英语真题一套\n数学背 20 个公式');
await shot(p, 'goal-editor.png');
await p.click('button:has-text("定下来")');
await p.waitForSelector('.goal-card[data-state="active"]');
await p.locator('.goal-task input').nth(0).click();
await p.waitForTimeout(400);
await shot(p, 'goal-active.png');

// ---- 复习流程 ----
await p.click('text=开始复习');
await shot(p, 'review-hidden.png', () => p.waitForSelector('text=显示内容'));
await p.click('button:has-text("显示内容")');
await shot(p, 'review.png', () => p.waitForSelector('.rating-bar'));
for (let i = 0; i < 10; i++) {
  if (await p.locator('text=本次复习完成').count()) break;
  if (await p.locator('.rating-bar').count()) await p.click(i % 2 ? '.rating-2' : '.rating-3');
  else if (await p.locator('button:has-text("显示内容")').count()) await p.click('button:has-text("显示内容")');
  else if (await p.locator('button:has-text("再看一遍")').count()) await p.click('button:has-text("再看一遍")');
  await p.waitForTimeout(300);
}
await shot(p, 'review-done.png', () => p.waitForSelector('text=本次复习完成'));
await p.click('text=返回今日');

// ---- 达成与打卡图 ----
await p.evaluate(async (t) => {
  const g = await window.__db.dailyGoals.get(t);
  await window.__db.dailyGoals.put({
    ...g,
    reviewTarget: 2,
    tasks: g.tasks.map((x) => ({ ...x, done: true })),
    updatedAt: Date.now(),
  });
}, ymd(new Date()));
await shot(p, 'goal-achieved.png', () => p.waitForSelector('.goal-card[data-state="achieved"]'));
await shot(p, 'share-dialog.png', async () => {
  await p.click('button:has-text("生成今日打卡图")');
  await p.waitForSelector('.share-card-preview img', { timeout: 20000 });
});
try {
  // 存档一张打卡图，缩到 720 宽省体积
  const dataUrl = await p.evaluate(() => {
    const src = document.querySelector('.share-card-dialog canvas');
    const w = 720;
    const small = document.createElement('canvas');
    small.width = w;
    small.height = Math.round((src.height / src.width) * w);
    small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
    return small.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, 'card-current.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  done.push('card-current.png');
} catch (e) {
  failed.push('card-current.png: ' + String(e).slice(0, 80));
}
await p.keyboard.press('Escape');

// ---- 其余页面 ----
await shot(p, 'library.png', async () => {
  await p.click('a[href="#/library"]');
  await p.waitForSelector('text=2 条笔记');
});
await shot(p, 'note-detail-history.png', async () => {
  await p.click('text=剩余价值理论');
  await p.waitForSelector('text=复习记录');
  await p.click('text=展开');
  await p.waitForTimeout(200);
});
await shot(p, 'stats.png', async () => {
  await p.click('a[href="#/stats"]');
  await p.waitForSelector('text=今日已复习');
});
await shot(p, 'settings.png', async () => {
  await p.click('a[href="#/settings"]');
  await p.waitForSelector('.section-title:has-text("复习参数")');
});

// ---- 深色模式 ----
// 必须用同一个上下文切换配色：新建 context 的存储是隔离的，数据带不过去
await p.emulateMedia({ colorScheme: 'dark' });
// 浅色那轮已经把今天的都复习完了，把到期日拨回今天，深色才有东西可拍
await p.evaluate(async (t) => {
  await window.__db.notes.toCollection().modify({ dueDate: t });
  await window.__db.cards.toCollection().modify({ dueDate: t });
}, ymd(new Date()));
await p.goto('http://localhost:5173/#/');
await p.waitForSelector('.goal-card');
await shot(p, 'dark-today.png');
await shot(p, 'dark-review.png', async () => {
  await p.click('text=开始复习');
  await p.waitForSelector('text=显示内容');
  await p.click('button:has-text("显示内容")');
  await p.waitForSelector('.rating-bar');
});
await shot(p, 'dark-library.png', async () => {
  await p.goto('http://localhost:5173/#/library');
  await p.waitForSelector('text=2 条笔记');
});
await shot(p, 'dark-note-detail.png', async () => {
  await p.click('text=剩余价值理论');
  await p.waitForSelector('text=问答卡片');
});
await shot(p, 'dark-settings.png', async () => {
  await p.goto('http://localhost:5173/#/settings');
  await p.waitForSelector('.section-title:has-text("复习参数")');
});

await browser.close();
console.log(`成功 ${done.length} 张：${done.join(' ')}`);
if (failed.length) console.log(`失败 ${failed.length} 张：\n  ${failed.join('\n  ')}`);
console.log('页面错误：', errors.length ? errors : '无');
