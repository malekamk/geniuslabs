import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, TextInput, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';
const TAG = 'ChangePassword';

function PasswordField({
  label, value, onChangeText, show, onToggleShow, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.inputWrap}>
        <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
        />
        <Pressable onPress={onToggleShow} hitSlop={8}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}

export function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setShowPasswords(false);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!user?.email) return;
    if (!current) return Alert.alert('Required', 'Enter your current password.');
    if (next.length < 8) return Alert.alert('Weak password', 'New password must be at least 8 characters.');
    if (next !== confirm) return Alert.alert('Mismatch', 'New passwords do not match.');
    if (next === current) return Alert.alert('No change', 'New password must be different from your current one.');

    setSaving(true);

    // Re-authenticate with the current password first — changing a password
    // without proving you know the current one would let anyone with a
    // moment of access to an already-signed-in device lock the real owner out.
    log.info(TAG, 'Verifying current password…');
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (reauthError) {
      setSaving(false);
      log.error(TAG, 'Re-authentication failed', reauthError);
      Alert.alert('Incorrect Password', 'Your current password is incorrect.');
      return;
    }

    log.info(TAG, 'Updating password…');
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) {
      log.error(TAG, 'updateUser failed', updateError);
      Alert.alert('Error', updateError.message);
      return;
    }

    log.ok(TAG, 'Password changed');
    reset();
    onClose();
    Alert.alert('Password Changed', 'Your password has been updated.');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Change Password</ThemedText>
            <ThemedText style={styles.sub}>Enter your current password to confirm it's you.</ThemedText>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <PasswordField
              label="Current Password"
              value={current}
              onChangeText={setCurrent}
              show={showPasswords}
              onToggleShow={() => setShowPasswords(v => !v)}
              placeholder="Your current password"
            />
            <PasswordField
              label="New Password"
              value={next}
              onChangeText={setNext}
              show={showPasswords}
              onToggleShow={() => setShowPasswords(v => !v)}
              placeholder="Min. 8 characters"
            />
            <PasswordField
              label="Confirm New Password"
              value={confirm}
              onChangeText={setConfirm}
              show={showPasswords}
              onToggleShow={() => setShowPasswords(v => !v)}
              placeholder="Repeat new password"
            />

            <Pressable
              style={[styles.btn, saving && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={saving}>
              {saving ? <LoadingDots color="#fff" /> : <ThemedText style={styles.btnText}>Update Password</ThemedText>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    padding: Spacing.four, paddingTop: Spacing.five,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 999 },
  body: { padding: Spacing.four },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four, gap: Spacing.three,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#F9FAFB', paddingHorizontal: Spacing.three,
  },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: Spacing.two + 2 },
  btn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
