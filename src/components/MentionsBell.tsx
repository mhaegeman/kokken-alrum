import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Profile } from '../lib/auth';
import type { Mention } from '../types';

interface Props {
  currentUserId: string;
  profilesById: Record<string, Profile>;
  onOpenTask: (taskId: number) => void;
  onOpenTopic: (topicId: number) => void;
}

export function MentionsBell({
  currentUserId,
  profilesById,
  onOpenTask,
  onOpenTopic,
}: Props) {
  const state = useStore((s) => s.state);
  const markMentionsSeen = useStore((s) => s.markMentionsSeen);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lookup tables for comment / message bodies, keyed by id.
  const commentsById = useMemo(() => {
    const m = new Map<number, { body: string; taskTitle: string }>();
    for (const t of state.tasks) {
      for (const c of t.comments) {
        if (c.id != null) m.set(c.id, { body: c.text, taskTitle: t.title });
      }
    }
    return m;
  }, [state.tasks]);

  const messagesById = useMemo(() => {
    const m = new Map<number, { body: string; topicTitle: string }>();
    const topicsById = new Map(state.topics.map((t) => [t.id, t.title] as const));
    for (const msg of state.messages) {
      m.set(msg.id, {
        body: msg.body,
        topicTitle: topicsById.get(msg.topicId) ?? '?',
      });
    }
    return m;
  }, [state.messages, state.topics]);

  const myMentions = useMemo(
    () =>
      state.mentions.filter((m) => m.mentionedUserId === currentUserId),
    [state.mentions, currentUserId],
  );

  const unread = myMentions.filter((m) => !m.seenAt);

  const onMentionClick = (mention: Mention) => {
    setOpen(false);
    if (mention.sourceKind === 'comment' && mention.taskId != null) {
      onOpenTask(mention.taskId);
    } else if (mention.sourceKind === 'note_message' && mention.topicId != null) {
      onOpenTopic(mention.topicId);
    }
    if (!mention.seenAt) markMentionsSeen([mention.id]);
  };

  const onMarkAllRead = () => {
    const ids = unread.map((m) => m.id);
    if (ids.length > 0) markMentionsSeen(ids);
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mentions"
        title={unread.length > 0 ? `${unread.length} new mention${unread.length === 1 ? '' : 's'}` : 'Mentions'}
      >
        <BellIcon />
        {unread.length > 0 && <span className="bell-dot tnum">{unread.length}</span>}
      </button>

      {open && (
        <div className="bell-dropdown" role="menu">
          <div className="bell-dropdown-head">
            <span>Mentions</span>
            {unread.length > 0 && (
              <button className="bell-mark-all" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="bell-list">
            {myMentions.length === 0 && (
              <p className="bell-empty">
                No mentions yet. Write <code>@max</code> or <code>@karo</code>{' '}
                in any comment or note to ping each other.
              </p>
            )}
            {myMentions.slice(0, 20).map((m) => {
              const author = m.createdBy ? profilesById[m.createdBy] : null;
              let where = '';
              let body = '';
              if (m.sourceKind === 'comment') {
                const c = commentsById.get(m.sourceId);
                where = c ? `Task · ${c.taskTitle}` : 'Task';
                body = c?.body ?? '';
              } else {
                const msg = messagesById.get(m.sourceId);
                where = msg ? `Notes · ${msg.topicTitle}` : 'Notes';
                body = msg?.body ?? '';
              }
              const preview = body.length > 100 ? body.slice(0, 99) + '…' : body;
              return (
                <button
                  key={m.id}
                  className={`bell-item ${m.seenAt ? '' : 'unread'}`}
                  onClick={() => onMentionClick(m)}
                >
                  <div className="bell-item-line">
                    <b>{author?.display_name ?? 'someone'}</b>
                    <span className="bell-item-where">{where}</span>
                  </div>
                  <p className="bell-item-preview">{preview}</p>
                  <span className="bell-item-time tnum">
                    {formatRelative(m.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 5 1.5 7 1.5 7H4.5S6 14 6 9z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
