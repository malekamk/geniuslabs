import { Ionicons } from '@expo/vector-icons';
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
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

type Role = 'guardian' | 'learner' | 'tutor';

// Shown once, right after a first-time Google/Apple sign-in — OAuth never
// asks "are you a guardian/learner/tutor?" the way the email signup form does.
export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, signOut } = useAuth();

  const [role, setRole] = useState<Role>('guardian');
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ?? ''
  );
  const [phone, setPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (role === 'learner' && !guardianEmail.trim())
      return Alert.alert('Required', "Please enter your parent/guardian's email.");

    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      role,
      full_name: fullName.trim(),
      ...(role !== 'learner' ? { phone: phone.trim() || null } : {}),
    });

    if (error) {
      setLoading(false);
      log.error('CompleteProfile', 'Upsert failed', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
      return;
    }

    if (role === 'learner') {
      const { data: linked, error: linkErr } = await supabase.rpc('link_learner_account', {
        p_guardian_email: guardianEmail.trim().toLowerCase(),
        p_learner_name:   fullName.trim(),
        p_user_id:        user.id,
      });
      if (linkErr) {
        log.warn('CompleteProfile', 'Learner link failed', linkErr);
      } else if (!linked) {
        log.warn('CompleteProfile', 'No matching learner row found');
        Alert.alert(
          'Almost there',
          "We couldn't find a matching enrolment for you yet. Ask your guardian to enrol you, then contact us to link your account."
        );
      }
    }

    await refreshProfile();
    setLoading(false);
    // navigation onward handled by _layout.tsx once profile is no longer null
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.four }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        <View style={styles.brand}>
          <ThemedText style={styles.brandName}>Almost done</ThemedText>
          <ThemedText style={styles.brandSub}>Tell us who you are to finish setting up your account</ThemedText>
        </View>

        <View style={styles.roleRow}>
          {([
            { r: 'guardian', icon: 'people-outline', label: 'Guardian' },
            { r: 'learner',  icon: 'person-outline', label: 'Learner' },
            { r: 'tutor',    icon: 'school-outline', label: 'Tutor' },
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

          {role === 'learner' ? (
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
          ) : (
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
          )}

          {role === 'learner' && (
            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={14} color="#1565C0" />
              <ThemedText style={[styles.noteText, { color: '#1E40AF' }]}>
                Use the exact full name your guardian used when enrolling you.
              </ThemedText>
            </View>
          )}

          <Pressable
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}>
            <ThemedText style={styles.submitBtnText}>
              {loading ? 'Saving…' : 'Continue'}
            </ThemedText>
          </Pressable>
        </View>

        <Pressable style={styles.signOutWrap} onPress={() => signOut()}>
          <ThemedText style={styles.signOutText}>Sign out</ThemedText>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.inputWrap}>
        <Ionicons name={icon as any} size={18} color="#9CA3AF" style={styles.inputIcon} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },

  brand: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  brandName: { fontSize: 24, fontWeight: '800', color: '#111827' },
  brandSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

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
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: Spacing.two + 2 },

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

  signOutWrap: { alignItems: 'center', marginTop: Spacing.one },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#6B7280', textDecorationLine: 'underline' },
});
