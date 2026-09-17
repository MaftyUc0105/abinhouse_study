import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImagePicker } from '../components/ImagePicker';
import { useToast } from '../components/Toast';
import { repo, type ImageInput } from '../db/repo';
import { db } from '../db/schema';
import type { ImageRecord } from '../db/types';

function toInputs(recs: ImageRecord[]): ImageInput[] {
  return recs.map((r) => ({ id: r.id, blob: r.blob, width: r.width, height: r.height, masks: r.masks ?? [] }));
}

export function AddEditPage() {
  const { type, id } = useParams<{ type?: 'note' | 'card'; id?: string }>();
  if (type === 'card' && id) return <CardForm id={id} />;
  return <NoteForm id={type === 'note' ? id : undefined} />;
}

function NoteForm({ id }: { id?: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const subjects = useLiveQuery(() => db.subjects.orderBy('name').toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<ImageInput[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSplit, setAskSplit] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const n = await db.notes.get(id);
      if (!n) {
        toast('笔记不存在');
        nav('/library', { replace: true });
        return;
      }
      const imgs = await db.images.where({ ownerType: 'note', ownerId: id }).sortBy('order');
      if (cancelled) return;
      setTitle(n.title);
      setSubject(n.subject);
      setTags(n.tags.join(', '));
      setBody(n.body);
      setImages(toInputs(imgs));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, nav, toast]);

  // 记住上次用的科目，录入连续多条时少一步
  useEffect(() => {
    if (id) return;
    try {
      const last = localStorage.getItem('lastSubject');
      if (last) setSubject(last);
    } catch {
      /* ignore */
    }
  }, [id]);

  async function save() {
    setError(null);
    if (!title.trim()) return setError('请填写标题');
    if (!body.trim() && images.length === 0) return setError('正文和照片至少填一项');
    setSaving(true);
    try {
      const input = { title, subject, body, tags: tags.split(/[,，]/) };
      try {
        localStorage.setItem('lastSubject', subject.trim());
      } catch {
        /* ignore */
      }
      if (id) {
        await repo.updateNote(id, input, images);
        toast('已保存');
        nav(`/notes/${id}`, { replace: true });
      } else {
        const newId = await repo.createNote(input, images);
        setAskSplit(newId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="page empty">加载中…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{id ? '编辑笔记' : '录入笔记'}</h1>
        {id && (
          <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>
            取消
          </button>
        )}
      </div>
      <div className="stack">
        <div className="field">
          <label>标题 *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：马克思主义的三个来源" />
        </div>
        <div className="row">
          <div className="field grow">
            <label>科目</label>
            <input
              className="input"
              list="subject-list"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="政治 / 英语 / 数学 / 专业课"
            />
            <datalist id="subject-list">
              {subjects.map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
          </div>
          <div className="field grow">
            <label>标签（逗号分隔）</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="第三章, 易错" />
          </div>
        </div>
        {subjects.length > 0 && (
          <div className="scroll-x">
            {subjects.map((s) => (
              <button
                key={s.name}
                type="button"
                className={`chip chip-btn${subject === s.name ? ' chip-active' : ''}`}
                onClick={() => setSubject(s.name)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="field">
          <label>内容（支持 Markdown，可直接粘贴）</label>
          <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="把笔记粘贴到这里…" />
        </div>
        <ImagePicker images={images} onChange={setImages} />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={saving} onClick={save}>
          {saving ? '保存中…' : id ? '保存修改' : '保存笔记'}
        </button>
        <div className="hint">保存后明天开始第一次复习。</div>
      </div>

      <ConfirmDialog
        open={askSplit !== null}
        title="已保存"
        message="要把这条笔记拆成若干问答卡片、分别安排复习吗？也可以以后在笔记详情里拆。"
        confirmText="拆分卡片"
        cancelText="暂不"
        onConfirm={() => nav(`/notes/${askSplit}/split`, { replace: true })}
        onCancel={() => {
          toast('已保存，明天开始复习');
          setTitle('');
          setBody('');
          setTags('');
          setImages([]);
          setAskSplit(null);
        }}
      />
    </div>
  );
}

function CardForm({ id }: { id: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [qImages, setQImages] = useState<ImageInput[]>([]);
  const [aImages, setAImages] = useState<ImageInput[]>([]);
  const [noteId, setNoteId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await db.cards.get(id);
      if (!c) {
        toast('卡片不存在');
        nav('/library', { replace: true });
        return;
      }
      const imgs = await db.images.where({ ownerType: 'card', ownerId: id }).sortBy('order');
      if (cancelled) return;
      setQuestion(c.question);
      setAnswer(c.answer);
      setNoteId(c.noteId);
      setQImages(toInputs(imgs.filter((i) => i.slot === 'question')));
      setAImages(toInputs(imgs.filter((i) => i.slot === 'answer')));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, nav, toast]);

  async function save() {
    setError(null);
    if (!question.trim() && qImages.length === 0) return setError('问题和问题图片至少填一项');
    setSaving(true);
    try {
      await repo.updateCard(id, { question, answer, questionImages: qImages, answerImages: aImages });
      toast('已保存');
      nav(`/notes/${noteId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="page empty">加载中…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>编辑卡片</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>
          取消
        </button>
      </div>
      <div className="stack">
        <div className="field">
          <label>问题</label>
          <textarea className="textarea textarea-sm" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <ImagePicker images={qImages} onChange={setQImages} label="问题图片" />
        <div className="field">
          <label>答案（支持 Markdown）</label>
          <textarea className="textarea textarea-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>
        <ImagePicker images={aImages} onChange={setAImages} label="答案图片" />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={saving} onClick={save}>
          {saving ? '保存中…' : '保存修改'}
        </button>
      </div>
    </div>
  );
}
