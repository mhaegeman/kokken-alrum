import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '../types';
import { getAttachmentSignedUrl } from '../lib/api';
import { formatDateShort } from '../lib/format';

export interface AttachmentListProps {
  attachments: Attachment[];
  uploaderName: (uploaderId: string | null | undefined) => string | undefined;
  currentUserId: string | null;
  canEdit: boolean;
  onUploadFile: (file: File) => Promise<void> | void;
  onAddLink: (url: string, label: string) => Promise<void> | void;
  onDelete: (attachment: Attachment) => Promise<void> | void;
}

export function AttachmentList({
  attachments,
  uploaderName,
  currentUserId,
  canEdit,
  onUploadFile,
  onAddLink,
  onDelete,
}: AttachmentListProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const onPickFile = () => fileInput.current?.click();

  const handleFiles = async (files: FileList | File[]) => {
    if (!canEdit) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          if (!confirm(`${file.name} is over 25 MB — continue anyway?`)) continue;
        }
        await onUploadFile(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;
    await handleFiles(files);
  };

  const onAddLinkClick = async () => {
    if (!linkUrl.trim() || !canEdit) return;
    await onAddLink(linkUrl, linkLabel);
    setLinkUrl('');
    setLinkLabel('');
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragActive) setDragActive(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    // Only deactivate when leaving the dropzone (not children).
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!canEdit) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  };

  return (
    <>
      <div
        className={`drop-zone ${dragActive ? 'active' : ''} ${attachments.length === 0 ? 'empty' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {attachments.length === 0 ? (
          <p className="attachment-empty">
            {canEdit
              ? 'Drag a file here, or use Upload / paste a link below.'
              : 'No files or links yet.'}
          </p>
        ) : (
          <div className="attachments-list">
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                uploaderName={uploaderName(a.uploadedBy)}
                canDelete={a.uploadedBy === currentUserId}
                onDelete={() => onDelete(a)}
              />
            ))}
          </div>
        )}
        {dragActive && (
          <div className="drop-zone-overlay">Drop to upload</div>
        )}
      </div>

      <div className="attachment-actions">
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
          multiple
          onChange={onFileChosen}
        />

        <input
          type="url"
          placeholder="https://… (paste a link)"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddLinkClick();
          }}
          disabled={!canEdit}
          className="link-url-input"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddLinkClick();
          }}
          disabled={!canEdit}
          className="link-label-input"
        />
        <button
          className="btn-quiet drawer-small-btn"
          onClick={onAddLinkClick}
          disabled={!canEdit || !linkUrl.trim()}
        >
          Add link
        </button>
      </div>
    </>
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
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const isFile = attachment.kind === 'file';
  const isImage = isFile && attachment.mimeType?.startsWith('image/');

  // Lazy-load a signed thumbnail URL for image files.
  useEffect(() => {
    if (!isImage || !attachment.storagePath) return;
    let cancelled = false;
    getAttachmentSignedUrl(attachment.storagePath, 60 * 60)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        // Silent — thumbnail just won't render; file is still openable.
      });
    return () => {
      cancelled = true;
    };
  }, [isImage, attachment.storagePath]);

  const sizeLabel = attachment.sizeBytes ? formatSize(attachment.sizeBytes) : null;
  const createdLabel = formatDateShort(attachment.createdAt);

  const open = async () => {
    if (isFile) {
      if (!attachment.storagePath) return;
      setOpening(true);
      try {
        const url = thumbUrl ?? (await getAttachmentSignedUrl(attachment.storagePath));
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
      <button
        className="attachment-thumb"
        onClick={open}
        aria-label={`Open ${attachment.filename}`}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" />
        ) : (
          <span className="attachment-icon" aria-hidden="true">
            {isFile ? '📄' : '🔗'}
          </span>
        )}
      </button>
      <button className="attachment-name" onClick={open} disabled={opening}>
        {opening ? 'Opening…' : attachment.filename}
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
            if (confirm(`Delete "${attachment.filename}"?`)) onDelete();
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
