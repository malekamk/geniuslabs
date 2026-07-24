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

import ProfileDataIllustration from '@/assets/illustrations/profile-data.svg';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

// Shown once, right after a first-time Google/Apple sign-in. Guardian is the
// only role a human ever reaches this screen with — tutor/admin accounts are
// pre-provisioned via admin-create-user, and a learner's own login (if they
// want one) is pre-provisioned via guardian-invite-learner. Both invite flows
// set the profile row before the user ever gets here, so there's no "who are
// you?" choice left to make.
export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ?? ''
  );
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');

    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'guardian',
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    });

    if (error) {
      setLoading(false);
      log.error('CompleteProfile', 'Upsert failed', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
      return;
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
          <ProfileDataIllustration width={150} height={150} />
          <ThemedText style={styles.brandName}>Almost done</ThemedText>
          <ThemedText style={styles.brandSub}>A few details to finish setting up your account</ThemedText>
        </View>

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

  submitBtn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, alignItems: 'center', marginTop: Spacing.one,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  signOutWrap: { alignItems: 'center', marginTop: Spacing.one },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#6B7280', textDecorationLine: 'underline' },
});
