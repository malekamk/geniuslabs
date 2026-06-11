import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/utils/supabase';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email address.');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'geniuslabs://auth/reset-password',
    });
    setLoading(false);
    if (error) return Alert.alert('Error', error.message);
    setSent(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top + Spacing.three }]}>

        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        <View style={styles.icon}>
          <Ionicons name="lock-open-outline" size={36} color={PRIMARY} />
        </View>
        <ThemedText style={styles.title}>Forgot Password?</ThemedText>
        <ThemedText style={styles.sub}>
          Enter your email and we'll send you a link to reset your password.
        </ThemedText>

        {sent ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={32} color="#059669" />
            <ThemedText style={styles.successTitle}>Check your inbox</ThemedText>
            <ThemedText style={styles.successSub}>
              A password reset link has been sent to {email.trim()}.
            </ThemedText>
            <Pressable style={styles.btn} onPress={() => router.replace('/auth/login')}>
              <ThemedText style={styles.btnText}>Back to Sign In</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <ThemedText style={styles.label}>Email address</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="your@email.com"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Pressable
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={loading}>
              <ThemedText style={styles.btnText}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  icon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginTop: Spacing.four,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
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
    borderRadius: 8, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.five,
    alignItems: 'center', gap: Spacing.two,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },
  successTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  successSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
