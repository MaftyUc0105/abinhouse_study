// 把 docs/design/icons/ 下的 SVG 导出成各尺寸 PNG（安卓图标 + 网页图标）。
// 用法：node scripts/export-icons.mjs
// SVG 由 GPT 设计，见 bridge.md 的 T-005；这里只负责光栅化。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC = path.join(root, 'docs', 'design', 'icons');
const RES = path.join(root, 'android', 'app', 'src', 'main', 'res');
const WEB = path.join(root, 'public', 'icons');
/** 自适应图标的底色，与 values/ic_launcher_background.xml 保持一致 */
const BRAND = '#17604f';

const read = (n) => fs.readFileSync(path.join(SRC, n), 'utf8');
const square = read('square.svg');
const foreground = read('foreground.svg');
const round = read('round.svg');
const notification = read('notification.svg');

const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

/** 要生成的全部文件：[输出路径, svg, 边长, 可选底色] */
const jobs = [];
for (const [d, f] of DENSITIES) {
  jobs.push([path.join(RES, `mipmap-${d}`, 'ic_launcher.png'), square, Math.round(48 * f), null]);
  jobs.push([path.join(RES, `mipmap-${d}`, 'ic_launcher_round.png'), round, Math.round(48 * f), null]);
  jobs.push([path.join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'), foreground, Math.round(108 * f), null]);
  jobs.push([path.join(RES, `drawable-${d}`, 'ic_stat_icon_config_sample.png'), notification, Math.round(24 * f), null]);
}
jobs.push([path.join(WEB, 'icon-192.png'), square, 192, null]);
jobs.push([path.join(WEB, 'icon-512.png'), square, 512, null]);
// maskable 要满版底色，四周会被系统裁切，所以前景不能带圆角
jobs.push([path.join(WEB, 'icon-512-maskable.png'), foreground, 512, BRAND]);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto('about:blank');

for (const [out, svg, size, bg] of jobs) {
  const dataUrl = await page.evaluate(
    async ({ svg, size, bg }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.drawImage(img, 0, 0, size, size);
      return c.toDataURL('image/png');
    },
    { svg, size, bg },
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

await browser.close();

// 网页端的矢量图标直接用方形那版
fs.writeFileSync(path.join(WEB, 'icon.svg'), square);
// 自适应图标底色
fs.writeFileSync(
  path.join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND.toUpperCase()}</color>\n</resources>\n`,
);

console.log(`导出 ${jobs.length} 个 PNG，加 icon.svg 与 ic_launcher_background.xml`);
for (const [out] of jobs.slice(0, 4)) console.log('  例如', path.relative(root, out));
