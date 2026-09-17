import { nanoid } from 'nanoid';
import type { ImageInput } from '../db/repo';

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
}

/** 读取图片并处理 EXIF 方向 */
async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* 回退到 <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片无法读取'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 压缩为 JPEG：长边不超过 maxEdge，质量 quality */
export async function compressImage(
  file: Blob,
  { maxEdge = 1600, quality = 0.8 }: CompressOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const src = await loadBitmap(file);
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  if ('close' in src) src.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('图片压缩失败');
  return { blob, width, height };
}

export async function fileToImageInput(file: File, opts?: CompressOptions): Promise<ImageInput> {
  const { blob, width, height } = await compressImage(file, opts);
  return { id: nanoid(), blob, width, height };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
