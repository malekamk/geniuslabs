import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Who we are',
    body: [
      'Ravhuyani Genius Lab is an after-school tutoring centre in Limpopo, South Africa. This app is how our guardians, learners, and tutors enrol, pay fees, join classes, share study material, and stay in touch.',
    ],
  },
  {
    title: '2. What we collect',
    body: [
      'Everyone with an account: your name, email, role, and (for tutors) a bio and the subjects/grades you teach, plus a push-notification token for your device.',
      "When a guardian enrols a learner: the child's full name, date of birth, school, grade, chosen subjects, uploaded ID/birth certificate and school report, and your POPIA consent.",
      "Payments: amount, fee type, due date, and status. Card details are handled directly by Yoco's secure checkout — we never see or store your card number, expiry, or CVV.",
      "Classes, chat & learning: messages in your subject's group chat, read timestamps, which materials you've opened or completed, and class attendance.",
      "We don't collect a learner's ID number, medical notes, or your location — those aren't requested anywhere in the app today.",
    ],
  },
  {
    title: '3. Camera, microphone & live classes',
    body: [
      'Joining a live class asks for camera and microphone access and opens the call through Jitsi Meet, a third-party video service — not our own servers. We don\'t record or store the call. Because it runs on Jitsi\'s public infrastructure, anyone with the class link can join it, the same as any shared video-call link.',
    ],
  },
  {
    title: '4. How we use it',
    body: [
      'To run your account, match learners to the right classes and material, process fee payments, review enrolments, and send notifications you\'d expect — reminders, messages, and announcements. We never sell your data or use it for advertising.',
    ],
  },
  {
    title: '5. Who we share it with',
    body: [
      'Supabase (database, sign-in, storage, chat — hosted in the EU), Yoco (card payments, South Africa), Expo (push notifications), Jitsi Meet (live class video), and Google/Apple (only if you choose to sign in with them). Nobody else, except where the law requires it.',
    ],
  },
  {
    title: "6. Children's data & guardian consent",
    body: [
      "A learner's account is always set up and consented to by their guardian first. Guardians can ask us at any time to see, correct, or delete their child's information, or withdraw consent, using the details below.",
    ],
  },
  {
    title: '7. How long we keep it',
    body: [
      'For as long as the account or enrolment is active, plus a reasonable period after for records like payment history. Ask us to delete it and we will, unless the law requires us to keep it.',
    ],
  },
  {
    title: '8. Your rights under POPIA',
    body: [
      'You can ask what we hold about you or your child, ask us to correct or delete it, object to how it\'s used, withdraw consent, or complain to the Information Regulator of South Africa.',
    ],
  },
  {
    title: '9. How we protect it',
    body: [
      'Everything travels over encrypted connections. Access is restricted by row-level security — a guardian only sees their own learners, a tutor only sees the subjects they teach. Card payments are handled entirely by Yoco\'s PCI-DSS-compliant systems.',
    ],
  },
  {
    title: '10. Changes to this policy',
    body: [
      "We'll tell you in-app before any material change takes effect.",
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={PRIMARY} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Privacy Policy</ThemedText>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.four, paddingBottom: insets.bottom + Spacing.five }}>

        <ThemedText style={styles.effective}>Effective 20 July 2026 · Governed by POPIA (South Africa)</ThemedText>
        <ThemedText style={styles.intro}>
          How the Genius Labs app collects, uses, and protects your information — matched to what the app actually does, not a generic template.
        </ThemedText>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
            {section.body.map((p, i) => (
              <ThemedText key={i} style={styles.paragraph}>{p}</ThemedText>
            ))}
          </View>
        ))}

        <View style={styles.contactCard}>
          <ThemedText style={styles.sectionTitle}>11. Contact us</ThemedText>
          <ThemedText style={styles.paragraph}>Questions about this policy, or a request about your data?</ThemedText>
          <ThemedText style={styles.contactLine}>Ravhuyani Genius Lab</ThemedText>
          <ThemedText style={styles.contactLine}>Ravhuyanigeniuslab@gmail.com</ThemedText>
          <ThemedText style={styles.contactLine}>014 004 0463 · WhatsApp +27 76 886 2384</ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  effective: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginBottom: 8 },
  intro: { fontSize: 14, color: '#4B5563', lineHeight: 21, marginBottom: Spacing.four },
  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  paragraph: { fontSize: 13.5, color: '#374151', lineHeight: 20, marginBottom: 8 },
  contactCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: Spacing.three,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 2,
  },
  contactLine: { fontSize: 13.5, color: '#374151', fontWeight: '500' },
});
