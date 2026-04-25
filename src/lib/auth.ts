import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  tone: 'forest' | 'rose';
  avatar: 'palm' | 'rose';
  is_guest: boolean;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  profiles: Profile[];
  // True when the current user came in via an invite link (anonymous
  // session) — used to gate edit / delete UI and project-wide writes.
  isGuest: boolean;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fetch profiles once we have a session.
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (cancelled) return;
      if (error) {
        console.warn('Failed to load profiles', error);
        return;
      }
      const all = (data ?? []) as Profile[];
      setProfiles(all);
      setProfile(all.find((p) => p.id === session.user.id) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const isGuest = useMemo(() => {
    // Trust the JWT first (set by Supabase on signInAnonymously) so the
    // UI can decide before profile data arrives. Fall back to the
    // profile.is_guest column.
    if (session?.user && (session.user as { is_anonymous?: boolean }).is_anonymous) {
      return true;
    }
    return Boolean(profile?.is_guest);
  }, [session, profile]);

  return { loading, session, profile, profiles, isGuest };
}

export async function sendMagicLink(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('Enter an email address.');

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      // Only allow sign-ins for users who already exist (pre-invited by admin).
      shouldCreateUser: false,
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });

  if (error) {
    // Normalize Supabase's "Signups not allowed for otp" into a clearer message.
    if (/signups? not allowed|user not found/i.test(error.message)) {
      throw new Error(
        "That email isn't on the project. Only Max and Karo can sign in.",
      );
    }
    throw error;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ─── guest invites ─────────────────────────────────────────────

export interface InvitePeek {
  id: number;
  label: string;
  expires_at: string | null;
}

// Look up an invite token before asking the guest for their name. Returns
// null when the token is unknown / revoked / expired so the UI can show
// a "this link is no longer valid" message.
export async function peekInvite(token: string): Promise<InvitePeek | null> {
  const { data, error } = await supabase.rpc('peek_guest_invite', {
    p_token: token,
  });
  if (error) {
    console.warn('peek_guest_invite failed', error);
    return null;
  }
  const rows = (data ?? []) as InvitePeek[];
  return rows[0] ?? null;
}

// Sign in as a brand-new anonymous user, then claim the invite by writing
// the chosen display name into the auto-created profile row. If the
// guest already has an anonymous session we reuse it so revisiting the
// link doesn't create duplicate profiles.
export async function acceptInvite(token: string, displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Please enter a name.');
  if (trimmed.length > 60) throw new Error('Name is too long (max 60).');

  const { data: existing } = await supabase.auth.getSession();
  if (!existing.session) {
    const { error: signInErr } = await supabase.auth.signInAnonymously();
    if (signInErr) {
      throw new Error(
        'Could not start a guest session: ' + signInErr.message,
      );
    }
  }

  const { error } = await supabase.rpc('accept_guest_invite', {
    p_token: token,
    p_display_name: trimmed,
  });
  if (error) throw error;
}
