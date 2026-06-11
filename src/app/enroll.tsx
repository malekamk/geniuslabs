import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { uploadToStorage } from '@/utils/upload';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ALL_GRADES, subjectsForGrade } from '@/constants/curriculum';
import { useAuth } from '@/context/auth-context';

const PRIMARY   = '#1565C0';
const PRIMARY_D = '#0D47A1';
const BG        = '#F8FAFC';
const BORDER    = '#E2E8F0';
const LABEL     = '#0F172A';
const SUB       = '#64748B';
const R         = 8;

// ─── Dropdown (single-select) ────────────────────────────────────────────────
function Dropdown({ label, value, placeholder, options, onSelect, disabled }: {
  label: string; value: string; placeholder: string;
  options: string[]; onSelect: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.field}>
      <ThemedText style={s.fieldLabel}>{label}</ThemedText>
      <Pressable
        style={[s.dropTrigger, disabled && s.dropDisabled]}
        onPress={() => !disabled && setOpen(true)}>
        <ThemedText style={[s.dropText, !value && { color: '#94A3B8' }]}>
          {value || placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <ThemedText style={s.sheetTitle}>{label}</ThemedText>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.sheetRow, value === opt && s.sheetRowActive]}
                  onPress={() => { onSelect(opt); setOpen(false); }}>
                  <ThemedText style={[s.sheetRowText, value === opt && { color: PRIMARY, fontWeight: '700' }]}>
                    {opt}
                  </ThemedText>
                  {value === opt && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Multi-select subjects ───────────────────────────────────────────────────
function SubjectMultiSelect({ grade, selected, onToggle, disabled }: {
  grade: string; selected: string[]; onToggle: (s: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const opts = subjectsForGrade(grade);
  const label = selected.length === 0
    ? (disabled ? 'Select a grade first' : 'Select subjects…')
    : selected.length === 1 ? selected[0] : `${selected.length} subjects selected`;

  return (
    <View style={s.field}>
      <ThemedText style={s.fieldLabel}>Subjects Requiring Support <ThemedText style={s.req}>*</ThemedText></ThemedText>
      <Pressable
        style={[s.dropTrigger, disabled && s.dropDisabled]}
        onPress={() => !disabled && setOpen(true)}>
        <ThemedText style={[s.dropText, selected.length === 0 && { color: '#94A3B8' }]}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
      </Pressable>
      {selected.length > 0 && (
        <View style={s.chipRow}>
          {selected.map(s2 => (
            <Pressable key={s2} style={s.chip} onPress={() => onToggle(s2)}>
              <ThemedText style={s.chipText}>{s2}</ThemedText>
              <Ionicons name="close" size={11} color={PRIMARY} />
            </Pressable>
          ))}
        </View>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <ThemedText style={s.sheetTitle}>Subjects · {grade}</ThemedText>
            <ThemedText style={s.sheetSub}>Select all subjects requiring support</ThemedText>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {opts.map(opt => {
                const checked = selected.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.sheetRow, checked && s.sheetRowActive]}
                    onPress={() => onToggle(opt)}>
                    <View style={[s.checkBox, checked && s.checkBoxChecked]}>
                      {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <ThemedText style={[s.sheetRowText, checked && { color: PRIMARY, fontWeight: '600' }]}>
                      {opt}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.sheetDone} onPress={() => setOpen(false)}>
              <ThemedText style={s.sheetDoneText}>Done ({selected.length} selected)</ThemedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Form types ──────────────────────────────────────────────────────────────
type FormState = {
  learnerName: string;
  learnerDOB: string;
  schoolName: string;
  grade: string;
  subjects: string[];
  popia: boolean;
};

const INITIAL: FormState = {
  learnerName: '', learnerDOB: '', schoolName: '',
  grade: '', subjects: [], popia: false,
};

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ step, title, sub }: { step: string; title: string; sub?: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.stepBadge}><ThemedText style={s.stepText}>{step}</ThemedText></View>
      <View style={{ flex: 1 }}>
        <ThemedText style={s.sectionTitle}>{title}</ThemedText>
        {sub && <ThemedText style={s.sectionSub}>{sub}</ThemedText>}
      </View>
    </View>
  );
}

// ─── Upload row ───────────────────────────────────────────────────────────────
function UploadRow({ label, required, fileName, onPress, done }: {
  label: string; required?: boolean; fileName?: string; onPress: () => void; done: boolean;
}) {
  return (
    <Pressable style={[s.uploadRow, done && s.uploadRowDone]} onPress={onPress}>
      <View style={[s.uploadIcon, done && { backgroundColor: '#DCFCE7' }]}>
        <Ionicons name={done ? 'checkmark-circle' : 'cloud-upload-outline'} size={20} color={done ? '#16A34A' : '#94A3B8'} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[s.uploadLabel, done && { color: LABEL }]}>
          {label}{required && <ThemedText style={s.req}> *</ThemedText>}
        </ThemedText>
        <ThemedText style={[s.uploadSub, done && { color: PRIMARY }]} numberOfLines={1}>
          {fileName || 'PDF or image · tap to select'}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={done ? PRIMARY : '#CBD5E1'} />
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function EnrollScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { subject: preSubject } = useLocalSearchParams<{ subject?: string }>();
  const [form, setForm] = useState<FormState>({
    ...INITIAL, subjects: preSubject ? [preSubject] : [],
  });
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileNames, setFileNames]   = useState<Record<string, string>>({});
  const [localFiles, setLocalFiles] = useState<Record<string, { uri: string; mime: string }>>({});

  const set = (key: keyof FormState) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  function selectGrade(g: string) {
    setForm(f => ({ ...f, grade: g, subjects: [] }));
  }

  function toggleSubject(sub: string) {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(sub)
        ? f.subjects.filter(x => x !== sub)
        : [...f.subjects, sub],
    }));
  }

  async function pickFile(key: 'birthCertFile' | 'schoolReportFile' | 'additionalFile') {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setLocalFiles(f => ({ ...f, [key]: { uri: asset.uri, mime: asset.mimeType ?? 'application/pdf' } }));
      setFileNames(n => ({ ...n, [key]: asset.name }));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not pick file.');
    }
  }

  async function uploadLocalFiles() {
    const urls: Record<string, string> = {};
    for (const key of ['birthCertFile', 'schoolReportFile', 'additionalFile'] as const) {
      const local = localFiles[key];
      if (!local) continue;
      const ext = (fileNames[key]?.split('.').pop() ?? 'pdf').toLowerCase();
      const path = `${user?.id ?? 'anon'}/${key}-${Date.now()}.${ext}`;
      urls[key] = await uploadToStorage('enrolment-docs', path, local.uri, local.mime);
    }
    return urls;
  }

  function validate(): string | null {
    if (!form.learnerName.trim())    return "Learner's full name is required.";
    if (!form.learnerDOB.trim())     return "Learner's date of birth is required.";
    if (!form.grade)                 return 'Current grade is required.';
    if (form.subjects.length === 0)  return 'Select at least one subject.';
    if (!localFiles.birthCertFile)   return 'Birth Certificate / ID is required.';
    if (!localFiles.schoolReportFile) return 'School report is required.';
    if (!form.popia)                 return 'POPIA consent is required.';
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { Alert.alert('Incomplete', err); return; }

    setSubmitting(true);
    let fileUrls: Record<string, string> = {};
    try {
      fileUrls = await uploadLocalFiles();
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Upload Failed', e.message ?? 'Could not upload documents. Please try again.');
      return;
    }

    const { data: appData, error: dbErr } = await supabase.from('enrolment_applications').insert({
      email:               user?.email ?? '',
      guardian_name:       profile?.full_name ?? '',
      guardian_phone:      profile?.phone ?? '',
      guardian_email:      user?.email ?? '',
      learner_name:        form.learnerName,
      learner_dob:         form.learnerDOB,
      grade:               form.grade,
      subjects:            form.subjects,
      birth_cert_url:      fileUrls.birthCertFile    ?? null,
      school_report_url:   fileUrls.schoolReportFile ?? null,
      additional_file_url: fileUrls.additionalFile   ?? null,
      popia_consent:       form.popia,
      guardian_profile_id: user?.id ?? null,
    }).select('id').single();

    if (dbErr) {
      setSubmitting(false);
      log.error('Enrolment', 'Insert failed', dbErr);
      Alert.alert('Submission Failed', 'Could not submit. Please check your connection and try again.');
      return;
    }

    const dobIso = form.learnerDOB
      ? form.learnerDOB.split('/').reverse().join('-')
      : null;

    const { data: learnerData, error: learnerErr } = await supabase.from('learners').insert({
      guardian_id:   user!.id,
      full_name:     form.learnerName,
      date_of_birth: dobIso,
      grade:         form.grade,
      school_name:   form.schoolName || null,
    }).select('id').single();
    if (learnerErr) log.warn('Enrolment', 'Learner row insert failed (non-fatal)', learnerErr);

    if (appData?.id && learnerData?.id) {
      await supabase.from('enrolment_applications').update({ learner_id: learnerData.id }).eq('id', appData.id);
    }

    setSubmitting(false);
    log.ok('Enrolment', 'Submitted', { learner: form.learnerName });
    setSubmitted(true);
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={s.successRoot}>
        <LinearGradient colors={[PRIMARY, PRIMARY_D]} style={s.successIcon}>
          <Ionicons name="checkmark" size={42} color="#fff" />
        </LinearGradient>
        <ThemedText style={s.successTitle}>Application Submitted!</ThemedText>
        <ThemedText style={s.successSub}>
          We'll contact you at {profile?.phone ?? user?.email} within 24 hours to confirm classes and fees.
        </ThemedText>
        <View style={s.successCard}>
          {[
            { icon: 'person-outline',   label: 'Learner', value: form.learnerName },
            { icon: 'school-outline',   label: 'Grade',   value: form.grade },
            { icon: 'book-outline',     label: 'Subjects', value: form.subjects.join(', ') },
          ].map(r => (
            <View key={r.label} style={s.successRow}>
              <Ionicons name={r.icon as any} size={15} color={PRIMARY} />
              <ThemedText style={s.successRowLabel}>{r.label}</ThemedText>
              <ThemedText style={s.successRowVal} numberOfLines={1}>{r.value}</ThemedText>
            </View>
          ))}
        </View>
        <Pressable style={s.doneBtn} onPress={() => { setForm(INITIAL); setSubmitted(false); router.back(); }}>
          <ThemedText style={s.doneBtnText}>Back to Home</ThemedText>
        </Pressable>
      </View>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Hero header */}
        <LinearGradient colors={[PRIMARY, PRIMARY_D]} style={[s.hero, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <View style={s.heroIcon}>
            <Ionicons name="school" size={28} color="#fff" />
          </View>
          <ThemedText style={s.heroTitle}>Learner Enrolment</ThemedText>
          <ThemedText style={s.heroSub}>Complete the form below — our team will confirm classes within 24 hours</ThemedText>
        </LinearGradient>

        {/* Guardian identity bar */}
        <View style={s.guardianBar}>
          <View style={s.guardianAvatar}>
            <Ionicons name="person-circle" size={30} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={s.guardianName}>{profile?.full_name ?? user?.email}</ThemedText>
            <ThemedText style={s.guardianEmail}>{user?.email}</ThemedText>
          </View>
          <View style={s.guardianBadge}>
            <ThemedText style={s.guardianBadgeText}>Guardian</ThemedText>
          </View>
        </View>

        {/* Fee overview */}
        <View style={s.card}>
          <ThemedText style={s.cardTitle}>Fee Structure</ThemedText>
          <View style={s.divider} />
          {[
            { label: 'Monthly tuition (fixed)', amount: 'R 890' },
            { label: 'Psychological assessment (once-off)', amount: 'R 250' },
          ].map(f => (
            <View key={f.label} style={s.feeRow}>
              <Ionicons name="cash-outline" size={14} color="#94A3B8" />
              <ThemedText style={s.feeLabel}>{f.label}</ThemedText>
              <ThemedText style={s.feeAmount}>{f.amount}</ThemedText>
            </View>
          ))}
        </View>

        {/* POPIA notice */}
        <View style={s.notice}>
          <Ionicons name="shield-checkmark" size={16} color='#0369A1' />
          <View style={{ flex: 1 }}>
            <ThemedText style={s.noticeTitle}>POPIA Compliant</ThemedText>
            <ThemedText style={s.noticeSub}>Your information is treated as confidential and processed in accordance with POPIA.</ThemedText>
          </View>
        </View>

        {/* ── SECTION 1: Learner details ── */}
        <View style={s.card}>
          <Section step="1" title="Learner Details" sub="Enter the learner's personal information" />
          <View style={s.divider} />

          <View style={s.field}>
            <ThemedText style={s.fieldLabel}>Full Name <ThemedText style={s.req}>*</ThemedText></ThemedText>
            <TextInput
              style={s.input}
              value={form.learnerName}
              onChangeText={set('learnerName')}
              placeholder="e.g. Tshimangadzo Maluleke"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={s.field}>
            <ThemedText style={s.fieldLabel}>Date of Birth <ThemedText style={s.req}>*</ThemedText></ThemedText>
            <TextInput
              style={s.input}
              value={form.learnerDOB}
              onChangeText={set('learnerDOB')}
              placeholder="DD/MM/YYYY  e.g. 17/01/2010"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={s.field}>
            <ThemedText style={s.fieldLabel}>School Name</ThemedText>
            <TextInput
              style={s.input}
              value={form.schoolName}
              onChangeText={set('schoolName')}
              placeholder="e.g. Ravhuyani Secondary School"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <Dropdown
            label="Current Grade *"
            value={form.grade}
            placeholder="Select grade…"
            options={ALL_GRADES}
            onSelect={selectGrade}
          />
        </View>

        {/* ── SECTION 2: Subjects ── */}
        <View style={s.card}>
          <Section step="2" title="Subjects" sub="CAPS-aligned · select all that apply" />
          <View style={s.divider} />
          <SubjectMultiSelect
            grade={form.grade}
            selected={form.subjects}
            onToggle={toggleSubject}
            disabled={!form.grade}
          />
        </View>

        {/* ── SECTION 3: Documents ── */}
        <View style={s.card}>
          <Section step="3" title="Documents" sub="PDF or image files accepted" />
          <View style={s.divider} />
          {([
            { key: 'birthCertFile',   label: 'Birth Certificate / ID',  required: true  },
            { key: 'schoolReportFile', label: 'Latest School Report',     required: true  },
            { key: 'additionalFile',  label: 'Additional Documents',      required: false },
          ] as const).map(doc => (
            <UploadRow
              key={doc.key}
              label={doc.label}
              required={doc.required}
              done={!!localFiles[doc.key]}
              fileName={fileNames[doc.key]}
              onPress={() => pickFile(doc.key)}
            />
          ))}
        </View>

        {/* ── POPIA consent ── */}
        <Pressable style={s.popiaRow} onPress={() => setForm(f => ({ ...f, popia: !f.popia }))}>
          <View style={[s.checkBox, form.popia && s.checkBoxChecked]}>
            {form.popia && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <ThemedText style={s.popiaText}>
            I consent to the processing of personal information for enrolment and academic support purposes in accordance with POPIA.{' '}
            <ThemedText style={s.req}>*</ThemedText>
          </ThemedText>
        </Pressable>

        {/* ── Submit ── */}
        <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          <LinearGradient colors={[PRIMARY, PRIMARY_D]} style={s.submitInner}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />}
            <ThemedText style={s.submitText}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </ThemedText>
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { gap: 0 },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: { padding: Spacing.four, paddingBottom: 28, gap: 8, alignItems: 'center' },
  backBtn: {
    position: 'absolute', top: 16, left: Spacing.four,
    width: 36, height: 36, borderRadius: R,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: R,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 19 },

  // ── Guardian bar ───────────────────────────────────────────────────────────
  guardianBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: Spacing.four, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  guardianAvatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  guardianName: { fontSize: 14, fontWeight: '700', color: LABEL },
  guardianEmail: { fontSize: 12, color: SUB },
  guardianBadge: { backgroundColor: PRIMARY + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  guardianBadgeText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', marginHorizontal: Spacing.three, marginTop: Spacing.two,
    borderRadius: R, gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.three,
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: LABEL },
  divider: { height: 1, backgroundColor: '#F1F5F9' },

  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  feeLabel: { flex: 1, fontSize: 13, color: SUB },
  feeAmount: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  // ── Notice ─────────────────────────────────────────────────────────────────
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F0F9FF', marginHorizontal: Spacing.three, marginTop: Spacing.two,
    borderRadius: R, padding: Spacing.two + 4,
    borderLeftWidth: 3, borderLeftColor: '#0EA5E9',
  },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#0369A1' },
  noticeSub: { fontSize: 12, color: '#0369A1', lineHeight: 17, opacity: 0.8, marginTop: 2 },

  // ── Section header ─────────────────────────────────────────────────────────
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: {
    width: 26, height: 26, borderRadius: R,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: LABEL, marginTop: 2 },
  sectionSub: { fontSize: 12, color: SUB, marginTop: 2 },

  // ── Fields ─────────────────────────────────────────────────────────────────
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  req: { color: '#DC2626' },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: R,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: LABEL, backgroundColor: '#FAFAFA',
  },

  // ── Dropdown ───────────────────────────────────────────────────────────────
  dropTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: BORDER, borderRadius: R,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FAFAFA',
  },
  dropDisabled: { opacity: 0.45 },
  dropText: { fontSize: 15, color: LABEL, flex: 1 },

  // ── Subject chips ──────────────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PRIMARY + '12', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  // ── Sheet ──────────────────────────────────────────────────────────────────
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8,
    paddingBottom: 32, maxHeight: '65%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 15, fontWeight: '700', color: LABEL,
    paddingHorizontal: Spacing.four, paddingTop: 8, paddingBottom: 4,
  },
  sheetSub: { fontSize: 12, color: SUB, paddingHorizontal: Spacing.four, paddingBottom: 8 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.four, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  sheetRowActive: { backgroundColor: PRIMARY + '08' },
  sheetRowText: { flex: 1, fontSize: 15, color: LABEL },
  checkBox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sheetDone: {
    marginHorizontal: Spacing.four, marginTop: 12,
    backgroundColor: PRIMARY, borderRadius: R,
    paddingVertical: 13, alignItems: 'center',
  },
  sheetDoneText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Upload rows ────────────────────────────────────────────────────────────
  uploadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: R, borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FAFAFA',
  },
  uploadRowDone: { borderColor: '#22C55E', backgroundColor: '#F0FDF4' },
  uploadIcon: {
    width: 36, height: 36, borderRadius: R,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  uploadLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  uploadSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // ── POPIA ──────────────────────────────────────────────────────────────────
  popiaRow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginHorizontal: Spacing.three, marginTop: Spacing.two,
    backgroundColor: '#fff', borderRadius: R, padding: Spacing.three,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  popiaText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 20 },

  // ── Submit ─────────────────────────────────────────────────────────────────
  submitBtn: {
    marginHorizontal: Spacing.three, marginTop: Spacing.three,
    borderRadius: R, overflow: 'hidden',
  },
  submitInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Success ────────────────────────────────────────────────────────────────
  successRoot: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.five, gap: Spacing.three,
  },
  successIcon: {
    width: 88, height: 88, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: LABEL, textAlign: 'center' },
  successSub: { fontSize: 14, color: SUB, textAlign: 'center', lineHeight: 22 },
  successCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: R,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    gap: 2,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  successRowLabel: { fontSize: 13, color: SUB, width: 62 },
  successRowVal: { flex: 1, fontSize: 13, fontWeight: '600', color: LABEL, textAlign: 'right' },
  doneBtn: {
    backgroundColor: PRIMARY, paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: R, marginTop: Spacing.one,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
