import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { sendNotifications } from '@/utils/notify';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { Spacing } from '@/constants/theme';
import type { Announcement, AnnouncementType } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';
const Tap = TouchableOpacity as any;

type TargetRole = 'all' | 'learner' | 'guardian' | 'tutor';

const TYPE_CFG: Record<AnnouncementType, { label: string; color: string; bg: string }> = {
  general: { label: 'General',  color: '#1565C0', bg: '#EFF6FF' },
  event:   { label: 'Event',    color: '#7C3AED', bg: '#F5F3FF' },
  urgent:  { label: 'Urgent',   color: '#DC2626', bg: '#FEF2F2' },
  payment: { label: 'Payment',  color: '#D97706', bg: '#FFFBEB' },
  exam:    { label: 'Exam',     color: '#059669', bg: '#F0FDF4' },
};

const ROLE_OPTS: { key: TargetRole; label: string }[] = [
  { key: 'all',      label: 'Everyone' },
  { key: 'learner',  label: 'Learners' },
  { key: 'guardian', label: 'Guardians' },
  { key: 'tutor',    label: 'Tutors' },
];

const TYPE_OPTS: { key: AnnouncementType; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'event',   label: 'Event' },
  { key: 'urgent',  label: 'Urgent' },
  { key: 'payment', label: 'Payment' },
  { key: 'exam',    label: 'Exam' },
];

export default function AdminAnnouncements() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [type, setType]         = useState<AnnouncementType>('general');
  const [target, setTarget]     = useState<TargetRole>('all');

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  }

  function openForm() {
    setTitle(''); setBody(''); setType('general'); setTarget('all');
    setShowForm(true);
  }

  async function send() {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!body.trim())  return Alert.alert('Required', 'Please enter a message.');
    setSaving(true);
    try {
      // Insert announcement
      const { data: ann, error } = await supabase
        .from('announcements')
        .insert({
          title: title.trim(),
          body: body.trim(),
          type,
          target_role: target === 'all' ? null : target,
          active: true,
          published_at: new Date().toISOString(),
          cta_label: '',
          cta_route: '',
          created_by: profile?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Fetch matching profiles to send in-app notifications
      let q = supabase.from('profiles').select('id');
      if (target !== 'all') q = q.eq('role', target);
      const { data: profiles } = await q;

      const ids = (profiles ?? []).map((p: { id: string }) => p.id);
      if (ids.length) {
        await sendNotifications(ids, title.trim(), body.trim(), 'announcement');
      }

      setItems(prev => [ann as Announcement, ...prev]);
      setShowForm(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: Announcement) {
    const next = !a.active;
    await supabase.from('announcements').update({ active: next }).eq('id', a.id);
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, active: next } : x));
  }

  async function deleteAnn(a: Announcement) {
    Alert.alert('Delete', `Delete "${a.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('announcements').delete().eq('id', a.id);
          setItems(prev => prev.filter(x => x.id !== a.id));
        },
      },
    ]);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <ThemedText style={s.title}>Announcements</ThemedText>
          <ThemedText style={s.subtitle}>{items.length} total</ThemedText>
        </View>
        <Tap style={s.addBtn} onPress={openForm} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <ThemedText style={s.addText}>New</ThemedText>
        </Tap>
      </View>

      {loading ? (
        <LoadingDots style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={a => a.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="megaphone-outline" size={44} color="#D1D5DB" />
              <ThemedText style={s.emptyText}>No announcements yet</ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.general;
            const roleLabel = item.target_role
              ? ROLE_OPTS.find(r => r.key === item.target_role)?.label ?? item.target_role
              : 'Everyone';
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.typeTag, { backgroundColor: cfg.bg }]}>
                    <ThemedText style={[s.typeTagText, { color: cfg.color }]}>{cfg.label}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={s.cardTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <ThemedText style={s.cardSub}>→ {roleLabel} · {fmtDate(item.created_at)}</ThemedText>
                  </View>
                  <View style={[s.statusChip, item.active ? s.activeChip : s.inactiveChip]}>
                    <ThemedText style={[s.statusText, { color: item.active ? '#065F46' : '#9CA3AF' }]}>
                      {item.active ? 'Live' : 'Off'}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={s.cardBody} numberOfLines={2}>{item.body}</ThemedText>
                <View style={s.actions}>
                  <Pressable style={[s.actionBtn, item.active ? s.deactivateBtn : s.activateBtn]}
                    onPress={() => toggleActive(item)}>
                    <Ionicons name={item.active ? 'eye-off-outline' : 'eye-outline'} size={13}
                      color={item.active ? '#6B7280' : PRIMARY} />
                    <ThemedText style={[s.actionText, { color: item.active ? '#6B7280' : PRIMARY }]}>
                      {item.active ? 'Deactivate' : 'Activate'}
                    </ThemedText>
                  </Pressable>
                  <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => deleteAnn(item)}>
                    <Ionicons name="trash-outline" size={13} color="#DC2626" />
                    <ThemedText style={[s.actionText, { color: '#DC2626' }]}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Compose modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalBar}>
              <ThemedText style={s.modalTitle}>New Announcement</ThemedText>
              <Pressable onPress={() => setShowForm(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Target audience */}
              <ThemedText style={s.fieldLabel}>SEND TO</ThemedText>
              <View style={s.pillRow}>
                {ROLE_OPTS.map(r => (
                  <Pressable key={r.key}
                    style={[s.pill, target === r.key && s.pillActive]}
                    onPress={() => setTarget(r.key)}>
                    <ThemedText style={[s.pillText, target === r.key && s.pillTextActive]}>
                      {r.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {/* Type */}
              <ThemedText style={s.fieldLabel}>TYPE</ThemedText>
              <View style={s.pillRow}>
                {TYPE_OPTS.map(t => (
                  <Pressable key={t.key}
                    style={[s.pill, type === t.key && s.pillActive]}
                    onPress={() => setType(t.key)}>
                    <ThemedText style={[s.pillText, type === t.key && s.pillTextActive]}>
                      {t.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {/* Title */}
              <ThemedText style={s.fieldLabel}>TITLE</ThemedText>
              <TextInput
                style={s.input}
                placeholder="e.g. School closed Friday"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />

              {/* Message */}
              <ThemedText style={s.fieldLabel}>MESSAGE</ThemedText>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Write your message here…"
                placeholderTextColor="#9CA3AF"
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Tap style={[s.sendBtn, saving && { opacity: 0.6 }]} onPress={send} activeOpacity={0.85} disabled={saving}>
                {saving
                  ? <LoadingDots color="#fff" />
                  : <><Ionicons name="send-outline" size={16} color="#fff" />
                    <ThemedText style={s.sendText}>Send Announcement</ThemedText></>}
              </Tap>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PRIMARY, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  list: { paddingHorizontal: Spacing.four, paddingBottom: 40 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  card: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeTagText: { fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  cardBody: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  activeChip: { backgroundColor: '#D1FAE5' },
  inactiveChip: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: '700' },
  activateBtn: { borderColor: PRIMARY + '40', backgroundColor: PRIMARY + '08' },
  deactivateBtn: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  deleteBtn: { borderColor: '#FECACA', backgroundColor: '#FEF2F2', marginLeft: 'auto' as any },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  modalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8, marginTop: Spacing.two },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  pillTextActive: { color: '#fff' },

  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 4 },
  inputMulti: { height: 110, paddingTop: 12 },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 8, paddingVertical: 14, marginTop: Spacing.three, marginBottom: Spacing.two },
  sendText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
