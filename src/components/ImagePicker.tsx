import { useRef, useState } from 'react';
import type { ImageInput } from '../db/repo';
import { useObjectUrls } from '../hooks/useObjectUrls';
import { fileToImageInput, formatBytes } from '../utils/image';
import { Lightbox } from './Lightbox';

interface Props {
  images: ImageInput[];
  onChange: (images: ImageInput[]) => void;
  label?: string;
}

/** 拍照 / 相册选图 + 缩略图管理（删除、排序） */
export function ImagePicker({ images, onChange, label = '照片' }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const urls = useObjectUrls(images);
  const totalSize = images.reduce((s, i) => s + i.blob.size, 0);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setPending(files.length);
    const added: ImageInput[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await fileToImageInput(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : '图片处理失败');
      } finally {
        setPending((p) => p - 1);
      }
    }
    if (added.length) onChange([...images, ...added]);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = images.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="field">
      <label>
        {label}
        {images.length > 0 && (
          <span className="tiny">
            {' '}
            · {images.length} 张 · {formatBytes(totalSize)}
          </span>
        )}
      </label>
      <div className="picker-buttons">
        <button type="button" className="btn btn-soft" onClick={() => cameraRef.current?.click()} disabled={pending > 0}>
          📷 拍照
        </button>
        <button type="button" className="btn btn-soft" onClick={() => galleryRef.current?.click()} disabled={pending > 0}>
          🖼 相册
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {pending > 0 && <div className="hint">正在压缩 {pending} 张图片…</div>}
      {error && <div className="error">{error}</div>}
      {images.length > 0 && (
        <div className="thumb-grid">
          {images.map((img, i) => (
            <div key={img.id} className="thumb">
              <img src={urls[img.id]} alt="" onClick={() => setOpen(i)} />
              <div className="thumb-actions">
                <button type="button" aria-label="左移" disabled={i === 0} onClick={() => move(i, -1)}>
                  ‹
                </button>
                <button
                  type="button"
                  className="del"
                  aria-label="删除"
                  onClick={() => onChange(images.filter((x) => x.id !== img.id))}
                >
                  ×
                </button>
                <button type="button" aria-label="右移" disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                  ›
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {open != null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
