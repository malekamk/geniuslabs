import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, TextInput, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase, getFunctionErrorMessage } from '@/utils/supabase';
import { log } from '@/utils/logger';

const DANGER = '#DC2626';
const BG = '#F7F9F8';
const TAG = 'DeleteAccount';
const CONFIRM_WORD = 'DELETE';

export function DeleteAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  function handleClose() {
    if (deleting) return;
    setConfirmText('');
    onClose();
  }

  async function handleDelete() {
    if (confirmText !== CONFIRM_WORD) return;

    setDeleting(true);
    log.info(TAG, 'Requesting account deletion…');
    const { data, error } = await supabase.functions.invoke('delete-account');

    if (error || data?.error) {
      setDeleting(false);
      const message = await getFunctionErrorMessage(error, data);
      log.error(TAG, 'delete-account failed', { message });
      Alert.alert('Error', message);
      return;
    }

    log.ok(TAG, 'Account deleted');
    await signOut();
    setDeleting(false);
    setConfirmText('');
    onClose();
    router.replace('/auth/login');
  }

  const canDelete = confirmText === CONFIRM_WORD;

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
            <ThemedText style={styles.title}>Delete Account</ThemedText>
            <ThemedText style={styles.sub}>This action is permanent and cannot be undone.</ThemedText>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={20} color={DANGER} />
            <ThemedText style={styles.warningText}>
              Deleting your account will sign you out permanently and remove your personal
              information. This cannot be reversed.
            </ThemedText>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.label}>
              Type {CONFIRM_WORD} to confirm
            </ThemedText>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={CONFIRM_WORD}
              placeholderTextColor="#9CA3AF"
            />

            <Pressable
              style={[styles.deleteBtn, (!canDelete || deleting) && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={!canDelete || deleting}>
              {deleting ? <LoadingDots color="#fff" /> : <ThemedText style={styles.deleteBtnText}>Delete My Account</ThemedText>}
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
  body: { padding: Spacing.four, gap: Spacing.three },
  warningCard: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: Spacing.three,
  },
  warningText: { flex: 1, fontSize: 13, color: '#991B1B', lineHeight: 19 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four, gap: Spacing.three,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#F9FAFB', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2,
    fontSize: 15, color: '#111827',
  },
  deleteBtn: {
    backgroundColor: DANGER, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
