import { useEffect, useState } from 'react';
import type { ViewId } from './types';
import { TopBar } from './components/TopBar';
import { Nav } from './components/Tabs';
import { Stats } from './components/Stats';
import { LoginScreen } from './components/LoginScreen';
import { HomeView } from './components/views/HomeView';
import { TasksView } from './components/views/TasksView';
import { TimelineView } from './components/views/TimelineView';
import { BudgetView } from './components/views/BudgetView';
import { NotesView } from './components/views/NotesView';
import { useAuth } from './lib/auth';
import { useStore } from './state/store';

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
  const { loading: authLoading, session, profile } = useAuth();

  if (authLoading) {
    return <LoadingSplash />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <Authenticated profileId={profile?.id ?? null} profile={profile} />;
}

function Authenticated({
  profileId,
  profile,
}: {
  profileId: string | null;
  profile: ReturnType<typeof useAuth>['profile'];
}) {
  const [view, setView] = useState<ViewId>('home');
  const loadFromServer = useStore((s) => s.loadFromServer);
  const startRealtime = useStore((s) => s.startRealtime);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);

  useEffect(() => {
    loadFromServer();
    const stop = startRealtime();
    return stop;
  }, [loadFromServer, startRealtime]);

  const innerHeader = view !== 'home' ? HEADERS[view] : null;

  return (
    <>
      <TopBar onHome={setView} profile={profile} />
      <Nav current={view} onChange={setView} />
      <main className="container">
        {status === 'loading' && (
          <p className="empty" style={{ paddingTop: 60 }}>
            Loading…
          </p>
        )}
        {status === 'error' && (
          <div
            className="login-error"
            style={{ marginTop: 40, padding: 14, borderRadius: 12 }}
          >
            Couldn't load project data: {error}
          </div>
        )}
        {status === 'ready' && (
          <>
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
                  {view === 'tasks' && <TasksView authorId={profileId} />}
                  {view === 'timeline' && <TimelineView />}
                  {view === 'budget' && <BudgetView />}
                  {view === 'notes' && <NotesView />}
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <div className="container">
          <p>Shared with Supabase · private to Max &amp; Karo</p>
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

function LoadingSplash() {
  return (
    <div className="login-wrap">
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</div>
    </div>
  );
}
