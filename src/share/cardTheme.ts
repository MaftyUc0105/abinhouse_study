/**
 * 打卡图的视觉规格。**这个文件由 GPT 负责美术设计**，详见 collab.md。
 *
 * 改这里的数值就能改变打卡图外观，不需要动 renderCard.ts。
 * 约束：
 * - 所有字段都必须保留，类型不能改；渲染器按这些字段画图。
 * - 颜色用 '#rrggbb' 或 'rgba(...)'；尺寸单位是设计稿像素（基于 width × height）。
 * - 不要引入外部字体或图片，App 要离线可用。
 */

export interface CardGradientStop {
  /** 0–1 */
  at: number;
  color: string;
}

export interface CardBackground {
  /** solid: 用 colors[0]；linear: 按 angle 做线性渐变 */
  type: 'solid' | 'linear';
  /** 角度，0 = 从上到下，90 = 从左到右 */
  angle: number;
  stops: CardGradientStop[];
}

/** 背景上的装饰圆，营造层次；留空数组即可关闭 */
export interface CardBlob {
  /** 相对画布宽高的 0–1 坐标 */
  x: number;
  y: number;
  /** 相对画布宽度的半径 */
  r: number;
  color: string;
}

export interface CardTextStyle {
  size: number;
  weight: number;
  color: string;
  /** 字间距，可为负 */
  tracking?: number;
}

export interface CardTheme {
  width: number;
  height: number;
  /** 导出倍数，2 表示输出 2 倍分辨率 */
  scale: number;
  fontFamily: string;

  background: CardBackground;
  blobs: CardBlob[];

  /** 内容区左右留白 */
  padding: number;
  /** 各区块之间的垂直间距 */
  sectionGap: number;

  /** 主面板（承载内容的圆角卡片） */
  panel: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    radius: number;
    /** 面板内缩 */
    padding: number;
  };

  text: {
    date: CardTextStyle;
    weekday: CardTextStyle;
    countdown: CardTextStyle;
    heroNumber: CardTextStyle;
    heroUnit: CardTextStyle;
    heroCaption: CardTextStyle;
    statusBadge: CardTextStyle;
    taskText: CardTextStyle;
    statValue: CardTextStyle;
    statLabel: CardTextStyle;
    watermark: CardTextStyle;
  };

  /** 右上角倒计时胶囊 */
  countdownPill: {
    fill: string;
    radius: number;
    paddingX: number;
    height: number;
  };

  /** 达成 / 未达成 状态标签 */
  statusBadge: {
    achievedFill: string;
    missedFill: string;
    radius: number;
    paddingX: number;
    height: number;
  };

  /** 环形进度 */
  ring: {
    radius: number;
    width: number;
    track: string;
    fillAchieved: string;
    fillActive: string;
    /** 环与右侧文字之间的距离 */
    gap: number;
  };

  tasks: {
    /** 最多画几条，超出显示"还有 N 项" */
    max: number;
    rowHeight: number;
    /** 勾选框边长 */
    boxSize: number;
    boxRadius: number;
    doneFill: string;
    doneMark: string;
    todoStroke: string;
    /** 未完成任务的文字颜色 */
    todoColor: string;
  };

  stats: {
    height: number;
    dividerColor: string;
  };

  watermarkText: string;
}

export const CARD_THEME: CardTheme = {
  width: 1080,
  height: 1440,
  scale: 1,
  fontFamily:
    "'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', 'HarmonyOS Sans SC', system-ui, sans-serif",

  background: {
    type: 'linear',
    angle: 155,
    stops: [
      { at: 0, color: '#1d4ed8' },
      { at: 0.55, color: '#2563eb' },
      { at: 1, color: '#3b82f6' },
    ],
  },
  blobs: [
    { x: 0.86, y: 0.08, r: 0.3, color: 'rgba(255,255,255,0.10)' },
    { x: 0.08, y: 0.94, r: 0.34, color: 'rgba(255,255,255,0.07)' },
  ],

  padding: 72,
  sectionGap: 44,

  panel: {
    fill: 'rgba(255,255,255,0.96)',
    stroke: 'rgba(255,255,255,0.65)',
    strokeWidth: 2,
    radius: 48,
    padding: 56,
  },

  text: {
    date: { size: 64, weight: 700, color: '#ffffff' },
    weekday: { size: 30, weight: 500, color: 'rgba(255,255,255,0.82)' },
    countdown: { size: 30, weight: 700, color: '#1d4ed8' },
    heroNumber: { size: 150, weight: 800, color: '#111827', tracking: -4 },
    heroUnit: { size: 34, weight: 600, color: '#6b7280' },
    heroCaption: { size: 30, weight: 500, color: '#6b7280' },
    statusBadge: { size: 28, weight: 700, color: '#ffffff' },
    taskText: { size: 34, weight: 500, color: '#1f2937' },
    statValue: { size: 50, weight: 700, color: '#111827' },
    statLabel: { size: 26, weight: 500, color: '#6b7280' },
    watermark: { size: 26, weight: 500, color: 'rgba(255,255,255,0.78)' },
  },

  countdownPill: { fill: '#ffffff', radius: 28, paddingX: 26, height: 56 },
  statusBadge: { achievedFill: '#16a34a', missedFill: '#9ca3af', radius: 24, paddingX: 24, height: 48 },

  ring: { radius: 92, width: 22, track: '#e5e7eb', fillAchieved: '#16a34a', fillActive: '#2563eb', gap: 44 },

  tasks: {
    max: 5,
    rowHeight: 62,
    boxSize: 38,
    boxRadius: 10,
    doneFill: '#16a34a',
    doneMark: '#ffffff',
    todoStroke: '#d1d5db',
    todoColor: '#9ca3af',
  },

  stats: { height: 132, dividerColor: '#e5e7eb' },

  watermarkText: '艾宾浩斯复习本',
};
