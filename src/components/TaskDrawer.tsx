import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Task, TaskPriority, TaskStatus } from '../types';
import { useStore } from '../state/store';
import { getAttachmentSignedUrl } from '../lib/api';
import type { Profile } from '../lib/auth';
import { Avatar } from './Avatar';
import { formatDateShort } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';

interface Props {
  openTaskId: number | null;
  onClose: () => void;
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
}

export function TaskDrawer({
  openTaskId,
  onClose,
  currentUserId,
  profilesById,
}: Props) {
  const task = useStore((s) =>
    openTaskId != null ? s.state.tasks.find((t) => t.id === openTaskId) : undefined,
  );
  const isOpen = Boolean(task);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`drawer ${isOpen ? 'open' : ''}`}
        aria-hidden={!isOpen}
        role="dialog"
      >
        {task && (
          <DrawerBody
            key={task.id}
            task={task}
            onClose={onClose}
            currentUserId={currentUserId}
            profilesById={profilesById}
          />
        )}
      </aside>
    </>
  );
}

function DrawerBody({
  task,
  onClose,
  currentUserId,
  profilesById,
}: {
  task: Task;
  onClose: () => void;
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
}) {
  const state = useStore((s) => s.state);
  const updateTask = useStore((s) => s.updateTask);
  const addTaskComment = useStore((s) => s.addTaskComment);
  const deleteTaskComment = useStore((s) => s.deleteTaskComment);
  const uploadTaskAttachment = useStore((s) => s.uploadTaskAttachment);
  const addTaskLink = useStore((s) => s.addTaskLink);
  const deleteTaskAttachment = useStore((s) => s.deleteTaskAttachment);
  const markMentionsSeen = useStore((s) => s.markMentionsSeen);

  const mentionNames = useMemo(
    () => Object.values(profilesById).map((p) => p.display_name),
    [profilesById],
  );

  // Mark this task's unread mentions for me as seen when the drawer opens.
  useEffect(() => {
    if (!currentUserId) return;
    const ids = state.mentions
      .filter(
        (m) =>
          m.mentionedUserId === currentUserId &&
          !m.seenAt &&
          m.taskId === task.id,
      )
      .map((m) => m.id);
    if (ids.length > 0) markMentionsSeen(ids);
    // We intentionally re-run when the task changes; not when state.mentions
    // updates, to avoid loops as we mark them seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, currentUserId]);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [commentText, setCommentText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const titleById = (id: number) =>
    state.tasks.find((tt) => tt.id === id)?.title ?? '?';
  const canEdit = !!currentUserId;

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else setTitle(task.title);
  };

  const saveDescription = () => {
    if (description !== task.description) {
      updateTask(task.id, { description });
    }
  };

  const onAddComment = () => {
    const v = commentText.trim();
    if (!v || !currentUserId) return;
    addTaskComment(task.id, v, currentUserId);
    setCommentText('');
  };

  const onPickFile = () => fileInput.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUserId) return;
    if (file.size > 25 * 1024 * 1024) {
      if (!confirm('That file is over 25 MB — continue anyway?')) return;
    }
    setUploading(true);
    try {
      await uploadTaskAttachment(task.id, file, currentUserId);
    } finally {
      setUploading(false);
    }
  };

  const onAddLink = async () => {
    if (!linkUrl.trim() || !currentUserId) return;
    await addTaskLink(task.id, linkUrl, linkLabel, currentUserId);
    setLinkUrl('');
    setLinkLabel('');
  };

  return (
    <div className="drawer-inner">
      <div className="drawer-head">
        <button className="drawer-close icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <span className="drawer-crumb">
          Phase {task.phase} · {state.phases[task.phase]?.name ?? '—'}
        </span>
      </div>

      <div className="drawer-scroll">
        <div className="drawer-title-row">
          <span className="task-num drawer-task-num">#{task.id}</span>
          <input
            className="drawer-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>

        <div className="drawer-pills">
          <span className={`pill pill-${task.priority}`}>{task.priority}</span>
          <span className={`pill pill-${task.status}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className="pill pill-low tnum">{task.duration || 0}d</span>
        </div>

        <section className="drawer-section">
          <h4>Description</h4>
          <textarea
            className="drawer-textarea"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="What needs to happen for this task? Any notes, decisions, open questions…"
          />
        </section>

        <section className="drawer-section">
          <h4>Details</h4>
          <div className="task-meta">
            <div className="field">
              <label>Status</label>
              <select
                value={task.status}
                onChange={(e) =>
                  updateTask(task.id, { status: e.target.value as TaskStatus })
                }
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select
                value={task.priority}
                onChange={(e) =>
                  updateTask(task.id, { priority: e.target.value as TaskPriority })
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="field">
              <label>Duration (days)</label>
              <input
                type="number"
                min={0}
                value={task.duration || 0}
                onChange={(e) =>
                  updateTask(task.id, {
                    duration: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
              />
            </div>
            <div className="field">
              <label>Start date (override)</label>
              <input
                type="date"
                value={task.start || ''}
                onChange={(e) => updateTask(task.id, { start: e.target.value })}
              />
            </div>
            <div className="field">
              <label>End date (override)</label>
              <input
                type="date"
                value={task.end || ''}
                onChange={(e) => updateTask(task.id, { end: e.target.value })}
              />
            </div>
          </div>
          {task.deps && task.deps.length > 0 && (
            <div className="deps">
              <strong>Depends on:</strong>{' '}
              {task.deps.map((d) => `#${d} ${titleById(d)}`).join(' · ')}
            </div>
          )}
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Attachments ({task.attachments.length})</h4>
            <div className="drawer-section-actions">
              <button
                className="btn-quiet drawer-small-btn"
                onClick={onPickFile}
                disabled={!canEdit || uploading}
              >
                {uploading ? 'Uploading…' : 'Upload file'}
              </button>
              <input
                ref={fileInput}
                type="file"
                hidden
                onChange={onFileChosen}
              />
            </div>
          </div>

          <div className="attachments-list">
            {task.attachments.length === 0 && (
              <p className="attachment-empty">
                No files or links yet.
              </p>
            )}
            {task.attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                uploaderName={
                  a.uploadedBy ? profilesById[a.uploadedBy]?.display_name : null
                }
                canDelete={a.uploadedBy === currentUserId}
                onDelete={() => deleteTaskAttachment(task.id, a)}
              />
            ))}
          </div>

          <div className="add-link-row">
            <input
              type="url"
              placeholder="https://… (paste a link)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddLink();
              }}
              disabled={!canEdit}
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddLink();
              }}
              disabled={!canEdit}
              style={{ flex: 1 }}
            />
            <button className="btn-quiet drawer-small-btn" onClick={onAddLink} disabled={!canEdit}>
              Add link
            </button>
          </div>
        </section>

        <section className="drawer-section">
          <h4>Comments ({task.comments.length})</h4>
          <div className="comments drawer-comments">
            {task.comments.map((c) => {
              const who = c.authorId ? profilesById[c.authorId] : null;
              return (
                <div key={c.id ?? `${c.date}-${c.text}`} className="comment comment-stacked">
                  <div className="comment-meta">
                    {who ? (
                      <>
                        <Avatar
                          user={who.avatar === 'rose' ? 'karo' : 'max'}
                          size={22}
                        />
                        <b>{who.display_name}</b>
                      </>
                    ) : (
                      <b style={{ color: 'var(--text-3)' }}>unknown</b>
                    )}
                    <span className="comment-date tnum">{c.date}</span>
                  </div>
                  <div
                    className="comment-text comment-rendered"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(c.text, { mentionNames }),
                    }}
                  />
                  {c.id !== undefined && c.authorId === currentUserId && (
                    <button
                      className="comment-del"
                      onClick={() => deleteTaskComment(task.id, c.id as number)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

            <div className="comment-add">
              <input
                type="text"
                placeholder={canEdit ? 'Add a comment… (try @max or @karo)' : 'Sign in to comment'}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddComment();
                }}
                disabled={!canEdit}
              />
              <button className="btn-primary" onClick={onAddComment} disabled={!canEdit}>
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AttachmentRow({
  attachment,
  uploaderName,
  canDelete,
  onDelete,
}: {
  attachment: Attachment;
  uploaderName: string | null | undefined;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [opening, setOpening] = useState(false);

  const isFile = attachment.kind === 'file';
  const displayName = attachment.filename;
  const sizeLabel = attachment.sizeBytes
    ? formatSize(attachment.sizeBytes)
    : null;
  const createdLabel = formatDateShort(attachment.createdAt);

  const open = async () => {
    if (isFile) {
      if (!attachment.storagePath) return;
      setOpening(true);
      try {
        const url = await getAttachmentSignedUrl(attachment.storagePath);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        alert("Couldn't open file: " + (e as Error).message);
      } finally {
        setOpening(false);
      }
    } else if (attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="attachment-row">
      <span className="attachment-icon" aria-hidden="true">
        {isFile ? '📄' : '🔗'}
      </span>
      <button className="attachment-name" onClick={open} disabled={opening}>
        {opening ? 'Opening…' : displayName}
      </button>
      <span className="attachment-meta tnum">
        {sizeLabel ? `${sizeLabel} · ` : ''}
        {uploaderName ? `${uploaderName} · ` : ''}
        {createdLabel}
      </span>
      {canDelete && (
        <button
          className="del-btn"
          onClick={() => {
            if (confirm(`Delete "${displayName}"?`)) onDelete();
          }}
          title="Delete"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
