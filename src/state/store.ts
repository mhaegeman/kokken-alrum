import { create } from 'zustand';
import type { AppState, BudgetItem, Contact, Task } from '../types';
import type { Attachment } from '../types';
import {
  loadAppState,
  addCommentRemote,
  addBudgetItemRemote,
  addContactRemote,
  addLinkAttachment,
  addNoteMessageRemote,
  addTaskRemote,
  createTopicRemote,
  deleteAttachmentRemote,
  deleteBudgetItemRemote,
  deleteCommentRemote,
  deleteContactRemote,
  deleteNoteMessageRemote,
  deleteTaskRemote,
  deleteTopicRemote,
  markMentionsSeenRemote,
  moveTaskRemote,
  subscribeToChanges,
  updateBudgetItemRemote,
  updateContactRemote,
  updateSettingsRemote,
  updateTaskRemote,
  updateTopicRemote,
  uploadFileAttachment,
} from '../lib/api';
import { toast } from '../lib/toast';

// Last-known-good cache of the AppState in localStorage so the UI can
// paint from cache on cold start (and works read-only when offline).
const CACHE_KEY = 'kokken_alrum_state_cache_v3';

function loadCachedState(): AppState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

function saveCachedState(s: AppState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded etc. — fine to ignore, cache is optional.
  }
}

const EMPTY_STATE: AppState = {
  startDate: '',
  currency: 'DKK',
  totalBudgetTarget: 0,
  phases: {},
  budgetCategories: {},
  tasks: [],
  budgetItems: [],
  topics: [],
  messages: [],
  mentions: [],
  contacts: [],
};

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Store {
  state: AppState;
  status: LoadStatus;
  error: string | null;

  loadFromServer: () => Promise<void>;
  startRealtime: () => () => void;

  updateTask: (id: number, patch: Partial<Task>) => Promise<void>;
  addTask: (input: {
    title: string;
    phase: number;
    priority: 'high' | 'medium' | 'low';
    duration: number;
  }) => Promise<number | null>;
  deleteTask: (id: number) => Promise<void>;
  /** Move a task to a new (phase, position-within-phase). Position is the
   *  desired index *after* the task is in place; pass 0 to insert at the
   *  start of the phase. The store computes a sort_order between the
   *  neighbours so we don't renumber unrelated tasks. */
  moveTask: (id: number, toPhase: number, toIndexInPhase: number) => Promise<void>;
  addTaskComment: (taskId: number, text: string, authorId: string) => Promise<void>;
  deleteTaskComment: (taskId: number, commentId: number) => Promise<void>;

  uploadTaskAttachment: (taskId: number, file: File, uploaderId: string) => Promise<void>;
  addTaskLink: (taskId: number, url: string, label: string, uploaderId: string) => Promise<void>;
  deleteTaskAttachment: (taskId: number, attachment: Attachment) => Promise<void>;

  uploadBudgetAttachment: (budgetItemId: number, file: File, uploaderId: string) => Promise<void>;
  addBudgetLink: (budgetItemId: number, url: string, label: string, uploaderId: string) => Promise<void>;
  deleteBudgetAttachment: (budgetItemId: number, attachment: Attachment) => Promise<void>;

  updateBudgetItem: (id: number, patch: Partial<BudgetItem>) => Promise<void>;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
  deleteBudgetItem: (id: number) => Promise<void>;

  setBudgetTarget: (target: number) => Promise<void>;
  setStartDate: (date: string) => Promise<void>;

  createTopic: (title: string, createdBy: string) => Promise<number | null>;
  renameTopic: (id: number, title: string) => Promise<void>;
  deleteTopic: (id: number) => Promise<void>;
  addNoteMessage: (
    topicId: number,
    body: string,
    authorId: string,
    files?: File[],
  ) => Promise<void>;
  deleteNoteMessage: (id: number) => Promise<void>;

  markMentionsSeen: (ids: number[]) => Promise<void>;

  addContact: (
    input: Omit<Contact, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    createdBy: string,
  ) => Promise<number | null>;
  updateContact: (id: number, patch: Partial<Contact>) => Promise<void>;
  deleteContact: (id: number) => Promise<void>;
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
    toast.error('Save failed: ' + (e as Error).message);
    await reload();
  }
}

// Pre-populate from localStorage so the first paint shows the last
// known data instead of empty placeholders. The actual loadFromServer
// will overwrite this once Supabase responds.
const cached = loadCachedState();

export const useStore = create<Store>()((set, get) => ({
  state: cached ?? EMPTY_STATE,
  status: cached ? 'ready' : 'idle',
  error: null,

  async loadFromServer() {
    const haveCache = get().status === 'ready';
    if (!haveCache) set({ status: 'loading', error: null });
    try {
      const next = await loadAppState();
      set({ state: next, status: 'ready', error: null });
      saveCachedState(next);
    } catch (e) {
      console.error(e);
      if (haveCache) {
        // Network blip — keep showing cached data + a quiet toast.
        toast.error("Couldn't refresh — showing last-known data.");
      } else {
        set({ status: 'error', error: (e as Error).message });
      }
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

  async addTask(input) {
    try {
      const task = await addTaskRemote(input);
      const prev = get().state;
      set({
        state: { ...prev, tasks: [...prev.tasks, task] },
      });
      return task.id;
    } catch (e) {
      toast.error('Could not create task: ' + (e as Error).message);
      return null;
    }
  },

  async deleteTask(id) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            tasks: prev.tasks.filter((t) => t.id !== id),
          },
        }),
      () => deleteTaskRemote(id),
      () => get().loadFromServer(),
    );
  },

  async moveTask(id, toPhase, toIndexInPhase) {
    const prev = get().state;
    const moving = prev.tasks.find((t) => t.id === id);
    if (!moving) return;

    // Phase neighbours, excluding the moving task itself, sorted by current
    // sort_order. The desired index is interpreted in this trimmed list.
    const phaseTasks = prev.tasks
      .filter((t) => t.phase === toPhase && t.id !== id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

    const idx = Math.max(0, Math.min(toIndexInPhase, phaseTasks.length));
    const before = phaseTasks[idx - 1]?.sortOrder;
    const after = phaseTasks[idx]?.sortOrder;

    let nextSort: number;
    if (before === undefined && after === undefined) {
      nextSort = 1;
    } else if (before === undefined) {
      nextSort = (after as number) - 1;
    } else if (after === undefined) {
      nextSort = before + 1;
    } else {
      nextSort = (before + after) / 2;
    }

    // No-op if the task is already exactly where it should be.
    if (moving.phase === toPhase && moving.sortOrder === nextSort) return;

    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id
                ? { ...t, phase: toPhase, sortOrder: nextSort }
                : t,
            ),
          },
        }),
      () => moveTaskRemote(id, toPhase, nextSort),
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
      toast.error('Could not add comment: ' + (e as Error).message);
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
      const attachment = await uploadFileAttachment({ taskId }, file, uploaderId);
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
      toast.error('Upload failed: ' + (e as Error).message);
    }
  },

  async addTaskLink(taskId, url, label, uploaderId) {
    try {
      const attachment = await addLinkAttachment({ taskId }, url, label, uploaderId);
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
      toast.error('Could not add link: ' + (e as Error).message);
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

  // ─── budget attachments ─────────────────────────────────

  async uploadBudgetAttachment(budgetItemId, file, uploaderId) {
    try {
      const attachment = await uploadFileAttachment({ budgetItemId }, file, uploaderId);
      const prev = get().state;
      set({
        state: {
          ...prev,
          budgetItems: prev.budgetItems.map((i) =>
            i.id === budgetItemId
              ? { ...i, attachments: [...i.attachments, attachment] }
              : i,
          ),
        },
      });
    } catch (e) {
      toast.error('Upload failed: ' + (e as Error).message);
    }
  },

  async addBudgetLink(budgetItemId, url, label, uploaderId) {
    try {
      const attachment = await addLinkAttachment({ budgetItemId }, url, label, uploaderId);
      const prev = get().state;
      set({
        state: {
          ...prev,
          budgetItems: prev.budgetItems.map((i) =>
            i.id === budgetItemId
              ? { ...i, attachments: [...i.attachments, attachment] }
              : i,
          ),
        },
      });
    } catch (e) {
      toast.error('Could not add link: ' + (e as Error).message);
    }
  },

  async deleteBudgetAttachment(budgetItemId, attachment) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            budgetItems: prev.budgetItems.map((i) =>
              i.id === budgetItemId
                ? {
                    ...i,
                    attachments: i.attachments.filter((a) => a.id !== attachment.id),
                  }
                : i,
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
      toast.error('Could not add item: ' + (e as Error).message);
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

  // ─── notes ──────────────────────────────────────────────

  async createTopic(title, createdBy) {
    const trimmed = title.trim();
    if (!trimmed) return null;
    try {
      const topic = await createTopicRemote(trimmed, createdBy);
      const prev = get().state;
      set({
        state: { ...prev, topics: [topic, ...prev.topics] },
      });
      return topic.id;
    } catch (e) {
      toast.error('Could not create topic: ' + (e as Error).message);
      return null;
    }
  },

  async renameTopic(id, title) {
    const prev = get().state;
    const trimmed = title.trim();
    if (!trimmed) return;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            topics: prev.topics.map((t) =>
              t.id === id ? { ...t, title: trimmed } : t,
            ),
          },
        }),
      () => updateTopicRemote(id, { title: trimmed }),
      () => get().loadFromServer(),
    );
  },

  async deleteTopic(id) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            topics: prev.topics.filter((t) => t.id !== id),
            messages: prev.messages.filter((m) => m.topicId !== id),
          },
        }),
      () => deleteTopicRemote(id),
      () => get().loadFromServer(),
    );
  },

  async addNoteMessage(topicId, body, authorId, files) {
    const trimmed = body.trim();
    const pending = files ?? [];
    if (!trimmed && pending.length === 0) return;
    try {
      const message = await addNoteMessageRemote(topicId, trimmed, authorId);

      // Upload any attached files in parallel; a failure on one shouldn't
      // lose the message we already saved.
      const uploaded: Attachment[] = [];
      if (pending.length > 0) {
        const results = await Promise.allSettled(
          pending.map((file) =>
            uploadFileAttachment({ noteMessageId: message.id }, file, authorId),
          ),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') uploaded.push(r.value);
          else toast.error('Upload failed: ' + (r.reason as Error).message);
        }
      }

      const fullMessage = { ...message, attachments: uploaded };
      const prev = get().state;
      // Merge by id rather than always pushing: if uploads outlast the
      // realtime debounce, loadFromServer may have already added the
      // bare message to state.messages, and a naive push duplicates it.
      const existsAt = prev.messages.findIndex((m) => m.id === fullMessage.id);
      const nextMessages =
        existsAt >= 0
          ? prev.messages.map((m, i) => (i === existsAt ? fullMessage : m))
          : [...prev.messages, fullMessage];
      set({
        state: {
          ...prev,
          messages: nextMessages,
          topics: prev.topics.map((t) =>
            t.id === topicId ? { ...t, updatedAt: message.createdAt } : t,
          ),
        },
      });
    } catch (e) {
      toast.error('Could not send: ' + (e as Error).message);
    }
  },

  async deleteNoteMessage(id) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            messages: prev.messages.filter((m) => m.id !== id),
          },
        }),
      () => deleteNoteMessageRemote(id),
      () => get().loadFromServer(),
    );
  },

  // ─── mentions ──────────────────────────────────────────

  async markMentionsSeen(ids) {
    if (ids.length === 0) return;
    const prev = get().state;
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            mentions: prev.mentions.map((m) =>
              idSet.has(m.id) && !m.seenAt ? { ...m, seenAt: now } : m,
            ),
          },
        }),
      () => markMentionsSeenRemote(ids),
      () => get().loadFromServer(),
    );
  },

  // ─── contacts ──────────────────────────────────────────

  async addContact(input, createdBy) {
    try {
      const contact = await addContactRemote(input, createdBy);
      const prev = get().state;
      set({ state: { ...prev, contacts: [...prev.contacts, contact] } });
      return contact.id;
    } catch (e) {
      toast.error('Could not add contact: ' + (e as Error).message);
      return null;
    }
  },

  async updateContact(id, patch) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            contacts: prev.contacts.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        }),
      () => updateContactRemote(id, patch),
      () => get().loadFromServer(),
    );
  },

  async deleteContact(id) {
    const prev = get().state;
    await withOptimistic(
      () =>
        set({
          state: {
            ...prev,
            contacts: prev.contacts.filter((c) => c.id !== id),
          },
        }),
      () => deleteContactRemote(id),
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
