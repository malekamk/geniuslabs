import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { Spacing } from '@/constants/theme';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

type Role = 'guardian' | 'learner' | 'tutor';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role>('guardian');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email.');
    if (role === 'learner' && !guardianEmail.trim())
      return Alert.alert('Required', "Please enter your parent/guardian's email.");
    if (password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    const trimmedEmail = email.trim().toLowerCase();
    log.info('Signup', 'Creating account…', { email: trimmedEmail, role });

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role,
          ...(role === 'guardian' ? { phone: phone.trim() } : {}),
        },
      },
    });

    if (error) {
      setLoading(false);
      log.error('Signup', 'Account creation failed', error);
      Alert.alert('Registration Failed', error.message);
      return;
    }

    log.ok('Signup', 'Account created', { userId: data.user?.id, role });

    if (role === 'guardian' && phone.trim() && data.session) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', data.user!.id);
      if (profileErr) log.warn('Signup', 'Profile phone update failed', profileErr);
    }

    if (role === 'learner' && data.user?.id) {
      log.info('Signup', 'Linking learner account…');
      const { data: linked, error: linkErr } = await supabase.rpc('link_learner_account', {
        p_guardian_email: guardianEmail.trim().toLowerCase(),
        p_learner_name:   fullName.trim(),
        p_user_id:        data.user.id,
      });
      if (linkErr) log.warn('Signup', 'Learner link failed', linkErr);
      else if (linked) log.ok('Signup', 'Learner linked to guardian account');
      else log.warn('Signup', 'No matching learner row found — guardian may not have enrolled them yet');
    }

    setLoading(false);
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
          {/* <View style={styles.logoCircle}>
            <Ionicons name="school" size={32} color="#fff" />
          </View> */}
          <ThemedText style={styles.brandName}>Create Account</ThemedText>
          <ThemedText style={styles.brandSub}>Who are you registering as?</ThemedText>
        </View>

        {/* ROLE SELECTOR */}
        <View style={styles.roleRow}>
          {([
            { r: 'guardian', icon: 'people-outline',  label: 'Guardian' },
            { r: 'learner',  icon: 'person-outline',  label: 'Learner' },
            { r: 'tutor',    icon: 'school-outline',  label: 'Tutor' },
          ] as { r: Role; icon: string; label: string }[]).map(({ r, icon, label }) => (
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

        {/* CARD */}
        <View style={styles.card}>

          <Field label="Full Name" icon="person-outline">
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={role === 'guardian' ? 'e.g. kganya maleka' : 'Your full name as enrolled'}
              placeholderTextColor="#9CA3AF"
            />
          </Field>

          {role === 'guardian' || role === 'tutor' ? (
            <Field label="Phone Number" icon="call-outline">
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 071 000 0000"
                placeholderTextColor="#9CA3AF"
              />
            </Field>
          ) : (
            <Field label="Parent / Guardian Email" icon="people-outline">
              <TextInput
                style={styles.input}
                value={guardianEmail}
                onChangeText={setGuardianEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="guardian@email.com"
                placeholderTextColor="#9CA3AF"
              />
            </Field>
          )}

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

          {role === 'learner' && (
            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={14} color="#1565C0" />
              <ThemedText style={[styles.noteText, { color: '#1E40AF' }]}>
                Use the exact full name your guardian used when enrolling you.
              </ThemedText>
            </View>
          )}

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
            <ThemedText style={styles.noteText}>
              Your information is processed in accordance with POPIA and used solely for account management.
            </ThemedText>
          </View>

          <Pressable
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSignup}
            disabled={loading}>
            <ThemedText style={styles.submitBtnText}>
              {loading ? 'Creating account…' : 'Create Account'}
            </ThemedText>
          </Pressable>
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
  logoCircle: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 24, fontWeight: '800', color: '#111827' },
  brandSub: { fontSize: 13, color: '#6B7280' },

  roleRow: { flexDirection: 'row', gap: Spacing.two },
  rolePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  rolePillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  rolePillText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  rolePillTextActive: { color: '#fff' },

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

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: 13, color: '#6B7280' },
  footerLink: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});
