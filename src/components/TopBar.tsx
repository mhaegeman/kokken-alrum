import { useState } from 'react';
import { useStore, exportJson } from '../state/store';
import { signOut, type Profile } from '../lib/auth';
import { Avatar } from './Avatar';
import { MentionsBell } from './MentionsBell';
import { InvitesPanel } from './InvitesPanel';
import { confirm } from '../lib/confirm';
import type { ViewId } from '../types';

export function TopBar({
  onHome,
  profile,
  profilesById,
  onOpenTask,
  onOpenTopic,
  isGuest,
}: {
  onHome: (v: ViewId) => void;
  profile: Profile | null;
  profilesById: Record<string, Profile>;
  onOpenTask: (taskId: number) => void;
  onOpenTopic: (topicId: number) => void;
  isGuest: boolean;
}) {
  const state = useStore((s) => s.state);
  const [invitesOpen, setInvitesOpen] = useState(false);

  const onSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: isGuest
        ? 'You can come back any time via your invite link.'
        : "We'll send you back to the login screen.",
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
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

          {profile && !isGuest && (
            <MentionsBell
              currentUserId={profile.id}
              profilesById={profilesById}
              onOpenTask={onOpenTask}
              onOpenTopic={onOpenTopic}
            />
          )}

          <div className="menu">
            {!isGuest && (
              <button
                className="icon-btn"
                onClick={() => setInvitesOpen(true)}
                title="Manage guest invite links"
              >
                Invite
              </button>
            )}
            {!isGuest && (
              <button className="icon-btn" onClick={() => exportJson(state)}>
                Export
              </button>
            )}
            {profile && (
              <span
                className="topbar-user"
                title={profile.email ?? undefined}
                style={{
                  fontSize: 13,
                  color: 'var(--text-2)',
                  padding: '0 4px',
                  alignSelf: 'center',
                }}
              >
                {profile.display_name}
                {isGuest && <span className="guest-tag">guest</span>}
              </span>
            )}
            <button className="icon-btn danger" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {!isGuest && (
        <InvitesPanel
          open={invitesOpen}
          onClose={() => setInvitesOpen(false)}
        />
      )}
    </header>
  );
}
