/**
 * 把每日打卡数据画成一张图。所有颜色、字号、间距都取自 cardTheme.ts，
 * 美术调整请改主题文件，不要改这里的排版逻辑。
 */
import { CARD_THEME, type CardTextStyle, type CardTheme } from './cardTheme';
import type { ShareCardData } from './cardData';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function applyText(ctx: CanvasRenderingContext2D, t: CardTextStyle, theme: CardTheme) {
  ctx.font = `${t.weight} ${t.size}px ${theme.fontFamily}`;
  ctx.fillStyle = t.color;
  ctx.letterSpacing = `${t.tracking ?? 0}px`;
}

/** 超出宽度时截断并加省略号 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function paintBackground(ctx: CanvasRenderingContext2D, theme: CardTheme) {
  const { width: w, height: h, background: bg } = theme;
  if (bg.type === 'solid' || bg.stops.length < 2) {
    ctx.fillStyle = bg.stops[0]?.color ?? '#2563eb';
  } else {
    const rad = ((bg.angle - 90) * Math.PI) / 180;
    const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const cx = w / 2;
    const cy = h / 2;
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    for (const s of bg.stops) grad.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, w, h);

  for (const b of theme.blobs) {
    ctx.beginPath();
    ctx.arc(b.x * w, b.y * h, b.r * w, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
  }
}

/** 在 canvas 上画出打卡图 */
export function drawCard(canvas: HTMLCanvasElement, data: ShareCardData, theme: CardTheme = CARD_THEME): void {
  const { width: W, height: H, padding: P, scale } = theme;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas');
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  paintBackground(ctx, theme);

  // ---- 顶部：日期 + 倒计时 ----
  let y = P + theme.text.date.size;
  applyText(ctx, theme.text.date, theme);
  ctx.textAlign = 'left';
  ctx.fillText(data.dateLabel, P, y);

  applyText(ctx, theme.text.weekday, theme);
  ctx.fillText(data.weekdayLabel, P, y + theme.text.weekday.size + 14);

  if (data.daysToExam !== null) {
    const pill = theme.countdownPill;
    applyText(ctx, theme.text.countdown, theme);
    const label = data.daysToExam === 0 ? '今天考试' : `距考研 ${data.daysToExam} 天`;
    const tw = ctx.measureText(label).width;
    const pw = tw + pill.paddingX * 2;
    const px = W - P - pw;
    const py = P + 6;
    ctx.fillStyle = pill.fill;
    roundRect(ctx, px, py, pw, pill.height, pill.radius);
    ctx.fill();
    applyText(ctx, theme.text.countdown, theme);
    ctx.fillText(label, px + pill.paddingX, py + pill.height / 2 + theme.text.countdown.size * 0.36);
  }

  y = y + theme.text.weekday.size + 14 + theme.sectionGap;

  // ---- 主面板 ----
  // 先量内容高度，面板按内容收缩并在剩余空间里居中。任务少时不会留一大片空白，
  // 任务多时撑到可用高度上限。画布尺寸始终是 1080×1440，方便发小红书。
  const panel = theme.panel;
  const panelX = P;
  const panelW = W - P * 2;
  const panelTop = y;
  const availableH = H - P - theme.text.watermark.size - 28 - panelTop;

  const shownTasks = data.tasks.slice(0, theme.tasks.max);
  const overflowTasks = data.tasks.length - shownTasks.length;
  const tasksBlockH =
    shownTasks.length === 0
      ? 0
      : theme.sectionGap +
        shownTasks.length * theme.tasks.rowHeight +
        (overflowTasks > 0 ? theme.text.statLabel.size + 20 : 0);
  const contentH =
    panel.padding * 2 +
    theme.statusBadge.height +
    theme.sectionGap +
    theme.ring.radius * 2 +
    tasksBlockH +
    theme.sectionGap +
    24 +
    theme.stats.height;
  const panelH = Math.min(availableH, Math.max(contentH, availableH * 0.62));
  const panelY = panelTop + Math.max(0, (availableH - panelH) / 2);

  ctx.fillStyle = panel.fill;
  roundRect(ctx, panelX, panelY, panelW, panelH, panel.radius);
  ctx.fill();
  if (panel.strokeWidth > 0) {
    ctx.strokeStyle = panel.stroke;
    ctx.lineWidth = panel.strokeWidth;
    ctx.stroke();
  }

  const innerX = panelX + panel.padding;
  const innerW = panelW - panel.padding * 2;
  let cy = panelY + panel.padding;

  // ---- 状态标签 ----
  const badge = theme.statusBadge;
  applyText(ctx, theme.text.statusBadge, theme);
  const badgeLabel = !data.hasGoal ? '今日学习记录' : data.achieved ? '今日目标达成' : '今日目标未达成';
  const bw = ctx.measureText(badgeLabel).width + badge.paddingX * 2;
  ctx.fillStyle = data.achieved ? badge.achievedFill : badge.missedFill;
  roundRect(ctx, innerX, cy, bw, badge.height, badge.radius);
  ctx.fill();
  applyText(ctx, theme.text.statusBadge, theme);
  ctx.fillText(badgeLabel, innerX + badge.paddingX, cy + badge.height / 2 + theme.text.statusBadge.size * 0.36);
  cy += badge.height + theme.sectionGap;

  // 统计区贴面板底部；中间内容在剩余空间里垂直居中
  const statsY = panelY + panelH - panel.padding - theme.stats.height;
  const middleH = theme.ring.radius * 2 + tasksBlockH;
  const freeSpace = statsY - 24 - theme.sectionGap - cy - middleH;
  if (freeSpace > 0) cy += freeSpace / 2;

  // ---- 环形进度 + 大数字 ----
  const ring = theme.ring;
  const percent =
    data.reviewTarget > 0
      ? Math.min(1, data.reviewDone / data.reviewTarget)
      : data.tasks.length > 0
        ? data.tasksDone / data.tasks.length
        : 0;
  const ringCx = innerX + ring.radius;
  const ringCy = cy + ring.radius;

  ctx.lineWidth = ring.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ring.radius, 0, Math.PI * 2);
  ctx.strokeStyle = ring.track;
  ctx.stroke();
  if (percent > 0) {
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ring.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent);
    ctx.strokeStyle = data.achieved ? ring.fillAchieved : ring.fillActive;
    ctx.stroke();
  }
  // 环心百分比
  applyText(ctx, theme.text.heroUnit, theme);
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(percent * 100)}%`, ringCx, ringCy + theme.text.heroUnit.size * 0.36);
  ctx.textAlign = 'left';

  // 右侧大数字
  const heroX = ringCx + ring.radius + ring.gap;
  applyText(ctx, theme.text.heroNumber, theme);
  const heroNum = String(data.reviewDone);
  ctx.fillText(heroNum, heroX, ringCy + theme.text.heroNumber.size * 0.2);
  const numW = ctx.measureText(heroNum).width;
  applyText(ctx, theme.text.heroUnit, theme);
  ctx.fillText('条复习', heroX + numW + 14, ringCy + theme.text.heroNumber.size * 0.2);
  applyText(ctx, theme.text.heroCaption, theme);
  const caption =
    data.reviewTarget > 0 ? `目标 ${data.reviewTarget} 条` : data.tasks.length > 0 ? `完成 ${data.tasksDone}/${data.tasks.length} 件事` : '今日记录';
  ctx.fillText(caption, heroX, ringCy + theme.text.heroNumber.size * 0.2 + theme.text.heroCaption.size + 20);

  cy = ringCy + ring.radius + theme.sectionGap;

  // ---- 任务列表 ----
  if (shownTasks.length > 0) {
    const tk = theme.tasks;
    for (const t of shownTasks) {
      const boxY = cy + (tk.rowHeight - tk.boxSize) / 2;
      if (t.done) {
        ctx.fillStyle = tk.doneFill;
        roundRect(ctx, innerX, boxY, tk.boxSize, tk.boxSize, tk.boxRadius);
        ctx.fill();
        ctx.strokeStyle = tk.doneMark;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(innerX + tk.boxSize * 0.26, boxY + tk.boxSize * 0.52);
        ctx.lineTo(innerX + tk.boxSize * 0.44, boxY + tk.boxSize * 0.7);
        ctx.lineTo(innerX + tk.boxSize * 0.76, boxY + tk.boxSize * 0.3);
        ctx.stroke();
      } else {
        ctx.strokeStyle = tk.todoStroke;
        ctx.lineWidth = 3;
        roundRect(ctx, innerX, boxY, tk.boxSize, tk.boxSize, tk.boxRadius);
        ctx.stroke();
      }
      applyText(ctx, theme.text.taskText, theme);
      if (!t.done) ctx.fillStyle = tk.todoColor;
      const tx = innerX + tk.boxSize + 22;
      // 右侧再留 16px，长标题不会顶到面板边缘
      const textMax = innerW - (tk.boxSize + 22) - 16;
      ctx.fillText(fitText(ctx, t.text, textMax), tx, cy + tk.rowHeight / 2 + theme.text.taskText.size * 0.36);
      cy += tk.rowHeight;
    }
    if (overflowTasks > 0) {
      applyText(ctx, theme.text.statLabel, theme);
      ctx.fillText(`还有 ${overflowTasks} 项`, innerX + tk.boxSize + 22, cy + 8 + theme.text.statLabel.size);
      cy += theme.text.statLabel.size + 20;
    }
  }

  // ---- 底部统计 ----
  const stats: { value: string; label: string }[] = [
    { value: String(data.streak), label: '连续达成天' },
    { value: String(data.studyDays), label: '累计学习天' },
    { value: String(data.totalReviews), label: '累计复习条' },
  ];
  ctx.strokeStyle = theme.stats.dividerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, statsY - 24);
  ctx.lineTo(innerX + innerW, statsY - 24);
  ctx.stroke();

  const cellW = innerW / stats.length;
  ctx.textAlign = 'center';
  stats.forEach((s, i) => {
    const cx = innerX + cellW * i + cellW / 2;
    applyText(ctx, theme.text.statValue, theme);
    ctx.fillText(s.value, cx, statsY + theme.text.statValue.size);
    applyText(ctx, theme.text.statLabel, theme);
    ctx.fillText(s.label, cx, statsY + theme.text.statValue.size + theme.text.statLabel.size + 18);
    if (i > 0) {
      ctx.strokeStyle = theme.stats.dividerColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(innerX + cellW * i, statsY + 6);
      ctx.lineTo(innerX + cellW * i, statsY + theme.stats.height - 10);
      ctx.stroke();
    }
  });

  // ---- 水印 ----
  applyText(ctx, theme.text.watermark, theme);
  ctx.textAlign = 'center';
  ctx.fillText(theme.watermarkText, W / 2, H - P + theme.text.watermark.size * 0.2);

  ctx.restore();
}

export function cardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片生成失败'))), 'image/png');
  });
}
