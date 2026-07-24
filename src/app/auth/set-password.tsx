import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

import SetPasswordIllustration from '@/assets/illustrations/set-password.svg';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

// Shown when profiles.must_change_password is true — after an admin/guardian
// creates an account with a temp password (see admin-create-user /
// guardian-invite-learner), the new user is forced through here once, right
// after their first normal sign-in, before reaching the rest of the app.
export default function SetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    if (password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    setSaving(true);
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setSaving(false);
      log.error('SetPassword', 'updateUser failed', pwError);
      Alert.alert('Error', pwError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles').update({ must_change_password: false }).eq('id', user.id);
    if (profileError) log.warn('SetPassword', 'Could not clear must_change_password', profileError);

    await refreshProfile();
    setSaving(false);
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top + Spacing.five }]}>

        <View style={styles.brand}>
          <SetPasswordIllustration width={150} height={150} />
          <ThemedText style={styles.title}>Set Your Password</ThemedText>
          <ThemedText style={styles.sub}>You're signing in with a temporary password — set your own to continue.</ThemedText>
        </View>

        <View style={styles.card}>
          <View style={{ gap: 6 }}>
            <ThemedText style={styles.label}>New Password</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor="#9CA3AF"
              />
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText style={styles.label}>Confirm Password</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                placeholder="Repeat password"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <Pressable
            style={[styles.btn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}>
            {saving ? <LoadingDots color="#fff" /> : <ThemedText style={styles.btnText}>Set Password</ThemedText>}
          </Pressable>
        </View>

        <Pressable style={styles.signOutWrap} onPress={() => signOut()}>
          <ThemedText style={styles.signOutText}>Sign out</ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.four },
  brand: { alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
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
  signOutWrap: { alignItems: 'center', marginTop: Spacing.one },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#6B7280', textDecorationLine: 'underline' },
});
