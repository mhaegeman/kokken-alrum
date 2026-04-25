import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { Profile } from '../../lib/auth';
import type { NoteMessage, Topic } from '../../types';
import { Avatar } from '../Avatar';
import { renderMarkdown } from '../../lib/markdown';

interface Props {
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
  selectedTopicId: number | null;
  onSelectTopic: (id: number | null) => void;
}

export function NotesView({
  currentUserId,
  profilesById,
  selectedTopicId,
  onSelectTopic,
}: Props) {
  const state = useStore((s) => s.state);
  const createTopic = useStore((s) => s.createTopic);
  const renameTopic = useStore((s) => s.renameTopic);
  const deleteTopic = useStore((s) => s.deleteTopic);
  const addNoteMessage = useStore((s) => s.addNoteMessage);
  const deleteNoteMessage = useStore((s) => s.deleteNoteMessage);
  const markMentionsSeen = useStore((s) => s.markMentionsSeen);

  const topics = state.topics;
  const messages = state.messages;

  const mentionNames = useMemo(
    () => Object.values(profilesById).map((p) => p.display_name),
    [profilesById],
  );

  // Auto-select the first topic once data loads / topics change.
  useEffect(() => {
    if (selectedTopicId == null && topics.length > 0) {
      onSelectTopic(topics[0].id);
    }
    if (
      selectedTopicId != null &&
      !topics.find((t) => t.id === selectedTopicId)
    ) {
      onSelectTopic(topics[0]?.id ?? null);
    }
  }, [topics, selectedTopicId, onSelectTopic]);

  // When a topic is opened, mark its unread mentions for me as seen.
  useEffect(() => {
    if (!currentUserId || selectedTopicId == null) return;
    const ids = state.mentions
      .filter(
        (m) =>
          m.mentionedUserId === currentUserId &&
          !m.seenAt &&
          m.topicId === selectedTopicId,
      )
      .map((m) => m.id);
    if (ids.length > 0) markMentionsSeen(ids);
    // Don't depend on state.mentions to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, currentUserId]);

  const messagesByTopic = useMemo(() => {
    const m = new Map<number, NoteMessage[]>();
    for (const msg of messages) {
      const list = m.get(msg.topicId) ?? [];
      list.push(msg);
      m.set(msg.topicId, list);
    }
    return m;
  }, [messages]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const selectedMessages = selectedTopicId
    ? messagesByTopic.get(selectedTopicId) ?? []
    : [];

  const onCreateTopic = async (title: string) => {
    if (!currentUserId) return;
    const id = await createTopic(title, currentUserId);
    if (id != null) onSelectTopic(id);
  };

  return (
    <div className={`notes-wrap ${selectedTopic ? 'has-thread' : ''}`}>
      <TopicSidebar
        topics={topics}
        messagesByTopic={messagesByTopic}
        selectedId={selectedTopicId}
        onSelect={onSelectTopic}
        onCreate={onCreateTopic}
        canCreate={!!currentUserId}
      />

      <div className="notes-main">
        {selectedTopic ? (
          <TopicThread
            topic={selectedTopic}
            messages={selectedMessages}
            currentUserId={currentUserId}
            profilesById={profilesById}
            mentionNames={mentionNames}
            onSend={(body) =>
              currentUserId &&
              addNoteMessage(selectedTopic.id, body, currentUserId)
            }
            onDeleteMessage={(id) => deleteNoteMessage(id)}
            onRename={(title) => renameTopic(selectedTopic.id, title)}
            onDelete={() => {
              if (
                confirm(
                  `Delete topic "${selectedTopic.title}" and all its messages?`,
                )
              ) {
                deleteTopic(selectedTopic.id);
              }
            }}
            onBack={() => onSelectTopic(null)}
          />
        ) : (
          <div className="notes-empty">
            <h3>No topic selected</h3>
            <p>
              Pick a topic on the left, or start a new one.
              {topics.length === 0 &&
                ' Try things like "Fridge choice" or "Kitchen island shape".'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sidebar ────────────────────────────────────────────────────

function TopicSidebar({
  topics,
  messagesByTopic,
  selectedId,
  onSelect,
  onCreate,
  canCreate,
}: {
  topics: Topic[];
  messagesByTopic: Map<number, NoteMessage[]>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: (title: string) => void;
  canCreate: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onCreate(t);
    setTitle('');
    setAdding(false);
  };

  return (
    <aside className="notes-sidebar">
      <div className="notes-sidebar-head">
        <h4>Topics</h4>
        {canCreate && !adding && (
          <button
            className="icon-btn notes-new-btn"
            onClick={() => setAdding(true)}
            aria-label="New topic"
            title="New topic"
          >
            +
          </button>
        )}
      </div>

      {adding && (
        <div className="notes-new-form">
          <input
            ref={inputRef}
            type="text"
            placeholder="Topic title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') {
                setAdding(false);
                setTitle('');
              }
            }}
            onBlur={() => {
              if (!title.trim()) setAdding(false);
            }}
          />
        </div>
      )}

      <div className="notes-topic-list">
        {topics.length === 0 && !adding && (
          <p className="notes-topic-empty">No topics yet.</p>
        )}
        {topics.map((t) => {
          const count = messagesByTopic.get(t.id)?.length ?? 0;
          const last = messagesByTopic.get(t.id)?.[count - 1];
          return (
            <button
              key={t.id}
              className={`notes-topic ${t.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <span className="notes-topic-title">{t.title}</span>
              <span className="notes-topic-meta">
                {count === 0
                  ? 'No messages'
                  : `${count} ${count === 1 ? 'message' : 'messages'}`}
                {last && ` · ${formatRelative(last.createdAt)}`}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ─── thread ─────────────────────────────────────────────────────

function TopicThread({
  topic,
  messages,
  currentUserId,
  profilesById,
  mentionNames,
  onSend,
  onDeleteMessage,
  onRename,
  onDelete,
  onBack,
}: {
  topic: Topic;
  messages: NoteMessage[];
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
  mentionNames: string[];
  onSend: (body: string) => void;
  onDeleteMessage: (id: number) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the title draft whenever the topic changes.
  useEffect(() => {
    setTitleDraft(topic.title);
    setEditingTitle(false);
  }, [topic.id, topic.title]);

  // Scroll to bottom on new messages or topic switch.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, topic.id]);

  const submitMessage = () => {
    const v = draft.trim();
    if (!v || !currentUserId) return;
    onSend(v);
    setDraft('');
  };

  const submitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== topic.title) onRename(t);
    setEditingTitle(false);
  };

  const canEditTopic = topic.createdBy === currentUserId;
  const creator = topic.createdBy ? profilesById[topic.createdBy] : null;

  return (
    <div className="notes-thread">
      <div className="notes-thread-head">
        <button
          className="icon-btn notes-back-btn"
          onClick={onBack}
          aria-label="Back to topics"
        >
          ←
        </button>
        <div className="notes-thread-title-wrap">
          {editingTitle ? (
            <input
              className="notes-thread-title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={submitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(topic.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h2
              className="notes-thread-title"
              onClick={canEditTopic ? () => setEditingTitle(true) : undefined}
              title={canEditTopic ? 'Click to rename' : undefined}
              style={{ cursor: canEditTopic ? 'text' : 'default' }}
            >
              {topic.title}
            </h2>
          )}
          <p className="notes-thread-sub">
            {creator ? `Started by ${creator.display_name}` : 'Started by ?'}
            {' · '}
            {formatDateLong(topic.createdAt)}
          </p>
        </div>
        {canEditTopic && (
          <button
            className="icon-btn danger"
            onClick={onDelete}
            title="Delete topic"
          >
            Delete
          </button>
        )}
      </div>

      <div className="notes-thread-body" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="notes-empty-thread">No messages yet — start the thread.</p>
        )}
        {messages.map((m) => {
          const author = m.authorId ? profilesById[m.authorId] : null;
          const mine = m.authorId === currentUserId;
          return (
            <div key={m.id} className="note-message">
              <div className="note-message-side">
                {author ? (
                  <Avatar
                    user={author.avatar === 'rose' ? 'karo' : 'max'}
                    size={28}
                  />
                ) : (
                  <span
                    className="avatar"
                    style={{ width: 28, height: 28 }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="note-message-main">
                <div className="note-message-meta">
                  <b>{author?.display_name ?? 'unknown'}</b>
                  <span className="tnum">{formatRelative(m.createdAt)}</span>
                  {mine && (
                    <button
                      className="comment-del note-message-del"
                      onClick={() => onDeleteMessage(m.id)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div
                  className="note-message-body"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(m.body, { mentionNames }),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="notes-composer">
        <textarea
          rows={2}
          placeholder={
            currentUserId
              ? 'Reply… (Enter to send, Shift+Enter newline, try @max or @karo)'
              : 'Sign in to reply'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitMessage();
            }
          }}
          disabled={!currentUserId}
        />
        <button
          className="btn-primary"
          onClick={submitMessage}
          disabled={!currentUserId || !draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
