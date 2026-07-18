import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { log } from './logger';

// Required once so the auth browser tab/sheet dismisses itself on completion.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

/**
 * Browser-redirect OAuth (Google/Apple) via Supabase Auth — no native SDKs,
 * works in Expo Go and standalone builds alike. Returns the session on
 * success, or null if the user cancelled.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  const redirectTo = makeRedirectUri();
  log.info('OAuth', `Starting ${provider} sign-in`, { redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No authorization URL returned');

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') {
    log.info('OAuth', `${provider} sign-in cancelled or failed`, { type: res.type });
    return null;
  }

  const session = await createSessionFromUrl(res.url);
  if (session) log.ok('OAuth', `${provider} sign-in successful`, { userId: session.user.id });
  return session;
}
