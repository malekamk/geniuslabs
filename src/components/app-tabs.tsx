import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { useClasses } from '@/context/classes-context';

const PRIMARY = '#1565C0';

// Standard expo-router Tabs (JS-rendered, backed by @react-navigation/
// bottom-tabs) — swapped off expo-router/unstable-native-tabs after
// persistent, unresolved tap-handling bugs in that experimental component.
// Admin and everyone else share this same (tabs) group, just with a
// different visible Tabs.Screen set. Every role lands here via the bare
// '/(tabs)' path (see src/app/_layout.tsx); "index" itself branches on role
// (src/app/(tabs)/index.tsx → learner home or admin dashboard).
//
// IMPORTANT: <Tabs> auto-registers every sibling route file as a visible
// tab unless it's explicitly listed here with `options={{ href: null }}` —
// every file in (tabs)/ must be accounted for in BOTH branches below, or it
// silently appears as an extra tab for the wrong role.
export default function AppTabs() {
  const { profile } = useAuth();
  const { chatUnread, tasksUnread } = useNotifications();
  const { classes } = useClasses();
  const isGuardian = profile?.role === 'guardian';
  const isAdmin    = profile?.role === 'admin';

  const now = Date.now();
  const hasLiveClass = classes.some(c => {
    if (!c.scheduled_at) return false;
    const t = new Date(c.scheduled_at).getTime();
    return now >= t - 60_000 && now <= t + 90 * 60_000;
  });
  const chatBadge  = chatUnread > 0 ? (chatUnread > 99 ? '99+' : String(chatUnread)) : undefined;
  const tasksBadge = tasksUnread > 0 ? (tasksUnread > 99 ? '99+' : String(tasksUnread)) : undefined;

  if (isAdmin) {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: PRIMARY }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="admin-enrolments"
          options={{ title: 'Enrolments', tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} /> }}
        />
        {/* Payments tab hidden pending App Store/Play Store review of the
            in-app Yoco checkout flow (Apple 3.1.1) — admin-payments.tsx
            itself is untouched, just not linked from the tab bar. */}
        <Tabs.Screen name="admin-payments" options={{ href: null }} />
        <Tabs.Screen
          name="admin-users"
          options={{ title: 'Users', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="admin-announcements"
          options={{ title: 'Broadcast', tabBarIcon: ({ color, size }) => <Ionicons name="radio" size={size} color={color} /> }}
        />
        {/* Not tabs for admin — hidden but still valid routes */}
        <Tabs.Screen name="programs" options={{ href: null }} />
        <Tabs.Screen name="chat" options={{ href: null }} />
        <Tabs.Screen name="classes" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="gallery" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: PRIMARY }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          href: isGuardian ? undefined : null,
          title: 'Programmes',
          tabBarIcon: ({ color, size }) => <Ionicons name="reader" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: isGuardian ? null : undefined,
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: chatBadge,
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color, size }) => <Ionicons name="videocam" size={size} color={color} />,
          tabBarBadge: hasLiveClass ? '●' : undefined,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          tabBarBadge: tasksBadge,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }}
      />
      {/* Not tabs for this role — hidden but still valid routes */}
      <Tabs.Screen name="gallery" options={{ href: null }} />
      <Tabs.Screen name="admin-enrolments" options={{ href: null }} />
      <Tabs.Screen name="admin-payments" options={{ href: null }} />
      <Tabs.Screen name="admin-users" options={{ href: null }} />
      <Tabs.Screen name="admin-announcements" options={{ href: null }} />
    </Tabs>
  );
}
