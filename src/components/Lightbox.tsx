import { useEffect, useRef, useState } from 'react';
import { useObjectUrls } from '../hooks/useObjectUrls';

interface Props {
  images: { id: string; blob: Blob }[];
  index: number;
  onClose: () => void;
}

export function Lightbox({ images, index, onClose }: Props) {
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
        <img src={urls[img.id]} alt="" />
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
