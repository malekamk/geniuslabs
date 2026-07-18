import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { uploadToStorage } from '@/utils/upload';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PayBtn = TouchableOpacity as any;
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingRow } from '@/components/loading-dots';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ALL_GRADES, ALL_OFFERED_SUBJECTS } from '@/constants/curriculum';
import { useAuth } from '@/context/auth-context';
import { useClasses } from '@/context/classes-context';
import { useNotifications } from '@/context/notification-context';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import type { Learner, Payment, EnrolmentApplication, Profile as TutorProfile, QuizAttempt, UserMaterialProgress } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';
// Postgres rejects '' for a uuid column (22P02) — use this instead of ?? '' so an
// unresolved id just filters to zero rows rather than throwing.
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

const CONTACT = {
  phone: '0140040463',
  whatsapp: '+27768862384',
  email: 'Ravhuyanigeniuslab@gmail.com',
  address: 'South Africa',
};

const ROLE_LABEL: Record<string, string> = {
  guardian: 'Guardian',
  tutor: 'Tutor',
  admin: 'Admin',
  learner: 'Learner',
};

const ROLE_COLOR: Record<string, string> = {
  guardian: '#1565C0',
  tutor: PRIMARY,
  admin: '#7C3AED',
  learner: '#059669',
};

const PAYMENT_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  overdue: { bg: '#FEE2E2', text: '#991B1B' },
  failed:  { bg: '#FEE2E2', text: '#991B1B' },
  waived:  { bg: '#F3F4F6', text: '#6B7280' },
  refunded:{ bg: '#EDE9FE', text: '#5B21B6' },
};

const APP_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E' },
  reviewing: { label: 'Reviewing', bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { label: 'Approved',  bg: '#D1FAE5', text: '#065F46' },
  rejected:  { label: 'Rejected',  bg: '#FEE2E2', text: '#991B1B' },
};

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, loginAs } = useAuth();

  // Tutor profile editing
  const [tutorBio, setTutorBio] = useState(profile?.bio ?? '');
  const [tutorSubjects, setTutorSubjects] = useState<string[]>(profile?.subjects ?? []);
  const [tutorGrades, setTutorGrades] = useState<string[]>(profile?.grades ?? []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  async function saveTutorProfile() {
    setSavingProfile(true);
    log.info('Profile', 'Saving tutor profile…');
    const { error } = await supabase.from('profiles').update({
      bio:      tutorBio.trim() || null,
      subjects: tutorSubjects,
      grades:   tutorGrades,
    }).eq('id', user!.id);
    setSavingProfile(false);
    if (error) { log.error('Profile', 'Save failed', error); Alert.alert('Error', 'Could not save. Try again.'); }
    else { log.ok('Profile', 'Tutor profile saved'); setEditingProfile(false); }
  }

  const isGuardian = profile?.role === 'guardian';
  const isTutor    = profile?.role === 'tutor';
  const isAdmin    = profile?.role === 'admin';
  const isLearner  = profile?.role === 'learner';

  const { data: myLearnerRow } = useSupabaseQuery<Learner>('learners', {
    filter: q => q.eq('profile_id', user?.id ?? NULL_UUID),
  });
  const myLearner = myLearnerRow[0] ?? null;

  const { data: learners, loading: learnersLoading, refetch: refetchLearners } =
    useSupabaseQuery<Learner>('learners', {
      filter: q => q.eq('guardian_id', user?.id ?? NULL_UUID),
    });

  const { data: applications, refetch: refetchApps } =
    useSupabaseQuery<EnrolmentApplication>('enrolment_applications', {
      select: 'id, learner_name, subjects, status, submitted_at, birth_cert_url, school_report_url, additional_file_url',
      filter: q => isLearner
        ? q.eq('learner_id', myLearner?.id ?? NULL_UUID).order('submitted_at', { ascending: false })
        : q.eq('guardian_profile_id', user?.id ?? NULL_UUID).order('submitted_at', { ascending: false }),
    });

  // useSupabaseQuery captures its filter once on mount — refetch once the learner id is known.
  useEffect(() => { if (myLearner?.id) refetchApps(); }, [myLearner?.id]);

  useFocusEffect(useCallback(() => {
    refetchLearners();
    refetchApps();
  }, []));

  const { data: payments, loading: paymentsLoading } =
    useSupabaseQuery<Payment>('payments', {
      select: '*',
      filter: q => q.eq('guardian_id', user?.id ?? NULL_UUID).order('due_date', { ascending: false }),
    });

  const { data: allTutors } = useSupabaseQuery<TutorProfile>('profiles', {
    filter: q => q.eq('role', 'tutor').eq('is_active', true),
  });

  const { data: myClasses, loading: classesLoading } =
    useSupabaseQuery<{ id: string }>('classes', {
      select: 'id',
      filter: q => q.or(`tutor_id.eq.${user?.id ?? NULL_UUID},created_by.eq.${user?.id ?? NULL_UUID}`),
    });

  const { classes: allClasses } = useClasses();
  const { permissionStatus, enableNotifications } = useNotifications();

  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [payingFee, setPayingFee] = useState<string | null>(null);
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null);

  async function startPayment(learner: Learner, fee: { label: string; amount: number; feeType: string }) {
    setPayingFee(fee.label);
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { learnerId: learner.id, feeType: fee.feeType, title: fee.label, amount: fee.amount },
    });
    setPayingFee(null);
    if (error || !data?.checkoutUrl) {
      log.error('Payment', 'create-checkout failed', error ?? data);
      Alert.alert('Error', 'Could not start payment. Please try again.');
      return;
    }
    setSelectedLearner(null);
    router.push({
      pathname: '/payment-webview',
      params: { url: data.checkoutUrl, title: fee.label, paymentId: data.paymentId },
    } as any);
  }

  async function resumePayment(payment: Payment) {
    setResumingPaymentId(payment.id);
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { paymentId: payment.id },
    });
    setResumingPaymentId(null);
    if (error || !data?.checkoutUrl) {
      log.error('Payment', 'resume create-checkout failed', error ?? data);
      Alert.alert('Error', 'Could not resume this payment. Please try again.');
      return;
    }
    router.push({
      pathname: '/payment-webview',
      params: { url: data.checkoutUrl, title: payment.description ?? 'Payment', paymentId: data.paymentId },
    } as any);
  }

  // Guardian edit-learner state
  const [editMode, setEditMode]   = useState(false);
  const [editName, setEditName]   = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editDOB, setEditDOB]     = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [localDocs, setLocalDocs] = useState<Record<string, { uri: string; mime: string }>>({});
  const [docNames, setDocNames]   = useState<Record<string, string>>({});

  const selectedApp = selectedLearner
    ? applications.find(a => a.learner_name === selectedLearner.full_name) ?? null
    : null;

  // Use a null-UUID fallback — returns 0 rows without crashing on invalid UUID
  const learnerProfileId = selectedLearner?.profile_id ?? NULL_UUID;

  const { data: learnerAttempts, refetch: refetchAttempts } = useSupabaseQuery<QuizAttempt>('quiz_attempts', {
    select: '*, quiz:quizzes(title, pass_score)',
    filter: q => q.eq('profile_id', learnerProfileId)
                  .eq('status', 'completed')
                  .order('completed_at', { ascending: false }),
  });
  const { data: learnerProgress, refetch: refetchProgress } = useSupabaseQuery<UserMaterialProgress>('user_material_progress', {
    select: '*, material:materials(title, grade)',
    filter: q => q.eq('profile_id', learnerProfileId),
  });

  // Refetch progress when a different learner is selected
  useEffect(() => {
    refetchAttempts();
    refetchProgress();
  }, [selectedLearner?.id]);

  const paddingTop = Platform.select({ web: Spacing.six, default: insets.top });

  function openEdit() {
    if (!selectedLearner) return;
    setEditName(selectedLearner.full_name);
    setEditGrade(selectedLearner.grade);
    setEditSchool(selectedLearner.school_name ?? '');
    setEditDOB(selectedLearner.date_of_birth ?? '');
    setLocalDocs({});
    setDocNames({});
    setEditMode(true);
  }

  async function pickDoc(key: 'birthCertFile' | 'schoolReportFile' | 'additionalFile') {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setLocalDocs(d => ({ ...d, [key]: { uri: asset.uri, mime: asset.mimeType ?? 'application/pdf' } }));
      setDocNames(n => ({ ...n, [key]: asset.name }));
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function saveEdit() {
    if (!selectedLearner) return;
    setSavingEdit(true);
    const { error: lerr } = await supabase.from('learners').update({
      full_name:     editName.trim() || selectedLearner.full_name,
      grade:         editGrade || selectedLearner.grade,
      school_name:   editSchool.trim() || null,
      date_of_birth: editDOB.trim() || null,
    }).eq('id', selectedLearner.id);
    if (lerr) { setSavingEdit(false); Alert.alert('Error', lerr.message); return; }

    if (selectedApp && Object.keys(localDocs).length > 0) {
      const colMap: Record<string, string> = {
        birthCertFile:   'birth_cert_url',
        schoolReportFile: 'school_report_url',
        additionalFile:  'additional_file_url',
      };
      const updates: Record<string, string> = {};
      for (const key of ['birthCertFile', 'schoolReportFile', 'additionalFile'] as const) {
        const local = localDocs[key];
        if (!local) continue;
        const ext = (docNames[key]?.split('.').pop() ?? 'pdf').toLowerCase();
        const path = `${user?.id ?? 'anon'}/${key}-${Date.now()}.${ext}`;
        try {
          updates[colMap[key]] = await uploadToStorage('enrolment-docs', path, local.uri, local.mime);
        } catch (e: any) { setSavingEdit(false); Alert.alert('Upload Failed', e.message); return; }
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('enrolment_applications').update(updates).eq('id', selectedApp.id);
      }
    }

    setSavingEdit(false);
    setEditMode(false);
    setLocalDocs({});
    setDocNames({});
    refetchLearners();
    refetchApps();
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/auth/login');
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    : null;

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentInset={{ bottom: insets.bottom + BottomTabInset + Spacing.three }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop }]}>

      <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' }}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
        </View>

        {/* ── IDENTITY CARD ── */}
        <LinearGradient colors={[PRIMARY, '#0D3B23']} style={styles.identityCard}>
          <View style={styles.avatarCircle}>
            <ThemedText style={styles.avatarText}>
              {initials(profile?.full_name, user?.email)}
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.idName}>{profile?.full_name ?? 'No name set'}</ThemedText>
            <ThemedText style={styles.idEmail}>{user?.email}</ThemedText>
            <View style={styles.idRow}>
              {profile?.role && (
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[profile.role] + '33' }]}>
                  <ThemedText style={[styles.roleBadgeText, { color: '#fff' }]}>
                    {ROLE_LABEL[profile.role]}
                  </ThemedText>
                </View>
              )}
              {memberSince && (
                <ThemedText style={styles.idSince}>Since {memberSince}</ThemedText>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── INFO CARD ── */}
        <View style={styles.infoCard}>
          {/* <InfoRow icon="call-outline" label="Phone" value={profile?.phone ?? '—'} />
          <View style={styles.divider} /> */}
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
          {(isTutor || isAdmin) && profile?.bio && (
            <>
              <View style={styles.divider} />
              <InfoRow icon="person-outline" label="Bio" value={profile.bio} />
            </>
          )}
        </View>

        {/* ── LEARNER: MY DETAILS ── */}
        {isLearner && myLearner && (
          <>
            <SectionLabel title="My Details" />
            {(() => {
              const app = applications.find(a => a.learner_name === myLearner.full_name);
              const learnerSubjects: string[] = app?.subjects ?? [];

              // Tutors who teach at least one of the learner's subjects + learner's grade
              const myTutors = allTutors.filter(t => {
                const subjectMatch = (t.subjects ?? []).some(s => learnerSubjects.includes(s));
                const gradeMatch = !(t.grades ?? []).length || (t.grades ?? []).includes(myLearner.grade);
                return subjectMatch && gradeMatch;
              });

              return (
                <>
                  <View style={styles.infoCard}>
                    <DetailRow icon="school-outline" label="Grade" value={myLearner.grade} />
                    {myLearner.school_name && (
                      <><View style={styles.divider} /><DetailRow icon="business-outline" label="School" value={myLearner.school_name} /></>
                    )}
                    {myLearner.date_of_birth && (
                      <><View style={styles.divider} /><DetailRow icon="calendar-outline" label="DOB" value={myLearner.date_of_birth} /></>
                    )}
                    {learnerSubjects.length > 0 && (
                      <><View style={styles.divider} /><DetailRow icon="book-outline" label="Subjects" value={learnerSubjects.join(' · ')} /></>
                    )}
                  </View>

                  <SectionLabel title="My Tutors" count={myTutors.length} />
                  <View style={styles.cardList}>
                    {myTutors.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <ThemedText style={styles.emptyText}>No tutors matched yet</ThemedText>
                      </View>
                    ) : myTutors.map(t => (
                      <View key={t.id} style={styles.learnerRow}>
                        <View style={[styles.learnerAvatar, { backgroundColor: PRIMARY + '18' }]}>
                          <ThemedText style={styles.learnerAvatarText}>
                            {(t.full_name ?? 'T')[0].toUpperCase()}
                          </ThemedText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.learnerName}>{t.full_name ?? 'Tutor'}</ThemedText>
                          <ThemedText style={styles.learnerMeta} numberOfLines={1}>
                            {(t.subjects ?? []).filter(s => learnerSubjects.includes(s)).join(' · ')}
                          </ThemedText>
                        </View>
                        {t.bio ? (
                          <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                        ) : null}
                      </View>
                    ))}
                  </View>

                  {/* My Documents */}
                  {app && (app.birth_cert_url || app.school_report_url || app.additional_file_url) && (
                    <>
                      <SectionLabel title="My Documents" />
                      <View style={styles.infoCard}>
                        {([
                          { label: 'Birth Certificate / ID', url: app.birth_cert_url },
                          { label: 'School Report',          url: app.school_report_url },
                          { label: 'Additional Document',    url: app.additional_file_url },
                        ] as { label: string; url: string | null }[]).filter(d => d.url).map(doc => (
                          <Pressable
                            key={doc.label}
                            style={styles.docRow}
                            onPress={() => Linking.openURL(doc.url!)}>
                            <Ionicons name="document-attach-outline" size={18} color={PRIMARY} />
                            <ThemedText style={styles.docLabel}>{doc.label}</ThemedText>
                            <Ionicons name="open-outline" size={14} color="#9CA3AF" />
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ── GUARDIAN: MY LEARNERS ── */}
        {isGuardian && (
          <>
            <SectionLabel title="My Learners" />
            <View style={styles.cardList}>
              {learnersLoading ? (
                <View style={styles.emptyCard}>
                  <LoadingRow label="Loading…" />
                </View>
              ) : (
                learners.map(l => {
                  const app = applications.find(a => a.learner_name === l.full_name);
                  const statusCfg = APP_STATUS[app?.status ?? 'pending'];
                  return (
                    <Pressable
                      key={l.id}
                      style={({ pressed }) => [styles.learnerRow, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => setSelectedLearner(l)}>
                      <View style={styles.learnerAvatar}>
                        <ThemedText style={styles.learnerAvatarText}>{l.full_name[0].toUpperCase()}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.learnerName}>{l.full_name}</ThemedText>
                        <ThemedText style={styles.learnerMeta}>{l.grade}{l.school_name ? ` · ${l.school_name}` : ''}</ThemedText>
                      </View>
                      {app?.status && (
                        <View style={[styles.statusChip, { backgroundColor: statusCfg.bg }]}>
                          <ThemedText style={[styles.statusChipText, { color: statusCfg.text }]}>{statusCfg.label}</ThemedText>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 4 }} />
                    </Pressable>
                  );
                })
              )}
              <Pressable style={styles.addBtn} onPress={() => router.push('/enroll')}>
                <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                <ThemedText style={styles.addBtnText}>Enrol New Learner</ThemedText>
              </Pressable>
            </View>
          </>
        )}

        {/* ── GUARDIAN: FEE STRUCTURE hint ── */}
        {isGuardian && learners.length > 0 && (
          <>
            <SectionLabel title="Fee Structure" />
            <View style={[styles.cardList, { padding: Spacing.three }]}>
              <View style={styles.feePrompt}>
                <Ionicons name="card-outline" size={18} color={PRIMARY} />
                <ThemedText style={styles.feePromptText}>
                  Tap any learner above to view their details and make a payment.
                </ThemedText>
              </View>
            </View>
          </>
        )}

        {/* ── GUARDIAN: PAYMENTS ── */}
        {isGuardian && (
          <>
            <SectionLabel title="Payments" />
            <View style={styles.cardList}>
              {paymentsLoading ? (
                <View style={styles.emptyCard}>
                  <LoadingRow label="Loading…" />
                </View>
              ) : payments.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={28} color="#D1D5DB" />
                  <ThemedText style={styles.emptyText}>No payments on record yet</ThemedText>
                </View>
              ) : (
                payments.map(p => {
                  const statusStyle = PAYMENT_STATUS_COLOR[p.status] ?? PAYMENT_STATUS_COLOR.pending;
                  const isResuming = resumingPaymentId === p.id;
                  return (
                    <View key={p.id} style={p.status === 'pending' ? styles.paymentRowWithAction : styles.paymentRow}>
                      <View style={styles.paymentRow}>
                        <View style={styles.paymentLeft}>
                          <ThemedText style={styles.paymentType}>
                            {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                          </ThemedText>
                          <ThemedText style={styles.paymentDate}>
                            {p.due_date ? `Due ${new Date(p.due_date).toLocaleDateString('en-ZA')}` : 'No due date'}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <ThemedText style={styles.paymentAmount}>R {Number(p.amount).toFixed(2)}</ThemedText>
                          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                            <ThemedText style={[styles.statusText, { color: statusStyle.text }]}>
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                      {p.status === 'pending' && (
                        <Pressable
                          style={styles.resumePayBtn}
                          disabled={isResuming}
                          onPress={() => resumePayment(p)}>
                          <ThemedText style={styles.resumePayBtnText}>
                            {isResuming ? 'Starting…' : 'Pay Now'}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── TUTOR: PROFILE ── */}
        {isTutor && (
          <>
            <SectionLabel title="My Classes" />
            <View style={[styles.infoCard, { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }]}>
              <View style={[styles.learnerAvatar, { backgroundColor: PRIMARY + '18' }]}>
                <Ionicons name="videocam" size={20} color={PRIMARY} />
              </View>
              <ThemedText style={styles.learnerName}>
                {classesLoading ? 'Loading…' : `${myClasses.length} class${myClasses.length !== 1 ? 'es' : ''} created`}
              </ThemedText>
              <Pressable onPress={() => router.push('/(tabs)/classes')} style={{ marginLeft: 'auto' }}>
                <ThemedText style={{ color: PRIMARY, fontWeight: '700', fontSize: 13 }}>View →</ThemedText>
              </Pressable>
            </View>

            <View style={styles.sectionLabelRow}>
              <SectionLabel title="About Me" />
              {!editingProfile && (
                <Pressable onPress={() => setEditingProfile(true)} style={styles.editIconBtn}>
                  {/* <Ionicons name="pencil-outline" size={15} color={PRIMARY} /> */}
                  <ThemedText style={styles.editIconBtnText}>Edit</ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.tutorEditCard}>
              {editingProfile ? (
                <>
                  <ThemedText style={styles.tutorFieldLabel}>Description</ThemedText>
                  <TextInput
                    style={styles.tutorBioInput}
                    value={tutorBio}
                    onChangeText={setTutorBio}
                    placeholder="Tell learners about yourself — qualifications, teaching style, experience…"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    autoFocus
                  />

                  <MultiSelectDropdown
                    label="Subjects I Teach"
                    options={ALL_OFFERED_SUBJECTS}
                    selected={tutorSubjects}
                    onToggle={(s: string) => toggleItem(tutorSubjects, setTutorSubjects, s)}
                  />

                  <MultiSelectDropdown
                    label="Grades (optional)"
                    options={ALL_GRADES}
                    selected={tutorGrades}
                    onToggle={(g: string) => toggleItem(tutorGrades, setTutorGrades, g)}
                  />

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.one }}>
                    <Pressable
                      style={[styles.saveProfileBtn, { flex: 1, backgroundColor: '#F3F4F6' }]}
                      onPress={() => setEditingProfile(false)}>
                      <ThemedText style={[styles.saveProfileBtnText, { color: '#6B7280' }]}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.saveProfileBtn, { flex: 2 }, savingProfile && { opacity: 0.6 }]}
                      onPress={saveTutorProfile}
                      disabled={savingProfile}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <ThemedText style={styles.saveProfileBtnText}>
                        {savingProfile ? 'Saving…' : 'Save'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {tutorBio ? (
                    <InfoRow icon="person-outline" label="Bio" value={tutorBio} />
                  ) : (
                    <ThemedText style={styles.tutorViewEmpty}>Tap Edit to fill in your profile</ThemedText>
                  )}
                  {tutorSubjects.length > 0 && (
                    <><View style={styles.divider} /><InfoRow icon="book-outline" label="Subjects" value={tutorSubjects.join(' · ')} /></>
                  )}
                  {tutorGrades.length > 0 && (
                    <><View style={styles.divider} /><InfoRow icon="school-outline" label="Grades" value={tutorGrades.join(' · ')} /></>
                  )}
                </>
              )}
            </View>
          </>
        )}

        {/* ── ADMIN: QUICK LINKS ── */}
        {isAdmin && (
          <>
            <SectionLabel title="Admin" />
            <View style={styles.cardList}>
              <Pressable
                style={styles.adminRow}
                onPress={() => router.push('/(tabs)/admin-enrolments' as any)}>
                <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
                <ThemedText style={styles.adminRowText}>View Enrolment Applications</ThemedText>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            </View>
          </>
        )}

        {/* ── NOTIFICATIONS ── */}
        {Platform.OS !== 'web' && (
          <>
            <SectionLabel title="Notifications" />
            <View style={styles.cardList}>
              <Pressable
                style={styles.contactRow}
                disabled={permissionStatus === 'granted'}
                onPress={enableNotifications}>
                <View style={[styles.contactIcon, { backgroundColor: PRIMARY + '18' }]}>
                  <Ionicons name="notifications" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.contactLabel}>Push Notifications</ThemedText>
                  <ThemedText style={[
                    styles.contactSub,
                    permissionStatus === 'granted' ? styles.notifStatusOn : styles.notifStatusOff,
                  ]}>
                    {permissionStatus === 'granted' ? 'Enabled' : 'Off — tap to enable'}
                  </ThemedText>
                </View>
                {permissionStatus !== 'granted' && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
              </Pressable>
            </View>
          </>
        )}

        {/* ── CONTACT US ── */}
        <SectionLabel title="Contact Us" />
        <View style={styles.cardList}>
          {[
            { icon: 'call' as const, label: 'Call Us', sub: CONTACT.phone, color: PRIMARY,
              onPress: () => Linking.openURL(`tel:${CONTACT.phone.replace(/\s/g, '')}`) },
            { icon: 'logo-whatsapp' as const, label: 'WhatsApp', sub: 'Send a message', color: '#128C7E',
              onPress: () => Linking.openURL(`https://wa.me/${CONTACT.whatsapp}`) },
            { icon: 'mail' as const, label: 'Email', sub: CONTACT.email, color: '#1565C0',
              onPress: () => Linking.openURL(`mailto:${CONTACT.email}`) },
          ].map(item => (
            <Pressable key={item.label} style={styles.contactRow} onPress={item.onPress}>
              <View style={[styles.contactIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.contactLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.contactSub} numberOfLines={1}>{item.sub}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </Pressable>
          ))}
        </View>

        {/* ── SIGN OUT ── */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </Pressable>

        <ThemedText style={styles.version}>Ravhuyani Genius Lab · Limpopo</ThemedText>

      </View>
    </ScrollView>

    {/* ── LEARNER DETAIL MODAL ── */}
    <Modal
      visible={!!selectedLearner}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSelectedLearner(null)}>
      {selectedLearner && (() => {
        const app = selectedApp;
        const statusCfg = APP_STATUS[app?.status ?? 'pending'];
        return (
          <View style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <View style={styles.learnerAvatar}>
                <ThemedText style={styles.learnerAvatarText}>{selectedLearner.full_name[0].toUpperCase()}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalTitle}>{selectedLearner.full_name}</ThemedText>
                <ThemedText style={styles.modalSub}>{selectedLearner.grade}</ThemedText>
              </View>
                  {isGuardian && !editMode && (
                <Pressable onPress={openEdit} style={styles.editBtn}>
                  <Ionicons name="create-outline" size={16} color={PRIMARY} />
                  <ThemedText style={styles.editBtnText}>Edit</ThemedText>
                </Pressable>
              )}
              <Pressable onPress={() => { setSelectedLearner(null); setEditMode(false); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>

              {/* Application status */}
              {app?.status && (
                <View style={[styles.statusBanner, { backgroundColor: statusCfg.bg }]}>
                  <Ionicons name="document-text-outline" size={16} color={statusCfg.text} />
                  <ThemedText style={[styles.statusBannerText, { color: statusCfg.text }]}>
                    Application: {statusCfg.label}
                  </ThemedText>
                </View>
              )}

              {/* Details */}
              {editMode ? (
                <View style={styles.editCard}>
                  <View>
                    <ThemedText style={styles.editFieldLabel}>FULL NAME</ThemedText>
                    <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Full name" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View>
                    <ThemedText style={styles.editFieldLabel}>GRADE</ThemedText>
                    <View style={styles.gradePillRow}>
                      {ALL_GRADES.map(g => (
                        <Pressable key={g} style={[styles.gradePill, editGrade === g && styles.gradePillActive]} onPress={() => setEditGrade(g)}>
                          <ThemedText style={[styles.gradePillText, editGrade === g && { color: '#fff' }]}>{g}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View>
                    <ThemedText style={styles.editFieldLabel}>SCHOOL NAME</ThemedText>
                    <TextInput style={styles.editInput} value={editSchool} onChangeText={setEditSchool} placeholder="e.g. Ravhuyani Secondary" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View>
                    <ThemedText style={styles.editFieldLabel}>DATE OF BIRTH</ThemedText>
                    <TextInput style={styles.editInput} value={editDOB} onChangeText={setEditDOB} placeholder="DD/MM/YYYY" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" />
                  </View>
                </View>
              ) : (
                <View style={styles.detailCard}>
                  <DetailRow icon="school-outline" label="Grade" value={selectedLearner.grade} />
                  {selectedLearner.school_name && (
                    <><View style={styles.modalDivider} /><DetailRow icon="business-outline" label="School" value={selectedLearner.school_name} /></>
                  )}
                  {selectedLearner.date_of_birth && (
                    <><View style={styles.modalDivider} /><DetailRow icon="calendar-outline" label="Date of Birth" value={selectedLearner.date_of_birth} /></>
                  )}
                  <View style={styles.modalDivider} />
                  <DetailRow icon="ellipse-outline" label="Status" value={selectedLearner.is_active ? 'Active' : 'Inactive'} />
                </View>
              )}

              {/* Subjects */}
              {app?.subjects && app.subjects.length > 0 && (
                <>
                  <ThemedText style={styles.modalSectionLabel}>ENROLLED SUBJECTS</ThemedText>
                  <View style={styles.subjectGrid}>
                    {app.subjects.map(s => (
                      <View key={s} style={styles.subjectPill}>
                        <Ionicons name="book-outline" size={12} color={PRIMARY} />
                        <ThemedText style={styles.subjectPillText}>{s}</ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {app?.submitted_at && (
                <ThemedText style={styles.submittedAt}>
                  Application submitted {new Date(app.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </ThemedText>
              )}

              {/* Documents */}
              {(editMode || app?.birth_cert_url || app?.school_report_url || app?.additional_file_url) && (
                <>
                  <ThemedText style={styles.modalSectionLabel}>DOCUMENTS</ThemedText>
                  {([
                    { key: 'birthCertFile',    label: 'Birth Certificate / ID', url: app?.birth_cert_url },
                    { key: 'schoolReportFile', label: 'School Report',          url: app?.school_report_url },
                    { key: 'additionalFile',   label: 'Additional Document',    url: app?.additional_file_url },
                  ] as const).map(doc => {
                    const picked = !!localDocs[doc.key];
                    if (editMode) {
                      return (
                        <Pressable
                          key={doc.key}
                          style={[styles.docUploadRow, picked ? styles.docUploadDone : styles.docUploadIdle]}
                          onPress={() => pickDoc(doc.key)}>
                          <Ionicons
                            name={picked ? 'checkmark-circle' : (doc.url ? 'refresh-outline' : 'cloud-upload-outline')}
                            size={18}
                            color={picked ? '#16A34A' : doc.url ? PRIMARY : '#9CA3AF'}
                          />
                          <ThemedText style={[styles.docUploadText, { color: picked ? '#16A34A' : doc.url ? PRIMARY : '#9CA3AF' }]} numberOfLines={1}>
                            {picked ? docNames[doc.key] : doc.url ? `Replace: ${doc.label}` : `Upload: ${doc.label}`}
                          </ThemedText>
                          <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                        </Pressable>
                      );
                    }
                    if (!doc.url) return null;
                    return (
                      <Pressable key={doc.key} style={styles.docRow} onPress={() => Linking.openURL(doc.url!)}>
                        <Ionicons name="document-attach-outline" size={18} color={PRIMARY} />
                        <ThemedText style={styles.docLabel}>{doc.label}</ThemedText>
                        <Ionicons name="open-outline" size={14} color="#9CA3AF" />
                      </Pressable>
                    );
                  })}
                  {editMode && (
                    <View style={styles.editActions}>
                      <Pressable style={styles.cancelBtn} onPress={() => setEditMode(false)}>
                        <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.saveBtn, savingEdit && { opacity: 0.6 }]} onPress={saveEdit} disabled={savingEdit}>
                        <Ionicons name={savingEdit ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
                        <ThemedText style={styles.saveBtnText}>{savingEdit ? 'Saving…' : 'Save Changes'}</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* Classes for this learner */}
              {(() => {
                const enrolledSubjects: string[] = app?.subjects ?? [];
                const myClasses = allClasses.filter(c =>
                  c.grade === selectedLearner.grade &&
                  (enrolledSubjects.length === 0 || enrolledSubjects.includes(c.subject))
                );
                if (!myClasses.length) return null;
                return (
                  <>
                    <ThemedText style={styles.modalSectionLabel}>CLASSES</ThemedText>
                    {myClasses.map(c => (
                      <View key={c.id} style={styles.progressRow}>
                        <View style={[styles.progressDot, { backgroundColor: c.live ? PRIMARY : '#9CA3AF' }]} />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.progressTitle}>{c.title}</ThemedText>
                          <ThemedText style={styles.progressMeta}>{c.subject} · {c.time}</ThemedText>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: c.live ? '#D1FAE5' : '#F3F4F6' }]}>
                          <ThemedText style={[styles.statusChipText, { color: c.live ? '#065F46' : '#6B7280' }]}>
                            {c.live ? 'Live' : 'Scheduled'}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </>
                );
              })()}

              {/* Quiz results — paused for MVP */}

              {/* Material progress */}
              {learnerProgress.length > 0 && (
                <>
                  <ThemedText style={styles.modalSectionLabel}>MATERIAL PROGRESS</ThemedText>
                  {learnerProgress.map(p => {
                    const material = (p as any).material;
                    const cfg = { done: { label: 'Done', color: '#065F46', bg: '#D1FAE5' }, in_progress: { label: 'In Progress', color: '#92400E', bg: '#FEF3C7' }, new: { label: 'New', color: '#1E40AF', bg: '#DBEAFE' } }[p.status] ?? { label: p.status, color: '#6B7280', bg: '#F3F4F6' };
                    return (
                      <View key={p.id} style={styles.progressRow}>
                        <Ionicons name="document-text-outline" size={16} color="#9CA3AF" />
                        <ThemedText style={[styles.progressTitle, { flex: 1 }]} numberOfLines={1}>{material?.title ?? 'Material'}</ThemedText>
                        <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                          <ThemedText style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {learnerAttempts.length === 0 && learnerProgress.length === 0 && selectedLearner.profile_id == null && (
                <View style={styles.noAccountNote}>
                  <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                  <ThemedText style={styles.noAccountNoteText}>
                    Detailed marks and progress will appear once {selectedLearner.full_name.split(' ')[0]} creates their own account.
                  </ThemedText>
                </View>
              )}

              {/* ── PAY FOR THIS LEARNER ── */}
              <ThemedText style={styles.modalSectionLabel}>MAKE A PAYMENT</ThemedText>
              {app && app.status !== 'approved' ? (
                <View style={styles.feePrompt}>
                  <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
                  <ThemedText style={styles.feePromptText}>
                    Payment unlocks once the application is approved. Current status: {statusCfg.label}.
                  </ThemedText>
                </View>
              ) : (
                <View style={{ gap: Spacing.two, marginBottom: Spacing.three }}>
                  {[
                    { label: 'Monthly Tuition',         note: 'R890 per subject / month', amount: 890, feeType: 'tuition' },
                    { label: 'Psychological Assessment', note: 'Once-off fee',             amount: 250, feeType: 'registration' },
                  ].map(fee => (
                    <View key={fee.label} style={styles.feeRow}>
                      <View style={styles.feeTop}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.feeLabel}>{fee.label}</ThemedText>
                          <ThemedText style={styles.feeNote}>{fee.note}</ThemedText>
                        </View>
                        <ThemedText style={styles.feeAmount}>R{fee.amount}</ThemedText>
                      </View>
                      <PayBtn
                        style={styles.payBtn}
                        activeOpacity={0.8}
                        disabled={payingFee === fee.label}
                        onPress={() => startPayment(selectedLearner, fee)}>
                        <ThemedText style={styles.payBtnText}>
                          {payingFee === fee.label ? 'Starting…' : 'Pay Now'}
                        </ThemedText>
                      </PayBtn>
                    </View>
                  ))}
                </View>
              )}

              {isGuardian && (
                <Pressable
                  style={styles.viewAsBtn}
                  onPress={() => {
                    loginAs({
                      id: selectedLearner.profile_id ?? selectedLearner.id,
                      role: 'learner',
                      full_name: selectedLearner.full_name,
                      phone: null,
                      avatar_url: null,
                      bio: null,
                      subjects: null,
                      grades: [selectedLearner.grade],
                      is_active: true,
                      created_at: selectedLearner.created_at,
                      updated_at: selectedLearner.updated_at,
                    });
                    setSelectedLearner(null);
                    router.replace('/(tabs)');
                  }}>
                  <Ionicons name="person-circle-outline" size={18} color="#fff" />
                  <ThemedText style={styles.viewAsBtnText}>
                    Login as {selectedLearner.full_name.split(' ')[0]}
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>
        );
      })()}
    </Modal>
    </>
  );
}

function MultiSelectDropdown({
  label, options, selected, onToggle,
}: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = selected.length === 0
    ? 'None selected'
    : selected.length <= 3
      ? selected.join(', ')
      : `${selected.slice(0, 3).join(', ')} +${selected.length - 3} more`;
  return (
    <View style={{ marginTop: Spacing.two }}>
      <ThemedText style={styles.tutorFieldLabel}>{label}</ThemedText>
      <Pressable
        style={styles.dropdownTrigger}
        onPress={() => setOpen(v => !v)}>
        <ThemedText style={[styles.dropdownSummary, selected.length === 0 && { color: '#9CA3AF' }]} numberOfLines={1}>
          {summary}
        </ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </Pressable>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((opt, i) => {
            const checked = selected.includes(opt);
            return (
              <Pressable key={opt} onPress={() => onToggle(opt)}
                style={[styles.dropdownItem, i < options.length - 1 && styles.dropdownItemBorder]}>
                <ThemedText style={styles.dropdownItemText}>{opt}</ThemedText>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionLabel}>
      <ThemedText style={styles.sectionLabelText}>{title.toUpperCase()}</ThemedText>
      {count !== undefined && (
        <View style={styles.countBadge}>
          <ThemedText style={styles.countBadgeText}>{count}</ThemedText>
        </View>
      )}
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color="#9CA3AF" />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#9CA3AF" />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue} numberOfLines={2}>{value}</ThemedText>
    </View>
  );
}


const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: Spacing.five, gap: Spacing.two },

  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },

  identityCard: {
    marginHorizontal: Spacing.four,
    borderRadius: 8,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  idName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  idEmail: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  roleBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  idSince: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: Spacing.four,
    borderRadius: 8,
    paddingVertical: Spacing.one,
    elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
  },
  infoLabel: { fontSize: 13, color: '#9CA3AF', width: 48 },
  infoValue: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: Spacing.three },

  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three, marginBottom: Spacing.one,
  },
  sectionLabelText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  countBadge: {
    backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#374151' },

  cardList: {
    marginHorizontal: Spacing.four,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },

  emptyCard: {
    paddingVertical: Spacing.four,
    alignItems: 'center', gap: Spacing.two,
  },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  learnerCard: {
    paddingHorizontal: Spacing.three, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8,
  },
  learnerCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  // Modal
  modalRoot: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    padding: Spacing.four, paddingTop: Spacing.five,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 999 },
  modalBody: { padding: Spacing.four, gap: Spacing.three },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, padding: Spacing.two + 4,
  },
  statusBannerText: { fontSize: 14, fontWeight: '700' },
  detailCard: {
    backgroundColor: '#fff', borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  modalDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: Spacing.three },
  modalSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: Spacing.one,
  },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submittedAt: { fontSize: 11, color: '#D1D5DB', textAlign: 'center', marginTop: Spacing.two },

  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  progressDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  progressTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  progressMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  noAccountNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: Spacing.two,
    marginTop: Spacing.two,
  },
  noAccountNoteText: { flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  viewAsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, paddingVertical: Spacing.three, borderRadius: 8, marginTop: Spacing.two,
  },
  viewAsBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  tutorEditCard: {
    marginHorizontal: Spacing.four,
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  tutorFieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tutorBioInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 10,
    fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
    minHeight: 90, textAlignVertical: 'top',
  },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    backgroundColor: '#F9FAFB', marginTop: 6,
  },
  dropdownSummary: { flex: 1, fontSize: 14, color: '#111827' },
  dropdownList: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#fff', marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: 12,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 14, color: '#374151' },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  editPillActive: { backgroundColor: PRIMARY },
  editPillText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: Spacing.four,
  },
  editIconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editIconBtnText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  tutorViewText: { fontSize: 14, color: '#374151', lineHeight: 21 },
  tutorViewEmpty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  saveProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, paddingVertical: 12, borderRadius: 8, marginTop: Spacing.one,
  },
  saveProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  learnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 50 },
  detailText: { fontSize: 12, color: '#6B7280' },
  subjectsWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginLeft: 50 },
  subjectPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  subjectPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  subjectPillText: { fontSize: 11, fontWeight: '600', color: PRIMARY },
  learnerAvatar: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center',
  },
  learnerAvatarText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  learnerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  learnerMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  activeBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '600' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  paymentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  paymentLeft: { gap: 3 },
  paymentType: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentDate: { fontSize: 12, color: '#6B7280' },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },

  paymentRowWithAction: {},
  resumePayBtn: {
    marginHorizontal: Spacing.three,
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resumePayBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  adminRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: 14,
  },
  adminRowText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  contactIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  contactSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  notifStatusOn: { color: '#16A34A', fontWeight: '600' },
  notifStatusOff: { color: '#D97706', fontWeight: '600' },

  signOutBtn: {
    marginHorizontal: Spacing.four, marginTop: Spacing.three,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: Spacing.three, borderRadius: 8,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  version: { textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: Spacing.two },

  feePrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12,
  },
  feePromptText: { flex: 1, fontSize: 13, color: '#6B7280' },
  feeForRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PRIMARY + '12', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  feeForText: { fontSize: 13, color: '#374151' },
  feeForName: { fontWeight: '700', color: PRIMARY },
  feeRow: {
    backgroundColor: '#F9FAFB', borderRadius: 8,
    padding: Spacing.three, gap: Spacing.two,
  },
  feeTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  feeLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  feeNote:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  feeAmount: { fontSize: 20, fontWeight: '800', color: PRIMARY, flexShrink: 0 },
  payBtn: {
    backgroundColor: '#000', borderRadius: 8,
    paddingVertical: 11, alignItems: 'center',
  },
  payBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1565C0' },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: PRIMARY + '40',
    backgroundColor: PRIMARY + '10',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  editCard: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  editFieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  editInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: '#111827', backgroundColor: '#FAFAFA',
  },
  gradePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gradePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  gradePillActive: { backgroundColor: PRIMARY },
  gradePillText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  docUploadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 8, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 11,
  },
  docUploadIdle: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  docUploadDone: { borderColor: '#22C55E', backgroundColor: '#F0FDF4', borderStyle: 'solid' },
  docUploadText: { flex: 1, fontSize: 13 },

  editActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: PRIMARY, borderRadius: 8, paddingVertical: 12,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn: {
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
