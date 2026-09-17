import { useEffect, useRef, useState } from 'react';
import type { Mask } from '../db/types';
import { useObjectUrls } from '../hooks/useObjectUrls';
import { OccludedImage, type MaskMode } from './OccludedImage';

export interface LightboxImage {
  id: string;
  blob: Blob;
  width?: number;
  height?: number;
  masks?: Mask[];
}

interface Props {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  maskMode?: MaskMode;
  revealed?: Set<string>;
  allRevealed?: boolean;
  onToggle?: (maskId: string) => void;
}

export function Lightbox({ images, index, onClose, maskMode = 'none', revealed, allRevealed, onToggle }: Props) {
  const [i, setI] = useState(index);
  const urls = useObjectUrls(images);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
      if (e.key === 'ArrowRight') setI((v) => Math.min(images.length - 1, v + 1));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  const img = images[i];
  if (!img) return null;

  return (
    <div className="lightbox" role="dialog" aria-label="查看图片">
      <div className="lightbox-top">
        <span>
          {i + 1} / {images.length}
        </span>
        <button onClick={onClose}>关闭</button>
      </div>
      <div
        className="lightbox-body"
        onTouchStart={(e) => {
          if (e.touches.length === 1) touchX.current = e.touches[0].clientX;
          else touchX.current = null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 60) return;
          if (dx < 0) setI((v) => Math.min(images.length - 1, v + 1));
          else setI((v) => Math.max(0, v - 1));
        }}
      >
        <OccludedImage
          fit
          src={urls[img.id]}
          width={img.width ?? 1}
          height={img.height ?? 1}
          masks={img.masks}
          mode={maskMode}
          revealed={revealed}
          allRevealed={allRevealed}
          onToggle={onToggle}
        />
      </div>
      <div className="lightbox-nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>
          上一张
        </button>
        <button disabled={i === images.length - 1} onClick={() => setI(i + 1)}>
          下一张
        </button>
      </div>
    </div>
  );
}
