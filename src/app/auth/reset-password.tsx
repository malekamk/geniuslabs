import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { OtpInput, OtpInputHandle } from '@/components/otp-input';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

import OtpIllustration from '@/assets/illustrations/otp.svg';
import SetPasswordIllustration from '@/assets/illustrations/set-password.svg';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

// Reached from forgot-password.tsx. Supabase emails a 6-digit recovery code
// (same OTP mechanism as signup verification) — no link, no deep link.
// Step 1: verifyOtp(type:'recovery') establishes a session from the code.
// Step 2: updateUser sets the new password on that session.
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const otpRef = useRef<OtpInputHandle>(null);

  async function handleVerifyCode() {
    if (!email) return;
    if (code.length !== 6) return Alert.alert('Required', 'Enter the 6-digit code from your email.');

    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    setVerifying(false);

    if (error) {
      log.error('ResetPassword', 'verifyOtp failed', error);
      Alert.alert('Verification Failed', error.message);
      otpRef.current?.reset();
      return;
    }
    setStep('password');
  }

  async function handleSetPassword() {
    if (password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      log.error('ResetPassword', 'updateUser failed', error);
      Alert.alert('Error', error.message);
      return;
    }
    await refreshProfile();
    Alert.alert('Password Updated', 'Your password has been reset.');
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top + Spacing.five }]}>

        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        {step === 'code' ? (
          <>
            <View style={styles.brand}>
              <OtpIllustration width={140} height={140} />
              <ThemedText style={styles.title}>Enter Reset Code</ThemedText>
              <ThemedText style={styles.sub}>
                We sent a 6-digit code to {email ?? 'your email'}. Enter it below to continue.
              </ThemedText>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.label}>Verification Code</ThemedText>
              <OtpInput ref={otpRef} onChange={setCode} />

              <Pressable
                style={[styles.btn, verifying && { opacity: 0.6 }]}
                onPress={handleVerifyCode}
                disabled={verifying}>
                {verifying ? <LoadingDots color="#fff" /> : <ThemedText style={styles.btnText}>Verify</ThemedText>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.brand}>
              <SetPasswordIllustration width={140} height={140} />
              <ThemedText style={styles.title}>Set New Password</ThemedText>
              <ThemedText style={styles.sub}>Choose a new password for your account.</ThemedText>
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
                onPress={handleSetPassword}
                disabled={saving}>
                {saving ? <LoadingDots color="#fff" /> : <ThemedText style={styles.btnText}>Set Password</ThemedText>}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  brand: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
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
});
