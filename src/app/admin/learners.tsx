import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList, Linking, Modal,
  Pressable, ScrollView, StyleSheet, Switch, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { supabase } from '@/utils/supabase';
import { Spacing } from '@/constants/theme';
import type { Learner, EnrolmentApplication } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

const APP_STATUS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
};

export default function AdminLearners() {
  const insets = useSafeAreaInsets();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Learner | null>(null);
  const [selApp, setSelApp] = useState<EnrolmentApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(false);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase.from('learners').select('*').order('created_at', { ascending: false });
    setLearners((data ?? []) as Learner[]);
    setLoading(false);
  }

  async function openDetail(l: Learner) {
    setSelected(l);
    setLoadingApp(true);
    let { data } = await supabase
      .from('enrolment_applications')
      .select('*')
      .eq('learner_id', l.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      const byName = await supabase
        .from('enrolment_applications')
        .select('*')
        .eq('learner_name', l.full_name)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = byName.data;
    }
    setSelApp(data as EnrolmentApplication | null);
    setLoadingApp(false);
  }

  async function toggleActive(l: Learner) {
    const next = !l.is_active;
    Alert.alert(
      next ? 'Activate Learner' : 'Deactivate Learner',
      `${next ? 'Activate' : 'Deactivate'} ${l.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Activate' : 'Deactivate',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            await supabase.from('learners').update({ is_active: next }).eq('id', l.id);
            setLearners(prev => prev.map(x => x.id === l.id ? { ...x, is_active: next } : x));
            if (selected?.id === l.id) setSelected({ ...l, is_active: next });
          },
        },
      ]
    );
  }

  const filtered = learners.filter(l =>
    l.full_name.toLowerCase().includes(search.toLowerCase()) ||
    l.grade.toLowerCase().includes(search.toLowerCase()) ||
    (l.school_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const DOCS = [
    { key: 'birth_cert_url',   label: 'Birth Certificate / ID' },
    { key: 'school_report_url', label: 'School Report' },
    { key: 'additional_file_url', label: 'Additional Document' },
  ] as const;

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <ThemedText style={s.title}>Learners</ThemedText>
        <View style={s.badge}><ThemedText style={s.badgeText}>{learners.length}</ThemedText></View>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, grade, school…"
          placeholderTextColor="#9CA3AF"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <LoadingDots style={{ marginTop: 40, alignSelf: 'center' }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={l => l.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="school-outline" size={40} color="#D1D5DB" />
              <ThemedText style={s.emptyText}>No learners found</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[s.card, !item.is_active && { opacity: 0.55 }]} onPress={() => openDetail(item)}>
              <View style={s.avatar}>
                <ThemedText style={s.avatarText}>{item.full_name[0].toUpperCase()}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={s.name}>{item.full_name}</ThemedText>
                <ThemedText style={s.sub}>{item.grade}{item.school_name ? ` · ${item.school_name}` : ''}</ThemedText>
              </View>
              <Switch
                value={item.is_active}
                onValueChange={() => toggleActive(item)}
                trackColor={{ false: '#D1D5DB', true: PRIMARY + '80' }}
                thumbColor={item.is_active ? PRIMARY : '#9CA3AF'}
              />
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </Pressable>
          )}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <View style={s.avatar}>
                <ThemedText style={s.avatarText}>{selected.full_name[0].toUpperCase()}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={s.modalTitle}>{selected.full_name}</ThemedText>
                <ThemedText style={s.modalSub}>{selected.grade}</ThemedText>
              </View>
              <Pressable onPress={() => setSelected(null)} style={s.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>

              {/* Details */}
              <ThemedText style={s.sec}>DETAILS</ThemedText>
              <View style={s.infoCard}>
                {[
                  { icon: 'school-outline',    label: 'Grade',  value: selected.grade },
                  { icon: 'business-outline',  label: 'School', value: selected.school_name ?? '—' },
                  { icon: 'calendar-outline',  label: 'DOB',    value: selected.date_of_birth ?? '—' },
                  { icon: 'ellipse-outline',   label: 'Status', value: selected.is_active ? 'Active' : 'Inactive' },
                ].map((r, i, arr) => (
                  <View key={r.label}>
                    <View style={s.infoRow}>
                      <Ionicons name={r.icon as any} size={14} color="#9CA3AF" style={{ width: 18 }} />
                      <ThemedText style={s.infoLabel}>{r.label}</ThemedText>
                      <ThemedText style={s.infoValue}>{r.value}</ThemedText>
                    </View>
                    {i < arr.length - 1 && <View style={s.divider} />}
                  </View>
                ))}
              </View>

              {/* Application */}
              <ThemedText style={s.sec}>ENROLMENT APPLICATION</ThemedText>
              {loadingApp ? (
                <LoadingDots style={{ marginVertical: 12, alignSelf: 'center' }} />
              ) : selApp ? (
                <View style={s.infoCard}>
                  <View style={s.infoRow}>
                    <Ionicons name="document-text-outline" size={14} color="#9CA3AF" style={{ width: 18 }} />
                    <ThemedText style={s.infoLabel}>Status</ThemedText>
                    <View style={[s.chip, { backgroundColor: APP_STATUS[selApp.status]?.bg }]}>
                      <ThemedText style={[s.chipText, { color: APP_STATUS[selApp.status]?.text }]}>{selApp.status}</ThemedText>
                    </View>
                  </View>
                  {selApp.submitted_at && (
                    <>
                      <View style={s.divider} />
                      <View style={s.infoRow}>
                        <Ionicons name="calendar-outline" size={14} color="#9CA3AF" style={{ width: 18 }} />
                        <ThemedText style={s.infoLabel}>Submitted</ThemedText>
                        <ThemedText style={s.infoValue}>{new Date(selApp.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</ThemedText>
                      </View>
                    </>
                  )}
                  {selApp.subjects?.length > 0 && (
                    <>
                      <View style={s.divider} />
                      <View style={[s.infoRow, { alignItems: 'flex-start' }]}>
                        <Ionicons name="book-outline" size={14} color="#9CA3AF" style={{ width: 18, marginTop: 2 }} />
                        <ThemedText style={s.infoLabel}>Subjects</ThemedText>
                        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          {selApp.subjects.map(sub => (
                            <View key={sub} style={s.pill}>
                              <ThemedText style={s.pillText}>{sub}</ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              ) : (
                <View style={s.noApp}>
                  <ThemedText style={s.noAppText}>No application found for this learner.</ThemedText>
                </View>
              )}

              {/* Documents */}
              <ThemedText style={s.sec}>DOCUMENTS</ThemedText>
              {selApp && DOCS.some(d => selApp[d.key]) ? (
                <View style={s.infoCard}>
                  {DOCS.filter(d => selApp[d.key]).map((d, i, arr) => (
                    <View key={d.key}>
                      <Pressable style={s.docRow} onPress={() => Linking.openURL(selApp[d.key]!)}>
                        <Ionicons name="document-attach-outline" size={16} color={PRIMARY} />
                        <ThemedText style={s.docLabel}>{d.label}</ThemedText>
                        <Ionicons name="open-outline" size={14} color="#9CA3AF" />
                      </Pressable>
                      {i < arr.length - 1 && <View style={s.divider} />}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.noApp}>
                  <ThemedText style={s.noAppText}>No documents submitted yet.</ThemedText>
                </View>
              )}

              {/* Activate / Deactivate */}
              <Pressable
                style={[s.toggleBtn, selected.is_active ? s.deactivateBtn : s.activateBtn]}
                onPress={() => toggleActive(selected)}>
                <Ionicons
                  name={selected.is_active ? 'ban-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={selected.is_active ? '#DC2626' : '#16A34A'}
                />
                <ThemedText style={[s.toggleBtnText, { color: selected.is_active ? '#DC2626' : '#16A34A' }]}>
                  {selected.is_active ? 'Deactivate Learner' : 'Activate Learner'}
                </ThemedText>
              </Pressable>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', flex: 1 },
  badge: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.four, marginBottom: Spacing.two,
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  list: { paddingHorizontal: Spacing.four, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  avatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.four, paddingTop: 24,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 999 },
  modalBody: { padding: Spacing.four, gap: Spacing.two },

  sec: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginTop: 4, marginBottom: 4 },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  infoLabel: { fontSize: 13, color: '#9CA3AF', width: 72 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 14 },

  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  pill: { backgroundColor: PRIMARY + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '600', color: PRIMARY },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: PRIMARY },

  noApp: { backgroundColor: '#fff', borderRadius: 8, padding: 16, alignItems: 'center' },
  noAppText: { fontSize: 13, color: '#9CA3AF' },

  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 8, paddingVertical: 13, marginTop: 8,
    borderWidth: 1.5,
  },
  toggleBtnText: { fontSize: 14, fontWeight: '700' },
  activateBtn: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  deactivateBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
});
