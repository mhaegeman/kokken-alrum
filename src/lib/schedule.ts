import type { AppState } from '../types';
import { addDays } from './format';

export interface Scheduled {
  start: string;
  end: string;
}

export function computeSchedule(state: AppState): Record<number, Scheduled> {
  const tasksById = Object.fromEntries(state.tasks.map((t) => [t.id, t]));
  const computed: Record<number, Scheduled> = {};

  function endOf(id: number): Scheduled {
    if (computed[id]) return computed[id];
    const t = tasksById[id];
    let startAnchor = state.startDate;
    if (t.deps && t.deps.length) {
      const depEnds = t.deps.map((d) => endOf(d).end);
      depEnds.sort();
      startAnchor = depEnds[depEnds.length - 1];
    }
    const start = t.start || startAnchor;
    const end = t.end || addDays(start, Math.max(1, t.duration || 1));
    computed[id] = { start, end };
    return computed[id];
  }

  state.tasks.forEach((t) => endOf(t.id));
  return computed;
}
