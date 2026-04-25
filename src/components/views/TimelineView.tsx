import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { computeSchedule } from '../../lib/schedule';
import { addDays, diffDays, formatDateShort } from '../../lib/format';
import type { Task } from '../../types';

type Mode = 'gantt' | 'month' | 'fortnight';

export function TimelineView({
  onOpenTask,
}: {
  onOpenTask: (taskId: number) => void;
}) {
  const state = useStore((s) => s.state);
  const setStartDate = useStore((s) => s.setStartDate);
  const [mode, setMode] = useState<Mode>('gantt');

  const schedule = useMemo(() => computeSchedule(state), [state]);
  const entries = useMemo(
    () => state.tasks.map((t) => ({ task: t, ...schedule[t.id] })),
    [state.tasks, schedule],
  );
  const projectStart = state.startDate;
  const projectEnd = entries.reduce(
    (max, e) => (e.end > max ? e.end : max),
    projectStart,
  );

  return (
    <>
      <div className="filters">
        <label>Project start</label>
        <input
          type="date"
          value={state.startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <div className="timeline-mode-toggle" role="tablist" aria-label="View mode">
          {(['gantt', 'month', 'fortnight'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`timeline-mode-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'gantt' ? 'Gantt' : m === 'month' ? 'Month' : '14 days'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'gantt' && (
        <GanttMode
          entries={entries}
          projectStart={projectStart}
          projectEnd={projectEnd}
          state={state}
          onOpenTask={onOpenTask}
        />
      )}
      {mode === 'month' && (
        <MonthMode entries={entries} state={state} onOpenTask={onOpenTask} />
      )}
      {mode === 'fortnight' && (
        <FortnightMode entries={entries} onOpenTask={onOpenTask} state={state} />
      )}

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
        Dates are auto-scheduled from durations and dependencies. Override a task's
        start/end in the Tasks view to pin it.
      </p>
    </>
  );
}

// ─── shared types ──────────────────────────────────────────────

interface ScheduledTask {
  task: Task;
  start: string;
  end: string;
}

type StateLike = ReturnType<typeof useStore.getState>['state'];

function barClassesFor(task: Task): string {
  let c = `timeline-bar bar-phase-${task.phase}`;
  if (task.status === 'done') c += ' bar-done';
  if (task.status === 'blocked') c += ' bar-blocked';
  return c;
}

function legendOf(state: StateLike) {
  return (
    <div className="timeline-legend">
      {Object.entries(state.phases).map(([id, p]) => (
        <span key={id}>
          <span className={`legend-swatch bar-phase-${id}`} />
          {p.name}
        </span>
      ))}
      <span>
        <span
          className="legend-swatch"
          style={{ background: 'var(--graphite-3)', opacity: 0.45 }}
        />
        Done
      </span>
    </div>
  );
}

// ─── Gantt (existing layout) ───────────────────────────────────

function GanttMode({
  entries,
  projectStart,
  projectEnd,
  state,
  onOpenTask,
}: {
  entries: ScheduledTask[];
  projectStart: string;
  projectEnd: string;
  state: StateLike;
  onOpenTask: (id: number) => void;
}) {
  const totalDays = Math.max(7, diffDays(projectStart, projectEnd) + 1);
  const totalWeeks = Math.ceil(totalDays / 7);
  return (
    <div className="timeline-wrap">
      {legendOf(state)}
      <div
        className="timeline-grid"
        style={{ ['--weeks' as string]: totalWeeks } as React.CSSProperties}
      >
        <div className="timeline-axis">
          <div className="axis-label-col" style={{ width: 280 }}>
            Task
          </div>
          <div className="axis-weeks">
            {Array.from({ length: totalWeeks }).map((_, w) => {
              const weekStart = addDays(projectStart, w * 7);
              return (
                <div
                  key={w}
                  className="axis-week"
                  title={formatDateShort(weekStart)}
                >
                  W{w + 1}
                </div>
              );
            })}
          </div>
        </div>

        {entries.map(({ task, start, end }) => {
          const startOffset = diffDays(projectStart, start);
          const barDays = Math.max(1, diffDays(start, end));
          const leftPct = (startOffset / totalDays) * 100;
          const widthPct = (barDays / totalDays) * 100;

          return (
            <div className="timeline-row" key={task.id}>
              <button
                className="timeline-label timeline-label-btn"
                style={{ width: 280 }}
                onClick={() => onOpenTask(task.id)}
                title={`${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)} (${task.duration}d)`}
              >
                #{task.id} {task.title}
              </button>
              <div className="timeline-track">
                <button
                  className={barClassesFor(task) + ' timeline-bar-btn'}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  onClick={() => onOpenTask(task.id)}
                  title={`${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)}\nStatus: ${task.status.replace('_', ' ')}`}
                >
                  {task.duration}d
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 14-day strip ──────────────────────────────────────────────

function FortnightMode({
  entries,
  onOpenTask,
  state,
}: {
  entries: ScheduledTask[];
  onOpenTask: (id: number) => void;
  state: StateLike;
}) {
  // Anchor: the project start, but no earlier than today minus 1 day so
  // it stays relevant if the project has begun.
  const today = new Date().toISOString().slice(0, 10);
  const anchor =
    state.startDate < today
      ? new Date(addDays(today, -1))
      : new Date(state.startDate);
  const start = anchor.toISOString().slice(0, 10);
  const days = 14;

  const days14 = Array.from({ length: days }, (_, i) => addDays(start, i));
  const todayIdx = days14.indexOf(today);

  return (
    <div className="timeline-wrap">
      {legendOf(state)}
      <div
        className="timeline-grid"
        style={{ ['--weeks' as string]: days } as React.CSSProperties}
      >
        <div className="timeline-axis">
          <div className="axis-label-col" style={{ width: 220 }}>
            Task
          </div>
          <div className="axis-weeks">
            {days14.map((d, i) => (
              <div
                key={d}
                className={`axis-week ${i === todayIdx ? 'axis-today' : ''}`}
                title={d}
              >
                {formatDayShort(d)}
              </div>
            ))}
          </div>
        </div>

        {entries
          .filter((e) => e.start <= addDays(start, days - 1) && e.end >= start)
          .map(({ task, start: s, end: e }) => {
            const lo = s < start ? start : s;
            const hi = e > addDays(start, days - 1) ? addDays(start, days - 1) : e;
            const offset = diffDays(start, lo);
            const span = Math.max(1, diffDays(lo, hi) + 1);
            const leftPct = (offset / days) * 100;
            const widthPct = (span / days) * 100;
            return (
              <div className="timeline-row" key={task.id}>
                <button
                  className="timeline-label timeline-label-btn"
                  style={{ width: 220 }}
                  onClick={() => onOpenTask(task.id)}
                  title={`${task.title}\n${formatDateShort(s)} → ${formatDateShort(e)}`}
                >
                  #{task.id} {task.title}
                </button>
                <div className="timeline-track">
                  <button
                    className={barClassesFor(task) + ' timeline-bar-btn'}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => onOpenTask(task.id)}
                    title={`${task.title}\n${formatDateShort(s)} → ${formatDateShort(e)}`}
                  >
                    {task.duration}d
                  </button>
                </div>
              </div>
            );
          })}
        {entries.filter(
          (e) => e.start <= addDays(start, days - 1) && e.end >= start,
        ).length === 0 && (
          <p
            className="empty"
            style={{ padding: '24px 0', textAlign: 'left' }}
          >
            No tasks active in this 14-day window.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Month calendar grid ───────────────────────────────────────

function MonthMode({
  entries,
  state,
  onOpenTask,
}: {
  entries: ScheduledTask[];
  state: StateLike;
  onOpenTask: (id: number) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const anchorIso =
    state.startDate < today.slice(0, 7) + '-01' ? today : state.startDate;
  const anchor = new Date(anchorIso);
  const [yyyy, mm] = [anchor.getFullYear(), anchor.getMonth()];

  const [year, setYear] = useState(yyyy);
  const [month, setMonth] = useState(mm);

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const dayOfWeekStart = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const totalCells = Math.ceil((dayOfWeekStart + lastOfMonth.getDate()) / 7) * 7;

  const cellDates: (string | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - dayOfWeekStart + 1;
    if (dayNum >= 1 && dayNum <= lastOfMonth.getDate()) {
      const d = new Date(year, month, dayNum);
      cellDates.push(d.toISOString().slice(0, 10));
    } else {
      cellDates.push(null);
    }
  }

  // Tasks active anywhere this month.
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = lastOfMonth.toISOString().slice(0, 10);
  const tasksThisMonth = entries.filter(
    (e) => e.start <= monthEnd && e.end >= monthStart,
  );

  // For each task, decide which cells it covers (clamped to month).
  const monthLabel = firstOfMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const stepMonth = (dir: -1 | 1) => {
    const newDate = new Date(year, month + dir, 1);
    setYear(newDate.getFullYear());
    setMonth(newDate.getMonth());
  };

  return (
    <div className="timeline-wrap">
      <div className="month-header">
        <button className="btn-quiet" onClick={() => stepMonth(-1)}>
          ←
        </button>
        <h3 className="month-title">{monthLabel}</h3>
        <button className="btn-quiet" onClick={() => stepMonth(1)}>
          →
        </button>
      </div>
      {legendOf(state)}

      <div className="month-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div className="month-dow" key={d}>
            {d}
          </div>
        ))}
        {cellDates.map((d, i) => {
          if (!d) return <div key={i} className="month-cell month-cell-empty" />;
          const tasksOnDay = tasksThisMonth.filter(
            (e) => e.start <= d && e.end >= d,
          );
          const isToday = d === today;
          return (
            <div key={i} className={`month-cell ${isToday ? 'is-today' : ''}`}>
              <div className="month-day-num tnum">{Number(d.slice(8, 10))}</div>
              <div className="month-day-tasks">
                {tasksOnDay.slice(0, 3).map(({ task }) => (
                  <button
                    key={task.id}
                    className={`month-pill bar-phase-${task.phase} ${
                      task.status === 'done' ? 'bar-done' : ''
                    }`}
                    onClick={() => onOpenTask(task.id)}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {tasksOnDay.length > 3 && (
                  <span className="month-more">+{tasksOnDay.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
