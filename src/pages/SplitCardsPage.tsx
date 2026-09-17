import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePicker } from '../components/ImagePicker';
import { useToast } from '../components/Toast';
import { repo, type ImageInput } from '../db/repo';
import { db } from '../db/schema';
import { parseCards } from '../utils/splitCards';

const EXAMPLE = `Q: 问题一\nA: 答案一\n---\nQ: 问题二\nA: 答案二`;

export function SplitCardsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const existing = useLiveQuery(() => db.cards.where('noteId').equals(id).count(), [id]) ?? 0;
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [text, setText] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [qImages, setQImages] = useState<ImageInput[]>([]);
  const [aImages, setAImages] = useState<ImageInput[]>([]);
  const [saving, setSaving] = useState(false);

  const bulkText = text ?? note?.body ?? '';
  const parsed = useMemo(() => parseCards(bulkText), [bulkText]);

  if (note === undefined) return <div className="page empty">加载中…</div>;
  if (note === null) return <div className="page empty">笔记不存在</div>;

  async function createBulk() {
    if (parsed.length === 0) return;
    setSaving(true);
    try {
      await repo.createCards(id, parsed);
      toast(`已创建 ${parsed.length} 张卡片`);
      nav(`/notes/${id}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function createSingle() {
    if (!q.trim() && qImages.length === 0) return toast('请填写问题');
    setSaving(true);
    try {
      await repo.createCards(id, [{ question: q, answer: a, questionImages: qImages, answerImages: aImages }]);
      toast('已添加 1 张卡片');
      setQ('');
      setA('');
      setQImages([]);
      setAImages([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="grow">
          <h1>拆分卡片</h1>
          <div className="tiny ellipsis">{note.title}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/notes/${id}`)}>
          完成
        </button>
      </div>
      {existing > 0 && <div className="hint mb-8">这条笔记已有 {existing} 张卡片，新建的会追加在后面。</div>}

      <div className="row mb-8">
        <button className={`chip chip-btn${mode === 'bulk' ? ' chip-active' : ''}`} onClick={() => setMode('bulk')}>
          批量文本
        </button>
        <button className={`chip chip-btn${mode === 'single' ? ' chip-active' : ''}`} onClick={() => setMode('single')}>
          逐条添加（可附图）
        </button>
      </div>

      {mode === 'bulk' ? (
        <div className="stack">
          <div className="hint">
            卡片之间用一行 <code>---</code> 分隔；卡内 <code>Q:</code>（或“问：”）开头是问题，<code>A:</code>（或“答：”）之后是答案。没有标记时第一行当问题、其余当答案。
          </div>
          <textarea className="textarea" value={bulkText} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
          <div className="section-title">预览：将创建 {parsed.length} 张</div>
          <div className="list">
            {parsed.slice(0, 50).map((c, i) => (
              <div key={i} className="card small">
                <div>
                  <b>Q：</b>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{c.question}</span>
                </div>
                <div className="muted mt-8">
                  <b>A：</b>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{c.answer || '（空）'}</span>
                </div>
              </div>
            ))}
            {parsed.length > 50 && <div className="tiny center">… 还有 {parsed.length - 50} 张</div>}
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={saving || parsed.length === 0} onClick={createBulk}>
            创建 {parsed.length} 张卡片
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label>问题</label>
            <textarea className="textarea textarea-sm" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ImagePicker images={qImages} onChange={setQImages} label="问题图片" />
          <div className="field">
            <label>答案</label>
            <textarea className="textarea textarea-sm" value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <ImagePicker images={aImages} onChange={setAImages} label="答案图片" />
          <button className="btn btn-primary btn-lg btn-block" disabled={saving} onClick={createSingle}>
            添加这张卡片
          </button>
        </div>
      )}
    </div>
  );
}
