import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { sendNotifications } from '@/utils/notify';
import { Spacing } from '@/constants/theme';
import { ALL_GRADES, subjectsForGrade } from '@/constants/curriculum';
import { useClasses } from '@/context/classes-context';
import { useAuth } from '@/context/auth-context';

const PRIMARY = '#1565C0';
const PRIMARY_LIGHT = '#EFF6FF';
const BORDER = '#E2E8F0';
const LABEL = '#374151';
const PLACEHOLDER = '#9CA3AF';
const BG = '#F8FAFC';
const R = 8;

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}
function defaultSchedule() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d;
}

function Dropdown({ label, value, placeholder, options, onSelect, disabled }: {
  label: string; value: string; placeholder: string;
  options: string[]; onSelect: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.field}>
      <View style={s.sectionLabel}>
        <ThemedText style={s.sectionLabelText}>{label}</ThemedText>
      </View>
      <Pressable
        style={[s.dropTrigger, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}>
        <ThemedText style={[s.dropTriggerText, !value && { color: PLACEHOLDER }]}>
          {value || placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <ThemedText style={s.sheetTitle}>{label}</ThemedText>
            <ScrollView bounces={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.sheetOption, value === opt && s.sheetOptionActive]}
                  onPress={() => { onSelect(opt); setOpen(false); }}>
                  <ThemedText style={[s.sheetOptionText, value === opt && { color: PRIMARY, fontWeight: '700' }]}>
                    {opt}
                  </ThemedText>
                  {value === opt && <Ionicons name="checkmark" size={16} color={PRIMARY} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function CreateClassScreen() {
  const insets = useSafeAreaInsets();
  const { addClass } = useClasses();
  const { profile } = useAuth();

  const [title, setTitle]                   = useState('');
  const [grade, setGrade]                   = useState('');
  const [subject, setSubject]               = useState('');
  const [scheduledAt, setScheduledAt]       = useState<Date>(defaultSchedule);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving]                 = useState(false);
  // iOS spinner accumulates value without committing until Done
  const [iosTempDate, setIosTempDate]       = useState<Date>(defaultSchedule);

  function handleGradeSelect(g: string) { setGrade(g); setSubject(''); }

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (!selected) return;
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      const merged = new Date(selected);
      merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
      setScheduledAt(merged);
      setShowTimePicker(true);
    } else {
      setIosTempDate(selected);
    }
  }

  function onTimeChange(_: DateTimePickerEvent, selected?: Date) {
    if (!selected) return;
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      const merged = new Date(scheduledAt);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setScheduledAt(merged);
    } else {
      setIosTempDate(selected);
    }
  }

  function iosConfirmDate() {
    const merged = new Date(iosTempDate);
    merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
    setScheduledAt(merged);
    setShowDatePicker(false);
  }

  function iosConfirmTime() {
    const merged = new Date(scheduledAt);
    merged.setHours(iosTempDate.getHours(), iosTempDate.getMinutes(), 0, 0);
    setScheduledAt(merged);
    setShowTimePicker(false);
  }

  async function scheduleReminders(classTitle: string, subjectName: string, dt: Date) {
    try {
      const reminderAt = new Date(dt.getTime() - 15 * 60_000);
      if (reminderAt > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: `${classTitle} starts in 15 min`, body: `Get ready for ${subjectName}.`, sound: true },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminderAt },
        });
      }
      const morning = new Date(dt);
      morning.setHours(8, 0, 0, 0);
      if (morning > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: `Class today: ${classTitle}`, body: `${subjectName} at ${fmtTime(dt)}.`, sound: true },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: morning },
        });
      }
    } catch { /* non-fatal */ }
  }

  async function handleCreate() {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a class title.');
    if (!grade) return Alert.alert('Required', 'Please select a grade.');
    if (!subject) return Alert.alert('Required', 'Please select a subject.');
    if (scheduledAt <= new Date()) return Alert.alert('Invalid', 'Please choose a future date and time.');

    setSaving(true);
    await addClass({
      title: title.trim(),
      tutor: profile?.full_name ?? 'Tutor',
      grade, subject,
      scheduled_at: scheduledAt.toISOString(),
    });
    await scheduleReminders(title.trim(), subject, scheduledAt);

    // Notify learners + tutors
    const { data: profiles } = await supabase
      .from('profiles').select('id').in('role', ['learner', 'tutor']).eq('is_active', true);
    const ids = (profiles ?? []).map((p: { id: string }) => p.id);
    if (ids.length) {
      const when = scheduledAt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
      await sendNotifications(ids, 'New Class Scheduled', `${title.trim()} · Grade ${grade} ${subject} on ${when}.`, 'class_reminder');
    }

    setSaving(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#1565C0', '#0D47A1']} style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="videocam" size={26} color="#fff" />
          </View>
          <ThemedText style={s.headerTitle}>New Live Class</ThemedText>
          <ThemedText style={s.headerSub}>Learners will be notified when the class goes live</ThemedText>
        </LinearGradient>

        {/* Form */}
        <View style={s.form}>

          {/* Title */}
          <View style={s.field}>
            <ThemedText style={s.sectionLabelText}>Class Title</ThemedText>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Grade 12 Maths — Term 2 Revision"
              placeholderTextColor={PLACEHOLDER}
            />
          </View>

          {/* Grade */}
          <Dropdown
            label="Grade"
            value={grade}
            placeholder="Select grade…"
            options={ALL_GRADES}
            onSelect={handleGradeSelect}
          />

          {/* Subject */}
          <Dropdown
            label="Subject"
            value={subject}
            placeholder={grade ? 'Select subject…' : 'Select a grade first'}
            options={subjectsForGrade(grade)}
            onSelect={setSubject}
            disabled={!grade}
          />

          {/* Date & Time */}
          <View style={s.field}>
            <ThemedText style={s.sectionLabelText}>Date & Time</ThemedText>
            <View style={s.dtRow}>
              <Pressable style={s.dtBtn} onPress={() => { Haptics.selectionAsync(); setIosTempDate(scheduledAt); setShowDatePicker(true); }}>
                <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={s.dtLabel}>Date</ThemedText>
                  <ThemedText style={s.dtValue}>{fmtDate(scheduledAt)}</ThemedText>
                </View>
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
              </Pressable>
              <Pressable style={[s.dtBtn, s.dtBtnSm]} onPress={() => { Haptics.selectionAsync(); setIosTempDate(scheduledAt); setShowTimePicker(true); }}>
                <Ionicons name="time-outline" size={16} color={PRIMARY} />
                <View>
                  <ThemedText style={s.dtLabel}>Time</ThemedText>
                  <ThemedText style={s.dtValue}>{fmtTime(scheduledAt)}</ThemedText>
                </View>
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
              </Pressable>
            </View>
          </View>

          {/* Android: inline pickers */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker value={scheduledAt} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
          )}
          {Platform.OS === 'android' && showTimePicker && (
            <DateTimePicker value={scheduledAt} mode="time" display="default" onChange={onTimeChange} />
          )}

          {/* iOS: modal bottom sheet with Done */}
          {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
            <Modal visible transparent animationType="slide">
              <View style={s.pickerOverlay}>
                <View style={s.pickerSheet}>
                  <View style={s.pickerBar}>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowDatePicker(false); setShowTimePicker(false); }}>
                      <ThemedText style={s.pickerCancel}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); showDatePicker ? iosConfirmDate() : iosConfirmTime(); }}>
                      <ThemedText style={s.pickerDone}>Done</ThemedText>
                    </Pressable>
                  </View>
                  <View style={s.pickerWrap}>
                    <DateTimePicker
                      value={iosTempDate}
                      mode={showDatePicker ? 'date' : 'time'}
                      display="spinner"
                      minimumDate={showDatePicker ? new Date() : undefined}
                      onChange={showDatePicker ? onDateChange : onTimeChange}
                      textColor="#111827"
                      style={s.pickerControl}
                    />
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Reminder note */}
          <View style={s.note}>
            <Ionicons name="notifications-outline" size={14} color="#0891B2" />
            <ThemedText style={s.noteText}>
              Reminders will be sent 15 min before and at 8 AM on the day of class.
            </ThemedText>
          </View>

          {/* CTA */}
          <Pressable style={[s.cta, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
            <LinearGradient colors={['#1565C0', '#0D47A1']} style={s.ctaInner}>
              <Ionicons name={saving ? 'hourglass-outline' : 'checkmark-circle-outline'} size={20} color="#fff" />
              <ThemedText style={s.ctaText}>{saving ? 'Creating…' : 'Create Class'}</ThemedText>
            </LinearGradient>
          </Pressable>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: 0 },

  header: {
    borderRadius: R, padding: Spacing.four,
    alignItems: 'center', gap: 6, marginBottom: Spacing.three,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: R,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  form: {
    backgroundColor: '#fff', borderRadius: R,
    padding: Spacing.four, gap: Spacing.three,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  field: { gap: 8 },
  sectionLabelText: { fontSize: 13, fontWeight: '700', color: LABEL },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: R,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },

  dropTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: BORDER, borderRadius: R,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FAFAFA',
  },
  dropTriggerText: { fontSize: 15, color: '#111827' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: R, borderTopRightRadius: R,
    paddingTop: Spacing.three, paddingBottom: Spacing.five, maxHeight: '60%',
  },
  sheetTitle: {
    fontSize: 14, fontWeight: '700', color: LABEL,
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4,
  },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  sheetOptionActive: { backgroundColor: PRIMARY_LIGHT },
  sheetOptionText: { fontSize: 15, color: '#111827' },

  dtRow: { flexDirection: 'row', gap: Spacing.two },
  dtBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: PRIMARY_LIGHT, borderRadius: R,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1.5, borderColor: PRIMARY + '30',
  },
  dtBtnSm: { flex: 0, minWidth: 120 },
  dtLabel: { fontSize: 10, fontWeight: '700', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.5 },
  dtValue: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 1 },

  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F0F9FF', borderRadius: R, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#0891B2',
  },
  noteText: { flex: 1, fontSize: 12, color: '#0E7490', lineHeight: 18 },

  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 24 },
  pickerSheet: { backgroundColor: '#fff', borderRadius: 16, paddingBottom: 16, width: '100%' },
  pickerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerCancel: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  pickerDone: { fontSize: 15, color: PRIMARY, fontWeight: '700' },
  pickerWrap: { height: 216, overflow: 'hidden', alignItems: 'center' },
  pickerControl: { height: 216 },

  cta: { borderRadius: R, overflow: 'hidden', marginTop: Spacing.one },
  ctaInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
