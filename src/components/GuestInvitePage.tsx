import { useEffect, useState } from 'react';
import { acceptInvite, peekInvite, type InvitePeek } from '../lib/auth';
import { isConfigured } from '../lib/supabase';

interface Props {
  token: string;
  // Called after the invite has been accepted so the parent can drop
  // the ?invite=… query param and re-render in authenticated mode.
  onAccepted: () => void;
}

type Status =
  | { kind: 'checking' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; invite: InvitePeek }
  | { kind: 'submitting'; invite: InvitePeek }
  | { kind: 'done' };

export function GuestInvitePage({ token, onAccepted }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setStatus({
        kind: 'invalid',
        message: 'This site is not configured yet — check back later.',
      });
      return;
    }
    let cancelled = false;
    peekInvite(token)
      .then((invite) => {
        if (cancelled) return;
        if (!invite) {
          setStatus({
            kind: 'invalid',
            message: 'This invite link is no longer valid. Ask Max or Karo for a new one.',
          });
        } else {
          setStatus({ kind: 'ready', invite });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({
          kind: 'invalid',
          message: "Couldn't reach the server. Try again in a moment.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.kind !== 'ready') return;
    setError(null);
    setStatus({ kind: 'submitting', invite: status.invite });
    try {
      await acceptInvite(token, name);
      setStatus({ kind: 'done' });
      onAccepted();
    } catch (err) {
      setError((err as Error).message);
      setStatus({ kind: 'ready', invite: status.invite });
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-mark">K</div>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          Køkken alrum · Guest invite
        </p>
        <h1 style={{ fontSize: 36, marginBottom: 14 }}>You're invited.</h1>

        {status.kind === 'checking' && (
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            Checking your invite…
          </p>
        )}

        {status.kind === 'invalid' && (
          <p className="login-error">{status.message}</p>
        )}

        {(status.kind === 'ready' || status.kind === 'submitting') && (
          <>
            <p
              style={{
                color: 'var(--text-2)',
                marginBottom: 24,
                fontSize: 15,
                maxWidth: 420,
              }}
            >
              Pick a name so Max &amp; Karo know who's looking. As a guest you
              can browse the project, leave comments and add documents — but
              not change tasks, budget or topics.
              {status.kind === 'ready' && status.invite.expires_at && (
                <>
                  <br />
                  <span style={{ fontSize: 13 }}>
                    This link expires{' '}
                    {new Date(status.invite.expires_at).toLocaleDateString()}.
                  </span>
                </>
              )}
            </p>

            <form onSubmit={onSubmit} className="login-form">
              <input
                type="text"
                required
                autoFocus
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={status.kind === 'submitting'}
                maxLength={60}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={status.kind === 'submitting' || !name.trim()}
              >
                {status.kind === 'submitting' ? 'Joining…' : 'Continue as guest'}
              </button>
            </form>

            {error && <p className="login-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
