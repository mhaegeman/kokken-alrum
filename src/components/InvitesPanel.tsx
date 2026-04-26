import { useEffect, useRef, useState } from 'react';
import {
  createInviteRemote,
  listInvitesRemote,
  revokeInviteRemote,
  type GuestInvite,
} from '../lib/api';
import { toast } from '../lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

function inviteUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?invite=${token}`;
}

function inviteStatus(i: GuestInvite): 'active' | 'expired' | 'revoked' {
  if (i.revokedAt) return 'revoked';
  if (i.expiresAt && new Date(i.expiresAt).getTime() < Date.now()) return 'expired';
  return 'active';
}

export function InvitesPanel({ open, onClose }: Props) {
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(30);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listInvitesRemote();
      setInvites(list);
    } catch (e) {
      toast.error("Couldn't load invites: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) reload();
  }, [open]);

  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus();
      openerRef.current = null;
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement) openerRef.current = active;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const onCreate = async () => {
    setCreating(true);
    try {
      const expiresAt =
        typeof expiresInDays === 'number' && expiresInDays > 0
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
      const created = await createInviteRemote(label.trim(), expiresAt);
      setInvites((prev) => [created, ...prev]);
      setLabel('');
      try {
        await navigator.clipboard.writeText(inviteUrl(created.token));
        toast.success('Invite link created and copied to clipboard.');
      } catch {
        toast.success('Invite link created.');
      }
    } catch (e) {
      toast.error('Could not create invite: ' + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async (i: GuestInvite) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(i.token));
      setCopiedId(i.id);
      setTimeout(() => setCopiedId((id) => (id === i.id ? null : id)), 1500);
    } catch {
      toast.error("Couldn't copy — your browser blocked it.");
    }
  };

  const onRevoke = async (i: GuestInvite) => {
    if (!confirm(`Revoke this invite link? Anyone using it will lose access.`)) {
      return;
    }
    try {
      await revokeInviteRemote(i.id);
      setInvites((prev) =>
        prev.map((p) =>
          p.id === i.id ? { ...p, revokedAt: new Date().toISOString() } : p,
        ),
      );
    } catch (e) {
      toast.error('Could not revoke: ' + (e as Error).message);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} aria-hidden="false" />
      <div className="invites-modal" role="dialog" aria-modal="true" aria-label="Guest invites">
        <div className="invites-modal-head">
          <h2>Guest invite links</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="invites-modal-sub">
          Anyone with a link can sign in as a guest. Guests can browse, comment
          and upload documents — but cannot edit tasks, budget or topics.
        </p>

        <div className="invites-create">
          <input
            type="text"
            placeholder="Label (optional, e.g. 'Mom' or 'Builder')"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
          />
          <select
            value={expiresInDays === '' ? 'never' : String(expiresInDays)}
            onChange={(e) =>
              setExpiresInDays(e.target.value === 'never' ? '' : Number(e.target.value))
            }
            title="Expiry"
          >
            <option value="7">Expires in 7 days</option>
            <option value="30">Expires in 30 days</option>
            <option value="90">Expires in 90 days</option>
            <option value="never">No expiry</option>
          </select>
          <button
            className="btn-primary"
            onClick={onCreate}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create invite link'}
          </button>
        </div>

        <div className="invites-list">
          {loading && invites.length === 0 && (
            <p className="invites-empty">Loading…</p>
          )}
          {!loading && invites.length === 0 && (
            <p className="invites-empty">No invites yet.</p>
          )}
          {invites.map((i) => {
            const status = inviteStatus(i);
            const url = inviteUrl(i.token);
            return (
              <div key={i.id} className={`invite-row invite-${status}`}>
                <div className="invite-row-main">
                  <div className="invite-row-top">
                    <strong>{i.label || 'Untitled invite'}</strong>
                    <span className={`invite-badge invite-badge-${status}`}>
                      {status}
                    </span>
                  </div>
                  <div className="invite-row-url" title={url}>
                    {url}
                  </div>
                  <div className="invite-row-meta">
                    Created {new Date(i.createdAt).toLocaleDateString()}
                    {i.expiresAt && (
                      <>
                        {' · expires '}
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </>
                    )}
                    {i.revokedAt && (
                      <>
                        {' · revoked '}
                        {new Date(i.revokedAt).toLocaleDateString()}
                      </>
                    )}
                  </div>
                </div>
                <div className="invite-row-actions">
                  {status === 'active' && (
                    <>
                      <button
                        className="btn-quiet"
                        onClick={() => onCopy(i)}
                      >
                        {copiedId === i.id ? 'Copied!' : 'Copy link'}
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => onRevoke(i)}
                        title="Revoke"
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
