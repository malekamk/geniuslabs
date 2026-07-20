import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { useClasses } from '@/context/classes-context';

const PRIMARY = '#1565C0';

type P = { color: string; focused: boolean };
const ico = (outline: string, filled: string) => {
  function TabIcon({ color, focused }: P) {
    return <Ionicons name={(focused ? filled : outline) as any} color={color} size={24} />;
  }
  return TabIcon;
};

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
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
  const chatBadge    = chatUnread > 0 ? (chatUnread > 99 ? '99+' : String(chatUnread)) : undefined;
  const tasksBadge   = tasksUnread > 0 ? (tasksUnread > 99 ? '99+' : String(tasksUnread)) : undefined;
  const classBadge   = hasLiveClass ? '●' : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}>

      {/* ── ADMIN TABS ── */}
      <Tabs.Screen name="admin-dashboard"  options={isAdmin ? { title: 'Dashboard',   tabBarIcon: ico('home-outline', 'home') }                           : { href: null }} />
      <Tabs.Screen name="admin-enrolments" options={isAdmin ? { title: 'Enrolments',  tabBarIcon: ico('document-text-outline', 'document-text') }         : { href: null }} />
      <Tabs.Screen name="admin-payments"   options={isAdmin ? { title: 'Payments',    tabBarIcon: ico('card-outline', 'card') }                            : { href: null }} />
      <Tabs.Screen name="admin-users"          options={isAdmin ? { title: 'Users',         tabBarIcon: ico('people-outline', 'people') }                           : { href: null }} />
      <Tabs.Screen name="admin-announcements" options={isAdmin ? { title: 'Broadcast',     tabBarIcon: ico('radio-outline', 'radio') }                      : { href: null }} />

      {/* ── REGULAR TABS ── */}
      <Tabs.Screen name="index"    options={!isAdmin ? { title: 'Home',       tabBarIcon: ico('home-outline', 'home') }                                    : { href: null }} />
      <Tabs.Screen name="programs" options={(!isAdmin && isGuardian)  ? { title: 'Programmes', tabBarIcon: ico('reader-outline', 'reader') }               : { href: null }} />
      <Tabs.Screen name="chat"     options={(!isAdmin && !isGuardian) ? { title: 'Chat', tabBarIcon: ico('chatbubbles-outline', 'chatbubbles'), tabBarBadge: chatBadge } : { href: null }} />
      <Tabs.Screen name="classes"  options={!isAdmin ? { title: 'Classes', tabBarIcon: ico('videocam-outline', 'videocam'), tabBarBadge: classBadge }       : { href: null }} />
      <Tabs.Screen name="tasks"    options={!isAdmin ? { title: 'Tasks',   tabBarIcon: ico('trophy-outline', 'trophy'),    tabBarBadge: tasksBadge }        : { href: null }} />
      <Tabs.Screen name="gallery"  options={!isAdmin ? { title: 'Gallery',    tabBarIcon: ico('images-outline', 'images') }                                : { href: null }} />
      <Tabs.Screen name="profile"  options={!isAdmin ? { title: 'Profile',    tabBarIcon: ico('person-circle-outline', 'person-circle') }                  : { href: null }} />
    </Tabs>
  );
}
