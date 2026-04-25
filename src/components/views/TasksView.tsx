import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { TaskPriority, TaskStatus } from '../../types';
import { toast } from '../../lib/toast';

type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';

export function TasksView({
  onOpenTask,
}: {
  onOpenTask: (taskId: number) => void;
}) {
  const state = useStore((s) => s.state);
  const addTask = useStore((s) => s.addTask);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [adding, setAdding] = useState(false);

  const phaseEntries = Object.entries(state.phases);
  const firstPhaseId = phaseEntries[0]?.[0] ?? '1';

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
          {phaseEntries.map(([id, p]) => (
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

        <button
          className="btn-quiet"
          style={{ marginLeft: 'auto' }}
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Cancel' : '+ New task'}
        </button>
      </div>

      {adding && (
        <NewTaskForm
          phaseEntries={phaseEntries}
          defaultPhase={firstPhaseId}
          onCancel={() => setAdding(false)}
          onCreate={async (input) => {
            const id = await addTask(input);
            if (id != null) {
              toast.success('Task added.');
              setAdding(false);
              onOpenTask(id);
            }
          }}
        />
      )}

      <div>
        {tasks.length === 0 && (
          <p className="empty">
            {state.tasks.length === 0
              ? 'No tasks yet. Click + New task to add one.'
              : 'No tasks match the current filters.'}
          </p>
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

function NewTaskForm({
  phaseEntries,
  defaultPhase,
  onCancel,
  onCreate,
}: {
  phaseEntries: [string, { name: string; color: string }][];
  defaultPhase: string;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    phase: number;
    priority: TaskPriority;
    duration: number;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState(defaultPhase);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [duration, setDuration] = useState<number>(3);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await onCreate({
        title: t,
        phase: Number(phase),
        priority,
        duration: Math.max(0, duration | 0),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="new-task-row">
      <input
        type="text"
        autoFocus
        placeholder="What's the task?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        style={{ flex: 2, minWidth: 240 }}
      />
      <select value={phase} onChange={(e) => setPhase(e.target.value)}>
        {phaseEntries.map(([id, p]) => (
          <option key={id} value={id}>
            Phase {id} · {p.name}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
      >
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <input
        type="number"
        min={0}
        value={duration}
        onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
        style={{ width: 80 }}
        title="Duration in days"
      />
      <button
        className="btn-primary"
        onClick={submit}
        disabled={!title.trim() || busy}
      >
        {busy ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
