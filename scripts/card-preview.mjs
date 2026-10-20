// 打卡图排版自检：直接调渲染器画出各种极端情况，输出到 docs/design/card/
// 用法：先 npm run dev，再 node scripts/card-preview.mjs
// 改完 cardTheme.ts 跑一下，确认文字不溢出、不重叠、任务 0 条和 5 条都排得住。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'docs', 'design', 'card');
fs.mkdirSync(OUT, { recursive: true });

const base = {
  date: '2026-10-20',
  dateLabel: '10 月 20 日',
  weekdayLabel: '周二',
  daysToExam: 424,
  achieved: true,
  hasGoal: true,
  reviewDone: 42,
  reviewTarget: 40,
  tasks: [],
  tasksDone: 0,
  streak: 23,
  studyDays: 58,
  totalReviews: 1864,
};
const task = (text, done = true) => ({ text, done });

const cases = {
  'achieved-3tasks': {
    ...base,
    tasks: [task('政治第三章看完'), task('英语真题一套'), task('数学背 20 个公式')],
    tasksDone: 3,
  },
  'achieved-0task': { ...base, tasks: [], tasksDone: 0 },
  'missed-5tasks': {
    ...base,
    achieved: false,
    reviewDone: 17,
    tasks: [
      task('政治第三章看完'),
      task('英语真题一套'),
      task('数学背 20 个公式', false),
      task('专业课笔记整理', false),
      task('错题本复盘', false),
    ],
    tasksDone: 2,
    streak: 0,
  },
  'missed-7tasks-overflow': {
    ...base,
    achieved: false,
    reviewDone: 3,
    tasks: Array.from({ length: 7 }, (_, i) => task(`第 ${i + 1} 件事`, i < 2)),
    tasksDone: 2,
    streak: 0,
  },
  'nogoal-noexam': {
    ...base,
    achieved: false,
    hasGoal: false,
    reviewTarget: 0,
    reviewDone: 9,
    tasks: [],
    daysToExam: null,
    streak: 0,
  },
  'long-text': {
    ...base,
    reviewDone: 128,
    reviewTarget: 120,
    tasks: [
      task('马克思主义基本原理概论第三章剩余价值理论与资本积累全部看完并整理笔记'),
      task('英语一历年真题阅读理解第二篇精翻并背诵全部生词', false),
    ],
    tasksDone: 1,
    streak: 100,
    studyDays: 365,
    totalReviews: 99999,
  },
  'exam-today': { ...base, daysToExam: 0, tasks: [task('最后一遍错题')], tasksDone: 1 },
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/#/');
await page.waitForSelector('text=今日复习');

for (const [name, data] of Object.entries(cases)) {
  const dataUrl = await page.evaluate(async (d) => {
    const { drawCard } = await import('/src/share/renderCard.ts');
    const { CARD_THEME } = await import('/src/share/cardTheme.ts');
    const canvas = document.createElement('canvas');
    drawCard(canvas, d, CARD_THEME);
    // 按 720 宽存档：够看清排版，又不会让仓库里的截图越积越大
    const w = 720;
    const small = document.createElement('canvas');
    small.width = w;
    small.height = Math.round((canvas.height / canvas.width) * w);
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    return small.toDataURL('image/png');
  }, data);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

await browser.close();
console.log('输出:', fs.readdirSync(OUT).join(' '));
console.log('页面错误:', errors.length ? errors : '无');
