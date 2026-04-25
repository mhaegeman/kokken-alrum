import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { computeSchedule } from '../../lib/schedule';
import { diffDays, fmtMoney, formatDateShort } from '../../lib/format';
import { ProgressRing } from '../ProgressRing';
import type { ViewId } from '../../types';

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n - 1).trimEnd() + '…';
}

export function HomeView({
  onNavigate,
  onOpenTask,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenTask: (taskId: number) => void;
}) {
  const state = useStore((s) => s.state);

  const { pct, doneCount, totalCount } = useMemo(() => {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.status === 'done').length;
    return {
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
      doneCount: done,
      totalCount: total,
    };
  }, [state.tasks]);

  const estTotal = state.budgetItems.reduce((s, i) => s + (+i.estimate || 0), 0);
  const actTotal = state.budgetItems.reduce((s, i) => s + (+i.actual || 0), 0);
  const cur = state.currency || 'DKK';

  const schedule = useMemo(() => computeSchedule(state), [state]);

  const nextUp = useMemo(() => {
    return state.tasks
      .filter((t) => t.status !== 'done')
      .map((t) => ({ task: t, ...schedule[t.id] }))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3);
  }, [state.tasks, schedule]);

  const nextMilestone = nextUp[0];
  const daysToNext = nextMilestone
    ? Math.max(0, diffDays(new Date().toISOString().slice(0, 10), nextMilestone.end))
    : 0;

  const activity = useMemo(() => {
    const items: {
      sortKey: string;
      date: string;
      text: string;
      where: string;
    }[] = [];
    state.tasks.forEach((t) => {
      t.comments.forEach((c) => {
        items.push({
          sortKey: c.date,
          date: c.date,
          text: c.text,
          where: t.title,
        });
      });
    });
    state.messages.forEach((m) => {
      const topic = state.topics.find((t) => t.id === m.topicId);
      items.push({
        sortKey: m.createdAt,
        date: m.createdAt.slice(0, 10),
        text: m.body,
        where: topic ? `Notes · ${topic.title}` : 'Notes',
      });
    });
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items.slice(0, 5);
  }, [state.tasks, state.messages, state.topics]);

  return (
    <>
      <section className="hero">
        <p className="eyebrow hero-eyebrow">Kitchen &amp; kids room · Copenhagen</p>
        <h1>
          Our kitchen, <em>reimagined.</em>
        </h1>
        <p className="hero-lede">
          Turning the old kitchen into a kids room, and building a new{' '}
          <em>køkken alrum</em> in the living area. Plans, budget, and decisions — all
          in one place.
        </p>
      </section>

      <section className="home-summary">
        <div className="card">
          <div className="card-row">
            <ProgressRing pct={pct} />
            <div className="card-row-text">
              <p className="card-label">Progress</p>
              <p className="card-value tnum">{pct}%</p>
              <p className="card-sub">
                {doneCount} of {totalCount} tasks done
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="card-label">Next milestone</p>
          {nextMilestone ? (
            <>
              <p className="card-value tnum">{daysToNext}d</p>
              <p className="card-sub">
                until{' '}
                <b style={{ color: 'var(--text)', fontWeight: 500 }}>
                  {nextMilestone.task.title}
                </b>
                <br />
                {formatDateShort(nextMilestone.start)} →{' '}
                {formatDateShort(nextMilestone.end)}
              </p>
            </>
          ) : (
            <>
              <p className="card-value">—</p>
              <p className="card-sub">All tasks done 🎉</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="card-label">Budget</p>
          <p className="card-value tnum">{fmtMoney(estTotal, cur)}</p>
          <p className="card-sub">
            {fmtMoney(actTotal, cur)} spent · target{' '}
            {fmtMoney(state.totalBudgetTarget, cur)}
          </p>
          <div
            className="budget-bar-track"
            style={{ marginTop: 14, height: 6 }}
          >
            <div
              className={`budget-bar-fill ${
                estTotal > state.totalBudgetTarget ? 'over' : ''
              }`}
              style={{
                width: `${Math.min(
                  100,
                  state.totalBudgetTarget
                    ? (estTotal / state.totalBudgetTarget) * 100
                    : 0,
                )}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="home-cols">
        <div className="home-col">
          <h2>Next up</h2>
          <div className="next-up-list">
            {nextUp.length === 0 && (
              <p className="empty" style={{ padding: '20px 0', textAlign: 'left' }}>
                Nothing scheduled.
              </p>
            )}
            {nextUp.map(({ task, start, end }) => (
              <button
                key={task.id}
                className="next-up-item next-up-btn"
                onClick={() => onOpenTask(task.id)}
              >
                <span className={`next-up-dot phase-${task.phase}`} />
                <div className="next-up-main">
                  <p className="next-up-title">{task.title}</p>
                  <p className="next-up-meta">
                    Phase {task.phase} · {state.phases[task.phase]?.name} ·{' '}
                    <span className="tnum">
                      {formatDateShort(start)} → {formatDateShort(end)}
                    </span>
                  </p>
                </div>
                <span className="next-up-dur">{task.duration}d</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-col">
          <h2>Recent activity</h2>
          <div className="activity-list">
            {activity.length === 0 && (
              <p
                className="empty"
                style={{ padding: '20px 0', textAlign: 'left' }}
              >
                No comments yet.
              </p>
            )}
            {activity.map((a, i) => (
              <div key={i} className="activity-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="activity-text">
                    On <b>{a.where}</b> — {truncate(a.text, 140)}
                  </p>
                  <p className="activity-meta tnum">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="quick-actions">
        <p className="eyebrow">Jump in</p>
        <button className="btn-primary" onClick={() => onNavigate('tasks')}>
          View all tasks
        </button>
        <button className="btn-quiet" onClick={() => onNavigate('timeline')}>
          See the timeline
        </button>
        <button className="btn-quiet" onClick={() => onNavigate('budget')}>
          Open budget
        </button>
        <button className="btn-quiet" onClick={() => onNavigate('notes')}>
          Notes
        </button>
      </section>
    </>
  );
}
