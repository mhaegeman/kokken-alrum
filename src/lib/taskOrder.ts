import type { Task } from '../types';

/** Return tasks sorted in their canonical display order:
 *  by phase first, then sort_order, then id as a stable tie-break. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.phase - b.phase ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
}

/** Map of task id → 1-based position in the canonical sorted list.
 *  This is the "#N" the user sees; it auto-adjusts when tasks are
 *  reordered, while the underlying ids stay stable. */
export function positionsByTaskId(tasks: Task[]): Map<number, number> {
  const sorted = sortTasks(tasks);
  const m = new Map<number, number>();
  sorted.forEach((t, i) => m.set(t.id, i + 1));
  return m;
}

/** Given a task, return the set of task ids that *cannot* be added as a
 *  dependency without creating a cycle: the task itself, plus any task
 *  that already (transitively) depends on it. */
export function forbiddenDepIds(taskId: number, tasks: Task[]): Set<number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const forbidden = new Set<number>([taskId]);
  // BFS forward: from `taskId`, follow "is depended on by" edges.
  const dependents = new Map<number, number[]>();
  for (const t of tasks) {
    for (const d of t.deps) {
      const arr = dependents.get(d) ?? [];
      arr.push(t.id);
      dependents.set(d, arr);
    }
  }
  const queue: number[] = [taskId];
  while (queue.length) {
    const cur = queue.shift() as number;
    for (const next of dependents.get(cur) ?? []) {
      if (!forbidden.has(next)) {
        forbidden.add(next);
        queue.push(next);
      }
    }
  }
  // Tasks not in `byId` (shouldn't happen) are not relevant.
  for (const id of forbidden) if (!byId.has(id) && id !== taskId) forbidden.delete(id);
  return forbidden;
}
