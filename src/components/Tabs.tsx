import type { ViewId } from '../types';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'budget', label: 'Budget' },
  { id: 'notes', label: 'Notes' },
];

export function Nav({
  current,
  onChange,
}: {
  current: ViewId;
  onChange: (v: ViewId) => void;
}) {
  return (
    <nav className="nav">
      <div className="container">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-item ${current === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
