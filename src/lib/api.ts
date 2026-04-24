import { supabase } from './supabase';
import type {
  AppState,
  BudgetItem,
  Comment,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types';

// ─── DB row shapes ────────────────────────────────────────────

interface DbSettings {
  start_date: string;
  currency: string;
  total_budget_target: number;
}

interface DbPhase {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

interface DbBudgetCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface DbTask {
  id: number;
  phase_id: number;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  duration: number;
  deps: number[];
  start_date: string | null;
  end_date: string | null;
}

interface DbComment {
  id: number;
  task_id: number;
  author_id: string | null;
  body: string;
  created_at: string;
}

interface DbBudgetItem {
  id: number;
  category_id: string;
  name: string;
  estimate: number;
  actual: number;
}

// ─── load ─────────────────────────────────────────────────────

export async function loadAppState(): Promise<AppState> {
  const [settingsRes, phasesRes, catsRes, tasksRes, commentsRes, budgetRes] =
    await Promise.all([
      supabase.from('project_settings').select('*').eq('id', 1).single(),
      supabase.from('phases').select('*').order('sort_order'),
      supabase.from('budget_categories').select('*').order('sort_order'),
      supabase.from('tasks').select('*').order('id'),
      supabase.from('comments').select('*').order('created_at'),
      supabase.from('budget_items').select('*').order('id'),
    ]);

  for (const r of [settingsRes, phasesRes, catsRes, tasksRes, commentsRes, budgetRes]) {
    if (r.error) throw r.error;
  }

  const settings = settingsRes.data as DbSettings;
  const phases = (phasesRes.data ?? []) as DbPhase[];
  const cats = (catsRes.data ?? []) as DbBudgetCategory[];
  const tasks = (tasksRes.data ?? []) as DbTask[];
  const comments = (commentsRes.data ?? []) as DbComment[];
  const budget = (budgetRes.data ?? []) as DbBudgetItem[];

  const commentsByTask = new Map<number, Comment[]>();
  for (const c of comments) {
    const list = commentsByTask.get(c.task_id) ?? [];
    list.push(commentFromDb(c));
    commentsByTask.set(c.task_id, list);
  }

  return {
    startDate: settings.start_date,
    currency: settings.currency,
    totalBudgetTarget: +settings.total_budget_target,
    phases: Object.fromEntries(
      phases.map((p) => [p.id, { name: p.name, color: p.color }]),
    ),
    budgetCategories: Object.fromEntries(cats.map((c) => [c.id, c.name])),
    tasks: tasks.map((t) => ({
      id: t.id,
      phase: t.phase_id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      duration: t.duration,
      deps: t.deps ?? [],
      start: t.start_date ?? '',
      end: t.end_date ?? '',
      comments: commentsByTask.get(t.id) ?? [],
    })),
    budgetItems: budget.map((b) => ({
      id: b.id,
      category: b.category_id,
      name: b.name,
      estimate: +b.estimate,
      actual: +b.actual,
    })),
  };
}

// ─── task mutations ───────────────────────────────────────────

export async function updateTaskRemote(id: number, patch: Partial<Task>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.duration !== undefined) dbPatch.duration = patch.duration;
  if (patch.start !== undefined) dbPatch.start_date = patch.start || null;
  if (patch.end !== undefined) dbPatch.end_date = patch.end || null;
  if (patch.phase !== undefined) dbPatch.phase_id = patch.phase;
  if (patch.deps !== undefined) dbPatch.deps = patch.deps;

  const { error } = await supabase.from('tasks').update(dbPatch).eq('id', id);
  if (error) throw error;
}

// ─── comments ─────────────────────────────────────────────────

function commentFromDb(c: DbComment): Comment {
  return {
    id: c.id,
    text: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.author_id,
  };
}

export async function addCommentRemote(
  taskId: number,
  body: string,
  authorId: string,
): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, author_id: authorId, body })
    .select()
    .single();
  if (error) throw error;
  return commentFromDb(data as DbComment);
}

export async function deleteCommentRemote(commentId: number) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ─── budget items ─────────────────────────────────────────────

export async function updateBudgetItemRemote(id: number, patch: Partial<BudgetItem>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.category !== undefined) dbPatch.category_id = patch.category;
  if (patch.estimate !== undefined) dbPatch.estimate = patch.estimate;
  if (patch.actual !== undefined) dbPatch.actual = patch.actual;

  const { error } = await supabase.from('budget_items').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function addBudgetItemRemote(
  item: Omit<BudgetItem, 'id'>,
): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('budget_items')
    .insert({
      category_id: item.category,
      name: item.name,
      estimate: item.estimate,
      actual: item.actual,
    })
    .select()
    .single();
  if (error) throw error;
  const row = data as DbBudgetItem;
  return {
    id: row.id,
    category: row.category_id,
    name: row.name,
    estimate: +row.estimate,
    actual: +row.actual,
  };
}

export async function deleteBudgetItemRemote(id: number) {
  const { error } = await supabase.from('budget_items').delete().eq('id', id);
  if (error) throw error;
}

// ─── project settings ─────────────────────────────────────────

export async function updateSettingsRemote(patch: {
  startDate?: string;
  currency?: string;
  totalBudgetTarget?: number;
}) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.totalBudgetTarget !== undefined)
    dbPatch.total_budget_target = patch.totalBudgetTarget;

  const { error } = await supabase
    .from('project_settings')
    .update(dbPatch)
    .eq('id', 1);
  if (error) throw error;
}

// ─── realtime subscriptions ───────────────────────────────────

export function subscribeToChanges(onChange: () => void) {
  const channel = supabase
    .channel('kokken-alrum-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, onChange)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'budget_items' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_settings' },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
