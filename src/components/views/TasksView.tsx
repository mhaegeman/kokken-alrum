import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { Task, TaskPriority, TaskStatus } from '../../types';

type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';

export function TasksView({ authorId }: { authorId: string | null }) {
  const state = useStore((s) => s.state);
  const updateTask = useStore((s) => s.updateTask);
  const addTaskComment = useStore((s) => s.addTaskComment);
  const deleteTaskComment = useStore((s) => s.deleteTaskComment);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

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

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const titleById = (id: number) =>
    state.tasks.find((t) => t.id === id)?.title ?? '?';

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
          const isOpen = openIds.has(t.id);
          return (
            <div key={t.id}>
              {showPhase && (
                <div className="phase-header">
                  Phase {t.phase} · {state.phases[t.phase]?.name}
                </div>
              )}
              <TaskRow
                task={t}
                isOpen={isOpen}
                onToggle={() => toggle(t.id)}
                onUpdate={(patch) => updateTask(t.id, patch)}
                onAddComment={(text) =>
                  authorId ? addTaskComment(t.id, text, authorId) : undefined
                }
                onDeleteComment={(commentId) => deleteTaskComment(t.id, commentId)}
                titleById={titleById}
                canComment={!!authorId}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

function TaskRow({
  task,
  isOpen,
  onToggle,
  onUpdate,
  onAddComment,
  onDeleteComment,
  titleById,
  canComment,
}: {
  task: Task;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: number) => void;
  titleById: (id: number) => string;
  canComment: boolean;
}) {
  const [commentText, setCommentText] = useState('');

  const doAdd = () => {
    const v = commentText.trim();
    if (!v) return;
    onAddComment(v);
    setCommentText('');
  };

  return (
    <div className="task-row">
      <div
        className="task-head"
        onClick={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON') return;
          onToggle();
        }}
      >
        <span className={`chev ${isOpen ? 'open' : ''}`}>▶</span>
        <span className="task-num">#{task.id}</span>
        <span className={`task-title ${task.status === 'done' ? 'done' : ''}`}>
          {task.title}
        </span>
        <span className="task-dur">{task.duration || 0}d</span>
        <span className={`pill pill-${task.priority}`}>{task.priority}</span>
        <span className={`pill pill-${task.status}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>

      <div className={`task-body ${isOpen ? 'open' : ''}`}>
        <div className="task-meta">
          <div className="field">
            <label>Status</label>
            <select
              value={task.status}
              onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select
              value={task.priority}
              onChange={(e) => onUpdate({ priority: e.target.value as TaskPriority })}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="field">
            <label>Duration (days)</label>
            <input
              type="number"
              min={0}
              value={task.duration || 0}
              onChange={(e) =>
                onUpdate({ duration: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
            />
          </div>
          <div className="field">
            <label>Start date (override)</label>
            <input
              type="date"
              value={task.start || ''}
              onChange={(e) => onUpdate({ start: e.target.value })}
            />
          </div>
          <div className="field">
            <label>End date (override)</label>
            <input
              type="date"
              value={task.end || ''}
              onChange={(e) => onUpdate({ end: e.target.value })}
            />
          </div>
        </div>

        {task.deps && task.deps.length > 0 && (
          <div className="deps">
            <strong>Depends on:</strong>{' '}
            {task.deps.map((d) => `#${d} ${titleById(d)}`).join(' · ')}
          </div>
        )}

        <div className="comments">
          <h4>Comments ({task.comments.length})</h4>
          {task.comments.map((c) => (
            <div key={c.id ?? `${c.date}-${c.text}`} className="comment">
              <div className="comment-text">{c.text}</div>
              <div className="comment-date">{c.date}</div>
              {c.id !== undefined && (
                <button
                  className="comment-del"
                  title="Delete"
                  onClick={() => onDeleteComment(c.id as number)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="comment-add">
            <input
              type="text"
              placeholder={
                canComment ? 'Add a comment...' : 'Sign in to add comments'
              }
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doAdd();
              }}
              disabled={!canComment}
            />
            <button className="btn-primary" onClick={doAdd} disabled={!canComment}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
