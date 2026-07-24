import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { GoogleIcon } from '@/components/google-icon';
import { LoadingDots } from '@/components/loading-dots';
import { Spacing } from '@/constants/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { log } from '@/utils/logger';
import { supabase } from '@/utils/supabase';
import { signInWithProvider, signInWithAppleNative } from '@/utils/oauth';

import LoginIllustration from '@/assets/illustrations/login.svg';

const LOGIN_COUNT_KEY = 'geniuslabs_login_count';

async function maybeRequestReview() {
  try {
    const raw = await AsyncStorage.getItem(LOGIN_COUNT_KEY);
    const count = parseInt(raw ?? '0', 10) + 1;
    await AsyncStorage.setItem(LOGIN_COUNT_KEY, String(count));
    if (count === 3 && await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch {
    // non-fatal
  }
}

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

const DEMO_ACCOUNTS = [
  { role: 'Learner',  email: 'chrismalekamk@gmail.com', password: 'Passwordmk1$', color: '#059669' },
  { role: 'Tutor',    email: 'kganyamilton@icloud.com', password: 'Passwordmk1$', color: '#1565C0' },
  { role: 'Guardian', email: 'kganyamilton@gmail.com',  password: 'Passwordmk1$', color: '#7C3AED' },
  { role: 'Admin',    email: 'kganya@gmail.com',  password: 'Passwordmk1$', color: '#DC2626' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider);
    try {
      const session = await signInWithProvider(provider);
      if (session) maybeRequestReview();
      // navigation handled by _layout.tsx once the session/profile resolve
    } catch (e: any) {
      log.error('Login', `${provider} sign-in failed`, e);
      Alert.alert('Sign-in Failed', e?.message ?? 'Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleAppleNative() {
    setOauthLoading('apple');
    try {
      const session = await signInWithAppleNative();
      if (session) maybeRequestReview();
    } catch (e: any) {
      log.error('Login', 'Apple native sign-in failed', e);
      Alert.alert('Sign-in Failed', e?.message ?? 'Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }

  async function quickLogin(email: string, password: string) {
    setLoading(true);
    await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
  }

  async function handleLogin() {
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email.');
    if (!password) return Alert.alert('Required', 'Please enter your password.');

    const trimmedEmail = email.trim().toLowerCase();
    log.info('Login', 'Attempting sign in…', { email: trimmedEmail });

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);

    if (error) {
      log.error('Login', 'Sign in failed', error);
      Alert.alert('Login Failed', error.message);
    } else {
      log.ok('Login', 'Sign in successful', { userId: data.user?.id, email: data.user?.email });
      maybeRequestReview();
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.five }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* LOGO / BRAND */}
        <View style={styles.brand}>
          <LoginIllustration width={180} height={180} />
          <ThemedText style={styles.brandSub}>Sign in to your account</ThemedText>
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Email address</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
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
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Password</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#9CA3AF"
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <LoadingDots color="#fff" />
            ) : (
              <ThemedText style={styles.submitBtnText}>Sign In</ThemedText>
            )}
          </Pressable>

          <View style={styles.orDivider}>
            <View style={styles.demoDividerLine} />
            <ThemedText style={styles.orDividerText}>or continue with</ThemedText>
            <View style={styles.demoDividerLine} />
          </View>

          <View style={{ gap: Spacing.three }}>
            <Pressable
              style={[styles.oauthBtn, oauthLoading === 'google' && { opacity: 0.6 }]}
              disabled={!!oauthLoading}
              onPress={() => handleOAuth('google')}>
              {oauthLoading === 'google' ? (
                <LoadingDots />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <ThemedText style={styles.oauthBtnText}>Continue with Google</ThemedText>
                </>
              )}
            </Pressable>

            {Platform.OS === 'ios' && (
              oauthLoading === 'apple' ? (
                <View style={[styles.oauthBtn, styles.appleBtn]}>
                  <LoadingDots color="#fff" />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={8}
                  style={styles.appleNativeBtn}
                  onPress={handleAppleNative}
                />
              )
            )}
          </View>
        </View>

        {/* DEV QUICK LOGIN — dev builds only; never ships with real credentials in production */}
        {/* {__DEV__ && (
          <View style={styles.demoPanel}>
            <View style={styles.demoDivider}>
              <View style={styles.demoDividerLine} />
              <ThemedText style={styles.demoDividerText}>DEV · Demo Quick Login</ThemedText>
              <View style={styles.demoDividerLine} />
            </View>
            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map(a => (
                <Pressable
                  key={a.role}
                  style={[styles.demoBtn, { borderColor: a.color }]}
                  onPress={() => quickLogin(a.email, a.password)}>
                  <ThemedText style={[styles.demoBtnText, { color: a.color }]}>{a.role}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )} */}

        {/* FOOTER */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Don&apos;t have an account?</ThemedText>
          <Pressable onPress={() => router.push('/auth/signup')}>
            <ThemedText style={styles.footerLink}>Register here</ThemedText>
          </Pressable>
        </View>

        <Pressable style={styles.forgotWrap} onPress={() => router.push('/auth/forgot-password')}>
          <ThemedText style={styles.forgotLink}>Forgot your password?</ThemedText>
        </Pressable>

        <Pressable onPress={() => router.push('/privacy-policy' as any)} style={{ alignSelf: 'center', marginTop: Spacing.two }}>
          <ThemedText style={styles.footerText}>Privacy Policy</ThemedText>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },

  brand: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  brandSub: { fontSize: 18, color: '#000' ,textAlign: 'center', fontWeight: '600'},

  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four, gap: Spacing.three,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },

  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#F9FAFB', paddingHorizontal: Spacing.three,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: Spacing.two + 2 },
  eyeBtn: { padding: 6 },

  submitBtn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  orDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  orDividerText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingVertical: Spacing.three, backgroundColor: '#fff',
  },
  oauthBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  appleBtn: { backgroundColor: '#000', borderColor: '#000' },
  appleNativeBtn: { height: 48, width: '100%' },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.one },
  footerText: { fontSize: 13, color: '#6B7280' },
  footerLink: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  demoPanel: { gap: Spacing.two },
  demoDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  demoDividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  demoDividerText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  demoRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  demoBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#fff',
  },
  demoBtnText: { fontSize: 13, fontWeight: '700' },
  forgotWrap: { alignItems: 'center' },
  forgotLink: { fontSize: 13, fontWeight: '600', color: '#6B7280', textDecorationLine: 'underline' },
});
