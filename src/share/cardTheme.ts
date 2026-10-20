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
    angle: 150,
    stops: [
      { at: 0, color: '#173f40' },
      { at: 0.52, color: '#24534e' },
      { at: 1, color: '#386b5c' },
    ],
  },
  blobs: [
    { x: 1.04, y: 0.04, r: 0.36, color: 'rgba(216,235,209,0.08)' },
    { x: -0.1, y: 0.9, r: 0.34, color: 'rgba(244,219,169,0.08)' },
  ],

  padding: 72,
  sectionGap: 42,

  panel: {
    fill: '#fbf8f0',
    stroke: 'rgba(255,255,255,0.42)',
    strokeWidth: 2,
    radius: 40,
    padding: 56,
  },

  text: {
    date: { size: 64, weight: 800, color: '#f9f5e9', tracking: 1 },
    weekday: { size: 29, weight: 500, color: '#d5e6da', tracking: 2 },
    countdown: { size: 29, weight: 700, color: '#244e48' },
    heroNumber: { size: 136, weight: 800, color: '#193c39', tracking: -5 },
    heroUnit: { size: 32, weight: 700, color: '#42665d' },
    heroCaption: { size: 30, weight: 500, color: '#63776c' },
    statusBadge: { size: 28, weight: 700, color: '#ffffff', tracking: 1 },
    taskText: { size: 33, weight: 500, color: '#27443f' },
    statValue: { size: 50, weight: 800, color: '#1d413d' },
    statLabel: { size: 25, weight: 500, color: '#6b7b71' },
    watermark: { size: 25, weight: 600, color: '#dbe8d8', tracking: 3 },
  },

  countdownPill: { fill: '#edf2e7', radius: 27, paddingX: 24, height: 54 },
  statusBadge: { achievedFill: '#236c55', missedFill: '#8a6544', radius: 24, paddingX: 23, height: 48 },

  ring: { radius: 84, width: 18, track: '#dae6da', fillAchieved: '#2b8060', fillActive: '#b8894f', gap: 38 },

  tasks: {
    max: 5,
    rowHeight: 66,
    boxSize: 36,
    boxRadius: 9,
    doneFill: '#2b8060',
    doneMark: '#ffffff',
    todoStroke: '#bfae91',
    todoColor: '#887c68',
  },

  stats: { height: 132, dividerColor: '#dfe4d9' },

  watermarkText: '艾宾浩斯复习本',
};
