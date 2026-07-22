import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
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
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import { signInWithProvider } from '@/utils/oauth';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

// Guardian is the only self-service signup path — tutor/admin accounts are
// created by an admin (see admin-create-user), and a learner who wants their
// own login is invited by their guardian (see guardian-invite-learner).
// Both invite flows deterministically link by ID, no name-matching involved.
export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider);
      // navigation onward handled by _layout.tsx
    } catch (e: any) {
      log.error('Signup', `${provider} sign-in failed`, e);
      Alert.alert('Sign-in Failed', e?.message ?? 'Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleSignup() {
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email.');
    if (password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    const trimmedEmail = email.trim().toLowerCase();
    log.info('Signup', 'Creating account…', { email: trimmedEmail });

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { full_name: fullName.trim(), role: 'guardian', phone: phone.trim() },
      },
    });

    if (error) {
      setLoading(false);
      log.error('Signup', 'Account creation failed', error);
      Alert.alert('Registration Failed', error.message);
      return;
    }

    log.ok('Signup', 'Account created', { userId: data.user?.id });

    if (phone.trim() && data.session) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', data.user!.id);
      if (profileErr) log.warn('Signup', 'Profile phone update failed', profileErr);
    }

    setLoading(false);

    if (!data.session) {
      // Email confirmation is required — Supabase emailed a 6-digit code.
      router.push({ pathname: '/auth/verify-email', params: { email: trimmedEmail } });
      return;
    }
    // navigation handled by useEffect in _layout.tsx
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* BRAND */}
        <View style={styles.brand}>
          {/* <Image
            source={require('@/assets/images/geniuslabs-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          /> */}
          <ThemedText style={styles.brandName}>Create Account</ThemedText>
          <ThemedText style={styles.brandSub}>Sign up as a parent/guardian to enrol your learner</ThemedText>
        </View>

        {/* CARD */}
        <View style={styles.card}>

          <Field label="Full Name" icon="person-outline">
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. kganya maleka"
              placeholderTextColor="#9CA3AF"
            />
          </Field>

          {/* <Field label="Phone Number" icon="call-outline">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 071 000 0000"
              placeholderTextColor="#9CA3AF"
            />
          </Field> */}

          <Field label="Your Email Address" icon="mail-outline">
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
          </Field>

          <Field label="Password" icon="lock-closed-outline" rightSlot={
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
            </Pressable>
          }>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor="#9CA3AF"
            />
          </Field>

          <Field label="Confirm Password" icon="lock-closed-outline">
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPassword}
              placeholder="Repeat password"
              placeholderTextColor="#9CA3AF"
            />
          </Field>

          {/* <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
            <ThemedText style={styles.noteText}>
              Your information is processed in accordance with POPIA and used solely for account management.
            </ThemedText>
          </View> */}

          <Pressable
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSignup}
            disabled={loading}>
            <ThemedText style={styles.submitBtnText}>
              {loading ? 'Creating account…' : 'Create Account'}
            </ThemedText>
          </Pressable>

          <View style={styles.orDivider}>
            <View style={styles.orDividerLine} />
            <ThemedText style={styles.orDividerText}>or continue with</ThemedText>
            <View style={styles.orDividerLine} />
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
              <Pressable
                style={[styles.oauthBtn, styles.appleBtn, oauthLoading === 'apple' && { opacity: 0.6 }]}
                disabled={!!oauthLoading}
                onPress={() => handleOAuth('apple')}>
                {oauthLoading === 'apple' ? (
                  <LoadingDots color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                    <ThemedText style={[styles.oauthBtnText, { color: '#fff' }]}>Continue with Apple</ThemedText>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Already have an account?</ThemedText>
          <Pressable onPress={() => router.replace('/auth/login')}>
            <ThemedText style={styles.footerLink}>Sign in</ThemedText>
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, rightSlot, children }: {
  label: string; icon: string; rightSlot?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.inputWrap}>
        <Ionicons name={icon as any} size={18} color="#9CA3AF" style={styles.inputIcon} />
        {children}
        {rightSlot}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },

  brand: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  logo: { width: 150, height: 100 },
  brandName: { fontSize: 24, fontWeight: '800', color: '#111827' },
  brandSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

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
  inputIcon: { marginRight: 8 },
  input: { fontSize: 15, color: '#111827', paddingVertical: Spacing.two + 2 },
  eyeBtn: { padding: 6 },

  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: Spacing.two,
  },
  noteText: { flex: 1, fontSize: 11, color: '#6B7280', lineHeight: 17 },

  submitBtn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  orDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  orDividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  orDividerText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingVertical: Spacing.three, backgroundColor: '#fff',
  },
  oauthBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  appleBtn: { backgroundColor: '#000', borderColor: '#000' },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: 13, color: '#6B7280' },
  footerLink: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});
