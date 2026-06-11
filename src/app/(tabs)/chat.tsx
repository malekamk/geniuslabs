import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { supabase } from '@/utils/supabase';
import { BottomTabInset, Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';
const Touchable = TouchableOpacity as any;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SUBJECT_ICONS: Record<string, IoniconName> = {
  Mathematics: 'calculator-outline',
  'Mathematical Literacy': 'trending-up-outline',
  'Physical Sciences': 'flask-outline',
  'Life Sciences': 'bug-outline',
  'Natural Sciences': 'leaf-outline',
  English: 'reader-outline',
  Afrikaans: 'chatbubble-outline',
  Accounting: 'cash-outline',
  'Business Studies': 'briefcase-outline',
  Geography: 'map-outline',
  History: 'time-outline',
};

type ChatGroup = {
  subjectId: string;
  grade: string;
  subjectName: string;
  last_message: string | null;
  last_sender: string | null;
  last_at: string | null;
  unread: boolean;
};

function readKey(subjectId: string, grade: string) {
  return `chat_read_${subjectId}_${grade}`;
}

export default function ChatScreen() {
  const { profile } = useAuth();
  const { markChatRead } = useNotifications();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    markChatRead();
    fetchGroups();
  }, [profile?.id, profile?.subjects?.join(','), profile?.grades?.join(',')]));

  async function fetchGroups() {
    setLoading(true);
    let pairs: { subject_id: string; grade: string }[] = [];

    if (profile!.role === 'tutor') {
      const subjectNames = profile!.subjects ?? [];
      const grades = profile!.grades ?? [];
      if (subjectNames.length && grades.length) {
        const { data: subjectRows } = await supabase.from('subjects').select('id, name').in('name', subjectNames);
        for (const s of subjectRows ?? [])
          for (const g of grades as string[])
            pairs.push({ subject_id: s.id, grade: g });
      }
    } else if (profile!.role === 'learner') {
      const { data: learnerRow } = await supabase
        .from('learners').select('id, grade, full_name').eq('profile_id', profile!.id).single();
      if (learnerRow) {
        let { data: apps } = await supabase
          .from('enrolment_applications').select('subjects').eq('learner_id', learnerRow.id).limit(1);
        if (!apps?.length) {
          const { data } = await supabase
            .from('enrolment_applications').select('subjects')
            .ilike('learner_name', learnerRow.full_name.trim()).limit(1);
          apps = data;
        }
        const subjectNames: string[] = apps?.[0]?.subjects ?? [];
        if (subjectNames.length) {
          const { data: subjectRows } = await supabase.from('subjects').select('id, name').in('name', subjectNames);
          for (const s of subjectRows ?? [])
            pairs.push({ subject_id: s.id, grade: learnerRow.grade });
        }
      }
    }

    if (!pairs.length) { setGroups([]); setLoading(false); return; }

    const subjectIds = [...new Set(pairs.map(p => p.subject_id))];
    const { data: subjects } = await supabase.from('subjects').select('id, name').in('id', subjectIds);
    const subjectMap: Record<string, string> = {};
    for (const s of subjects ?? []) subjectMap[s.id] = s.name;

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id, subject_id, grade, chat_room_messages(content, created_at, sender_id, sender:profiles!chat_room_messages_sender_id_fkey(full_name))')
      .in('subject_id', subjectIds);

    const lastByPair: Record<string, { content: string; created_at: string; sender_name: string }> = {};
    for (const room of rooms ?? []) {
      const msgs: any[] = (room as any).chat_room_messages ?? [];
      if (msgs.length) {
        const latest = msgs.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];
        lastByPair[`${room.subject_id}|${room.grade}`] = {
          content: latest.content,
          created_at: latest.created_at,
          sender_name: latest.sender?.full_name ?? 'Someone',
        };
      }
    }

    // Load read timestamps from AsyncStorage
    const keys = pairs.map(p => readKey(p.subject_id, p.grade));
    const stored = await AsyncStorage.multiGet(keys);
    const readMap: Record<string, string | null> = {};
    stored.forEach(([k, v]) => { readMap[k] = v; });

    const built: ChatGroup[] = pairs.map(p => {
      const last = lastByPair[`${p.subject_id}|${p.grade}`];
      const lastRead = readMap[readKey(p.subject_id, p.grade)] ?? null;
      const unread = !!last && (!lastRead || last.created_at > lastRead);
      return {
        subjectId: p.subject_id,
        grade: p.grade,
        subjectName: subjectMap[p.subject_id] ?? 'Subject',
        last_message: last?.content ?? null,
        last_sender: last?.sender_name ?? null,
        last_at: last?.created_at ?? null,
        unread,
      };
    });

    // Sort: unread first, then by most recent message
    built.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      if (!a.last_at && !b.last_at) return 0;
      if (!a.last_at) return 1;
      if (!b.last_at) return -1;
      return b.last_at.localeCompare(a.last_at);
    });

    setGroups(built);
    setLoading(false);
  }

  const unreadCount = groups.filter(g => g.unread).length;
  const paddingTop = Platform.select({ web: Spacing.six, default: insets.top });

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <ThemedText style={styles.title}>Chats</ThemedText>
        {unreadCount > 0 && (
          <View style={styles.countBadge}>
            <ThemedText style={styles.countText}>{unreadCount}</ThemedText>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PRIMARY} />
          <ThemedText style={styles.loadingText}>Loading your groups…</ThemedText>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={36} color={PRIMARY} />
          </View>
          <ThemedText style={styles.emptyTitle}>No chats yet</ThemedText>
          <ThemedText style={styles.emptySub}>Your subject group chats will appear here once your profile is set up.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g: ChatGroup) => `${g.subjectId}|${g.grade}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + BottomTabInset + Spacing.three, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }: { item: ChatGroup }) => (
            <ChatRow item={item} onOpen={() => {
              // Mark as read
              AsyncStorage.setItem(readKey(item.subjectId, item.grade), item.last_at ?? new Date().toISOString());
              setGroups(prev => prev.map(g =>
                g.subjectId === item.subjectId && g.grade === item.grade ? { ...g, unread: false } : g
              ));
            }} />
          )}
        />
      )}
    </View>
  );
}

function ChatRow({ item, onOpen }: { item: ChatGroup; onOpen: () => void }) {
  const icon: IoniconName = SUBJECT_ICONS[item.subjectName] ?? 'book-outline';

  return (
    <Touchable
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => {
        onOpen();
        router.push({ pathname: '/chat-room', params: { subjectId: item.subjectId, grade: item.grade, subjectName: item.subjectName } });
      }}>

      {/* Avatar with unread dot */}
      <View>
        <View style={styles.avatar}>
          <Ionicons name={icon} size={22} color="#4B6CB7" />
        </View>
        {item.unread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <ThemedText style={[styles.rowTitle, item.unread && styles.rowTitleUnread]} numberOfLines={1}>
            {item.subjectName}
          </ThemedText>
          {item.last_at && <ThemedText style={styles.rowTime}>{fmtTime(item.last_at)}</ThemedText>}
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.gradePill}>
            <ThemedText style={styles.gradeText}>Gr {item.grade}</ThemedText>
          </View>
          <ThemedText style={[styles.preview, item.unread && styles.previewUnread]} numberOfLines={1}>
            {item.last_message
              ? `${item.last_sender ?? 'You'}: ${item.last_message}`
              : 'No messages yet — say hi!'}
          </ThemedText>
        </View>
      </View>

      {item.unread
        ? <View style={styles.unreadBadge}><ThemedText style={styles.unreadBadgeText}>•</ThemedText></View>
        : <Ionicons name="chevron-forward" size={15} color="#D1D5DB" />}
    </Touchable>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  countBadge: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'center' },
  countText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: PRIMARY + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 76 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: Spacing.four, paddingVertical: 14, gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF2F8' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#fff' },
  rowBody: { flex: 1, gap: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  rowTitleUnread: { fontWeight: '800' },
  rowTime: { fontSize: 12, color: '#9CA3AF', marginLeft: 6 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  gradePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexShrink: 0, backgroundColor: '#F3F4F6' },
  gradeText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  preview: { flex: 1, fontSize: 13, color: '#9CA3AF' },
  previewUnread: { color: '#111827', fontWeight: '600' },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { fontSize: 18, color: '#fff', lineHeight: 20, fontWeight: '900' },
});
