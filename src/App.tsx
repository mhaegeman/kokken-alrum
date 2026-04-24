import { useState } from 'react';
import type { ViewId } from './types';
import { TopBar } from './components/TopBar';
import { Nav } from './components/Tabs';
import { Stats } from './components/Stats';
import { HomeView } from './components/views/HomeView';
import { TasksView } from './components/views/TasksView';
import { TimelineView } from './components/views/TimelineView';
import { BudgetView } from './components/views/BudgetView';
import { NotesView } from './components/views/NotesView';

const HEADERS: Record<Exclude<ViewId, 'home'>, { title: string; sub: string }> = {
  tasks: {
    title: 'Tasks',
    sub: 'The full list, grouped by phase. Click a row to edit.',
  },
  timeline: {
    title: 'Timeline',
    sub: 'Auto-scheduled from durations and dependencies.',
  },
  budget: {
    title: 'Budget',
    sub: 'Estimates, actuals, and how we track against the target.',
  },
  notes: {
    title: 'Notes',
    sub: 'Open threads on specific topics.',
  },
};

export function App() {
  const [view, setView] = useState<ViewId>('home');

  const innerHeader = view !== 'home' ? HEADERS[view] : null;

  return (
    <>
      <TopBar onHome={setView} />
      <Nav current={view} onChange={setView} />
      <main className="container">
        {view === 'home' ? (
          <HomeView onNavigate={setView} />
        ) : (
          <>
            {innerHeader && (
              <div className="page-header">
                <h1>{innerHeader.title}</h1>
                <p>{innerHeader.sub}</p>
              </div>
            )}
            {view !== 'notes' && <Stats />}
            <section>
              {view === 'tasks' && <TasksView />}
              {view === 'timeline' && <TimelineView />}
              {view === 'budget' && <BudgetView />}
              {view === 'notes' && <NotesView />}
            </section>
          </>
        )}
      </main>
      <footer className="footer">
        <div className="container">
          <p>Local-only · data stored in your browser</p>
          <p>
            <a
              href="https://github.com/mhaegeman/kokken-alrum"
              target="_blank"
              rel="noopener noreferrer"
            >
              view source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
