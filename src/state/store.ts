import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, BudgetItem, Task } from '../types';
import { INITIAL_DATA } from './initial';

const STORAGE_KEY = 'kokken_alrum_state_v1';

interface Store {
  state: AppState;
  setState: (patch: Partial<AppState>) => void;
  updateTask: (id: number, patch: Partial<Task>) => void;
  addTaskComment: (id: number, text: string) => void;
  deleteTaskComment: (id: number, index: number) => void;
  updateBudgetItem: (id: number, patch: Partial<BudgetItem>) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  deleteBudgetItem: (id: number) => void;
  setBudgetTarget: (target: number) => void;
  setStartDate: (date: string) => void;
  reset: () => void;
  replaceState: (state: AppState) => void;
}

function mergeForwardCompat(s: AppState): AppState {
  return {
    ...s,
    phases: { ...INITIAL_DATA.phases, ...(s.phases ?? {}) },
    budgetCategories: {
      ...INITIAL_DATA.budgetCategories,
      ...(s.budgetCategories ?? {}),
    },
    currency: s.currency ?? INITIAL_DATA.currency,
    startDate: s.startDate ?? INITIAL_DATA.startDate,
    totalBudgetTarget: s.totalBudgetTarget ?? INITIAL_DATA.totalBudgetTarget,
  };
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      state: structuredClone(INITIAL_DATA),

      setState: (patch) =>
        set((s) => ({ state: { ...s.state, ...patch } })),

      updateTask: (id, patch) =>
        set((s) => ({
          state: {
            ...s.state,
            tasks: s.state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          },
        })),

      addTaskComment: (id, text) =>
        set((s) => ({
          state: {
            ...s.state,
            tasks: s.state.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    comments: [
                      ...t.comments,
                      { text, date: new Date().toISOString().slice(0, 10) },
                    ],
                  }
                : t,
            ),
          },
        })),

      deleteTaskComment: (id, index) =>
        set((s) => ({
          state: {
            ...s.state,
            tasks: s.state.tasks.map((t) =>
              t.id === id
                ? { ...t, comments: t.comments.filter((_, i) => i !== index) }
                : t,
            ),
          },
        })),

      updateBudgetItem: (id, patch) =>
        set((s) => ({
          state: {
            ...s.state,
            budgetItems: s.state.budgetItems.map((i) =>
              i.id === id ? { ...i, ...patch } : i,
            ),
          },
        })),

      addBudgetItem: (item) =>
        set((s) => {
          const nextId = Math.max(0, ...s.state.budgetItems.map((i) => i.id)) + 1;
          return {
            state: {
              ...s.state,
              budgetItems: [...s.state.budgetItems, { ...item, id: nextId }],
            },
          };
        }),

      deleteBudgetItem: (id) =>
        set((s) => ({
          state: {
            ...s.state,
            budgetItems: s.state.budgetItems.filter((i) => i.id !== id),
          },
        })),

      setBudgetTarget: (target) =>
        set((s) => ({ state: { ...s.state, totalBudgetTarget: target } })),

      setStartDate: (date) =>
        set((s) => ({ state: { ...s.state, startDate: date } })),

      reset: () => set({ state: structuredClone(INITIAL_DATA) }),

      replaceState: (state) => set({ state }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ state: s.state }),
      merge: (persisted, current) => {
        const p = persisted as { state?: AppState } | undefined;
        if (!p?.state) return current;
        return { ...current, state: mergeForwardCompat(p.state) };
      },
    },
  ),
);

export function exportJson(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kokken-alrum-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importJson(file: File): Promise<AppState> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.tasks || !data.budgetItems) {
    throw new Error('Invalid file — missing tasks or budgetItems.');
  }
  return data as AppState;
}
