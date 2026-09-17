import type { Mask } from '../db/types';

export type MaskMode = 'test' | 'outline' | 'none';

interface Props {
  src?: string;
  width: number;
  height: number;
  masks?: Mask[];
  /** test：未揭开的块实色遮住，可点开；outline：只画描边；none：不显示 */
  mode: MaskMode;
  revealed?: Set<string>;
  allRevealed?: boolean;
  onToggle?: (maskId: string) => void;
  onImageClick?: () => void;
  /** 大图模式：按视口限制尺寸 */
  fit?: boolean;
  className?: string;
}

/** 图片 + 遮挡层，遮挡块用相对坐标定位，任意显示尺寸都对齐 */
export function OccludedImage({
  src,
  width,
  height,
  masks = [],
  mode,
  revealed,
  allRevealed,
  onToggle,
  onImageClick,
  fit,
  className = '',
}: Props) {
  return (
    <div
      className={`occluded${fit ? ' occluded-fit' : ''} ${className}`}
      style={fit ? undefined : { aspectRatio: `${width} / ${height}` }}
      onClick={onImageClick}
    >
      {src && <img src={src} alt="" draggable={false} />}
      {mode !== 'none' &&
        masks.map((m, i) => {
          const open = mode === 'outline' || allRevealed || revealed?.has(m.id);
          return (
            <div
              key={m.id}
              className={`mask ${open ? 'mask-open' : 'mask-cover'}`}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}
              onClick={
                mode === 'test' && onToggle
                  ? (e) => {
                      e.stopPropagation();
                      onToggle(m.id);
                    }
                  : undefined
              }
            >
              {!open && <span>{i + 1}</span>}
            </div>
          );
        })}
    </div>
  );
}
