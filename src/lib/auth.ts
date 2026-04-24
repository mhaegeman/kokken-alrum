import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  tone: 'forest' | 'rose';
  avatar: 'palm' | 'rose';
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  profiles: Profile[];
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

  // Fetch profiles (ours + the other person's) once we have a session.
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

  return { loading, session, profile, profiles };
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
