import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type ClassRow = {
  id: string; title: string; grade: string; subject: string;
  tutor: string; scheduled_at: string | null; live: boolean;
  room: string; created_at: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function isLive(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const now = Date.now();
  return now >= t - 30 * 60_000 && now <= t + 90 * 60_000;
}

export default function AdminClasses() {
  const insets = useSafeAreaInsets();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('classes')
      .select('id, title, grade, subject, tutor, scheduled_at, live, room, created_at')
      .order('scheduled_at', { ascending: false });
    setClasses((data ?? []) as ClassRow[]);
    setLoading(false);
  }

  async function deleteClass(c: ClassRow) {
    Alert.alert('Delete Class', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('classes').delete().eq('id', c.id);
          if (error) { Alert.alert('Error', error.message); return; }
          setClasses(prev => prev.filter(x => x.id !== c.id));
        },
      },
    ]);
  }

  const upcoming = classes.filter(c => c.scheduled_at && new Date(c.scheduled_at) >= new Date());
  const past = classes.filter(c => !c.scheduled_at || new Date(c.scheduled_at) < new Date());

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={s.title}>Classes</ThemedText>
          <ThemedText style={s.subtitle}>{upcoming.length} upcoming · {past.length} past</ThemedText>
        </View>
        <Pressable style={s.addBtn} onPress={() => router.push('/create-class' as any)}>
          <Ionicons name="add" size={18} color="#fff" />
          <ThemedText style={s.addBtnText}>New</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : (
        <FlatList
          data={classes}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="videocam-outline" size={40} color="#D1D5DB" />
              <ThemedText style={s.emptyText}>No classes yet</ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const live = isLive(item.scheduled_at);
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.liveIndicator, live ? s.liveDot : s.scheduledDot]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={s.classTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <ThemedText style={s.classSub}>{item.subject} · {item.grade}</ThemedText>
                  </View>
                  <View style={[s.chip, live ? s.liveChip : s.scheduledChip]}>
                    <ThemedText style={[s.chipText, { color: live ? '#065F46' : '#6B7280' }]}>
                      {live ? 'Live' : 'Scheduled'}
                    </ThemedText>
                  </View>
                </View>

                <View style={s.meta}>
                  <View style={s.metaRow}>
                    <Ionicons name="person-outline" size={12} color="#9CA3AF" />
                    <ThemedText style={s.metaText}>{item.tutor}</ThemedText>
                  </View>
                  <View style={s.metaRow}>
                    <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                    <ThemedText style={s.metaText}>{fmtDate(item.scheduled_at)}</ThemedText>
                  </View>
                  <View style={s.metaRow}>
                    <Ionicons name="link-outline" size={12} color="#9CA3AF" />
                    <ThemedText style={s.metaText} numberOfLines={1}>{item.room}</ThemedText>
                  </View>
                </View>

                <Pressable style={s.deleteBtn} onPress={() => deleteClass(item)}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <ThemedText style={s.deleteBtnText}>Delete Class</ThemedText>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  list: { paddingHorizontal: Spacing.four, paddingBottom: 40 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
  liveDot: { backgroundColor: '#22C55E' },
  scheduledDot: { backgroundColor: '#D1D5DB' },
  classTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  classSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
  liveChip: { backgroundColor: '#D1FAE5' },
  scheduledChip: { backgroundColor: '#F3F4F6' },

  meta: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#6B7280' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});
