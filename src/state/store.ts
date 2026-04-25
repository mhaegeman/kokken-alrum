import { create } from 'zustand';
import type { AppState, BudgetItem, Task } from '../types';
import type { Attachment } from '../types';
import {
  loadAppState,
  addCommentRemote,
  addBudgetItemRemote,
  addLinkAttachment,
  deleteAttachmentRemote,
  deleteBudgetItemRemote,
  deleteCommentRemote,
  subscribeToChanges,
  updateBudgetItemRemote,
  updateSettingsRemote,
  updateTaskRemote,
  uploadFileAttachment,
} from '../lib/api';

const EMPTY_STATE: AppState = {
  startDate: '',
  currency: 'DKK',
  totalBudgetTarget: 0,
  phases: {},
  budgetCategories: {},
  tasks: [],
  budgetItems: [],
};

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Store {
  state: AppState;
  status: LoadStatus;
  error: string | null;

  loadFromServer: () => Promise<void>;
  startRealtime: () => () => void;

  updateTask: (id: number, patch: Partial<Task>) => Promise<void>;
  addTaskComment: (taskId: number, text: string, authorId: string) => Promise<void>;
  deleteTaskComment: (taskId: number, commentId: number) => Promise<void>;

  uploadTaskAttachment: (taskId: number, file: File, uploaderId: string) => Promise<void>;
  addTaskLink: (taskId: number, url: string, label: string, uploaderId: string) => Promise<void>;
  deleteTaskAttachment: (taskId: number, attachment: Attachment) => Promise<void>;

  updateBudgetItem: (id: number, patch: Partial<BudgetItem>) => Promise<void>;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
  deleteBudgetItem: (id: number) => Promise<void>;

  setBudgetTarget: (target: number) => Promise<void>;
  setStartDate: (date: string) => Promise<void>;
}

// Small helper: applies an optimistic patch, runs the remote mutation, and if
// it fails reverts by forcing a reload from the server.
async function withOptimistic(
  apply: () => void,
  remote: () => Promise<void>,
  reload: () => Promise<void>,
) {
  apply();
  try {
    await remote();
  } catch (e) {
    console.error(e);
    alert('Save failed: ' + (e as Error).message);
    await reload();
  }
}

export const useStore = create<Store>()((set, get) => ({
  state: EMPTY_STATE,
  status: 'idle',
  error: null,

  async loadFromServer() {
    set({ status: 'loading', error: null });
    try {
      const next = await loadAppState();
      set({ state: next, status: 'ready' });
    } catch (e) {
      console.error(e);
      set({ status: 'error', error: (e as Error).message });
    }
  },

  startRealtime() {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToChanges(() => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        get().loadFromServer();
      }, 300);
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsubscribe();
    };
  },

  // ─── tasks ──────────────────────────────────────────────

  async updateTask(id, patch) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          },
        }),
      () => updateTaskRemote(id, patch),
      () => get().loadFromServer(),
    );
  },

  async addTaskComment(taskId, text, authorId) {
    if (!text.trim()) return;
    try {
      const comment = await addCommentRemote(taskId, text.trim(), authorId);
      const prev = get().state;
      set({
        state: {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t,
          ),
        },
      });
    } catch (e) {
      alert('Could not add comment: ' + (e as Error).message);
    }
  },

  async deleteTaskComment(taskId, commentId) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) }
                : t,
            ),
          },
        }),
      () => deleteCommentRemote(commentId),
      () => get().loadFromServer(),
    );
  },

  // ─── attachments ────────────────────────────────────────

  async uploadTaskAttachment(taskId, file, uploaderId) {
    try {
      const attachment = await uploadFileAttachment(taskId, file, uploaderId);
      const prev = get().state;
      set({
        state: {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: [...t.attachments, attachment] }
              : t,
          ),
        },
      });
    } catch (e) {
      alert('Upload failed: ' + (e as Error).message);
    }
  },

  async addTaskLink(taskId, url, label, uploaderId) {
    try {
      const attachment = await addLinkAttachment(taskId, url, label, uploaderId);
      const prev = get().state;
      set({
        state: {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: [...t.attachments, attachment] }
              : t,
          ),
        },
      });
    } catch (e) {
      alert('Could not add link: ' + (e as Error).message);
    }
  },

  async deleteTaskAttachment(taskId, attachment) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    attachments: t.attachments.filter((a) => a.id !== attachment.id),
                  }
                : t,
            ),
          },
        }),
      () => deleteAttachmentRemote(attachment),
      () => get().loadFromServer(),
    );
  },

  // ─── budget ─────────────────────────────────────────────

  async updateBudgetItem(id, patch) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            budgetItems: prev.budgetItems.map((i) =>
              i.id === id ? { ...i, ...patch } : i,
            ),
          },
        }),
      () => updateBudgetItemRemote(id, patch),
      () => get().loadFromServer(),
    );
  },

  async addBudgetItem(item) {
    try {
      const row = await addBudgetItemRemote(item);
      const prev = get().state;
      set({
        state: { ...prev, budgetItems: [...prev.budgetItems, row] },
      });
    } catch (e) {
      alert('Could not add item: ' + (e as Error).message);
    }
  },

  async deleteBudgetItem(id) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            budgetItems: prev.budgetItems.filter((i) => i.id !== id),
          },
        }),
      () => deleteBudgetItemRemote(id),
      () => get().loadFromServer(),
    );
  },

  // ─── settings ───────────────────────────────────────────

  async setBudgetTarget(target) {
    const prev = get().state;
    await withOptimistic(
      () => set({ state: { ...prev, totalBudgetTarget: target } }),
      () => updateSettingsRemote({ totalBudgetTarget: target }),
      () => get().loadFromServer(),
    );
  },

  async setStartDate(date) {
    const prev = get().state;
    await withOptimistic(
      () => set({ state: { ...prev, startDate: date } }),
      () => updateSettingsRemote({ startDate: date }),
      () => get().loadFromServer(),
    );
  },
}));

// ─── JSON snapshot export (nice-to-have for backup) ──────────────

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
