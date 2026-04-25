import { useStore, exportJson } from '../state/store';
import { signOut, type Profile } from '../lib/auth';
import { Avatar } from './Avatar';
import { MentionsBell } from './MentionsBell';
import type { ViewId } from '../types';

export function TopBar({
  onHome,
  profile,
  profilesById,
  onOpenTask,
  onOpenTopic,
}: {
  onHome: (v: ViewId) => void;
  profile: Profile | null;
  profilesById: Record<string, Profile>;
  onOpenTask: (taskId: number) => void;
  onOpenTopic: (topicId: number) => void;
}) {
  const state = useStore((s) => s.state);

  const onSignOut = async () => {
    if (!confirm('Sign out of Køkken alrum?')) return;
    await signOut();
  };

  return (
    <header className="topbar">
      <div className="container">
        <button className="brand" onClick={() => onHome('home')}>
          <div className="brand-mark">K</div>
          <div>
            <p className="brand-title">Køkken alrum</p>
            <p className="brand-sub">Copenhagen</p>
          </div>
        </button>

        <div className="topbar-end">
          <div className="avatars" aria-label="Project members">
            <Avatar user="max" title="Max" />
            <Avatar user="karo" title="Karo" />
          </div>

          {profile && (
            <MentionsBell
              currentUserId={profile.id}
              profilesById={profilesById}
              onOpenTask={onOpenTask}
              onOpenTopic={onOpenTopic}
            />
          )}

          <div className="menu">
            <button className="icon-btn" onClick={() => exportJson(state)}>
              Export
            </button>
            {profile && (
              <span
                className="topbar-user"
                title={profile.email}
                style={{
                  fontSize: 13,
                  color: 'var(--text-2)',
                  padding: '0 4px',
                  alignSelf: 'center',
                }}
              >
                {profile.display_name}
              </span>
            )}
            <button className="icon-btn danger" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
