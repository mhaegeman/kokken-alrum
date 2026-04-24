import type { ViewId } from '../types';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'budget', label: 'Budget' },
];

export function Tabs({
  current,
  onChange,
}: {
  current: ViewId;
  onChange: (v: ViewId) => void;
}) {
  return (
    <nav className="tabs">
      <div className="container">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${current === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
