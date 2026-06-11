import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { EnrolmentApplication } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type Filter = 'all' | 'pending' | 'reviewing' | 'approved' | 'rejected';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'approved',  label: 'Approved' },
  { key: 'rejected',  label: 'Rejected' },
];

const STATUS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
};

export default function AdminEnrolments() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [apps, setApps] = useState<EnrolmentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchApps(); }, []));

  async function fetchApps() {
    setLoading(true);
    let q = supabase
      .from('enrolment_applications')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setApps((data ?? []) as EnrolmentApplication[]);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { fetchApps(); }, [filter]));

  const paddingTop = insets.top + Spacing.three;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <ThemedText style={styles.title}>Enrolments</ThemedText>
        <View style={[styles.countBadge, { backgroundColor: PRIMARY }]}>
          <ThemedText style={styles.countText}>{apps.length}</ThemedText>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable key={f.key} style={[styles.filterPill, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}>
            <ThemedText style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : apps.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={40} color="#D1D5DB" />
          <ThemedText style={styles.emptyText}>No {filter === 'all' ? '' : filter} applications</ThemedText>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={a => a.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.three, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => {
            const sc = STATUS[item.status] ?? STATUS.pending;
            return (
              <Pressable style={styles.card}
                onPress={() => router.push({ pathname: '/admin/application-detail', params: { id: item.id } } as any)}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>{item.learner_name[0].toUpperCase()}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.name}>{item.learner_name}</ThemedText>
                    <ThemedText style={styles.sub}>Grade {item.grade} · {item.subjects?.join(', ')}</ThemedText>
                  </View>
                  <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                    <ThemedText style={[styles.chipText, { color: sc.text }]}>{item.status}</ThemedText>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                  <ThemedText style={styles.date}>
                    Submitted {new Date(item.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={14} color="#D1D5DB" style={{ marginLeft: 'auto' }} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'center' },
  countText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.one, marginBottom: Spacing.two, flexWrap: 'wrap' },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#000', borderColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  date: { fontSize: 12, color: '#9CA3AF' },
});
