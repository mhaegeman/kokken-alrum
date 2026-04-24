import { useState } from 'react';
import { sendMagicLink } from '../lib/auth';
import { isConfigured } from '../lib/supabase';
import { Avatar } from './Avatar';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await sendMagicLink(email);
      setStatus('sent');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-mark">K</div>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          Køkken alrum · Copenhagen
        </p>
        <h1 style={{ fontSize: 42, marginBottom: 14 }}>Welcome back.</h1>
        <p
          style={{
            color: 'var(--text-2)',
            marginBottom: 28,
            fontSize: 15,
            maxWidth: 380,
          }}
        >
          Sign in with the email we both know. We'll email you a magic link — no
          password needed.
        </p>

        {!isConfigured && (
          <div className="login-error">
            This site is not configured yet. Add{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
          </div>
        )}

        {status === 'sent' ? (
          <div className="login-sent">
            <p style={{ fontSize: 15, marginBottom: 6 }}>Check your inbox.</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>
              We sent a link to <b>{email}</b>. Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="login-form">
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isConfigured || status === 'sending'}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!isConfigured || status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}

        {error && <p className="login-error">{error}</p>}

        <div className="login-who">
          <Avatar user="max" size={26} />
          <Avatar user="karo" size={26} />
          <span>Max &amp; Karo only</span>
        </div>
      </div>
    </div>
  );
}
