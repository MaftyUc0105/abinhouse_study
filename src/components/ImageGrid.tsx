import { useCallback, useState } from 'react';
import { useObjectUrls } from '../hooks/useObjectUrls';
import { Lightbox, type LightboxImage } from './Lightbox';
import { OccludedImage, type MaskMode } from './OccludedImage';

interface Props {
  images: LightboxImage[];
  /** grid：缩略图网格；list：逐张全宽显示。带遮挡的图片始终按 list 显示 */
  mode?: 'grid' | 'list';
  /** test：遮挡自测；outline：只画描边 */
  maskMode?: MaskMode;
  /** 揭开全部遮挡 */
  allRevealed?: boolean;
}

/** 只读图片展示，点击进入灯箱；支持遮挡自测（逐块点开） */
export function ImageGrid({ images, mode = 'list', maskMode = 'none', allRevealed }: Props) {
  const urls = useObjectUrls(images);
  const [open, setOpen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const toggle = useCallback(
    (id: string) =>
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  if (images.length === 0) return null;

  const hasMasks = maskMode !== 'none' && images.some((i) => (i.masks?.length ?? 0) > 0);
  const effective = hasMasks ? 'list' : mode;

  return (
    <>
      {effective === 'grid' ? (
        <div className="thumb-grid">
          {images.map((img, i) => (
            <div key={img.id} className="thumb" onClick={() => setOpen(i)}>
              {urls[img.id] && <img src={urls[img.id]} alt="" loading="lazy" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="photo-list">
          {images.map((img, i) => (
            <OccludedImage
              key={img.id}
              src={urls[img.id]}
              width={img.width ?? 4}
              height={img.height ?? 3}
              masks={img.masks}
              mode={maskMode}
              revealed={revealed}
              allRevealed={allRevealed}
              onToggle={toggle}
              onImageClick={() => setOpen(i)}
              className="photo"
            />
          ))}
        </div>
      )}
      {hasMasks && maskMode === 'test' && !allRevealed && (
        <div className="tiny">点遮挡块可逐个揭开，点图片其他位置放大</div>
      )}
      {open != null && (
        <Lightbox
          images={images}
          index={open}
          onClose={() => setOpen(null)}
          maskMode={maskMode}
          revealed={revealed}
          allRevealed={allRevealed}
          onToggle={toggle}
        />
      )}
    </>
  );
}
