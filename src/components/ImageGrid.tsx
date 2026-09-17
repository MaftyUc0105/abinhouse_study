import { useState } from 'react';
import { useObjectUrls } from '../hooks/useObjectUrls';
import { Lightbox } from './Lightbox';

interface Props {
  images: { id: string; blob: Blob; width?: number; height?: number }[];
  /** grid：缩略图网格；list：逐张全宽显示 */
  mode?: 'grid' | 'list';
}

/** 只读图片展示，点击进入灯箱 */
export function ImageGrid({ images, mode = 'list' }: Props) {
  const urls = useObjectUrls(images);
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;

  return (
    <>
      {mode === 'grid' ? (
        <div className="thumb-grid">
          {images.map((img, i) => (
            <div key={img.id} className="thumb" onClick={() => setOpen(i)}>
              <img src={urls[img.id]} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      ) : (
        <div className="photo-list">
          {images.map((img, i) => (
            <img
              key={img.id}
              src={urls[img.id]}
              alt=""
              width={img.width}
              height={img.height}
              loading="lazy"
              onClick={() => setOpen(i)}
            />
          ))}
        </div>
      )}
      {open != null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
