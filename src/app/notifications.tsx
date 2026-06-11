import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { supabase } from '@/utils/supabase';
import type { Notification, NotificationType, Announcement } from '@/types/db';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<NotificationType, IoniconName> = {
  class_reminder: 'videocam-outline',
  payment_due: 'card-outline',
  new_material: 'document-text-outline',
  quiz_available: 'help-circle-outline',
  announcement: 'megaphone-outline',
  general: 'notifications-outline',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  class_reminder: '#1565C0',
  payment_due: '#DC2626',
  new_material: '#7C3AED',
  quiz_available: '#D97706',
  announcement: PRIMARY,
  general: '#6B7280',
};

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const { markAllRead } = useNotifications();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch every time the screen comes into focus
  useFocusEffect(useCallback(() => {
    if (!profile) return;
    fetchNotifications();
    markAllRead();
    supabase.from('notifications').update({ read: true })
      .eq('profile_id', profile.id).eq('read', false).then(() => {});
  }, [profile?.id]));

  // Live updates while screen is open
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`notifs-screen:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${profile.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  async function fetchNotifications() {
    setLoading(true);
    const [{ data: notifs }, { data: annos }] = await Promise.all([
      supabase.from('notifications').select('*').eq('profile_id', profile!.id).order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(5),
    ]);
    setNotifications((notifs as Notification[]) ?? []);
    setAnnouncements((annos as Announcement[]) ?? []);
    setLoading(false);
  }

  async function handleTap(item: Notification) {
    if (!item.read) {
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      await supabase.from('notifications').update({ read: true }).eq('id', item.id);
    }
    const d = item.data as Record<string, unknown> | null;
    if (d?.chat_room_id) {
      router.push({ pathname: '/chat-room', params: {
        chatRoomId:  d.chat_room_id as string,
        subjectName: (d.subject as string) ?? 'Chat',
        grade:       (d.grade as string) ?? '',
      }} as any);
    } else if (item.type === 'class_reminder') {
      router.push('/(tabs)/classes' as any);
    } else if (item.type === 'payment_due') {
      router.push('/(tabs)/profile' as any);
    } else if (item.type === 'new_material' || item.type === 'quiz_available') {
      router.push('/(tabs)/tasks' as any);
    }
  }

  const paddingTop = Platform.select({ android: insets.top, web: Spacing.six, default: insets.top });

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <ThemedText style={styles.title}>Notifications</ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
          ListEmptyComponent={
            announcements.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
                <ThemedText style={styles.emptyText}>All caught up</ThemedText>
                <ThemedText style={styles.emptySub}>No notifications yet.</ThemedText>
              </View>
            ) : null
          }
          ListHeaderComponent={
            announcements.length > 0 ? (
              <View style={styles.annoSection}>
                <ThemedText style={styles.sectionLabel}>Announcements</ThemedText>
                {announcements.map(a => (
                  <View key={a.id} style={styles.annoRow}>
                    <View style={[styles.iconWrap, { backgroundColor: PRIMARY + '18' }]}>
                      <Ionicons name="megaphone-outline" size={20} color={PRIMARY} />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <ThemedText style={styles.rowTitle} numberOfLines={1}>{a.title}</ThemedText>
                        <ThemedText style={styles.rowTime}>{formatTime(a.published_at)}</ThemedText>
                      </View>
                      <ThemedText style={styles.rowBody2} numberOfLines={3}>{a.body}</ThemedText>
                    </View>
                  </View>
                ))}
                {notifications.length > 0 && <ThemedText style={[styles.sectionLabel, { marginTop: Spacing.three }]}>Notifications</ThemedText>}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const color = TYPE_COLOR[item.type] ?? '#6B7280';
            const icon = TYPE_ICON[item.type] ?? 'notifications-outline';
            return (
              <Pressable
                style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => handleTap(item)}>
                <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={20} color={color} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <ThemedText style={styles.rowTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <ThemedText style={styles.rowTime}>{formatTime(item.created_at)}</ThemedText>
                  </View>
                  <ThemedText style={styles.rowBody2} numberOfLines={2}>{item.body}</ThemedText>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.three,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: Spacing.two,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', marginHorizontal: Spacing.four, marginTop: Spacing.two,
    borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: PRIMARY },
  iconWrap: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  rowTime: { fontSize: 11, color: '#9CA3AF' },
  rowBody2: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 4, flexShrink: 0 },
  annoSection: { paddingTop: Spacing.two },
  annoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', marginHorizontal: Spacing.four, marginTop: Spacing.two,
    borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8,
    textTransform: 'uppercase', marginHorizontal: Spacing.four, marginTop: Spacing.two, marginBottom: 2,
  },
});
