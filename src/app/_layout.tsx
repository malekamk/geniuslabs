import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { BrandedLoadingScreen } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { LearnerBanner } from '@/components/learner-banner';
import { OfflineBanner } from '@/components/offline-banner';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { ClassesProvider } from '@/context/classes-context';
import { NetworkProvider } from '@/context/network-context';
import { NotificationProvider } from '@/context/notification-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { session, profile, loading, isImpersonating } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loading) return;

    const seg0 = segments[0] as string | undefined;
    const inAuth = seg0 === 'auth';

    if (!session) {
      if (!inAuth) router.replace('/auth/login');
      return;
    }

    // Authenticated but no role set yet — happens on a first-time Google/Apple
    // sign-in, since OAuth never asks "guardian/learner/tutor?" the way email
    // signup does. Covers both cases: no profile row at all, AND a bare row
    // with role still null (e.g. an on-signup DB trigger created it already).
    // Force the one-time role picker before anything else.
    if (!profile || !profile.role) {
      if (segments.join('/') !== 'auth/complete-profile') router.replace('/auth/complete-profile');
      return;
    }

    // Account was created with a temp password (admin-create-user /
    // guardian-invite-learner) — force a real password before anything else.
    if (profile.must_change_password) {
      if (segments.join('/') !== 'auth/set-password') router.replace('/auth/set-password');
      return;
    }

    // Recovery OTP (reset-password.tsx) establishes a session on step 1
    // (verifyOtp) before the user has actually set a new password on step
    // 2 — don't bounce them to tabs mid-flow the way a normal signed-in
    // visit to /auth would.
    if (inAuth && segments.join('/') !== 'auth/reset-password') {
      // Bare '/(tabs)' path — the SAME landing route for every role. It
      // always resolves to this group's own index.tsx, whose content itself
      // branches on role (admin dashboard vs learner/tutor/guardian home).
      // There is exactly one NativeTabs tree in the whole app; never jump
      // straight into a specific named tab, since that forces the native
      // tab bar to re-target itself right after mounting instead of just
      // opening on tab 0 — that's what previously left taps dead.
      router.replace('/(tabs)');
      return;
    }

    // Role guard — admin-only routes are blocked for any non-admin, regardless
    // of tab visibility (tab hiding is cosmetic, not a security boundary).
    const seg1 = segments[1] as string | undefined;
    const isAdminRoute = seg0 === 'admin' || (seg0 === '(tabs)' && seg1?.startsWith('admin-'));
    if (isAdminRoute && profile.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments]);

  // Hand off from the native splash to the branded JS loader as soon as this
  // component paints its first frame — must not wait on `loading` itself,
  // since BrandedLoadingScreen IS what the user watches while it's true.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Show the branded loader (not a blank screen) until auth resolves
  if (loading) return <BrandedLoadingScreen />;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ClassesProvider>
      <NotificationProvider>
        <StatusBar style={isImpersonating ? 'light' : 'dark'} />
        <LearnerBanner />
        <Stack>
          <Stack.Screen name="auth/login"            options={{ headerShown: false }} />
          <Stack.Screen name="auth/signup"           options={{ headerShown: false }} />
          <Stack.Screen name="auth/verify-email"     options={{ headerShown: false }} />
          <Stack.Screen name="auth/forgot-password"  options={{ headerShown: false }} />
          <Stack.Screen name="auth/reset-password"   options={{ headerShown: false }} />
          <Stack.Screen name="auth/complete-profile" options={{ headerShown: false }} />
          <Stack.Screen name="auth/set-password"     options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"                options={{ headerShown: false }} />
          <Stack.Screen name="chat-room"             options={{ headerShown: false }} />
          <Stack.Screen name="notifications"         options={{ headerShown: false }} />
          <Stack.Screen name="payment-webview"       options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="admin/application-detail" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="admin/learners"        options={{ headerShown: false }} />
          <Stack.Screen name="admin/materials"       options={{ headerShown: false }} />
          <Stack.Screen name="admin/classes"         options={{ headerShown: false }} />
          <Stack.Screen name="admin/gallery"         options={{ headerShown: false }} />
          <Stack.Screen name="admin/add-staff"       options={{ title: 'Add Staff', presentation: 'modal', headerBackTitle: 'Cancel' }} />
          <Stack.Screen name="enroll"                options={{ title: 'Learner Enrolment', headerBackTitle: 'Back' }} />
          <Stack.Screen name="live-class/[room]"     options={{ title: 'Online Classroom', headerBackTitle: 'Classes' }} />
          <Stack.Screen name="create-class"          options={{ title: 'Create Class', presentation: 'modal', headerBackTitle: 'Cancel' }} />
          <Stack.Screen name="create-material"       options={{ title: 'Add Material', presentation: 'modal', headerBackTitle: 'Cancel' }} />
          <Stack.Screen name="create-quiz"           options={{ title: 'Add Quiz', presentation: 'modal', headerBackTitle: 'Cancel' }} />
          <Stack.Screen name="quiz/[id]"             options={{ title: 'Quiz', headerBackTitle: 'Tasks' }} />
          <Stack.Screen name="quiz-questions/[id]"   options={{ title: 'Manage Questions', presentation: 'modal', headerBackTitle: 'Cancel' }} />
        </Stack>
      </NotificationProvider>
      </ClassesProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <NetworkProvider>
        <OfflineBanner />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
