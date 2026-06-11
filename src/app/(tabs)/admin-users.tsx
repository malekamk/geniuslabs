import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { Profile } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type RoleFilter = 'learner' | 'tutor' | 'guardian';
const TABS: { key: RoleFilter; label: string; color: string }[] = [
  { key: 'learner',  label: 'Learners',  color: '#059669' },
  { key: 'tutor',    label: 'Tutors',    color: '#1565C0' },
  { key: 'guardian', label: 'Guardians', color: '#7C3AED' },
];

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<RoleFilter>('learner');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchUsers(); }, [tab]));

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', tab)
      .order('created_at', { ascending: false });
    setUsers((data ?? []) as Profile[]);
    setLoading(false);
  }

  async function toggleActive(user: Profile) {
    const next = !user.is_active;
    Alert.alert(
      next ? 'Activate User' : 'Deactivate User',
      `${next ? 'Activate' : 'Deactivate'} ${user.full_name ?? 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Activate' : 'Deactivate',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            await supabase.from('profiles').update({ is_active: next }).eq('id', user.id);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: next } : u));
          },
        },
      ]
    );
  }

  const activeTab = TABS.find(t => t.key === tab)!;
  const paddingTop = insets.top + Spacing.three;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <ThemedText style={styles.title}>Users</ThemedText>
        <View style={[styles.countBadge, { backgroundColor: activeTab.color }]}>
          <ThemedText style={styles.countText}>{users.length}</ThemedText>
        </View>
      </View>

      {/* Role tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <Pressable key={t.key} style={[styles.tabPill, tab === t.key && { backgroundColor: t.color }]}
            onPress={() => setTab(t.key)}>
            <ThemedText style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color="#D1D5DB" />
          <ThemedText style={styles.emptyText}>No {tab}s yet</ThemedText>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.three, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_active && styles.cardInactive]}>
              <View style={[styles.avatar, { backgroundColor: activeTab.color + '20' }]}>
                <ThemedText style={[styles.avatarText, { color: activeTab.color }]}>
                  {initials(item.full_name)}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.name} numberOfLines={1}>{item.full_name ?? '—'}</ThemedText>
                {item.role === 'tutor' && item.subjects && item.subjects.length > 0 && (
                  <ThemedText style={styles.sub} numberOfLines={1}>{item.subjects.join(' · ')}</ThemedText>
                )}
                {item.role === 'tutor' && item.grades && item.grades.length > 0 && (
                  <ThemedText style={styles.sub2}>{item.grades.join(', ')}</ThemedText>
                )}
                <ThemedText style={styles.joined}>
                  Joined {new Date(item.created_at).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                </ThemedText>
              </View>
              <Switch
                value={item.is_active}
                onValueChange={() => toggleActive(item)}
                trackColor={{ false: '#D1D5DB', true: activeTab.color + '80' }}
                thumbColor={item.is_active ? activeTab.color : '#9CA3AF'}
              />
            </View>
          )}
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
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.two, marginBottom: Spacing.two },
  tabPill: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardInactive: { opacity: 0.5 },
  avatar: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sub2: { fontSize: 11, color: '#9CA3AF' },
  joined: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});
