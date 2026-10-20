import { useEffect, useRef, useState } from 'react';
import { db } from '../db/schema';
import { useToday } from '../hooks/useToday';
import { buildShareCardData, type ShareCardData } from '../share/cardData';
import { CARD_THEME } from '../share/cardTheme';
import { cardToBlob, drawCard } from '../share/renderCard';
import { buildCaption, cardFileName, copyText, saveCardImage, shareCardImage } from '../share/shareCard';

type Msg = { ok: boolean; text: string } | null;

/** 生成今日打卡图，预览后分享或保存，并可复制配套文案 */
export function ShareCardDialog({ onClose }: { onClose: () => void }) {
  const today = useToday();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<ShareCardData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 生成图片
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const d = await buildShareCardData(db, today);
        if (cancelled) return;
        setData(d);
        const canvas = canvasRef.current ?? document.createElement('canvas');
        drawCard(canvas, d, CARD_THEME);
        const blob = await cardToBlob(canvas);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '生成失败');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [today]);

  async function withBlob(label: string, fn: (blob: Blob, name: string) => Promise<Msg>) {
    if (!canvasRef.current || !data) return;
    setMsg(null);
    setBusy(label);
    try {
      const blob = await cardToBlob(canvasRef.current);
      setMsg(await fn(blob, cardFileName(data.date)));
    } catch (e) {
      setMsg({ ok: false, text: `${label}失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog share-card-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>今日打卡图</h2>

        <div className="share-card-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="今日打卡图预览" />
          ) : (
            <div className="share-card-placeholder">{error ?? '正在生成…'}</div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {error && <div className="error">{error}</div>}
        {msg && <div className={msg.ok ? 'backup-ok small' : 'error'}>{msg.text}</div>}

        <div className="share-card-actions">
          <button
            className="btn btn-primary grow"
            disabled={!previewUrl || !!busy}
            onClick={() =>
              withBlob('分享', async (blob, name) => {
                const r = await shareCardImage(blob, name);
                if (r.kind === 'shared') return { ok: true, text: '已发出。' };
                if (r.kind === 'cancelled') return { ok: false, text: '已取消分享。' };
                return { ok: true, text: `已保存到下载：${name}` };
              })
            }
          >
            {busy === '分享' ? '处理中…' : '分享图片'}
          </button>
          <button
            className="btn grow"
            disabled={!previewUrl || !!busy}
            onClick={() =>
              withBlob('保存', async (blob, name) => {
                const r = await saveCardImage(blob, name);
                return { ok: true, text: r.location ? `已保存：${r.location}` : `已保存到下载：${name}` };
              })
            }
          >
            保存到相册目录
          </button>
        </div>

        <button
          className="btn btn-sm btn-block mt-8"
          disabled={!data}
          onClick={async () => {
            if (!data) return;
            const ok = await copyText(buildCaption(data));
            setMsg({ ok, text: ok ? '文案已复制，粘贴到小红书或朋友圈即可。' : '复制失败，请长按下面的文字手动复制。' });
          }}
        >
          复制配套文案
        </button>

        {data && <pre className="share-card-caption">{buildCaption(data)}</pre>}

        <div className="dialog-actions">
          <button className="btn btn-block" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
