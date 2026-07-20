import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { OtpInput, OtpInputHandle } from '@/components/otp-input';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_SOFT_LIMIT = 5;

// Shown right after guardian signup when Supabase's "Confirm email" setting
// is on — Supabase already generated, stored, and emailed a real 6-digit
// code; this screen just collects it and calls verifyOtp. No custom code
// generation/storage/expiry of our own.
export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef = useRef<OtpInputHandle>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleVerify() {
    if (!email) return;
    if (code.length !== 6) return Alert.alert('Required', 'Enter the 6-digit code from your email.');

    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setVerifying(false);

    if (error) {
      log.error('VerifyEmail', 'verifyOtp failed', error);
      Alert.alert('Verification Failed', error.message);
      otpRef.current?.reset();
      return;
    }
    log.ok('VerifyEmail', 'Email verified');
    // navigation onward handled by _layout.tsx once the session resolves
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    startCooldown();

    if (error) {
      log.error('VerifyEmail', 'resend failed', error);
      Alert.alert('Error', error.message);
      return;
    }
    setResendCount((c) => c + 1);
    otpRef.current?.reset();
    Alert.alert('Code Sent', `A new code was sent to ${email}.`);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top + Spacing.five }]}>

        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        <View style={styles.brand}>
          <ThemedText style={styles.title}>Check Your Email</ThemedText>
          <ThemedText style={styles.sub}>
            We sent a 6-digit code to {email ?? 'your email'}. Enter it below to verify your account.
          </ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.label}>Verification Code</ThemedText>
          <OtpInput ref={otpRef} onChange={setCode} />

          <Pressable
            style={[styles.btn, verifying && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={verifying}>
            {verifying ? <LoadingDots color="#fff" /> : <ThemedText style={styles.btnText}>Verify</ThemedText>}
          </Pressable>

          <Pressable
            style={styles.resendWrap}
            onPress={handleResend}
            disabled={resending || cooldown > 0}>
            <ThemedText style={[styles.resendText, (resending || cooldown > 0) && { color: '#9CA3AF' }]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
            </ThemedText>
          </Pressable>

          {resendCount >= RESEND_SOFT_LIMIT && (
            <ThemedText style={styles.helpText}>
              Still not arriving? Check your spam folder, or contact support.
            </ThemedText>
          )}
        </View>
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
  btn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendWrap: { alignItems: 'center', marginTop: Spacing.one },
  resendText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  helpText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: Spacing.one },
});
