import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { ONBOARDING_KEY } from './onboarding';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { ClassesProvider } from '@/context/classes-context';
import { NotificationProvider } from '@/context/notification-context';

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Read onboarding flag ONCE on mount — never re-read on navigation
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => setOnboardingDone(val === 'true'));
  }, []);

  useEffect(() => {
    // Wait until auth AND onboarding storage are both resolved
    if (loading || onboardingDone === null) return;

    const seg0 = segments[0] as string | undefined;

    // Onboarding disabled
    // if (!onboardingDone) {
    //   if (seg0 !== 'onboarding') router.replace('/onboarding');
    //   return;
    // }

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

    if (inAuth) {
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
  }, [session, profile, loading, onboardingDone, segments]);

  // Render nothing until auth resolves (prevents the flash of wrong screen)
  if (loading || onboardingDone === null) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ClassesProvider>
      <NotificationProvider>
        <StatusBar style="dark" />
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="onboarding"            options={{ headerShown: false }} />
          <Stack.Screen name="auth/login"            options={{ headerShown: false }} />
          <Stack.Screen name="auth/signup"           options={{ headerShown: false }} />
          <Stack.Screen name="auth/forgot-password"  options={{ headerShown: false }} />
          <Stack.Screen name="auth/complete-profile" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"                options={{ headerShown: false }} />
          <Stack.Screen name="chat-room"             options={{ headerShown: false }} />
          <Stack.Screen name="notifications"         options={{ headerShown: false }} />
          <Stack.Screen name="payment-webview"       options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="admin/application-detail" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="admin/learners"        options={{ headerShown: false }} />
          <Stack.Screen name="admin/materials"       options={{ headerShown: false }} />
          <Stack.Screen name="admin/classes"         options={{ headerShown: false }} />
          <Stack.Screen name="admin/gallery"         options={{ headerShown: false }} />
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
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
