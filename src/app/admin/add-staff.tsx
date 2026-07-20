import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LoadingRow } from '@/components/loading-dots';
import { Spacing } from '@/constants/theme';
import { supabase, getFunctionErrorMessage } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

type StaffRole = 'tutor' | 'admin';

export default function AddStaffScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<StaffRole>(params.role === 'admin' ? 'admin' : 'tutor');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter a full name.');
    if (!email.trim()) return Alert.alert('Required', 'Please enter an email address.');

    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: email.trim(), fullName: fullName.trim(), role, phone: phone.trim() || undefined },
    });
    setSaving(false);

    if (error || data?.error) {
      const message = await getFunctionErrorMessage(error, data);
      log.error('AddStaff', 'admin-create-user failed', { message });
      Alert.alert('Error', message);
      return;
    }

    log.ok('AddStaff', 'Created', { email, role });
    Alert.alert(
      'Account Created',
      `Temp password for ${fullName.trim()}:\n\n${data.tempPassword}\n\nShare this with them — they'll be asked to set their own password on first sign-in.`,
      [{ text: 'Done', onPress: () => router.back() }]
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">

        <View style={styles.roleRow}>
          {([
            { r: 'tutor', icon: 'school-outline', label: 'Tutor' },
            { r: 'admin', icon: 'shield-checkmark-outline', label: 'Admin' },
          ] as { r: StaffRole; icon: string; label: string }[]).map(({ r, icon, label }) => (
            <Pressable
              key={r}
              style={[styles.rolePill, role === r && styles.rolePillActive]}
              onPress={() => setRole(r)}>
              <Ionicons name={icon as any} size={15} color={role === r ? '#fff' : '#6B7280'} />
              <ThemedText style={[styles.rolePillText, role === r && styles.rolePillTextActive]}>
                {label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={styles.label}>Full Name *</ThemedText>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Thabo Mokoena"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={styles.label}>Email Address *</ThemedText>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="name@email.com"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText style={styles.label}>Phone Number</ThemedText>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="e.g. 071 000 0000"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.note}>
          <Ionicons name="mail-outline" size={14} color="#6B7280" />
          <ThemedText style={styles.noteText}>
            They'll receive an email invite to set their own password — you won't see or need to share one.
          </ThemedText>
        </View>

        <Pressable
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}>
          {saving ? (
            <LoadingRow label="Sending invite…" color="#fff" textColor="#fff" />
          ) : (
            <ThemedText style={styles.submitBtnText}>Send Invite</ThemedText>
          )}
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },

  roleRow: { flexDirection: 'row', gap: Spacing.two },
  rolePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  rolePillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  rolePillText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  rolePillTextActive: { color: '#fff' },

  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },

  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: Spacing.two,
  },
  noteText: { flex: 1, fontSize: 11, color: '#6B7280', lineHeight: 17 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, marginTop: Spacing.one,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
