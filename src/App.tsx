import { useEffect, useMemo, useState } from 'react';
import type { ViewId } from './types';
import { TopBar } from './components/TopBar';
import { Nav } from './components/Tabs';
import { Stats } from './components/Stats';
import { LoginScreen } from './components/LoginScreen';
import { GuestInvitePage } from './components/GuestInvitePage';
import { HomeView } from './components/views/HomeView';
import { TasksView } from './components/views/TasksView';
import { TimelineView } from './components/views/TimelineView';
import { BudgetView } from './components/views/BudgetView';
import { NotesView } from './components/views/NotesView';
import { TaskDrawer } from './components/TaskDrawer';
import { Toaster } from './components/Toaster';
import { HomeSkeleton } from './components/Skeleton';
import { useAuth, type Profile } from './lib/auth';
import { useStore } from './state/store';

const HEADERS: Record<Exclude<ViewId, 'home'>, { title: string; sub: string }> = {
  tasks: {
    title: 'Tasks',
    sub: 'The full list, grouped by phase. Click a row to open it.',
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

// Read ?invite=… from the URL once on mount. We don't depend on a router,
// so the only "navigation" we need is to drop the param after acceptance.
function readInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get('invite');
  if (!t) return null;
  // Defensive: only accept UUID-shaped tokens.
  if (!/^[0-9a-f-]{32,40}$/i.test(t)) return null;
  return t;
}

function clearInviteParam() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export function App() {
  const { loading: authLoading, session, profile, profiles, isGuest } = useAuth();
  const [inviteToken, setInviteToken] = useState<string | null>(readInviteToken);

  if (authLoading) {
    return <LoadingSplash />;
  }

  // ?invite=<token> → show the guest landing page. We let it run even if
  // there's already an authenticated session: a full member clicking
  // their own invite by accident still gets a clear "this is for guests"
  // page and can choose not to accept.
  if (inviteToken) {
    return (
      <GuestInvitePage
        token={inviteToken}
        onAccepted={() => {
          clearInviteParam();
          setInviteToken(null);
        }}
      />
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <Authenticated profile={profile} profiles={profiles} isGuest={isGuest} />
  );
}

function Authenticated({
  profile,
  profiles,
  isGuest,
}: {
  profile: Profile | null;
  profiles: Profile[];
  isGuest: boolean;
}) {
  const [view, setView] = useState<ViewId>('home');
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const loadFromServer = useStore((s) => s.loadFromServer);
  const startRealtime = useStore((s) => s.startRealtime);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);

  useEffect(() => {
    loadFromServer();
    const stop = startRealtime();
    return stop;
  }, [loadFromServer, startRealtime]);

  const profilesById = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  const onOpenTask = (id: number) => setOpenTaskId(id);
  const onCloseTask = () => setOpenTaskId(null);
  const onOpenTopic = (id: number) => {
    setView('notes');
    setSelectedTopicId(id);
  };

  const innerHeader = view !== 'home' ? HEADERS[view] : null;

  return (
    <>
      <TopBar
        onHome={setView}
        profile={profile}
        profilesById={profilesById}
        onOpenTask={onOpenTask}
        onOpenTopic={onOpenTopic}
        isGuest={isGuest}
      />
      <Nav current={view} onChange={setView} />
      <main className="container">
        {(status === 'loading' || status === 'idle') && <HomeSkeleton />}
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
              <HomeView
                onNavigate={setView}
                onOpenTask={onOpenTask}
                onOpenTopic={onOpenTopic}
              />
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
                  {view === 'tasks' && (
                    <TasksView onOpenTask={onOpenTask} isGuest={isGuest} />
                  )}
                  {view === 'timeline' && (
                    <TimelineView onOpenTask={onOpenTask} />
                  )}
                  {view === 'budget' && (
                    <BudgetView
                      currentUserId={profile?.id ?? null}
                      profilesById={profilesById}
                      isGuest={isGuest}
                    />
                  )}
                  {view === 'notes' && (
                    <NotesView
                      currentUserId={profile?.id ?? null}
                      profilesById={profilesById}
                      selectedTopicId={selectedTopicId}
                      onSelectTopic={setSelectedTopicId}
                      isGuest={isGuest}
                    />
                  )}
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

      <TaskDrawer
        openTaskId={openTaskId}
        onClose={onCloseTask}
        currentUserId={profile?.id ?? null}
        profilesById={profilesById}
        isGuest={isGuest}
      />

      <Toaster />
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
