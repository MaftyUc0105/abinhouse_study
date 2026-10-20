/** 打卡图的分享与保存，以及一键复制的发帖文案 */
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToArrayBuffer } from '../db/backup';
import { isNativeApp } from '../native/platform';
import { bytesToBase64 } from '../utils/base64';
import type { ShareCardData } from './cardData';

export const CARD_FOLDER = '复习本打卡';

export function cardFileName(date: string): string {
  return `复习打卡_${date}.png`;
}

export type CardShareResult = { kind: 'shared' | 'saved' | 'downloaded' | 'cancelled'; location?: string };

async function toBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blobToArrayBuffer(blob)));
}

/** 分享图片：App 调起系统分享；网页端优先用系统分享，不支持则下载 */
export async function shareCardImage(blob: Blob, filename: string): Promise<CardShareResult> {
  if (isNativeApp) {
    const data = await toBase64(blob);
    const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    try {
      await Share.share({ title: '今日打卡', files: [written.uri], dialogTitle: '分享打卡图到' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg)) return { kind: 'cancelled' };
      throw e;
    }
    return { kind: 'shared' };
  }

  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  try {
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: '今日打卡' });
      return { kind: 'shared' };
    }
  } catch (e) {
    if (/abort/i.test((e as Error)?.name ?? '')) return { kind: 'cancelled' };
    // 分享失败则退回下载
  }
  downloadBlobAs(blob, filename);
  return { kind: 'downloaded' };
}

/** 保存到手机：App 存到 文档/复习本打卡，网页端走下载 */
export async function saveCardImage(blob: Blob, filename: string): Promise<CardShareResult> {
  if (isNativeApp) {
    await Filesystem.writeFile({
      path: `${CARD_FOLDER}/${filename}`,
      data: await toBase64(blob),
      directory: Directory.Documents,
      recursive: true,
    });
    return { kind: 'saved', location: `文件管理 → 文档（Documents）→ ${CARD_FOLDER}` };
  }
  downloadBlobAs(blob, filename);
  return { kind: 'downloaded' };
}

function downloadBlobAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 生成可直接粘贴到小红书 / 朋友圈的文案 */
export function buildCaption(d: ShareCardData): string {
  const lines: string[] = [];
  const head = [`${d.dateLabel} ${d.weekdayLabel}`];
  if (d.streak > 0) head.push(`连续第 ${d.streak} 天`);
  lines.push(head.join(' · '));

  if (d.reviewTarget > 0) {
    lines.push(`复习 ${d.reviewDone}/${d.reviewTarget} 条${d.reviewDone >= d.reviewTarget ? ' 达成' : ''}`);
  } else if (d.reviewDone > 0) {
    lines.push(`复习 ${d.reviewDone} 条`);
  }

  for (const t of d.tasks) lines.push(`${t.done ? '[完成]' : '[未完成]'} ${t.text}`);

  if (d.daysToExam !== null) lines.push(d.daysToExam === 0 ? '今天考试' : `距考研 ${d.daysToExam} 天`);
  lines.push('');
  lines.push('#考研 #每日打卡 #学习日常 #自律');
  return lines.join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 退回手动选中 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
