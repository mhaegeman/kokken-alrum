import { useStore } from '../../state/store';
import { computeSchedule } from '../../lib/schedule';
import { addDays, diffDays, formatDateShort } from '../../lib/format';

export function TimelineView() {
  const state = useStore((s) => s.state);
  const setStartDate = useStore((s) => s.setStartDate);

  const schedule = computeSchedule(state);
  const entries = state.tasks.map((t) => ({ task: t, ...schedule[t.id] }));
  const projectStart = state.startDate;
  const projectEnd = entries.reduce(
    (max, e) => (e.end > max ? e.end : max),
    projectStart,
  );

  const totalDays = Math.max(7, diffDays(projectStart, projectEnd) + 1);
  const totalWeeks = Math.ceil(totalDays / 7);
  const endDateLabel = formatDateShort(projectEnd);

  return (
    <>
      <div className="filters">
        <label>Project start</label>
        <input
          type="date"
          value={state.startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          · {totalWeeks} weeks · ends approx. {endDateLabel}
        </span>
      </div>

      <div className="timeline-wrap">
        <div className="timeline-legend">
          {Object.entries(state.phases).map(([id, p]) => (
            <span key={id}>
              <span className="legend-swatch" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
          <span>
            <span
              className="legend-swatch"
              style={{ background: '#888', opacity: 0.45 }}
            />
            Done
          </span>
        </div>

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

            let barClass = `timeline-bar bar-phase-${task.phase}`;
            if (task.status === 'done') barClass += ' bar-done';
            if (task.status === 'blocked') barClass += ' bar-blocked';

            return (
              <div className="timeline-row" key={task.id}>
                <div
                  className="timeline-label"
                  style={{ width: 280 }}
                  title={`${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)} (${task.duration}d)`}
                >
                  #{task.id} {task.title}
                </div>
                <div className="timeline-track">
                  <div
                    className={barClass}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)}\nStatus: ${task.status.replace('_', ' ')}`}
                  >
                    {task.duration}d
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
        Dates are auto-scheduled from durations and dependencies. Override a task's
        start/end in the Tasks view to pin it.
      </p>
    </>
  );
}
