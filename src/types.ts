export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Phase {
  name: string;
  color: string;
}

export interface Comment {
  id?: number;
  text: string;
  date: string;
  authorId?: string | null;
}

export interface Task {
  id: number;
  phase: number;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  duration: number;
  deps: number[];
  start: string;
  end: string;
  comments: Comment[];
  attachments: Attachment[];
}

export type AttachmentKind = 'file' | 'link';

export interface Attachment {
  id: number;
  taskId: number | null;
  budgetItemId: number | null;
  noteMessageId: number | null;
  kind: AttachmentKind;
  filename: string;
  storagePath?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  createdAt: string;
}

export type AttachmentTarget =
  | { taskId: number }
  | { budgetItemId: number }
  | { noteMessageId: number };

export interface BudgetItem {
  id: number;
  category: string;
  name: string;
  estimate: number;
  actual: number;
  attachments: Attachment[];
}

export interface AppState {
  startDate: string;
  phases: Record<string, Phase>;
  tasks: Task[];
  budgetCategories: Record<string, string>;
  budgetItems: BudgetItem[];
  currency: string;
  totalBudgetTarget: number;
  topics: Topic[];
  messages: NoteMessage[];
  mentions: Mention[];
  contacts: Contact[];
}

export interface Contact {
  id: number;
  name: string;
  role: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MentionSourceKind = 'comment' | 'note_message';

export interface Mention {
  id: number;
  sourceKind: MentionSourceKind;
  sourceId: number;
  taskId: number | null;
  topicId: number | null;
  mentionedUserId: string;
  createdBy: string | null;
  createdAt: string;
  seenAt: string | null;
}

export interface Topic {
  id: number;
  title: string;
  createdBy: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteMessage {
  id: number;
  topicId: number;
  authorId: string | null;
  body: string;
  createdAt: string;
  attachments: Attachment[];
}

export type ViewId = 'home' | 'tasks' | 'timeline' | 'budget' | 'notes' | 'contacts';
