import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { Profile } from '../../lib/auth';
import type { NoteMessage, Topic } from '../../types';
import { Avatar } from '../Avatar';
import { MessageAttachments } from '../MessageAttachments';
import { renderMarkdown, type MentionContact } from '../../lib/markdown';
import { confirm } from '../../lib/confirm';
import {
  buildMentionItems,
  useMentionAutocomplete,
  type MentionItem,
} from '../MentionAutocomplete';

interface Props {
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
  selectedTopicId: number | null;
  onSelectTopic: (id: number | null) => void;
  isGuest: boolean;
}

export function NotesView({
  currentUserId,
  profilesById,
  selectedTopicId,
  onSelectTopic,
  isGuest,
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
  const mentionContacts = useMemo(
    () => state.contacts.map((c) => ({ id: c.id, name: c.name })),
    [state.contacts],
  );
  const mentionItems = useMemo(
    () =>
      buildMentionItems({
        users: Object.values(profilesById).map((p) => ({
          id: p.id,
          display_name: p.display_name,
        })),
        contacts: state.contacts,
        selfId: currentUserId,
      }),
    [profilesById, state.contacts, currentUserId],
  );

  // Auto-select the first topic on desktop (where the side panel + thread
  // are visible together and an empty thread pane looks odd). On mobile
  // the layout shows either the topic list or one thread, so auto-
  // selecting would skip past the list and trap the user — tapping the
  // back arrow sets selectedTopicId to null, and an unconditional auto-
  // select effect would immediately re-select the same topic. Only the
  // mobile breakpoint shows the back button, so gating on viewport width
  // matches the layout exactly.
  useEffect(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 720px)').matches;
    if (
      !isMobile &&
      selectedTopicId == null &&
      topics.length > 0
    ) {
      onSelectTopic(topics[0].id);
    }
    // If the currently-selected topic disappears (e.g. deleted by the
    // other user via realtime), clear to null. On mobile the user lands
    // back on the list; on desktop the empty state appears, then the
    // auto-select branch above picks the new first topic on the next
    // render. Either way is less surprising than silently swapping.
    if (
      selectedTopicId != null &&
      !topics.find((t) => t.id === selectedTopicId)
    ) {
      onSelectTopic(null);
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
        canCreate={!!currentUserId && !isGuest}
      />

      <div className="notes-main">
        {selectedTopic ? (
          <TopicThread
            topic={selectedTopic}
            messages={selectedMessages}
            currentUserId={currentUserId}
            profilesById={profilesById}
            mentionNames={mentionNames}
            mentionContacts={mentionContacts}
            mentionItems={mentionItems}
            isGuest={isGuest}
            onSend={(body, files) =>
              currentUserId &&
              addNoteMessage(selectedTopic.id, body, currentUserId, files)
            }
            onDeleteMessage={(id) => deleteNoteMessage(id)}
            onRename={(title) => renameTopic(selectedTopic.id, title)}
            onDelete={async () => {
              const ok = await confirm({
                title: 'Delete topic?',
                message: `"${selectedTopic.title}" and all its messages will be permanently deleted.`,
                confirmLabel: 'Delete topic',
                danger: true,
              });
              if (ok) deleteTopic(selectedTopic.id);
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
  mentionContacts,
  mentionItems,
  isGuest,
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
  mentionContacts: MentionContact[];
  mentionItems: MentionItem[];
  isGuest: boolean;
  onSend: (body: string, files: File[]) => void;
  onDeleteMessage: (id: number) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerMention = useMentionAutocomplete<HTMLTextAreaElement>({
    value: draft,
    onChange: setDraft,
    items: mentionItems,
    inputRef: composerRef,
  });

  // Keep the title-edit field in sync with the source of truth so that
  // realtime renames (or our own saves) reflect immediately.
  useEffect(() => {
    setTitleDraft(topic.title);
    setEditingTitle(false);
  }, [topic.title]);

  // Only discard in-progress composer state when actually switching to a
  // different topic — a rename of the open topic should not wipe a draft
  // or queued attachments.
  useEffect(() => {
    setPendingFiles([]);
    setDraft('');
  }, [topic.id]);

  // Scroll to bottom on new messages or topic switch.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, topic.id]);

  const submitMessage = async () => {
    const v = draft.trim();
    if (!currentUserId) return;
    if (!v && pendingFiles.length === 0) return;
    setSending(true);
    try {
      await Promise.resolve(onSend(v, pendingFiles));
      setDraft('');
      setPendingFiles([]);
    } finally {
      setSending(false);
    }
  };

  const addPendingFiles = async (files: FileList | File[]) => {
    const fresh: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) {
        const ok = await confirm({
          title: 'Large file',
          message: `${f.name} is over 25 MB — attach anyway?`,
          confirmLabel: 'Attach',
        });
        if (!ok) continue;
      }
      fresh.push(f);
    }
    if (fresh.length > 0) setPendingFiles((p) => [...p, ...fresh]);
  };

  const removePendingFile = (index: number) =>
    setPendingFiles((p) => p.filter((_, i) => i !== index));

  const onComposerDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!currentUserId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragActive) setDragActive(true);
  };

  const onComposerDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const onComposerDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!currentUserId) return;
    if (e.dataTransfer.files?.length) addPendingFiles(e.dataTransfer.files);
  };

  const submitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== topic.title) onRename(t);
    setEditingTitle(false);
  };

  const canEditTopic = !isGuest && topic.createdBy === currentUserId;
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
                {m.body && (
                  <div
                    className="note-message-body"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(m.body, { mentionNames, mentionContacts }),
                    }}
                  />
                )}
                {m.attachments && m.attachments.length > 0 && (
                  <MessageAttachments attachments={m.attachments} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`notes-composer ${dragActive ? 'drag-active' : ''}`}
        onDragOver={onComposerDragOver}
        onDragLeave={onComposerDragLeave}
        onDrop={onComposerDrop}
      >
        <div className="composer-main">
          {pendingFiles.length > 0 && (
            <div className="composer-pending">
              {pendingFiles.map((f, i) => (
                <span className="pending-chip" key={i}>
                  <span aria-hidden="true">
                    {f.type.startsWith('image/') ? '🖼' : '📄'}
                  </span>
                  <span className="pending-chip-name">{f.name}</span>
                  <button
                    className="pending-chip-x"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removePendingFile(i)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mention-input-wrap">
            <textarea
              ref={composerRef}
              rows={2}
              placeholder={
                currentUserId
                  ? 'Reply… (Enter to send, Shift+Enter newline, type @ to mention, drag in files)'
                  : 'Sign in to reply'
              }
              value={draft}
              onChange={composerMention.onChange}
              onKeyDown={(e) => {
                if (composerMention.onKeyDown(e)) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage();
                }
              }}
              disabled={!currentUserId || sending}
            />
            {composerMention.popup}
          </div>
        </div>

        <div className="composer-actions">
          <button
            className="icon-btn composer-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!currentUserId || sending}
            aria-label="Attach files"
            title="Attach files"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              if (e.target.files) addPendingFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            className="btn-primary"
            onClick={submitMessage}
            disabled={
              !currentUserId ||
              sending ||
              (!draft.trim() && pendingFiles.length === 0)
            }
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>

        {dragActive && (
          <div className="composer-drop-overlay">Drop to attach</div>
        )}
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
