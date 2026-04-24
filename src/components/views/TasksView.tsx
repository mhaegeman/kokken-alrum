import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { TaskPriority, TaskStatus } from '../../types';

type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';

export function TasksView({
  onOpenTask,
}: {
  onOpenTask: (taskId: number) => void;
}) {
  const state = useStore((s) => s.state);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const tasks = useMemo(
    () =>
      state.tasks.filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (phaseFilter !== 'all' && String(t.phase) !== phaseFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        return true;
      }),
    [state.tasks, statusFilter, phaseFilter, priorityFilter],
  );

  let lastPhase: number | null = null;

  return (
    <>
      <div className="filters">
        <label>Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>

        <label>Phase</label>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
          <option value="all">All</option>
          {Object.entries(state.phases).map(([id, p]) => (
            <option key={id} value={id}>
              {id}. {p.name}
            </option>
          ))}
        </select>

        <label>Priority</label>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
        >
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div>
        {tasks.length === 0 && (
          <p className="empty">No tasks match the current filters.</p>
        )}
        {tasks.map((t) => {
          const showPhase = t.phase !== lastPhase;
          lastPhase = t.phase;
          const attachCount = t.attachments?.length ?? 0;
          const commentCount = t.comments?.length ?? 0;
          return (
            <div key={t.id}>
              {showPhase && (
                <div className="phase-header">
                  Phase {t.phase} · {state.phases[t.phase]?.name}
                </div>
              )}
              <button
                className="task-row task-row-btn"
                onClick={() => onOpenTask(t.id)}
              >
                <span className="task-num">#{t.id}</span>
                <span className={`task-title ${t.status === 'done' ? 'done' : ''}`}>
                  {t.title}
                </span>
                <span className="task-row-meta">
                  {attachCount > 0 && (
                    <span className="task-chip" title="Attachments">
                      📎 {attachCount}
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span className="task-chip" title="Comments">
                      💬 {commentCount}
                    </span>
                  )}
                  <span className="task-dur tnum">{t.duration || 0}d</span>
                  <span className={`pill pill-${t.priority}`}>{t.priority}</span>
                  <span className={`pill pill-${t.status}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
