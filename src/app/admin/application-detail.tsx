import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { sendNotifications } from '@/utils/notify';
import { log } from '@/utils/logger';
import { Spacing } from '@/constants/theme';
import type { EnrolmentApplication } from '@/types/db';

const PRIMARY = '#1565C0';

const STATUS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
};

export default function ApplicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [app, setApp] = useState<EnrolmentApplication | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchApp(); }, [id]);

  async function fetchApp() {
    const { data } = await supabase.from('enrolment_applications').select('*').eq('id', id).single();
    if (data) {
      setApp(data as EnrolmentApplication);
      setNotes(data.admin_notes ?? '');
    }
  }

  async function updateStatus(status: 'approved' | 'rejected' | 'reviewing') {
    if (!app) return;
    const verb = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Mark as Reviewing';
    Alert.alert(`${verb} Application`, `${verb} application for ${app.learner_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb, style: status === 'rejected' ? 'destructive' : 'default',
        onPress: async () => {
          setSaving(true);
          const { error } = await supabase.from('enrolment_applications').update({
            status,
            admin_notes:  notes.trim() || null,
            reviewed_by:  user?.id,
            reviewed_at:  new Date().toISOString(),
          }).eq('id', app.id);
          if (error) {
            setSaving(false);
            log.error('AppDetail', 'Status update failed', error);
            Alert.alert('Error', 'Could not update the application. Please try again.');
            return;
          }
          if (app.guardian_profile_id && (status === 'approved' || status === 'rejected')) {
            await sendNotifications(
              app.guardian_profile_id,
              status === 'approved' ? 'Enrolment Approved! 🎉' : 'Enrolment Update',
              status === 'approved'
                ? `${app.learner_name}'s enrolment has been approved. Welcome to Genius Lab!`
                : `${app.learner_name}'s application has been reviewed. Please contact us for more information.`,
              'general',
            );
          } else {
            log.warn('AppDetail', 'Skipped notify — guardian_profile_id missing or status not approved/rejected');
          }
          setSaving(false);
          router.back();
        },
      },
    ]);
  }

  if (!app) return <View style={styles.root} />;

  const sc = STATUS[app.status] ?? STATUS.pending;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#374151" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Application</ThemedText>
        <View style={[styles.chip, { backgroundColor: sc.bg }]}>
          <ThemedText style={[styles.chipText, { color: sc.text }]}>{app.status}</ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Learner info */}
        <SectionLabel label="LEARNER" />
        <View style={styles.card}>
          <Row icon="person-outline" label="Name" value={app.learner_name} />
          <Divider />
          <Row icon="school-outline" label="Grade" value={app.grade} />
          <Divider />
          <Row icon="calendar-outline" label="Date of Birth" value={app.learner_dob ?? '—'} />
        </View>

        {/* Subjects */}
        {app.subjects && app.subjects.length > 0 && (
          <>
            <SectionLabel label="SUBJECTS" />
            <View style={styles.pillWrap}>
              {app.subjects.map(s => (
                <View key={s} style={styles.pill}>
                  <Ionicons name="book-outline" size={12} color={PRIMARY} />
                  <ThemedText style={styles.pillText}>{s}</ThemedText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Guardian info */}
        <SectionLabel label="GUARDIAN" />
        <View style={styles.card}>
          <Row icon="person-circle-outline" label="Name" value={app.guardian_name} />
          <Divider />
          <Row icon="call-outline" label="Phone" value={app.guardian_phone} />
          <Divider />
          <Row icon="mail-outline" label="Email" value={app.guardian_email} />
        </View>

        {/* Meta */}
        <SectionLabel label="APPLICATION" />
        <View style={styles.card}>
          <Row icon="calendar-outline" label="Submitted" value={new Date(app.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} />
          {app.reviewed_at && <><Divider /><Row icon="checkmark-circle-outline" label="Reviewed" value={new Date(app.reviewed_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} /></>}
          <Divider />
          <Row icon="shield-checkmark-outline" label="POPIA Consent" value={app.popia_consent ? 'Yes' : 'No'} />
        </View>

        {/* Documents */}
        {(app.birth_cert_url || app.school_report_url || app.additional_file_url) && (
          <>
            <SectionLabel label="DOCUMENTS" />
            <View style={styles.card}>
              {[
                { label: 'Birth Certificate / ID', url: app.birth_cert_url },
                { label: 'School Report',          url: app.school_report_url },
                { label: 'Additional Document',    url: app.additional_file_url },
              ].filter(d => d.url).map((doc, i, arr) => (
                <View key={doc.label}>
                  <Pressable style={styles.docRow} onPress={() => Linking.openURL(doc.url!)}>
                    <Ionicons name="document-attach-outline" size={16} color={PRIMARY} />
                    <ThemedText style={styles.docLabel}>{doc.label}</ThemedText>
                    <Ionicons name="open-outline" size={14} color="#9CA3AF" />
                  </Pressable>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Admin notes */}
        <SectionLabel label="ADMIN NOTES" />
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add internal notes…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
        />

        {/* Actions */}
        {app.status !== 'approved' && app.status !== 'rejected' && (
          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.reviewBtn]}
              onPress={() => updateStatus('reviewing')} disabled={saving}>
              <Ionicons name="eye-outline" size={16} color="#1565C0" />
              <ThemedText style={[styles.actionText, { color: '#1565C0' }]}>Review</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => updateStatus('rejected')} disabled={saving}>
              <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
              <ThemedText style={[styles.actionText, { color: '#DC2626' }]}>Reject</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => updateStatus('approved')} disabled={saving}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <ThemedText style={[styles.actionText, { color: '#fff' }]}>Approve</ThemedText>
            </Pressable>
          </View>
        )}

        {app.status === 'approved' && (
          <View style={[styles.banner, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#065F46" />
            <ThemedText style={[styles.bannerText, { color: '#065F46' }]}>Application approved</ThemedText>
          </View>
        )}

        {app.status === 'rejected' && (
          <View style={[styles.banner, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="close-circle" size={18} color="#991B1B" />
            <ThemedText style={[styles.bannerText, { color: '#991B1B' }]}>Application rejected</ThemedText>
          </View>
        )}

        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <ThemedText style={styles.sectionLabel}>{label}</ThemedText>;
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={16} color="#9CA3AF" style={{ width: 20 }} />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue} numberOfLines={1}>{value}</ThemedText>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: Spacing.two },
  closeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  content: { padding: Spacing.four, gap: 0 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 8, marginTop: 16, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: Spacing.three, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 },
  rowLabel: { fontSize: 14, color: '#6B7280', width: 90 },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PRIMARY + '12', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  notesInput: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 13 },
  actionText: { fontSize: 14, fontWeight: '700' },
  reviewBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  approveBtn: { backgroundColor: PRIMARY },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 14, marginTop: Spacing.three },
  bannerText: { fontSize: 14, fontWeight: '700' },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: Spacing.three,
  },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: PRIMARY },
});
