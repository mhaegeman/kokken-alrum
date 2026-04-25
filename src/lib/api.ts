import { supabase } from './supabase';
import type {
  AppState,
  Attachment,
  AttachmentKind,
  AttachmentTarget,
  BudgetItem,
  Comment,
  Mention,
  MentionSourceKind,
  NoteMessage,
  Task,
  TaskPriority,
  TaskStatus,
  Topic,
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
  description: string | null;
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

interface DbAttachment {
  id: number;
  task_id: number | null;
  budget_item_id: number | null;
  kind: AttachmentKind;
  storage_path: string | null;
  url: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface DbTopic {
  id: number;
  title: string;
  created_by: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface DbNoteMessage {
  id: number;
  topic_id: number;
  author_id: string | null;
  body: string;
  created_at: string;
}

interface DbMention {
  id: number;
  source_kind: MentionSourceKind;
  source_id: number;
  task_id: number | null;
  topic_id: number | null;
  mentioned_user_id: string;
  created_by: string | null;
  created_at: string;
  seen_at: string | null;
}

// ─── load ─────────────────────────────────────────────────────

export async function loadAppState(): Promise<AppState> {
  const [
    settingsRes,
    phasesRes,
    catsRes,
    tasksRes,
    commentsRes,
    budgetRes,
    attachmentsRes,
    topicsRes,
    messagesRes,
    mentionsRes,
  ] = await Promise.all([
    supabase.from('project_settings').select('*').eq('id', 1).single(),
    supabase.from('phases').select('*').order('sort_order'),
    supabase.from('budget_categories').select('*').order('sort_order'),
    supabase.from('tasks').select('*').order('id'),
    supabase.from('comments').select('*').order('created_at'),
    supabase.from('budget_items').select('*').order('id'),
    supabase.from('attachments').select('*').order('created_at'),
    supabase.from('notes_topics').select('*').order('updated_at', { ascending: false }),
    supabase.from('note_messages').select('*').order('created_at'),
    supabase.from('mentions').select('*').order('created_at', { ascending: false }),
  ]);

  for (const r of [
    settingsRes,
    phasesRes,
    catsRes,
    tasksRes,
    commentsRes,
    budgetRes,
    attachmentsRes,
    topicsRes,
    messagesRes,
    mentionsRes,
  ]) {
    if (r.error) throw r.error;
  }

  const settings = settingsRes.data as DbSettings;
  const phases = (phasesRes.data ?? []) as DbPhase[];
  const cats = (catsRes.data ?? []) as DbBudgetCategory[];
  const tasks = (tasksRes.data ?? []) as DbTask[];
  const comments = (commentsRes.data ?? []) as DbComment[];
  const budget = (budgetRes.data ?? []) as DbBudgetItem[];
  const attachments = (attachmentsRes.data ?? []) as DbAttachment[];
  const topics = (topicsRes.data ?? []) as DbTopic[];
  const messages = (messagesRes.data ?? []) as DbNoteMessage[];
  const mentions = (mentionsRes.data ?? []) as DbMention[];

  const commentsByTask = new Map<number, Comment[]>();
  for (const c of comments) {
    const list = commentsByTask.get(c.task_id) ?? [];
    list.push(commentFromDb(c));
    commentsByTask.set(c.task_id, list);
  }

  const attachmentsByTask = new Map<number, Attachment[]>();
  const attachmentsByBudgetItem = new Map<number, Attachment[]>();
  for (const a of attachments) {
    const dto = attachmentFromDb(a);
    if (a.task_id != null) {
      const list = attachmentsByTask.get(a.task_id) ?? [];
      list.push(dto);
      attachmentsByTask.set(a.task_id, list);
    } else if (a.budget_item_id != null) {
      const list = attachmentsByBudgetItem.get(a.budget_item_id) ?? [];
      list.push(dto);
      attachmentsByBudgetItem.set(a.budget_item_id, list);
    }
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
      description: t.description ?? '',
      priority: t.priority,
      status: t.status,
      duration: t.duration,
      deps: t.deps ?? [],
      start: t.start_date ?? '',
      end: t.end_date ?? '',
      comments: commentsByTask.get(t.id) ?? [],
      attachments: attachmentsByTask.get(t.id) ?? [],
    })),
    budgetItems: budget.map((b) => ({
      id: b.id,
      category: b.category_id,
      name: b.name,
      estimate: +b.estimate,
      actual: +b.actual,
      attachments: attachmentsByBudgetItem.get(b.id) ?? [],
    })),
    topics: topics.map(topicFromDb),
    messages: messages.map(noteMessageFromDb),
    mentions: mentions.map(mentionFromDb),
  };
}

function mentionFromDb(m: DbMention): Mention {
  return {
    id: m.id,
    sourceKind: m.source_kind,
    sourceId: m.source_id,
    taskId: m.task_id,
    topicId: m.topic_id,
    mentionedUserId: m.mentioned_user_id,
    createdBy: m.created_by,
    createdAt: m.created_at,
    seenAt: m.seen_at,
  };
}

function topicFromDb(t: DbTopic): Topic {
  return {
    id: t.id,
    title: t.title,
    createdBy: t.created_by,
    archived: t.archived,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function noteMessageFromDb(m: DbNoteMessage): NoteMessage {
  return {
    id: m.id,
    topicId: m.topic_id,
    authorId: m.author_id,
    body: m.body,
    createdAt: m.created_at,
  };
}

// ─── task mutations ───────────────────────────────────────────

export async function addTaskRemote(input: {
  title: string;
  phase: number;
  priority: TaskPriority;
  duration: number;
  status?: TaskStatus;
  deps?: number[];
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      phase_id: input.phase,
      priority: input.priority,
      duration: input.duration,
      status: input.status ?? 'not_started',
      deps: input.deps ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  const t = data as DbTask;
  return {
    id: t.id,
    phase: t.phase_id,
    title: t.title,
    description: t.description ?? '',
    priority: t.priority,
    status: t.status,
    duration: t.duration,
    deps: t.deps ?? [],
    start: t.start_date ?? '',
    end: t.end_date ?? '',
    comments: [],
    attachments: [],
  };
}

export async function deleteTaskRemote(id: number) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTaskRemote(id: number, patch: Partial<Task>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
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

// ─── attachments ──────────────────────────────────────────────

function attachmentFromDb(a: DbAttachment): Attachment {
  return {
    id: a.id,
    taskId: a.task_id,
    budgetItemId: a.budget_item_id,
    kind: a.kind,
    filename: a.filename,
    storagePath: a.storage_path,
    url: a.url,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    uploadedBy: a.uploaded_by,
    createdAt: a.created_at,
  };
}

function targetToInsert(target: AttachmentTarget): {
  task_id: number | null;
  budget_item_id: number | null;
  pathPrefix: string;
} {
  if ('taskId' in target) {
    return {
      task_id: target.taskId,
      budget_item_id: null,
      pathPrefix: `task/${target.taskId}`,
    };
  }
  return {
    task_id: null,
    budget_item_id: target.budgetItemId,
    pathPrefix: `budget/${target.budgetItemId}`,
  };
}

const ATTACH_BUCKET = 'attachments';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160) || 'file';
}

export async function uploadFileAttachment(
  target: AttachmentTarget,
  file: File,
  uploaderId: string,
): Promise<Attachment> {
  const t = targetToInsert(target);
  const safe = sanitizeFilename(file.name);
  const path = `${t.pathPrefix}/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from(ATTACH_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      task_id: t.task_id,
      budget_item_id: t.budget_item_id,
      kind: 'file',
      storage_path: path,
      filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploaderId,
    })
    .select()
    .single();
  if (error) {
    // Best-effort cleanup of the uploaded object if the row insert failed.
    await supabase.storage.from(ATTACH_BUCKET).remove([path]);
    throw error;
  }
  return attachmentFromDb(data as DbAttachment);
}

export async function addLinkAttachment(
  target: AttachmentTarget,
  url: string,
  label: string,
  uploaderId: string,
): Promise<Attachment> {
  const trimmedUrl = url.trim();
  const trimmedLabel = label.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('Links must start with http:// or https://');
  }

  const t = targetToInsert(target);
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      task_id: t.task_id,
      budget_item_id: t.budget_item_id,
      kind: 'link',
      url: trimmedUrl,
      filename: trimmedLabel || trimmedUrl,
      uploaded_by: uploaderId,
    })
    .select()
    .single();
  if (error) throw error;
  return attachmentFromDb(data as DbAttachment);
}

export async function deleteAttachmentRemote(attachment: Attachment) {
  if (attachment.kind === 'file' && attachment.storagePath) {
    // Remove the object first; if this fails, the DB row would stay dangling.
    await supabase.storage.from(ATTACH_BUCKET).remove([attachment.storagePath]);
  }
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

export async function getAttachmentSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACH_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
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
    attachments: [],
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

// ─── notes ────────────────────────────────────────────────────

export async function createTopicRemote(
  title: string,
  createdBy: string,
): Promise<Topic> {
  const { data, error } = await supabase
    .from('notes_topics')
    .insert({ title: title.trim(), created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return topicFromDb(data as DbTopic);
}

export async function updateTopicRemote(
  id: number,
  patch: { title?: string; archived?: boolean },
) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.archived !== undefined) dbPatch.archived = patch.archived;
  const { error } = await supabase.from('notes_topics').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function deleteTopicRemote(id: number) {
  const { error } = await supabase.from('notes_topics').delete().eq('id', id);
  if (error) throw error;
}

export async function addNoteMessageRemote(
  topicId: number,
  body: string,
  authorId: string,
): Promise<NoteMessage> {
  const { data, error } = await supabase
    .from('note_messages')
    .insert({ topic_id: topicId, author_id: authorId, body })
    .select()
    .single();
  if (error) throw error;
  // Bump the topic's updated_at so the sidebar can sort by recent activity.
  await supabase
    .from('notes_topics')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', topicId);
  return noteMessageFromDb(data as DbNoteMessage);
}

export async function deleteNoteMessageRemote(id: number) {
  const { error } = await supabase.from('note_messages').delete().eq('id', id);
  if (error) throw error;
}

// ─── mentions ─────────────────────────────────────────────────

export async function markMentionsSeenRemote(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('mentions')
    .update({ seen_at: new Date().toISOString() })
    .in('id', ids);
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attachments' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes_topics' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'note_messages' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mentions' },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
