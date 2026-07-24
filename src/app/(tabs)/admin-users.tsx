import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { EmptyState } from '@/components/empty-state';
import { supabase, getFunctionErrorMessage } from '@/utils/supabase';
import { log } from '@/utils/logger';
import { useAuth } from '@/context/auth-context';
import { useTopInset } from '@/hooks/use-top-inset';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { Profile } from '@/types/db';

import TeamIllustration from '@/assets/illustrations/team.svg';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type RoleFilter = 'learner' | 'tutor' | 'guardian' | 'admin';
const TABS: { key: RoleFilter; label: string; color: string }[] = [
  { key: 'learner',  label: 'Learners',  color: '#059669' },
  { key: 'tutor',    label: 'Tutors',    color: '#1565C0' },
  { key: 'guardian', label: 'Guardians', color: '#7C3AED' },
  { key: 'admin',    label: 'Admins',    color: '#DC2626' },
];

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { profile, loginAs } = useAuth();
  const [tab, setTab] = useState<RoleFilter>('learner');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

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

  function toggleActive(user: Profile) {
    if (user.id === profile?.id) {
      Alert.alert('Not Allowed', "You can't deactivate your own account.");
      return;
    }
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

  function loginAsUser(user: Profile) {
    Alert.alert(
      'Login As',
      `View the app as ${user.full_name ?? 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Login As',
          onPress: () => {
            loginAs(user);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  function promoteToAdmin(user: Profile) {
    Alert.alert(
      'Make Admin',
      `Give ${user.full_name ?? 'this user'} full admin access? This can't be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Admin',
          onPress: async () => {
            setPromotingId(user.id);
            const { data, error } = await supabase.functions.invoke('set-user-role', {
              body: { userId: user.id, role: 'admin' },
            });
            setPromotingId(null);
            if (error || data?.error) {
              const message = await getFunctionErrorMessage(error, data);
              log.error('AdminUsers', 'set-user-role failed', { message });
              Alert.alert('Error', message);
              return;
            }
            log.ok('AdminUsers', 'Promoted to admin', { userId: user.id });
            setUsers(prev => prev.filter(u => u.id !== user.id));
          },
        },
      ]
    );
  }

  function addStaff() {
    Alert.alert('Add Staff', 'What would you like to add?', [
      { text: 'Add Tutor', onPress: () => router.push({ pathname: '/admin/add-staff', params: { role: 'tutor' } }) },
      { text: 'Add Admin', onPress: () => router.push({ pathname: '/admin/add-staff', params: { role: 'admin' } }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const activeTab = TABS.find(t => t.key === tab)!;
  const paddingTop = topInset + Spacing.three;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <ThemedText style={styles.title}>Users</ThemedText>
        <View style={[styles.countBadge, { backgroundColor: activeTab.color }]}>
          <ThemedText style={styles.countText}>{users.length}</ThemedText>
        </View>
        <Pressable style={styles.addBtn} onPress={addStaff} hitSlop={10}>
          <Ionicons name="add" size={22} color={PRIMARY} />
        </Pressable>
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
        <LoadingDots style={{ marginTop: 40 }} />
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState illustration={TeamIllustration} title={`No ${tab}s yet`} sub="They'll show up here once added." />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.three, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, !item.is_active && styles.cardInactive]}
              onPress={() => setSelectedUser(item)}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: activeTab.color + '20' }]}>
                  <ThemedText style={[styles.avatarText, { color: activeTab.color }]}>
                    {initials(item.full_name)}
                  </ThemedText>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.name} numberOfLines={1}>{item.full_name ?? '—'}</ThemedText>
                {item.email && (
                  <ThemedText style={styles.sub} numberOfLines={1}>{item.email}</ThemedText>
                )}
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
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={!!selectedUser}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedUser(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedUser && (
              <>
                {selectedUser.avatar_url ? (
                  <Image source={{ uri: selectedUser.avatar_url }} style={styles.modalAvatar} />
                ) : (
                  <View style={[styles.modalAvatar, { backgroundColor: activeTab.color + '20' }]}>
                    <ThemedText style={[styles.modalAvatarText, { color: activeTab.color }]}>
                      {initials(selectedUser.full_name)}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={styles.modalName} numberOfLines={1}>{selectedUser.full_name ?? '—'}</ThemedText>
                {selectedUser.email && (
                  <ThemedText style={styles.modalEmail} numberOfLines={1}>{selectedUser.email}</ThemedText>
                )}
                <View style={styles.modalActions}>
                  {selectedUser.id !== profile?.id && (
                    <Pressable
                      style={styles.modalBtn}
                      onPress={() => { const u = selectedUser; setSelectedUser(null); loginAsUser(u); }}>
                      <Ionicons name="log-in-outline" size={16} color="#fff" />
                      <ThemedText style={styles.modalBtnText}>Login As</ThemedText>
                    </Pressable>
                  )}
                  {tab !== 'admin' && (
                    <Pressable
                      style={styles.modalBtn}
                      disabled={promotingId === selectedUser.id}
                      onPress={() => { const u = selectedUser; setSelectedUser(null); promoteToAdmin(u); }}>
                      {promotingId === selectedUser.id ? (
                        <LoadingDots size={5} color="#fff" />
                      ) : (
                        <>
                          {/* <Ionicons name="shield-checkmark-outline" size={16} color="#fff" /> */}
                          <ThemedText style={styles.modalBtnText}>Make Admin</ThemedText>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'center' },
  addBtn: { marginLeft: 'auto', padding: 4 },
  countText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.two, marginBottom: Spacing.two },
  tabPill: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardInactive: { opacity: 0.5 },
  avatar: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sub2: { fontSize: 11, color: '#9CA3AF' },
  joined: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four,
  },
  modalCard: {
    width: '100%', maxWidth: 350, backgroundColor: '#fff', borderRadius: 20,
    paddingVertical: Spacing.four, paddingHorizontal: Spacing.four, alignItems: 'center',
  },
  modalAvatar: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three,
  },
  modalAvatarText: { fontSize: 32, fontWeight: '800' },
  modalName: { fontSize: 18, fontWeight: '800', color: '#111827', maxWidth: '100%' },
  modalEmail: { fontSize: 13, color: '#6B7280', marginTop: 4, maxWidth: '100%' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.four, width: '100%' },
  modalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#000', borderRadius: 10, paddingVertical: 12,
  },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
