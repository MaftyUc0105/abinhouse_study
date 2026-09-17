/** 自评：0 忘了 / 1 模糊 / 2 记得 / 3 很熟 */
export type Rating = 0 | 1 | 2 | 3;
export type ItemType = 'note' | 'card';
/** 复习强度标签：重点 / 注意 / 正常 / 稳固 */
export type Intensity = 'focus' | 'attention' | 'normal' | 'solid';
/** 本地日期字符串 'YYYY-MM-DD' */
export type LocalDate = string;
export type ImageSlot = 'body' | 'question' | 'answer';

export interface Scheduling {
  /** 阶梯索引，0 = 尚未复习过 / 刚重置 */
  stage: number;
  dueDate: LocalDate;
  lastReviewedAt: number | null;
  /** 上次实际安排的间隔天数（超出阶梯后用于乘法） */
  lastInterval: number;
  reviewCount: number;
  /** 评"忘了"的累计次数 */
  lapseCount: number;
  /** 最近 3 次评分，用于强度标签 */
  recentRatings: Rating[];
  suspended: boolean;
}

export interface Note extends Scheduling {
  id: string;
  title: string;
  subject: string;
  /** markdown 正文，可为空（纯图片笔记） */
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Card extends Scheduling {
  id: string;
  noteId: string;
  question: string;
  answer: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** 照片遮挡块，坐标为相对图片的 0–1 比例 */
export interface Mask {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageRecord {
  id: string;
  ownerType: ItemType;
  ownerId: string;
  slot: ImageSlot;
  order: number;
  /** 压缩后的 JPEG */
  blob: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
  /** 遮挡或顺序修改时间；旧数据可能没有，按 createdAt 处理 */
  updatedAt?: number;
  masks?: Mask[];
}

export interface ReviewLog {
  id?: number;
  itemType: ItemType;
  itemId: string;
  rating: Rating;
  reviewedAt: number;
  /** 复习当天的本地日期，便于按天统计 */
  date: LocalDate;
  stageBefore: number;
  stageAfter: number;
  /** 本次评分后安排的间隔天数 */
  intervalDays: number;
  dueBefore: LocalDate;
}

export interface Subject {
  name: string;
  createdAt: number;
}

export interface Settings {
  id: 'default';
  /** 艾宾浩斯阶梯（天） */
  ladder: number[];
  /** 超出阶梯后的间隔乘数 */
  overflowFactor: number;
  /** 评"模糊"时间隔缩短系数 */
  fuzzyShrink: number;
  /** 每日新条目上限，0 = 不限制 */
  dailyNewCap: number;
  /** 评"忘了"是否在当次会话中再出现一次 */
  forgotSameDay: boolean;
  /** 间隔上限（天） */
  maxInterval: number;
  /** 到期日小幅错开，避免同一天堆积 */
  fuzz: boolean;
  /** 考研日期；设置后复习间隔不会越过考试日 */
  examDate: LocalDate | null;
  /** 最后修改时间，多设备同步时新者为准 */
  updatedAt: number;
}

/** 删除记录，用于多设备同步时阻止已删条目复活 */
export interface Tombstone {
  /** 'note:<id>' | 'card:<id>' | 'image:<id>' */
  key: string;
  deletedAt: number;
}

/** 仅本机的键值数据（同步配置、状态），不参与同步和备份 */
export interface MetaRecord {
  key: string;
  value: unknown;
}

export const RATING_LABEL: Record<Rating, string> = {
  0: '忘了',
  1: '模糊',
  2: '记得',
  3: '很熟',
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  focus: '重点',
  attention: '注意',
  normal: '正常',
  solid: '稳固',
};
