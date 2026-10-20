import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import { repo } from '../db/repo';
import type { DailyGoal } from '../db/types';
import { useDailyGoal } from '../hooks/useDailyGoal';
import { parseTasks } from '../scheduler/goals';
import { ShareCardDialog } from './ShareCardDialog';
import { useToast } from './Toast';

/** 环形进度。半径与线宽由 CSS 变量控制，GPT 可在样式里调整 */
function ProgressRing({ percent, label, sub }: { percent: number; label: string; sub: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="goal-ring">
      <svg viewBox="0 0 120 120" className="goal-ring-svg" aria-hidden="true">
        <circle className="goal-ring-track" cx="60" cy="60" r={r} fill="none" />
        <circle
          className="goal-ring-fill"
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, percent)))}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="goal-ring-center">
        <b className="goal-ring-label">{label}</b>
        <span className="goal-ring-sub">{sub}</span>
      </div>
    </div>
  );
}

/** 今日目标卡片：定目标、勾任务、达成后分享 */
export function DailyGoalCard({ dueToday }: { dueToday: number }) {
  const g = useDailyGoal();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (g.loading) return null;

  const { progress: p } = g;
  const state = !g.hasGoal ? 'none' : p.achieved ? 'achieved' : p.settled ? 'missed' : 'active';

  if (!g.hasGoal) {
    return (
      <>
        <section className="card goal-card" data-state="none">
          <div className="goal-card-head">
            <b className="goal-card-title">今天还没定目标</b>
            {g.streak > 0 && <span className="goal-streak">连续达成 {g.streak} 天</span>}
          </div>
          <p className="goal-card-hint">
            定一个今天就能验收的目标。到晚上只有"做到了"和"没做到"两种结果，不留模糊地带。
          </p>
          <button className="btn btn-primary btn-block" onClick={() => setEditing(true)}>
            定今天的目标
          </button>
        </section>
        {editing && <GoalEditor date={g.today} goal={g.goal} dueToday={dueToday} onClose={() => setEditing(false)} />}
      </>
    );
  }

  const ringLabel = p.reviewTarget > 0 ? `${p.reviewDone}/${p.reviewTarget}` : `${p.tasksDone}/${p.tasksTotal}`;
  const ringSub = p.reviewTarget > 0 ? '复习' : '任务';

  return (
    <>
      <section className="card goal-card" data-state={state}>
        <div className="goal-card-head">
          <b className="goal-card-title">
            {state === 'achieved' ? '今日目标已达成' : state === 'missed' ? '今日目标未达成' : '今天的目标'}
          </b>
          {g.streak > 0 && <span className="goal-streak">连续达成 {g.streak} 天</span>}
        </div>

        <div className="goal-card-body">
          <ProgressRing percent={p.percent} label={ringLabel} sub={ringSub} />
          <div className="goal-card-side">
            {p.reviewTarget > 0 && p.tasksTotal > 0 && (
              <div className="small muted">
                复习 {p.reviewDone}/{p.reviewTarget} · 任务 {p.tasksDone}/{p.tasksTotal}
              </div>
            )}
            {g.last7.planned > 0 && (
              <div className="tiny">
                最近 7 天达成 {g.last7.achieved}/{g.last7.planned}
              </div>
            )}
            {p.reviewTarget > 0 && !p.settled && p.reviewDone < p.reviewTarget && (
              <div className="tiny">还差 {p.reviewTarget - p.reviewDone} 条复习</div>
            )}
          </div>
        </div>

        {g.goal!.tasks.length > 0 && (
          <ul className="goal-tasks">
            {g.goal!.tasks.map((t) => (
              <li key={t.id} className={`goal-task${t.done ? ' is-done' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={p.settled}
                    onChange={(e) => void repo.setGoalTaskDone(g.today, t.id, e.target.checked)}
                  />
                  <span className="goal-task-text">{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="goal-actions">
          {p.achieved && (
            <button className="btn btn-primary btn-sm grow" onClick={() => setSharing(true)}>
              生成今日打卡图
            </button>
          )}
          {!p.settled && (
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              改目标
            </button>
          )}
          {!p.settled && !p.achieved && (
            <button
              className="btn btn-sm"
              onClick={async () => {
                await repo.settleGoalFor(g.today);
                toast('已结算今天');
              }}
            >
              提前结算
            </button>
          )}
          {p.settled && !p.achieved && (
            <button className="btn btn-sm" onClick={() => setSharing(true)}>
              生成今日打卡图
            </button>
          )}
        </div>
      </section>

      {editing && <GoalEditor date={g.today} goal={g.goal} dueToday={dueToday} onClose={() => setEditing(false)} />}
      {sharing && <ShareCardDialog onClose={() => setSharing(false)} />}
    </>
  );
}

/** 定目标弹窗：复习条数 + 每行一件事 */
function GoalEditor({
  date,
  goal,
  dueToday,
  onClose,
}: {
  date: string;
  goal: DailyGoal | undefined;
  dueToday: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState(String(goal?.reviewTarget ?? dueToday ?? 0));
  const [text, setText] = useState((goal?.tasks ?? []).map((t) => t.text).join('\n'));
  const [saving, setSaving] = useState(false);

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

  const n = Math.max(0, Math.round(Number(target) || 0));
  const tasks = parseTasks(text, () => nanoid(8));
  const existing = new Map((goal?.tasks ?? []).map((t) => [t.text, t]));
  // 文字没变的任务保留原来的 id 和勾选状态
  const merged = tasks.map((t) => existing.get(t.text) ?? t);

  async function save() {
    if (n === 0 && merged.length === 0) {
      toast('至少设一个复习条数或一件事');
      return;
    }
    setSaving(true);
    try {
      await repo.saveGoal(date, { reviewTarget: n, tasks: merged });
      toast('目标已定，今晚见分晓');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog goal-editor" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>今天的目标</h2>

        <div className="field">
          <label>复习多少条</label>
          <input
            className="input"
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ''))}
          />
          <div className="scroll-x goal-quick">
            {[dueToday, 20, 40, 60].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
              <button key={v} type="button" className="chip chip-btn" onClick={() => setTarget(String(v))}>
                {v === dueToday ? `今天到期 ${v}` : v}
              </button>
            ))}
            <button type="button" className="chip chip-btn" onClick={() => setTarget('0')}>
              不设
            </button>
          </div>
        </div>

        <div className="field mt-8">
          <label>今天还要做的事，一行一件</label>
          <textarea
            className="textarea textarea-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'政治第三章看完\n英语真题一套\n数学背 20 个公式'}
          />
          <div className="hint">这些是复习队列之外的新内容，自己勾完成。</div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? '保存中…' : '定下来'}
          </button>
        </div>
      </div>
    </div>
  );
}
