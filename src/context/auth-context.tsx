import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import type { Profile } from '@/types/db';

const TAG = 'Auth';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  realProfile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isImpersonating: boolean;
  loginAs: (p: Profile) => void;
  exitLoginAs: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profile = impersonatedProfile ?? realProfile;
  const isImpersonating = !!impersonatedProfile;
  const loginAs = (p: Profile) => setImpersonatedProfile(p);
  const exitLoginAs = () => setImpersonatedProfile(null);

  useEffect(() => {
    log.info(TAG, 'Checking existing session…');

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user) {
        log.ok(TAG, 'Session restored', { userId: s.user.id, email: s.user.email });
        setSession(s);
        fetchProfile(s.user.id, s.user);
      } else {
        log.info(TAG, 'No existing session — user is logged out');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      log.info(TAG, `Auth state changed: ${event}`, s?.user ? { userId: s.user.id } : {});
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id, s.user);
      } else {
        setRealProfile(null);
        setImpersonatedProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, authUser?: User) {
    log.info(TAG, 'Fetching profile…', { userId });
    // maybeSingle (not single) — a brand-new OAuth user has no row yet, which
    // is an expected case, not an error worth logging in red.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      log.error(TAG, 'Profile fetch failed', error);
    } else if (data) {
      log.ok(TAG, 'Profile loaded', { role: (data as Profile).role, name: (data as Profile).full_name });
    } else {
      log.info(TAG, 'No profile row yet — new user needs to complete profile');
    }

    const profileRow = data as Profile | null;

    // Google sign-in puts a profile photo URL in user_metadata — pick it up
    // once, so the avatar shows instead of initials without any manual step.
    // Apple never provides one, so this stays a no-op for Apple/email users.
    if (profileRow && !profileRow.avatar_url) {
      const metaAvatar = (authUser?.user_metadata?.avatar_url as string | undefined)
        ?? (authUser?.user_metadata?.picture as string | undefined);
      if (metaAvatar) {
        profileRow.avatar_url = metaAvatar;
        supabase.from('profiles').update({ avatar_url: metaAvatar }).eq('id', userId)
          .then(({ error: avatarErr }) => { if (avatarErr) log.warn(TAG, 'Avatar sync failed', avatarErr); });
      }
    }

    setRealProfile(profileRow);
    setLoading(false);
  }

  async function refreshProfile() {
    if (session?.user) await fetchProfile(session.user.id, session.user);
  }

  async function signOut() {
    log.info(TAG, 'Signing out…');
    const { error } = await supabase.auth.signOut();
    if (error) log.error(TAG, 'Sign out failed', error);
    else log.ok(TAG, 'Signed out');
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, realProfile, loading, signOut, isImpersonating, loginAs, exitLoginAs, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
