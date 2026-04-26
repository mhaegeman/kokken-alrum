import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { Task, TaskPriority, TaskStatus } from '../../types';
import { toast } from '../../lib/toast';
import { positionsByTaskId, sortTasks } from '../../lib/taskOrder';

type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';

// Where a drop indicator should appear when dragging.
type DropTarget =
  | { kind: 'phase-start'; phase: number }
  | { kind: 'before-task'; taskId: number; phase: number }
  | { kind: 'after-task'; taskId: number; phase: number };

export function TasksView({
  onOpenTask,
  isGuest,
}: {
  onOpenTask: (taskId: number) => void;
  isGuest: boolean;
}) {
  const state = useStore((s) => s.state);
  const addTask = useStore((s) => s.addTask);
  const moveTask = useStore((s) => s.moveTask);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [adding, setAdding] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const phaseEntries = Object.entries(state.phases);
  const firstPhaseId = phaseEntries[0]?.[0] ?? '1';

  // Position map is computed across the *full* list (unfiltered), so the
  // visible "#N" stays stable while the user fiddles with filters.
  const positions = useMemo(() => positionsByTaskId(state.tasks), [state.tasks]);

  const sortedTasks = useMemo(
    () =>
      sortTasks(state.tasks).filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (phaseFilter !== 'all' && String(t.phase) !== phaseFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        return true;
      }),
    [state.tasks, statusFilter, phaseFilter, priorityFilter],
  );

  const filtersActive =
    statusFilter !== 'all' || phaseFilter !== 'all' || priorityFilter !== 'all';

  const onDrop = async (target: DropTarget) => {
    if (draggingId == null) return;
    setDropTarget(null);
    setDraggingId(null);
    // Resolve to a (phase, indexInPhase) using the *full* unfiltered task
    // list — drag-and-drop must respect the real layout, not the filtered
    // view. Otherwise dropping while a filter is active would shuffle
    // tasks the user can't see.
    const allInPhase = sortTasks(state.tasks).filter(
      (t) => t.phase === target.phase && t.id !== draggingId,
    );
    let idx: number;
    if (target.kind === 'phase-start') {
      idx = 0;
    } else {
      const refIdx = allInPhase.findIndex((t) => t.id === target.taskId);
      idx = refIdx === -1 ? allInPhase.length : (target.kind === 'after-task' ? refIdx + 1 : refIdx);
    }
    await moveTask(draggingId, target.phase, idx);
  };

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

        {!isGuest && (
          <button
            className="btn-quiet"
            style={{ marginLeft: 'auto' }}
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? 'Cancel' : '+ New task'}
          </button>
        )}
      </div>

      {adding && !isGuest && (
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

      {!isGuest && filtersActive && (
        <p className="reorder-hint">
          Clear filters to drag tasks around — drag-and-drop only works on the full list.
        </p>
      )}

      <div onDragLeave={(e) => {
        // If the drag leaves the entire list area, clear the indicator.
        if (e.currentTarget === e.target) setDropTarget(null);
      }}>
        {sortedTasks.length === 0 && (
          <p className="empty">
            {state.tasks.length === 0
              ? 'No tasks yet. Click + New task to add one.'
              : 'No tasks match the current filters.'}
          </p>
        )}

        {phaseEntries.map(([phaseIdStr, phase]) => {
          const phaseId = Number(phaseIdStr);
          const phaseTasks = sortedTasks.filter((t) => t.phase === phaseId);
          if (phaseTasks.length === 0 && filtersActive) return null;
          const draggable = !isGuest && !filtersActive;
          const dropOnHeader =
            dropTarget?.kind === 'phase-start' && dropTarget.phase === phaseId;

          return (
            <div key={phaseIdStr}>
              <div
                className={`phase-header ${draggable ? 'phase-header-droppable' : ''} ${
                  dropOnHeader ? 'drop-target' : ''
                }`}
                onDragOver={(e) => {
                  if (!draggable || draggingId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTarget({ kind: 'phase-start', phase: phaseId });
                }}
                onDrop={(e) => {
                  if (!draggable || draggingId == null) return;
                  e.preventDefault();
                  onDrop({ kind: 'phase-start', phase: phaseId });
                }}
              >
                Phase {phaseIdStr} · {phase.name}
              </div>

              {phaseTasks.length === 0 && draggable && (
                <p
                  className={`phase-empty-drop ${dropOnHeader ? 'drop-target' : ''}`}
                  onDragOver={(e) => {
                    if (draggingId == null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropTarget({ kind: 'phase-start', phase: phaseId });
                  }}
                  onDrop={(e) => {
                    if (draggingId == null) return;
                    e.preventDefault();
                    onDrop({ kind: 'phase-start', phase: phaseId });
                  }}
                >
                  Drop a task here to add it to this phase.
                </p>
              )}

              {phaseTasks.map((t) => {
                const indicator =
                  dropTarget &&
                  dropTarget.kind !== 'phase-start' &&
                  dropTarget.taskId === t.id
                    ? dropTarget.kind
                    : null;
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    position={positions.get(t.id) ?? t.id}
                    isDragging={draggingId === t.id}
                    indicator={indicator}
                    draggable={draggable}
                    onOpen={() => onOpenTask(t.id)}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    onDragOverRow={(pos) =>
                      setDropTarget({
                        kind: pos === 'top' ? 'before-task' : 'after-task',
                        taskId: t.id,
                        phase: t.phase,
                      })
                    }
                    onDropOnRow={(pos) =>
                      onDrop({
                        kind: pos === 'top' ? 'before-task' : 'after-task',
                        taskId: t.id,
                        phase: t.phase,
                      })
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── one task row ──────────────────────────────────────────────

function TaskRow({
  task,
  position,
  isDragging,
  indicator,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropOnRow,
}: {
  task: Task;
  position: number;
  isDragging: boolean;
  indicator: 'before-task' | 'after-task' | null;
  draggable: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverRow: (pos: 'top' | 'bottom') => void;
  onDropOnRow: (pos: 'top' | 'bottom') => void;
}) {
  const attachCount = task.attachments?.length ?? 0;
  const commentCount = task.comments?.length ?? 0;

  return (
    <div
      className={`task-row-wrap ${indicator ? `drop-${indicator}` : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        // Set a payload (some browsers require it for the drag to work)
        // and a label for the drag image.
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(task.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const pos = e.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
        onDragOverRow(pos);
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const pos = e.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
        onDropOnRow(pos);
      }}
    >
      <button
        className={`task-row task-row-btn ${isDragging ? 'dragging' : ''}`}
        onClick={onOpen}
      >
        {draggable && (
          <span
            className="task-drag-handle"
            aria-hidden="true"
            title="Drag to reorder"
          >
            ⋮⋮
          </span>
        )}
        <span className="task-num">#{position}</span>
        <span className={`task-title ${task.status === 'done' ? 'done' : ''}`}>
          {task.title}
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
          <span className="task-dur tnum">{task.duration || 0}d</span>
          <span className={`pill pill-${task.priority}`}>{task.priority}</span>
          <span className={`pill pill-${task.status}`}>
            {task.status.replace('_', ' ')}
          </span>
        </span>
      </button>
    </div>
  );
}

// ─── new task form ─────────────────────────────────────────────

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
