import { useEffect, useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { useStore } from '../state/store';
import type { Profile } from '../lib/auth';
import { Avatar } from './Avatar';
import { renderMarkdown } from '../lib/markdown';
import { AttachmentList } from './AttachmentList';

interface Props {
  openTaskId: number | null;
  onClose: () => void;
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
  isGuest: boolean;
}

export function TaskDrawer({
  openTaskId,
  onClose,
  currentUserId,
  profilesById,
  isGuest,
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
            isGuest={isGuest}
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
  isGuest,
}: {
  task: Task;
  onClose: () => void;
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
  isGuest: boolean;
}) {
  const state = useStore((s) => s.state);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
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
  const mentionContacts = useMemo(
    () => state.contacts.map((c) => ({ id: c.id, name: c.name })),
    [state.contacts],
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

  const titleById = (id: number) =>
    state.tasks.find((tt) => tt.id === id)?.title ?? '?';
  // Anyone authenticated (incl. guests) can post comments and upload
  // attachments; only full members can edit / delete the task itself.
  const canContribute = !!currentUserId;
  const canModify = canContribute && !isGuest;

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

  return (
    <div className="drawer-inner">
      <div className="drawer-head">
        <button className="drawer-close icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <span className="drawer-crumb">
          Phase {task.phase} · {state.phases[task.phase]?.name ?? '—'}
        </span>
        {canModify && (
          <button
            className="icon-btn danger drawer-delete"
            onClick={() => {
              if (
                confirm(
                  `Delete task "${task.title}"?\nThis will also remove its comments and attachments. This cannot be undone.`,
                )
              ) {
                deleteTask(task.id);
                onClose();
              }
            }}
            title="Delete task"
          >
            Delete
          </button>
        )}
      </div>

      <div className="drawer-scroll">
        <div className="drawer-title-row">
          <span className="task-num drawer-task-num">#{task.id}</span>
          {canModify ? (
            <input
              className="drawer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <h2 className="drawer-title drawer-title-readonly">{task.title}</h2>
          )}
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
          {canModify ? (
            <textarea
              className="drawer-textarea"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="What needs to happen for this task? Any notes, decisions, open questions…"
            />
          ) : task.description ? (
            <p className="drawer-readonly-text">{task.description}</p>
          ) : (
            <p className="drawer-readonly-empty">No description.</p>
          )}
        </section>

        <section className="drawer-section">
          <h4>Details</h4>
          {canModify ? (
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
          ) : (
            <div className="task-meta-readonly">
              <div>
                <span className="meta-label">Status:</span>{' '}
                {task.status.replace('_', ' ')}
              </div>
              <div>
                <span className="meta-label">Priority:</span> {task.priority}
              </div>
              <div>
                <span className="meta-label">Duration:</span>{' '}
                {task.duration || 0}d
              </div>
              {task.start && (
                <div>
                  <span className="meta-label">Start:</span> {task.start}
                </div>
              )}
              {task.end && (
                <div>
                  <span className="meta-label">End:</span> {task.end}
                </div>
              )}
            </div>
          )}
          {task.deps && task.deps.length > 0 && (
            <div className="deps">
              <strong>Depends on:</strong>{' '}
              {task.deps.map((d) => `#${d} ${titleById(d)}`).join(' · ')}
            </div>
          )}
        </section>

        <section className="drawer-section">
          <h4>Attachments ({task.attachments.length})</h4>
          <AttachmentList
            attachments={task.attachments}
            canEdit={canContribute}
            currentUserId={currentUserId}
            uploaderName={(id) =>
              id ? profilesById[id]?.display_name : undefined
            }
            onUploadFile={(file) =>
              currentUserId
                ? uploadTaskAttachment(task.id, file, currentUserId)
                : undefined
            }
            onAddLink={(url, label) =>
              currentUserId
                ? addTaskLink(task.id, url, label, currentUserId)
                : undefined
            }
            onDelete={(a) => deleteTaskAttachment(task.id, a)}
          />
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
                      __html: renderMarkdown(c.text, { mentionNames, mentionContacts }),
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
                placeholder={
                  canContribute
                    ? 'Add a comment… (try @max or @karo)'
                    : 'Sign in to comment'
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddComment();
                }}
                disabled={!canContribute}
              />
              <button
                className="btn-primary"
                onClick={onAddComment}
                disabled={!canContribute}
              >
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

