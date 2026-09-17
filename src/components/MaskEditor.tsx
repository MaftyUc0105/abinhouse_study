import { nanoid } from 'nanoid';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Mask } from '../db/types';
import { useObjectUrls } from '../hooks/useObjectUrls';

interface Props {
  image: { id: string; blob: Blob; width: number; height: number };
  masks: Mask[];
  onDone: (masks: Mask[]) => void;
  onCancel: () => void;
}

const MIN = 0.02;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** 全屏遮挡编辑：拖拽画框，点框选中后可删除；可放大并切换到"移动"模式滚动查看 */
export function MaskEditor({ image, masks: initial, onDone, onCancel }: Props) {
  const urls = useObjectUrls([image]);
  const [masks, setMasks] = useState<Mask[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Mask | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'draw' | 'move'>('draw');
  const [baseWidth, setBaseWidth] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const draftRef = useRef<Mask | null>(null);
  draftRef.current = draft;

  useLayoutEffect(() => {
    const calc = () => {
      const vw = window.innerWidth - 16;
      const vh = window.innerHeight - 130;
      setBaseWidth(Math.max(120, Math.min(vw, (vh * image.width) / image.height, 900)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [image.width, image.height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function rel(e: ReactPointerEvent) {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (tool !== 'draw' || e.button > 0) return;
    const p = rel(e);
    start.current = p;
    setSelected(null);
    setDraft({ id: 'draft', x: p.x, y: p.y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const p = rel(e);
    const s = start.current;
    setDraft({ id: 'draft', x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }

  function onUp() {
    if (!start.current) return;
    start.current = null;
    const d = draftRef.current;
    if (d && d.w >= MIN && d.h >= MIN) {
      const m = { ...d, id: nanoid(8) };
      setMasks((prev) => [...prev, m]);
    }
    setDraft(null);
  }

  const width = baseWidth * zoom;

  return (
    <div className="mask-editor" role="dialog" aria-label="编辑遮挡">
      <div className="mask-toolbar">
        <button onClick={onCancel}>取消</button>
        <span className="mask-count">{masks.length} 块</span>
        <button onClick={() => onDone(masks)} className="primary">
          完成
        </button>
      </div>
      <div className="mask-toolbar mask-toolbar-2">
        <button className={tool === 'draw' ? 'on' : ''} onClick={() => setTool('draw')}>
          画框
        </button>
        <button className={tool === 'move' ? 'on' : ''} onClick={() => setTool('move')}>
          移动
        </button>
        <button onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))}>放大 {zoom}×</button>
        <button disabled={!selected} onClick={() => (setMasks((p) => p.filter((m) => m.id !== selected)), setSelected(null))}>
          删除选中
        </button>
        <button disabled={masks.length === 0} onClick={() => (setMasks([]), setSelected(null))}>
          清空
        </button>
      </div>
      <div className={`mask-editor-body${tool === 'move' ? ' is-move' : ''}`}>
        <div
          ref={wrapRef}
          className={`mask-canvas${tool === 'draw' ? ' is-draw' : ''}`}
          style={{ width }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {urls[image.id] && <img src={urls[image.id]} alt="" draggable={false} style={{ width }} />}
          {masks.map((m, i) => (
            <div
              key={m.id}
              className={`mask mask-edit${selected === m.id ? ' is-selected' : ''}`}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}
              onPointerDown={(e) => {
                if (tool !== 'draw') return;
                e.stopPropagation();
                setSelected(m.id);
              }}
            >
              <span>{i + 1}</span>
            </div>
          ))}
          {draft && (
            <div
              className="mask mask-draft"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
            />
          )}
        </div>
      </div>
      <div className="mask-hint">
        {tool === 'draw' ? '在图上拖动画出要遮住的区域，点一下已有的框可选中' : '移动模式：可以滑动查看放大的图片'}
      </div>
    </div>
  );
}
