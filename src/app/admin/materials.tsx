import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/utils/supabase';
import { sendNotifications } from '@/utils/notify';
import { Spacing } from '@/constants/theme';
import type { Material, MaterialType } from '@/types/db';

import LibraryIllustration from '@/assets/illustrations/library.svg';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

const TYPE_CFG: Record<MaterialType, { label: string; color: string; bg: string }> = {
  pdf:        { label: 'PDF',        color: '#1565C0', bg: '#EFF6FF' },
  video:      { label: 'Video',      color: '#7C3AED', bg: '#F5F3FF' },
  notes:      { label: 'Notes',      color: '#059669', bg: '#F0FDF4' },
  worksheet:  { label: 'Worksheet',  color: '#D97706', bg: '#FFFBEB' },
  exam_paper: { label: 'Exam Paper', color: '#DC2626', bg: '#FEF2F2' },
};

type Filter = 'all' | MaterialType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'pdf',        label: 'PDF' },
  { key: 'video',      label: 'Video' },
  { key: 'notes',      label: 'Notes' },
  { key: 'worksheet',  label: 'Worksheet' },
  { key: 'exam_paper', label: 'Exam' },
];

export default function AdminMaterials() {
  const insets = useSafeAreaInsets();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });
    setMaterials((data ?? []) as Material[]);
    setLoading(false);
  }

  async function togglePublish(m: Material) {
    const next = !m.is_published;
    await supabase.from('materials').update({ is_published: next }).eq('id', m.id);
    setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, is_published: next } : x));

    // Notify learners + tutors when publishing (not unpublishing)
    if (next) {
      const { data: profiles } = await supabase
        .from('profiles').select('id').in('role', ['learner', 'tutor']).eq('is_active', true);
      const ids = (profiles ?? []).map((p: { id: string }) => p.id);
      if (ids.length) {
        await sendNotifications(ids, 'New Material Available', `"${m.title}" (Grade ${m.grade}) has been published.`, 'new_material');
      }
    }
  }

  async function deleteMaterial(m: Material) {
    Alert.alert('Delete Material', `Delete "${m.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('materials').delete().eq('id', m.id);
          if (error) { Alert.alert('Error', error.message); return; }
          setMaterials(prev => prev.filter(x => x.id !== m.id));
        },
      },
    ]);
  }

  const filtered = filter === 'all' ? materials : materials.filter(m => m.type === filter);
  const publishedCount = materials.filter(m => m.is_published).length;

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={s.title}>Materials</ThemedText>
          <ThemedText style={s.subtitle}>{publishedCount} published · {materials.length - publishedCount} drafts</ThemedText>
        </View>
        <View style={s.badge}><ThemedText style={s.badgeText}>{filtered.length}</ThemedText></View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}>
        {FILTERS.map(f => (
          <Pressable key={f.key} style={[s.filterPill, filter === f.key && s.filterActive]}
            onPress={() => setFilter(f.key)}>
            <ThemedText style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <LoadingDots style={{ marginTop: 40, alignSelf: 'center' }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <EmptyState illustration={LibraryIllustration} title="No materials found" sub="Study resources you add will show up here." />
            </View>
          }
          renderItem={({ item }) => {
            const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.pdf;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.typeTag, { backgroundColor: cfg.bg }]}>
                    <ThemedText style={[s.typeTagText, { color: cfg.color }]}>{cfg.label}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={s.matTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <ThemedText style={s.matSub}>{item.grade}{item.subject ? ` · ${(item as any).subject}` : ''}</ThemedText>
                  </View>
                  <View style={[s.pubChip, item.is_published ? s.pubChipOn : s.pubChipOff]}>
                    <ThemedText style={[s.pubChipText, { color: item.is_published ? '#065F46' : '#9CA3AF' }]}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </ThemedText>
                  </View>
                </View>

                <View style={s.actions}>
                  <Pressable style={[s.actionBtn, item.is_published ? s.unpublishBtn : s.publishBtn]}
                    onPress={() => togglePublish(item)}>
                    <Ionicons
                      name={item.is_published ? 'eye-off-outline' : 'eye-outline'}
                      size={14}
                      color={item.is_published ? '#6B7280' : PRIMARY}
                    />
                    <ThemedText style={[s.actionBtnText, { color: item.is_published ? '#6B7280' : PRIMARY }]}>
                      {item.is_published ? 'Unpublish' : 'Publish'}
                    </ThemedText>
                  </Pressable>

                  {(item.file_url || item.external_url) && (
                    <Pressable style={[s.actionBtn, s.openBtn]}
                      onPress={() => Linking.openURL(item.file_url ?? item.external_url!)}>
                      <Ionicons name="open-outline" size={14} color="#0369A1" />
                      <ThemedText style={[s.actionBtnText, { color: '#0369A1' }]}>Open</ThemedText>
                    </Pressable>
                  )}

                  <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => deleteMaterial(item)}>
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                    <ThemedText style={[s.actionBtnText, { color: '#DC2626' }]}>Delete</ThemedText>
                  </Pressable>
                </View>
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
  badge: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  filterRow: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, gap: 8 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#111827', borderColor: '#111827' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },

  list: { paddingHorizontal: Spacing.four, paddingBottom: 40 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  typeTagText: { fontSize: 11, fontWeight: '700' },
  matTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  matSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pubChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pubChipOn: { backgroundColor: '#D1FAE5' },
  pubChipOff: { backgroundColor: '#F3F4F6' },
  pubChipText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  publishBtn: { borderColor: PRIMARY + '40', backgroundColor: PRIMARY + '08' },
  unpublishBtn: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  openBtn: { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' },
  deleteBtn: { borderColor: '#FECACA', backgroundColor: '#FEF2F2', marginLeft: 'auto' as any },
});
