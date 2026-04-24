import { useState } from 'react';
import type { ViewId } from './types';
import { TopBar } from './components/TopBar';
import { Tabs } from './components/Tabs';
import { Stats } from './components/Stats';
import { TasksView } from './components/views/TasksView';
import { TimelineView } from './components/views/TimelineView';
import { BudgetView } from './components/views/BudgetView';

export function App() {
  const [view, setView] = useState<ViewId>('tasks');

  return (
    <>
      <TopBar />
      <Tabs current={view} onChange={setView} />
      <main className="container">
        <Stats />
        <section>
          {view === 'tasks' && <TasksView />}
          {view === 'timeline' && <TimelineView />}
          {view === 'budget' && <BudgetView />}
        </section>
      </main>
      <footer className="footer">
        <div className="container">
          <p>
            Local-only · data stored in your browser ·{' '}
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
