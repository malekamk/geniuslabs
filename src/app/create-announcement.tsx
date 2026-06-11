import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import type { AnnouncementType } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

const TYPES: { key: AnnouncementType; label: string; color: string }[] = [
  { key: 'general',  label: 'General',  color: '#6B7280' },
  { key: 'event',    label: 'Event',    color: '#1565C0' },
  { key: 'urgent',   label: 'Urgent',   color: '#DC2626' },
  { key: 'payment',  label: 'Payment',  color: '#D97706' },
  { key: 'exam',     label: 'Exam',     color: '#7C3AED' },
];

export default function CreateAnnouncementScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [ctaLabel, setCtaLabel]   = useState('Learn More');
  const [ctaRoute, setCtaRoute]   = useState('/(tabs)');
  const [type, setType]           = useState<AnnouncementType>('general');
  const [saving, setSaving]       = useState(false);

  async function publish() {
    if (!title.trim()) return Alert.alert('Required', 'Title is required.');
    if (!body.trim())  return Alert.alert('Required', 'Body is required.');
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title:       title.trim(),
      body:        body.trim(),
      type,
      date_label:  dateLabel.trim() || null,
      cta_label:   ctaLabel.trim() || 'Learn More',
      cta_route:   ctaRoute.trim() || '/(tabs)',
      active:      true,
      created_by:  user?.id ?? null,
      published_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return Alert.alert('Error', error.message);
    Alert.alert('Published', 'Announcement is now live.', [{ text: 'OK', onPress: () => router.back() }]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#374151" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>New Announcement</ThemedText>
        <Pressable
          style={[styles.publishBtn, saving && { opacity: 0.6 }]}
          onPress={publish}
          disabled={saving}>
          <ThemedText style={styles.publishBtnText}>{saving ? 'Saving…' : 'Publish'}</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Type selector */}
        <ThemedText style={styles.label}>Type</ThemedText>
        <View style={styles.typeRow}>
          {TYPES.map(t => (
            <Pressable
              key={t.key}
              style={[styles.typePill, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
              onPress={() => setType(t.key)}>
              <ThemedText style={[styles.typeText, type === t.key && { color: '#fff' }]}>{t.label}</ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.label}>Title <ThemedText style={styles.req}>*</ThemedText></ThemedText>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Term 2 Exam Timetable Released"
          placeholderTextColor="#9CA3AF"
          maxLength={120}
        />

        <ThemedText style={styles.label}>Body <ThemedText style={styles.req}>*</ThemedText></ThemedText>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Write the full announcement text here…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <ThemedText style={styles.label}>Date / Event label <ThemedText style={styles.opt}>(optional)</ThemedText></ThemedText>
        <TextInput
          style={styles.input}
          value={dateLabel}
          onChangeText={setDateLabel}
          placeholder="e.g. 14 June 2026"
          placeholderTextColor="#9CA3AF"
        />

        <ThemedText style={styles.label}>Call-to-action label</ThemedText>
        <TextInput
          style={styles.input}
          value={ctaLabel}
          onChangeText={setCtaLabel}
          placeholder="e.g. Register Now"
          placeholderTextColor="#9CA3AF"
        />

        <ThemedText style={styles.label}>CTA route (where the button navigates)</ThemedText>
        <TextInput
          style={styles.input}
          value={ctaRoute}
          onChangeText={setCtaRoute}
          placeholder="e.g. /enroll or /(tabs)/classes"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
        />

        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.three,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  publishBtn: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: Spacing.four, gap: Spacing.two },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: Spacing.two },
  req: { color: '#DC2626' },
  opt: { color: '#9CA3AF', fontWeight: '400' },
  input: {
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2,
    fontSize: 15, color: '#111827',
  },
  textArea: { minHeight: 120, paddingTop: Spacing.two + 2 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  typeText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
});
