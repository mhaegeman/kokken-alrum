import { useEffect, useState } from 'react';
import type { Attachment } from '../types';
import { getAttachmentSignedUrl } from '../lib/api';

// A read-only inline view of attachments. Image attachments render as
// thumbnails (click to open full-size); other files / links render as
// chips. No upload, delete, or drag-drop UI here — that lives in the
// parent (e.g. composer + AttachmentList).
export function MessageAttachments({
  attachments,
}: {
  attachments: Attachment[];
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter(
    (a) => a.kind === 'file' && a.mimeType?.startsWith('image/'),
  );
  const others = attachments.filter((a) => !images.includes(a));

  return (
    <div className="msg-attachments">
      {images.length > 0 && (
        <div className="msg-attach-grid">
          {images.map((a) => (
            <ImageThumb key={a.id} attachment={a} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="msg-attach-chips">
          {others.map((a) => (
            <ChipAttachment key={a.id} attachment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImageThumb({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.storagePath) return;
    let cancelled = false;
    getAttachmentSignedUrl(attachment.storagePath, 60 * 60)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath]);

  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="msg-img-link"
      title={attachment.filename}
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
    >
      {url ? (
        <img src={url} alt={attachment.filename} />
      ) : (
        <span className="msg-img-placeholder" />
      )}
    </a>
  );
}

function ChipAttachment({ attachment }: { attachment: Attachment }) {
  const [opening, setOpening] = useState(false);
  const isFile = attachment.kind === 'file';

  const open = async () => {
    if (isFile && attachment.storagePath) {
      setOpening(true);
      try {
        const u = await getAttachmentSignedUrl(attachment.storagePath);
        window.open(u, '_blank', 'noopener,noreferrer');
      } finally {
        setOpening(false);
      }
    } else if (attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button className="msg-chip" onClick={open} disabled={opening}>
      <span aria-hidden="true">{isFile ? '📄' : '🔗'}</span>
      <span className="msg-chip-name">
        {opening ? 'Opening…' : attachment.filename}
      </span>
    </button>
  );
}
