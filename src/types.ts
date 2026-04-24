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
  priority: TaskPriority;
  status: TaskStatus;
  duration: number;
  deps: number[];
  start: string;
  end: string;
  comments: Comment[];
}

export interface BudgetItem {
  id: number;
  category: string;
  name: string;
  estimate: number;
  actual: number;
}

export interface AppState {
  startDate: string;
  phases: Record<string, Phase>;
  tasks: Task[];
  budgetCategories: Record<string, string>;
  budgetItems: BudgetItem[];
  currency: string;
  totalBudgetTarget: number;
}

export type ViewId = 'home' | 'tasks' | 'timeline' | 'budget' | 'notes';
